import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, sessions, agentTurns, syntheses } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

/**
 * Lazily ensures a user row exists in the DB for the current Clerk user.
 * Returns the DB user id (uuid).
 */
async function ensureUser(): Promise<string> {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Unauthorized");

  // Check if user already exists
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  // Lazy-create user row
  const clerkUser = await currentUser();
  const email =
    clerkUser?.emailAddresses?.[0]?.emailAddress ?? `${clerkId}@unknown.com`;

  const inserted = await db
    .insert(users)
    .values({ clerkId, email })
    .returning({ id: users.id });

  return inserted[0].id;
}

// GET /api/sessions — list all sessions for the authenticated user
export async function GET() {
  try {
    const userId = await ensureUser();

    const userSessions = await db
      .select({
        id: sessions.id,
        problem: sessions.problem,
        createdAt: sessions.createdAt,
      })
      .from(sessions)
      .where(eq(sessions.userId, userId))
      .orderBy(desc(sessions.createdAt))
      .limit(50);

    return NextResponse.json({ sessions: userSessions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[API /sessions GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/sessions — create a new session, return sessionId
export async function POST(req: Request) {
  try {
    const userId = await ensureUser();
    const { problem } = await req.json();

    if (!problem || typeof problem !== "string" || problem.trim().length === 0) {
      return NextResponse.json({ error: "problem is required" }, { status: 400 });
    }

    const inserted = await db
      .insert(sessions)
      .values({ userId, problem: problem.trim() })
      .returning({ id: sessions.id });

    return NextResponse.json({ sessionId: inserted[0].id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[API /sessions POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
