/**
 * WebSocket Server for Network Discovery
 * Real-time node discovery and cluster communication
 * SECURED: Clerk authentication required for node registration
 */

import { WebSocketServer, WebSocket } from "ws";
import { EventEmitter } from "events";
import { logger } from "./logger.js";
import crypto from "crypto";
import { createClerkClient } from "@clerk/backend";

const GHOST_SECRET = process.env.GHOST_SECRET || "insecure-dev-secret-change-in-production";
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

// Initialize Clerk client
const clerkClient = CLERK_SECRET_KEY ? createClerkClient({ secretKey: CLERK_SECRET_KEY }) : null;

export interface DiscoveryMessage {
  type: "hello" | "heartbeat" | "goodbye" | "cluster-update" | "query" | "response";
  fromNodeId: string;
  timestamp: Date;
  location?: { lat: number; lng: number };
  capacity?: number;
  data?: any;
  token?: string; // Authentication token
  clerkToken?: string; // Clerk JWT for authentication
}

export class DiscoveryServer extends EventEmitter {
  private wss: WebSocketServer;
  private clients: Map<string, WebSocket> = new Map();
  private authenticatedNodes: Map<string, { clerkId: string; authenticatedAt: Date }> = new Map();
  private port: number;

  constructor(port: number = 8765) {
    super();
    this.port = port;
    this.wss = new WebSocketServer({ port });
    this.setupHandlers();
    
    logger.info({ port }, "WebSocket discovery server starting...");
    
    // Warn if using insecure secret
    if (GHOST_SECRET === "insecure-dev-secret-change-in-production") {
      logger.warn(
        "SECURITY WARNING: GHOST_SECRET not set! Using insecure default. Set GHOST_SECRET env var in production."
      );
    }
    
    if (!CLERK_SECRET_KEY) {
      logger.warn(
        "SECURITY WARNING: CLERK_SECRET_KEY not set! WebSocket auth will fail in production."
      );
    }
  }

  /**
   * Verify Clerk JWT token
   */
  private async verifyClerkToken(clerkToken: string): Promise<{ valid: boolean; clerkId?: string; error?: string }> {
    try {
      if (!CLERK_SECRET_KEY || !clerkClient) {
        return { valid: false, error: "CLERK_SECRET_KEY not configured" };
      }

      // Remove "Bearer " prefix if present
      const token = clerkToken.startsWith("Bearer ") ? clerkToken.slice(7) : clerkToken;

      // Verify JWT using Clerk client
      const payload = await clerkClient.verifyToken(token);

      if (!payload || !payload.sub) {
        return { valid: false, error: "Invalid JWT payload" };
      }

      return { valid: true, clerkId: payload.sub };
    } catch (err) {
      logger.error({ err }, "Clerk token verification failed");
      return { valid: false, error: err instanceof Error ? err.message : "JWT verification failed" };
    }
  }

