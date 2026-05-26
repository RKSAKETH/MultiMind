import { SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

export default async function HomePage() {
  const { userId } = await auth();

  if (userId) {
    redirect("/dashboard");
  }

  return (
    <main className="relative min-h-screen bg-[#080b12] overflow-hidden flex flex-col">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-grid opacity-50" />
      <div className="glow-orb w-[600px] h-[600px] bg-blue-600 -top-40 -left-40" />
      <div className="glow-orb w-[500px] h-[500px] bg-purple-600 top-1/2 -right-60" />
      <div className="glow-orb w-[400px] h-[400px] bg-emerald-600 bottom-0 left-1/2" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <span className="text-sm font-bold text-white">M</span>
          </div>
          <span className="font-bold text-white text-lg tracking-tight">MultiMind</span>
        </div>
        {/* Show UserButton for signed-in users, sign-in for signed-out */}
        <UserButton />
        <SignInButton mode="modal">
          <button
            id="sign-in-nav-btn"
            className="px-5 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium text-white transition-all duration-200"
          >
            Sign In
          </button>
        </SignInButton>
      </nav>

      {/* Hero */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-medium mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          Powered by Google Gemini 1.5 Flash
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 max-w-4xl">
          <span className="text-white">Four minds.</span>
          <br />
          <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">
            One answer.
          </span>
        </h1>

        <p className="text-gray-400 text-lg sm:text-xl max-w-2xl mb-10 leading-relaxed">
          MultiMind deploys four specialized AI agents — a Strategist, Critic, Technical
          Expert, and Creative — simultaneously analyzing your problem in real time, then
          synthesizing their insights into one comprehensive answer.
        </p>

        {/* CTA */}
        <SignInButton mode="modal">
          <button
            id="hero-get-started-btn"
            className="group px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-lg transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-105"
          >
            Get Started Free
            <span className="ml-2 group-hover:translate-x-1 inline-block transition-transform duration-200">→</span>
          </button>
        </SignInButton>

        {/* Agent preview cards */}
        <div className="mt-20 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl w-full">
          {[
            { name: "Strategist", color: "blue", icon: "🎯", desc: "Frameworks & long-term planning" },
            { name: "Critic", color: "red", icon: "⚔️", desc: "Risks & blind spots" },
            { name: "Technical", color: "green", icon: "⚙️", desc: "Engineering tradeoffs" },
            { name: "Creative", color: "purple", icon: "✨", desc: "Lateral thinking" },
          ].map((agent) => (
            <div
              key={agent.name}
              className="glass-card rounded-xl p-4 text-center hover:border-white/10 transition-all duration-300 hover:-translate-y-1"
            >
              <div className="text-2xl mb-2">{agent.icon}</div>
              <div className="text-sm font-semibold text-white mb-1">{agent.name}</div>
              <div className="text-xs text-gray-500">{agent.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
