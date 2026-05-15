import {
  pgTable,
  serial,
  text,
  integer,
  real,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";

export const ghostInviteTokens = pgTable("ghost_invite_tokens", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  label: text("label").notNull().default(""),
  maxUses: integer("max_uses").notNull().default(100),
  usesCount: integer("uses_count").notNull().default(0),
  active: boolean("active").notNull().default(true),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const ghostWorkerSessions = pgTable("ghost_worker_sessions", {
  id: serial("id").primaryKey(),
  workerId: text("worker_id").notNull().unique(),
  workerSecret: text("worker_secret").notNull(),
  name: text("name").notNull(),
  inviteToken: text("invite_token"),
  status: text("status").notNull().default("idle"),
  lastSeen: timestamp("last_seen", { withTimezone: true })
    .defaultNow()
    .notNull(),
  tasksProcessed: integer("tasks_processed").notNull().default(0),
  tasksFailed: integer("tasks_failed").notNull().default(0),
  avgResponseMs: real("avg_response_ms"),
  connectedAt: timestamp("connected_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const ghostWorkerTasks = pgTable("ghost_worker_tasks", {
  id: serial("id").primaryKey(),
  taskId: text("task_id").notNull().unique(),
  status: text("status").notNull().default("pending"),
  payload: text("payload").notNull(),
  workerId: text("worker_id"),
  result: text("result"),
  assignedAt: timestamp("assigned_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  timeoutAt: timestamp("timeout_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type GhostInviteToken = typeof ghostInviteTokens.$inferSelect;
export type GhostWorkerSession = typeof ghostWorkerSessions.$inferSelect;
export type GhostWorkerTask = typeof ghostWorkerTasks.$inferSelect;
