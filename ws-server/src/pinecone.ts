import { Pinecone } from "@pinecone-database/pinecone";

let pc: Pinecone | null = null;

function getPineconeClient(): Pinecone {
  if (!pc) {
    pc = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });
  }
  return pc;
}

/**
 * Queries a specific agent's namespace in Pinecone for relevant past context.
 * Returns up to topK text snippets concatenated as a single string.
 */
export async function queryNamespace(
  agentId: string,
  vector: number[],
  topK: number = 3
): Promise<string> {
  try {
    const client = getPineconeClient();
    const index = client.index(process.env.PINECONE_INDEX_NAME!).namespace(agentId);

    const results = await index.query({
      vector,
      topK,
      includeMetadata: true,
    });

    if (!results.matches || results.matches.length === 0) {
      return "";
    }

    const snippets = results.matches
      .filter((m) => m.score && m.score > 0.5) // Only include relevant matches
      .map((m) => (m.metadata?.text as string) ?? "")
      .filter(Boolean);

    if (snippets.length === 0) return "";

    return `\n\n[Relevant past context for ${agentId}]:\n${snippets.join("\n---\n")}`;
  } catch (err) {
    // Non-fatal: if Pinecone fails, proceed without memory context
    console.warn(`[Pinecone] queryNamespace failed for ${agentId}:`, err);
    return "";
  }
}

/**
 * Upserts a vector + text metadata into a specific agent's namespace.
 * Used after synthesis to store session memory for future debates.
 */
export async function upsertToNamespace(
  agentId: string,
  vector: number[],
  text: string,
  id: string
): Promise<void> {
  try {
    const client = getPineconeClient();
    const index = client.index(process.env.PINECONE_INDEX_NAME!).namespace(agentId);

    await index.upsert([
      {
        id,
        values: vector,
        metadata: { text: text.slice(0, 2000) }, // Pinecone metadata limit
      },
    ]);
    console.log(`[Pinecone] Upserted to namespace '${agentId}' with id '${id}'`);
  } catch (err) {
    console.warn(`[Pinecone] upsertToNamespace failed for ${agentId}:`, err);
  }
}
