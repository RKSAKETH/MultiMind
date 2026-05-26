import { GoogleGenAI } from "@google/genai";

let genAI: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI {
  if (!genAI) {
    genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  }
  return genAI;
}

const SAFETY_SETTINGS = [
  {
    category: "HARM_CATEGORY_HARASSMENT",
    threshold: "BLOCK_NONE",
  },
  {
    category: "HARM_CATEGORY_HATE_SPEECH",
    threshold: "BLOCK_NONE",
  },
  {
    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
    threshold: "BLOCK_NONE",
  },
  {
    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
    threshold: "BLOCK_NONE",
  },
] as any;

/**
 * Streams a Gemini response for a single agent.
 * Calls onToken for each chunk, onDone when complete.
 * Returns the full accumulated response text.
 */
export async function streamAgentResponse(
  systemPrompt: string,
  userProblem: string,
  memoryContext: string,
  onToken: (token: string) => void,
  onDone: () => void
): Promise<string> {
  const prompt = memoryContext
    ? `${userProblem}\n${memoryContext}`
    : userProblem;

  const result = await getGenAI().models.generateContentStream({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      systemInstruction: systemPrompt,
      safetySettings: SAFETY_SETTINGS,
    },
  });

  let fullText = "";

  for await (const chunk of result) {
    const text = chunk.text;
    if (text) {
      fullText += text;
      onToken(text);
    }
  }

  onDone();
  return fullText;
}

/**
 * Streams the synthesis response combining all four agent outputs.
 * Returns the full accumulated synthesis text.
 */
export async function streamSynthesis(
  systemPrompt: string,
  problem: string,
  agentOutputs: Record<string, string>,
  onToken: (token: string) => void,
  onDone: () => void
): Promise<string> {
  const synthesisPrompt = `
ORIGINAL PROBLEM:
${problem}

---

STRATEGIST ANALYSIS:
${agentOutputs["strategist"] || "(no output)"}

---

CRITIC ANALYSIS:
${agentOutputs["critic"] || "(no output)"}

---

TECHNICAL EXPERT ANALYSIS:
${agentOutputs["technical"] || "(no output)"}

---

CREATIVE ANALYSIS:
${agentOutputs["creative"] || "(no output)"}

---

Please synthesize these four analyses into a comprehensive final answer.
`.trim();

  const result = await getGenAI().models.generateContentStream({
    model: "gemini-1.5-flash",
    contents: synthesisPrompt,
    config: {
      systemInstruction: systemPrompt,
      safetySettings: SAFETY_SETTINGS,
    },
  });

  let fullText = "";

  for await (const chunk of result) {
    const text = chunk.text;
    if (text) {
      fullText += text;
      onToken(text);
    }
  }

  onDone();
  return fullText;
}

