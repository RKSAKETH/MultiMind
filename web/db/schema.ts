import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  problem: text("problem").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const agentTurns = pgTable("agent_turns", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  agentId: text("agent_id").notNull(),
  agentName: text("agent_name").notNull(),
  content: text("content").notNull(),
  turnType: text("turn_type").notNull().default("debate"), // "debate" | "followup"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const syntheses = pgTable("syntheses", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" })
    .unique(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type AgentTurn = typeof agentTurns.$inferSelect;
export type Synthesis = typeof syntheses.$inferSelect;
