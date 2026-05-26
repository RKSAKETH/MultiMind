import { Socket } from "socket.io";
import { AGENTS, SYNTHESIS_SYSTEM_PROMPT, AgentId } from "./agents";
import { streamAgentResponse, streamSynthesis } from "./gemini";
import { generateEmbedding } from "./embeddings";
import { queryNamespace, upsertToNamespace } from "./pinecone";

export interface DebateParams {
  problem: string;
  userId: string;
  sessionId: string;
}

/**
 * Main orchestration function.
 * 1. Generate embedding for problem
 * 2. Query each agent's Pinecone namespace for memory context
 * 3. Fire all 4 Gemini streams in parallel via Promise.allSettled
 * 4. Collect outputs, then run synthesis stream
 * 5. Upsert synthesis to all 4 agent namespaces
 */
export async function runDebate(
  socket: Socket,
  params: DebateParams
): Promise<void> {
  const { problem, userId, sessionId } = params;

  console.log(`[Orchestrator] Starting debate for session ${sessionId}`);

  // ─── Step 1: Generate embedding for the problem ───────────────────────────
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

  // ─── Step 3: Fire all 4 agent streams in parallel ─────────────────────────
  const agentOutputs: Record<string, string> = {};

  const agentTasks = AGENTS.map((agent) => {
    return streamAgentResponse(
      agent.systemPrompt,
      problem,
      memoryContexts[agent.id],
      (token: string) => {
        socket.emit("agent_token", { agentId: agent.id, token });
      },
      () => {
        socket.emit("agent_done", { agentId: agent.id });
        console.log(`[Orchestrator] Agent ${agent.id} finished`);
      }
    ).then((fullText) => {
      agentOutputs[agent.id] = fullText;
    });
  });

  const results = await Promise.allSettled(agentTasks);

  // Log any agent failures
  results.forEach((result, i) => {
    if (result.status === "rejected") {
      const agentId = AGENTS[i].id;
      console.error(`[Orchestrator] Agent ${agentId} failed:`, result.reason);
      socket.emit("agent_done", { agentId, error: true });
      agentOutputs[agentId] = agentOutputs[agentId] || "(Agent failed to respond)";
    }
  });

  // ─── Step 4: Run synthesis stream ─────────────────────────────────────────
  console.log("[Orchestrator] Starting synthesis...");
  let synthesisText = "";

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
      token: "Synthesis failed due to an error. Please check the individual agent responses above.",
    });
  }

  // ─── Step 5: Emit debate_done ──────────────────────────────────────────────
  socket.emit("debate_done", {});
  console.log(`[Orchestrator] Debate complete for session ${sessionId}`);

  // ─── Step 6: Upsert synthesis to all agent namespaces (non-blocking) ───────
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
