import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { db } from "@/lib/db";
import { users, sessions, syntheses } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { AGENT_ORDER, AGENT_CONFIG } from "@/lib/agents";

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getUserSessionsWithSynthesis(clerkId: string) {
  try {
    const user = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);

    if (!user.length) return [];

    // Fetch sessions
    const userSessions = await db
      .select({
        id: sessions.id,
        problem: sessions.problem,
        createdAt: sessions.createdAt,
      })
      .from(sessions)
      .where(eq(sessions.userId, user[0].id))
      .orderBy(desc(sessions.createdAt))
      .limit(20);

    if (!userSessions.length) return [];

    // Fetch syntheses for all these sessions in one query
    const sessionIds = userSessions.map((s) => s.id);
    const synthesisList = await db
      .select({ sessionId: syntheses.sessionId, content: syntheses.content })
      .from(syntheses)
      .where(
        // Use `inArray` workaround via a simple loop since drizzle ORM handles it
        eq(syntheses.sessionId, sessionIds[0])
      );

    // Build lookup map
    const synthesisMap: Record<string, string> = {};
    for (const s of synthesisList) {
      synthesisMap[s.sessionId] = s.content;
    }

    // Fetch all syntheses more broadly (iterate for simplicity)
    const allSyntheses = await Promise.all(
      userSessions.slice(0, 20).map(async (session) => {
        try {
          const result = await db
            .select({ content: syntheses.content })
            .from(syntheses)
            .where(eq(syntheses.sessionId, session.id))
            .limit(1);
          return { sessionId: session.id, content: result[0]?.content ?? "" };
        } catch {
          return { sessionId: session.id, content: "" };
        }
      })
    );

    const synthMap: Record<string, string> = {};
    for (const s of allSyntheses) synthMap[s.sessionId] = s.content;

    return userSessions.map((session) => ({
      ...session,
      synthesisPreview: getFirstSentence(synthMap[session.id] ?? ""),
    }));
  } catch {
    return [];
  }
}

function getFirstSentence(text: string): string {
  if (!text) return "";
  const match = text.match(/[^.!?]+[.!?]+/);
  return match ? match[0].trim() : text.slice(0, 100);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/");

  const pastSessions = await getUserSessionsWithSynthesis(clerkId);

  return (
    <div className="min-h-screen bg-[#080b12]">
      <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 bg-[#080b12]/80 backdrop-blur-sm sticky top-0">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-sm font-bold text-white">M</span>
            </div>
            <span className="font-bold text-white text-lg">MultiMind</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              id="new-debate-header-btn"
              href="/debate"
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-sm font-semibold transition-all duration-200 hover:scale-105"
            >
              + New Debate
            </Link>
            <UserButton />
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-10">
        {/* Welcome section */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white mb-1">Your Debates</h1>
          <p className="text-gray-500 text-sm">All your past multi-agent debates</p>
        </div>

        {/* New debate CTA */}
        <Link
          id="new-debate-cta-card"
          href="/debate"
          className="group block mb-10 p-5 rounded-2xl border border-dashed border-white/10 hover:border-blue-500/40 bg-white/[0.02] hover:bg-blue-500/5 transition-all duration-300"
        >
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-xl group-hover:scale-110 transition-transform duration-300">
              🧠
            </div>
            <div>
              <div className="text-white font-semibold mb-0.5 group-hover:text-blue-300 transition-colors text-sm">
                Start a new debate
              </div>
              <div className="text-gray-600 text-xs">
                Four agents. One answer. Real-time.
              </div>
            </div>
            <div className="ml-auto text-gray-600 group-hover:text-blue-400 group-hover:translate-x-1 transition-all duration-300 text-lg">
              →
            </div>
          </div>
        </Link>

        {/* Sessions */}
        {pastSessions.length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            <div className="text-5xl mb-4">💬</div>
            <p className="text-lg font-medium text-gray-500 mb-2">No debates yet</p>
            <p className="text-sm">Start your first debate above!</p>
          </div>
        ) : (
          <div>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">
              Recent Sessions
            </h2>
            {/* Card grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pastSessions.map((session, index) => (
                <Link
                  key={session.id}
                  id={`session-card-${index}`}
                  href={`/debate?sessionId=${session.id}`}
                  className="
                    group flex flex-col gap-3 p-5 rounded-2xl
                    border border-white/5 hover:border-white/12
                    bg-white/[0.02] hover:bg-white/[0.04]
                    transition-all duration-200
                    hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30
                  "
                >
                  {/* Problem title */}
                  <p className="text-gray-200 text-sm font-medium leading-snug line-clamp-2 group-hover:text-white transition-colors">
                    {session.problem}
                  </p>

                  {/* Agent identity dots */}
                  <div className="flex items-center gap-2">
                    {AGENT_ORDER.map((id) => {
                      const cfg = AGENT_CONFIG[id];
                      return (
                        <div
                          key={id}
                          title={cfg.name}
                          className={`
                            w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0
                            ${cfg.tw.bg} border border-white/10
                          `}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className={`w-2.5 h-2.5 ${cfg.tw.text} fill-current`}
                            aria-hidden="true"
                          >
                            <path d={cfg.icon} />
                          </svg>
                        </div>
                      );
                    })}
                    <span className="text-xs text-gray-700 ml-auto">
                      {formatDate(session.createdAt)}
                    </span>
                  </div>

                  {/* Synthesis preview */}
                  {session.synthesisPreview ? (
                    <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed border-t border-white/5 pt-2">
                      {session.synthesisPreview}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-700 italic border-t border-white/5 pt-2">
                      No verdict yet
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
