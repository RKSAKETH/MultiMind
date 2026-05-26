import { Socket } from "socket.io";
import { AGENTS, AGENT_ORDER, SYNTHESIS_SYSTEM_PROMPT, AgentId } from "./agents";
import { streamAgentResponse, streamSynthesis } from "./gemini";
import { generateEmbedding } from "./embeddings";
import { queryNamespace, upsertToNamespace } from "./pinecone";

export interface DebateParams {
  problem: string;
  userId: string;
  sessionId: string;
}

export interface FollowUpParams {
  sessionId: string;
  question: string;
  targetAgent: AgentId | "all";
}

// In-memory store of conversation history per session (for Q&A)
// Key: sessionId, Value: plain-text debate history
const sessionHistories = new Map<string, string>();

/**
 * Build conversation history string from accumulated agent outputs.
 * Format: "User asked: X\n\nStrategist said: Y\n\nCritic said: Z..."
 */
function buildHistoryString(
  problem: string,
  agentOutputs: Record<string, string>
): string {
  let history = `User asked: ${problem}`;
  for (const agentId of AGENT_ORDER) {
    if (agentOutputs[agentId]) {
      const agent = AGENTS.find((a) => a.id === agentId)!;
      history += `\n\n${agent.name} said: ${agentOutputs[agentId]}`;
    }
  }
  return history;
}

/**
 * Build the prompt for a single agent including the debate history so far.
 */
function buildAgentPrompt(
  problem: string,
  agentName: string,
  historyLines: string,
  memoryContext: string
): string {
  let prompt = problem;

  if (historyLines) {
    prompt = `Here is the debate so far:\n${historyLines}\n\nNow give your response as the ${agentName}.`;
  }

  if (memoryContext) {
    prompt += `\n\nRelevant context from past debates:\n${memoryContext}`;
  }

  return prompt;
}

/**
 * Main orchestration function — sequential debate pipeline.
 * 1. Generate embedding for problem
 * 2. Query each agent's Pinecone namespace for memory context
 * 3. Run agents sequentially: Strategist → Critic → Technical → Creative
 *    Each agent receives the full debate history so far
 * 4. Run synthesis with full debate history
 * 5. Emit debate_done
 * 6. Upsert synthesis to Pinecone (non-blocking)
 * 7. Store conversation history in memory for Q&A follow-ups
 */
