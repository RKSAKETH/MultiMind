import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, sessions, agentTurns, syntheses } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// POST /api/sessions/[id]/save — save agent turns and synthesis after debate
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

    // Verify session belongs to this user
    const dbUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);

    if (!dbUser.length) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const session = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(eq(sessions.id, sessionId), eq(sessions.userId, dbUser[0].id))
      )
      .limit(1);

    if (!session.length) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const { agentOutputs, synthesisContent } = await req.json();

    // Upsert agent turns
    if (agentOutputs && typeof agentOutputs === "object") {
      const agentNames: Record<string, string> = {
        strategist: "Strategist",
        critic: "Critic",
        technical: "Technical Expert",
        creative: "Creative",
      };

      for (const [agentId, content] of Object.entries(agentOutputs)) {
        if (typeof content === "string" && content.trim()) {
          await db.insert(agentTurns).values({
            sessionId,
            agentId,
            agentName: agentNames[agentId] ?? agentId,
            content: content.trim(),
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
    console.error("[API /sessions/[id]/save POST]", err);
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

    const dbUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);

    if (!dbUser.length) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const session = await db
      .select()
      .from(sessions)
      .where(
        and(eq(sessions.id, sessionId), eq(sessions.userId, dbUser[0].id))
      )
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