  private setupHandlers(): void {
    this.wss.on("connection", (ws, req) => {
      const nodeId = req.url?.split("?")[1].split("=")[1] || "unknown";
      logger.info({ nodeId }, "New WebSocket connection");

      // Wait for authentication message
      let authenticated = false;
      let clerkId: string | null = null;

      ws.on("message", async (data) => {
        try {
          const message: DiscoveryMessage = JSON.parse(data.toString());

          // First message must be hello with Clerk token for authentication
          if (!authenticated && message.type === "hello") {
            if (!message.clerkToken) {
              logger.warn({ nodeId }, "Connection rejected: no Clerk token");
              ws.send(JSON.stringify({
                type: "error",
                fromNodeId: "server",
                timestamp: new Date(),
                data: { error: "Authentication required. Provide Clerk JWT token in clerkToken field." }
              }));
              ws.close(4001, "Authentication required");
              return;
            }

            // Verify Clerk token
            const verification = await this.verifyClerkToken(message.clerkToken);
            if (!verification.valid || !verification.clerkId) {
              logger.warn(
                { nodeId, error: verification.error },
                "Connection rejected: invalid Clerk token"
              );
              ws.send(JSON.stringify({
                type: "error",
                fromNodeId: "server",
                timestamp: new Date(),
                data: { error: "Invalid authentication token." }
              }));
              ws.close(4003, "Invalid token");
              return;
            }

            // Authentication successful
            authenticated = true;
            clerkId = verification.clerkId;
            
            // Store authenticated node with Clerk ID
            this.authenticatedNodes.set(nodeId, {
              clerkId,
              authenticatedAt: new Date()
            });
            this.clients.set(nodeId, ws);
            
            logger.info(
              { nodeId, clerkId },
              "Node authenticated successfully via Clerk"
            );

            // Generate node token for ongoing communication (optional, for extra security)
            const nodeToken = DiscoveryServer.generateNodeToken(nodeId);

            // Emit authenticated hello
            this.emit("node-hello", nodeId, message);

            // Send success response with node token
            ws.send(JSON.stringify({
              type: "hello",
              fromNodeId: "server",
              timestamp: new Date(),
              data: {
                message: "Authenticated successfully via Clerk",
                authenticated: true,
                clerkId,
                nodeToken // For subsequent message validation
              }
            }));
            return;
          }

          // Reject non-authenticated messages
          if (!authenticated) {
            logger.warn({ nodeId }, "Message rejected: not authenticated");
            ws.close(4002, "Not authenticated");
            return;
          }

          // Handle authenticated messages
          this.handleMessage(nodeId, message);
        } catch (err) {
          logger.warn({ err, nodeId }, "Invalid message format");
        }
      });

      ws.on("close", () => {
        logger.info({ nodeId, clerkId }, "WebSocket client disconnected");
        this.clients.delete(nodeId);
        this.authenticatedNodes.delete(nodeId);
        this.emit("node-offline", nodeId);
      });

      ws.on("error", (err) => {
        logger.error({ err, nodeId }, "WebSocket error");
        this.clients.delete(nodeId);
        this.authenticatedNodes.delete(nodeId);
      });

      // Send welcome message (expects auth)
      ws.send(
        JSON.stringify({
          type: "hello",
          fromNodeId: "server",
          timestamp: new Date(),
          data: { message: "Connected. Send hello with Clerk JWT token to authenticate." },
        }),
      );
    });

    this.wss.on("error", (err) => {
      logger.error({ err }, "WebSocket server error");
    });
  }

  private handleMessage(nodeId: string, message: DiscoveryMessage): void {
    logger.debug({ nodeId, type: message.type }, "Received discovery message");

    switch (message.type) {
      case "hello":
        this.emit("node-hello", nodeId, message);
        break;
      case "heartbeat":
        this.emit("heartbeat", nodeId, message);
        break;
      case "goodbye":
        this.emit("node-goodbye", nodeId, message);
        break;
      case "cluster-update":
        this.emit("cluster-update", nodeId, message);
        break;
      case "query":
        this.emit("query", nodeId, message);
        break;
      case "response":
        this.emit("response", nodeId, message);
        break;
    }
  }

  /** Broadcast message to all connected nodes */
  broadcast(message: DiscoveryMessage, excludeNodeId?: string): void {
    const data = JSON.stringify(message);
    let sent = 0;

    this.clients.forEach((ws, nodeId) => {
      if (nodeId !== excludeNodeId && ws.readyState === WebSocket.OPEN) {
        ws.send(data);
        sent++;
      }
    });

    logger.debug({ sent, type: message.type }, "Broadcast message sent");
  }

  /** Send message to specific node */
  sendTo(nodeId: string, message: DiscoveryMessage): boolean {
    const ws = this.clients.get(nodeId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
      logger.debug({ nodeId, type: message.type }, "Message sent to node");
      return true;
    }
    logger.warn({ nodeId }, "Node not found or not connected");
    return false;
  }

  /** Get connected node count */
  getConnectedCount(): number {
    return this.authenticatedNodes.size;
  }

  /** Get connected node IDs (authenticated only) */
  getConnectedNodeIds(): string[] {
    return Array.from(this.authenticatedNodes.keys());
  }

  /** Get authenticated node info */
  getAuthenticatedNodeInfo(nodeId: string): { clerkId: string; authenticatedAt: Date } | undefined {
    return this.authenticatedNodes.get(nodeId);
  }

  /** Check if node is authenticated */
  isAuthenticated(nodeId: string): boolean {
    return this.authenticatedNodes.has(nodeId);
  }

  /** Get Clerk ID for authenticated node */
  getClerkId(nodeId: string): string | undefined {
    return this.authenticatedNodes.get(nodeId)?.clerkId;
  }

  /**
   * Generate authentication token for a node (for ongoing message validation)
   */
  static generateNodeToken(nodeId: string): string {
    const timestamp = Date.now();
    const payload = `${nodeId}:${timestamp}`;
    const signature = crypto
      .createHmac("sha256", GHOST_SECRET)
      .update(payload)
      .digest("hex");
    return `${payload}:${signature}`;
  }

  /** Close server */
  close(): void {
    this.wss.close(() => {
      logger.info("WebSocket discovery server closed");
    });
  }
}
