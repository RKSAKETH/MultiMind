import dotenv from "dotenv";
dotenv.config({ override: true });
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { runDebate, runFollowUp } from "./orchestrator";

const PORT = parseInt(process.env.PORT || "4000", 10);

// Print masked Gemini API key to help user verify the loaded value
const apiKey = process.env.GEMINI_API_KEY || "";
const maskedKey = apiKey ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}` : "NOT FOUND";
console.log(`[Startup] Loaded Gemini API Key: ${maskedKey}`);

// ─── Express + HTTP Server ─────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const httpServer = createServer(app);

// ─── Socket.io ─────────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: process.env.WEB_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: 120000,
  pingInterval: 25000,
});

io.on("connection", (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  socket.on(
    "start_debate",
    async (data: { problem: string; userId: string; sessionId: string }) => {
      const { problem, userId, sessionId } = data;

      if (!problem || !userId || !sessionId) {
        socket.emit("error", { message: "Missing required fields: problem, userId, sessionId" });
        return;
      }

      console.log(
        `[Socket] start_debate received — session=${sessionId}, user=${userId}, problem="${problem.slice(0, 60)}..."`
      );

      try {
        await runDebate(socket, { problem, userId, sessionId });
      } catch (err) {
        console.error("[Socket] Unhandled error in runDebate:", err);
        socket.emit("error", {
          message: "An unexpected error occurred during the debate.",
        });
      }
    }
  );

  socket.on(
    "followup_question",
    async (data: { sessionId: string; question: string; targetAgent: string }) => {
      const { sessionId, question, targetAgent } = data;

      if (!sessionId || !question || !targetAgent) {
        socket.emit("error", { message: "Missing required fields: sessionId, question, targetAgent" });
        return;
      }

      console.log(
        `[Socket] followup_question received — session=${sessionId}, target=${targetAgent}, question="${question.slice(0, 60)}"`
      );

      try {
        await runFollowUp(socket, { sessionId, question, targetAgent: targetAgent as any });
      } catch (err) {
        console.error("[Socket] Unhandled error in runFollowUp:", err);
        socket.emit("error", { message: "An unexpected error occurred during the follow-up." });
      }
    }
  );

  socket.on("disconnect", (reason) => {
    console.log(`[Socket] Client disconnected: ${socket.id} — reason: ${reason}`);
  });
});

// ─── Start Server ───────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`\n🧠 MultiMind WebSocket Server running on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   Waiting for debate connections...\n`);
});

export { io };
