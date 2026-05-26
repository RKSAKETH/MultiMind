import { Suspense } from "react";
// import DebatePageClient from "./DebateClient";

export const metadata = {
  title: "Debate — MultiMind",
  description: "Watch four AI agents analyze your problem simultaneously in real time.",
};

export default function DebatePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#080b12] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
            <p className="text-gray-600 text-sm">Loading...</p>
          </div>
        </div>
      }
    >
      {/* <DebatePageClient /> */}
    </Suspense>
  );
}
