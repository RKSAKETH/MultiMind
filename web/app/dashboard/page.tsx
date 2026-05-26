import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { db } from "@/lib/db";
import { users, sessions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

async function getUserSessions(clerkId: string) {
  try {
    const user = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);

    if (!user.length) return [];

    return await db
      .select({
        id: sessions.id,
        problem: sessions.problem,
        createdAt: sessions.createdAt,
      })
      .from(sessions)
      .where(eq(sessions.userId, user[0].id))
      .orderBy(desc(sessions.createdAt))
      .limit(20);
  } catch {
    return [];
  }
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export default async function DashboardPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/");

  const pastSessions = await getUserSessions(clerkId);

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
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-sm font-medium transition-all duration-200 hover:scale-105"
            >
              + New Debate
            </Link>
            <UserButton />
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        {/* Welcome section */}
        <div className="mb-12">
          <h1 className="text-3xl font-bold text-white mb-2">Your Debates</h1>
          <p className="text-gray-500">All your past multi-agent debate sessions</p>
        </div>

        {/* New debate CTA */}
        <Link
          id="new-debate-cta-card"
          href="/debate"
          className="group block mb-8 p-6 rounded-2xl border border-dashed border-white/10 hover:border-blue-500/40 bg-white/[0.02] hover:bg-blue-500/5 transition-all duration-300"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform duration-300">
              🧠
            </div>
            <div>
              <div className="text-white font-semibold mb-1 group-hover:text-blue-300 transition-colors">
                Start a new debate
              </div>
              <div className="text-gray-500 text-sm">
                Submit a problem and watch four agents analyze it simultaneously
              </div>
            </div>
            <div className="ml-auto text-gray-600 group-hover:text-blue-400 group-hover:translate-x-1 transition-all duration-300 text-xl">
              →
            </div>
          </div>
        </Link>

        {/* Sessions list */}
        {pastSessions.length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            <div className="text-4xl mb-4">💬</div>
            <p className="text-lg font-medium text-gray-500 mb-2">No debates yet</p>
            <p className="text-sm">Start your first debate above to see it here.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
              Recent Sessions
            </h2>
            {pastSessions.map((session, index) => (
              <Link
                key={session.id}
                id={`session-link-${index}`}
                href={`/debate?sessionId=${session.id}`}
                className="group flex items-start gap-4 p-5 rounded-xl border border-white/5 hover:border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-200"
              >
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-gray-700 to-gray-800 border border-white/10 flex items-center justify-center flex-shrink-0 text-sm">
                  🔍
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-200 text-sm font-medium truncate group-hover:text-white transition-colors">
                    {session.problem}
                  </p>
                  <p className="text-gray-600 text-xs mt-1">
                    {formatDate(session.createdAt)}
                  </p>
                </div>
                <div className="text-gray-700 group-hover:text-gray-400 group-hover:translate-x-0.5 transition-all duration-200 flex-shrink-0">
                  →
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
