import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, sessions, agentTurns, syntheses } from "@/db/schema";
import { eq, and } from "drizzle-orm";

const AGENT_NAMES: Record<string, string> = {
  strategist: "Strategist",
  critic: "Critic",
  technical: "Technical Expert",
  creative: "Creative",
};

async function getAuthenticatedUser(clerkId: string) {
  const dbUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  return dbUser[0] ?? null;
}

async function verifySession(sessionId: string, userId: string) {
  const session = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .limit(1);
  return session[0] ?? null;
}

// POST /api/sessions/[id] — save initial debate agent turns and synthesis
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: sessionId } = await params;

    const dbUser = await getAuthenticatedUser(clerkId);
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const session = await verifySession(sessionId, dbUser.id);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const { agentOutputs, synthesisContent } = await req.json();

    // Insert debate agent turns
    if (agentOutputs && typeof agentOutputs === "object") {
      for (const [agentId, content] of Object.entries(agentOutputs)) {
        if (typeof content === "string" && content.trim()) {
          await db.insert(agentTurns).values({
            sessionId,
            agentId,
            agentName: AGENT_NAMES[agentId] ?? agentId,
            content: content.trim(),
            turnType: "debate",
          });
        }
      }
    }

    // Upsert synthesis
    if (synthesisContent && typeof synthesisContent === "string") {
      await db
        .insert(syntheses)
        .values({ sessionId, content: synthesisContent.trim() })
        .onConflictDoUpdate({
          target: syntheses.sessionId,
          set: { content: synthesisContent.trim() },
        });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[API /sessions/[id] POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/sessions/[id] — save follow-up Q&A turns
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: sessionId } = await params;

    const dbUser = await getAuthenticatedUser(clerkId);
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const session = await verifySession(sessionId, dbUser.id);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // followupTurns: { agentId: string; agentName: string; content: string }[]
    const { followupTurns } = await req.json();

    if (!Array.isArray(followupTurns)) {
      return NextResponse.json({ error: "followupTurns must be an array" }, { status: 400 });
    }

    for (const turn of followupTurns) {
      if (turn.agentId && turn.content?.trim()) {
        await db.insert(agentTurns).values({
          sessionId,
          agentId: turn.agentId,
          agentName: turn.agentName ?? AGENT_NAMES[turn.agentId] ?? turn.agentId,
          content: turn.content.trim(),
          turnType: "followup",
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[API /sessions/[id] PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/sessions/[id] — get session with all agent turns and synthesis
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: sessionId } = await params;

    const dbUser = await getAuthenticatedUser(clerkId);
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const session = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, dbUser.id)))
      .limit(1);

    if (!session.length) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const turns = await db
      .select()
      .from(agentTurns)
      .where(eq(agentTurns.sessionId, sessionId));

    const synthesis = await db
      .select()
      .from(syntheses)
      .where(eq(syntheses.sessionId, sessionId))
      .limit(1);

    return NextResponse.json({
      session: session[0],
      agentTurns: turns,
      synthesis: synthesis[0] ?? null,
    });
  } catch (err) {
    console.error("[API /sessions/[id] GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
