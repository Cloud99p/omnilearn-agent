import { pgTable, text, timestamp, jsonb, integer, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
/**
 * Service registrations — the onboarding record for any external project
 * using the OmniLearn SDK. An API key is issued at registration; its SHA-256
 * hash is stored here (never the plaintext key).
 */
export const serviceRegistrations = pgTable("service_registrations", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull().unique(),
    version: text("version").notNull().default("1.0.0"),
    ownerEmail: text("owner_email").notNull(),
    description: text("description"),
    domain: text("domain").notNull().default("general"),
    knowledgeTypes: jsonb("knowledge_types").$type().notNull().default([]),
    rateLimit: integer("rate_limit").notNull().default(60),
    apiKeyPrefix: text("api_key_prefix").notNull(),
    apiKeyHash: text("api_key_hash").notNull(),
    status: text("status").notNull().default("active"), // active | pending | suspended
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
export const insertServiceRegistrationSchema = createInsertSchema(serviceRegistrations).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
