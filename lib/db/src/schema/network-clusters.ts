/**
 * Network Clusters Schema
 * Persistent storage for 7-tier mesh network clusters
 */

import {
  pgTable,
  text,
  integer,
  doublePrecision,
  timestamp,
  jsonb,
  bigint,
  serial,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { networkGhostNodes } from "./ghost-nodes.js";

export const networkClusters = pgTable("network_clusters", {
  id: text("id").primaryKey(),
  tier: integer("tier").notNull(),
  name: text("name").notNull(),
  locationLat: doublePrecision("location_lat").notNull(),
  locationLng: doublePrecision("location_lng").notNull(),
  radiusKm: doublePrecision("radius_km").notNull(),
  parentId: text("parent_id").references(() => networkClusters.id),
  childIds: text("child_ids").array().default([]),
  nodeIds: text("node_ids").array().default([]),
  totalNodes: integer("total_nodes").default(0),
  onlineNodes: integer("online_nodes").default(0),
  capacity: integer("capacity").default(0),
  load: integer("load").default(0),
  knowledgeIndex: jsonb("knowledge_index").default([]),
  lastSync: timestamp("last_sync", { withTimezone: true }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const networkClustersRelations = relations(
  networkClusters,
  ({ many, one }) => ({
    parent: one(networkClusters, {
      fields: [networkClusters.parentId],
      references: [networkClusters.id],
      relationName: "clusterHierarchy",
    }),
    children: many(networkClusters, { relationName: "clusterHierarchy" }),
    nodes: many(networkGhostNodes),
  }),
);

export const networkRoutingTables = pgTable("network_routing_tables", {
  clusterId: text("cluster_id")
    .primaryKey()
    .references(() => networkClusters.id),
  routes: jsonb("routes").notNull().default({}),
  latencyMap: jsonb("latency_map").notNull().default({}),
  lastUpdated: timestamp("last_updated", { withTimezone: true }).defaultNow(),
});

export const networkHeartbeats = pgTable("network_heartbeats", {
  id: serial("id").primaryKey(),
  nodeId: text("node_id")
    .notNull()
    .references(() => networkGhostNodes.id),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
  status: text("status").notNull(),
  load: integer("load"),
  latencyMs: integer("latency_ms"),
});
