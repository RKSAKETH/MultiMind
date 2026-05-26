import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  }
  return genAI;
}

const SAFETY_SETTINGS = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

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
  const model = getGenAI().getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: systemPrompt,
    safetySettings: SAFETY_SETTINGS,
  });

  const prompt = memoryContext
    ? `${userProblem}\n${memoryContext}`
    : userProblem;

  const result = await model.generateContentStream(prompt);

  let fullText = "";

  for await (const chunk of result.stream) {
    const text = chunk.text();
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
  const model = getGenAI().getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: systemPrompt,
    safetySettings: SAFETY_SETTINGS,
  });

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

  const result = await model.generateContentStream(synthesisPrompt);

  let fullText = "";

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) {
      fullText += text;
      onToken(text);
    }
  }

  onDone();
  return fullText;
}