export async function runDebate(
  socket: Socket,
  params: DebateParams
): Promise<void> {
  const { problem, userId, sessionId } = params;

  console.log(`[Orchestrator] Starting sequential debate for session ${sessionId}`);

  // ─── Step 1: Generate embedding ───────────────────────────────────────────
  let problemEmbedding: number[] = [];
  try {
    problemEmbedding = await generateEmbedding(problem);
    console.log(`[Orchestrator] Generated embedding (dim=${problemEmbedding.length})`);
  } catch (err) {
    console.warn("[Orchestrator] Embedding failed, proceeding without memory:", err);
  }

  // ─── Step 2: Query Pinecone memory for each agent ─────────────────────────
  const memoryContexts: Record<AgentId, string> = {
    strategist: "",
    critic: "",
    technical: "",
    creative: "",
  };

  if (problemEmbedding.length > 0) {
    await Promise.allSettled(
      AGENTS.map(async (agent) => {
        const context = await queryNamespace(agent.id, problemEmbedding, 3);
        memoryContexts[agent.id] = context;
        if (context) {
          console.log(`[Orchestrator] Memory context found for ${agent.id}`);
        }
      })
    );
  }

  // ─── Step 3: Sequential agent debate ──────────────────────────────────────
  const agentOutputs: Record<string, string> = {};
  let historyLines = ""; // Grows after each agent responds

  for (const agentId of AGENT_ORDER) {
    const agent = AGENTS.find((a) => a.id === agentId)!;

    console.log(`[Orchestrator] Agent ${agentId} starting...`);

    // Build the prompt for this agent with debate context
    const prompt = buildAgentPrompt(
      problem,
      agent.name,
      historyLines,
      memoryContexts[agentId]
    );

    let fullText = "";

    try {
      fullText = await streamAgentResponse(
        agent.systemPrompt,
        prompt,
        "", // memory context already injected into prompt
        (token: string) => {
          socket.emit("agent_token", {
            agentId: agent.id,
            agentName: agent.name,
            token,
          });
        },
        () => {
          socket.emit("agent_done", {
            agentId: agent.id,
            agentName: agent.name,
            fullResponse: fullText,
          });
          console.log(`[Orchestrator] Agent ${agentId} finished`);
        }
      );

      agentOutputs[agentId] = fullText;

      // Append this agent's response to the running history
      historyLines += (historyLines ? "\n\n" : "") + `${agent.name} said: ${fullText}`;
    } catch (err) {
      console.error(`[Orchestrator] Agent ${agentId} failed:`, err);
      socket.emit("agent_done", { agentId, agentName: agent.name, error: true, fullResponse: "" });
      agentOutputs[agentId] = "(Agent failed to respond)";
      historyLines += (historyLines ? "\n\n" : "") + `${agent.name} said: (failed to respond)`;
    }
  }

  // ─── Step 4: Run synthesis stream ─────────────────────────────────────────
  console.log("[Orchestrator] Starting synthesis...");
  let synthesisText = "";
  const fullHistory = `User asked: ${problem}\n\n${historyLines}`;

  try {
    synthesisText = await streamSynthesis(
      SYNTHESIS_SYSTEM_PROMPT,
      problem,
      agentOutputs,
      (token: string) => {
        socket.emit("synthesis_token", { token });
      },
      () => {
        console.log("[Orchestrator] Synthesis complete");
      }
    );
  } catch (err) {
    console.error("[Orchestrator] Synthesis failed:", err);
    socket.emit("synthesis_token", {
      token: "Synthesis failed. Please review the individual agent responses above.",
    });
  }

  // ─── Step 5: Emit debate_done ──────────────────────────────────────────────
  socket.emit("debate_done", {});
  console.log(`[Orchestrator] Debate complete for session ${sessionId}`);

  // ─── Step 6: Store history for Q&A follow-ups ─────────────────────────────
  const historyWithSynthesis =
    fullHistory +
    (synthesisText ? `\n\nSynthesis/Final Verdict: ${synthesisText}` : "");
  sessionHistories.set(sessionId, historyWithSynthesis);
  console.log(`[Orchestrator] Stored conversation history for session ${sessionId}`);

  // ─── Step 7: Upsert synthesis to Pinecone (non-blocking) ─────────────────
  if (problemEmbedding.length > 0 && synthesisText) {
    const upsertId = `session-${sessionId}-${Date.now()}`;
    const upsertText = `Problem: ${problem}\n\nSynthesis: ${synthesisText}`;

    Promise.allSettled(
      AGENTS.map((agent) =>
        upsertToNamespace(agent.id, problemEmbedding, upsertText, upsertId)
      )
    ).then((upsertResults) => {
      const failed = upsertResults.filter((r) => r.status === "rejected").length;
      console.log(
        `[Orchestrator] Upserted to Pinecone (${AGENTS.length - failed}/${AGENTS.length} namespaces succeeded)`
      );
    });
  }
}

/**
 * Handle a follow-up Q&A question after the debate is complete.
 * If targetAgent === "all", run all agents sequentially.
 * If a specific agent, run just that agent.
 */
export async function runFollowUp(
  socket: Socket,
  params: FollowUpParams
): Promise<void> {
  const { sessionId, question, targetAgent } = params;

  const history = sessionHistories.get(sessionId) ?? "";
  const followUpPrompt = history
    ? `Here is the debate so far:\n${history}\n\nThe user has a follow-up question: ${question}\n\nRespond to this follow-up question.`
    : question;

  const agentsToRun =
    targetAgent === "all"
      ? AGENTS.filter((a) => AGENT_ORDER.includes(a.id))
      : AGENTS.filter((a) => a.id === targetAgent);

  for (const agent of agentsToRun) {
    console.log(`[FollowUp] Agent ${agent.id} responding to follow-up...`);

    let fullText = "";
    try {
      fullText = await streamAgentResponse(
        agent.systemPrompt,
        followUpPrompt,
        "",
        (token: string) => {
          socket.emit("followup_token", {
            agentId: agent.id,
            agentName: agent.name,
            token,
          });
        },
        () => {
          console.log(`[FollowUp] Agent ${agent.id} done`);
        }
      );

      // Append follow-up exchange to history
      const updatedHistory = sessionHistories.get(sessionId) ?? "";
      sessionHistories.set(
        sessionId,
        updatedHistory +
          `\n\nUser follow-up: ${question}\n\n${agent.name} replied: ${fullText}`
      );
    } catch (err) {
      console.error(`[FollowUp] Agent ${agent.id} failed:`, err);
      socket.emit("followup_token", {
        agentId: agent.id,
        agentName: agent.name,
        token: "(Agent failed to respond to follow-up)",
      });
    }
  }

  socket.emit("followup_done", {});
  console.log(`[FollowUp] Follow-up complete for session ${sessionId}`);
}
