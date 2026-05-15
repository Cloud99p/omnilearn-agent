import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const repositories = pgTable("repositories", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id").notNull(),
  repoFullName: text("repo_full_name").notNull(),
  description: text("description"),
  isPrivate: boolean("is_private").notNull().default(false),
  isStarred: boolean("is_starred").notNull().default(false),
  language: text("language"),
  htmlUrl: text("html_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const insertRepositorySchema = createInsertSchema(repositories).omit({
  id: true,
  createdAt: true,
});
export type Repository = typeof repositories.$inferSelect;
export type InsertRepository = z.infer<typeof insertRepositorySchema>;
