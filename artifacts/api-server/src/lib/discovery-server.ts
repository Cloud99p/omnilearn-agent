/**
 * WebSocket Server for Network Discovery
 * Real-time node discovery and cluster communication
 * SECURED: Requires signed token (GHOST_SECRET) for node registration
 */

import { WebSocketServer, WebSocket } from "ws";
import { EventEmitter } from "events";
import { logger } from "./logger.js";
import crypto from "crypto";

const GHOST_SECRET = process.env.GHOST_SECRET || "insecure-dev-secret-change-in-production";

export interface DiscoveryMessage {
  type: "hello" | "heartbeat" | "goodbye" | "cluster-update" | "query" | "response";
  fromNodeId: string;
  timestamp: Date;
  location?: { lat: number; lng: number };
  capacity?: number;
  data?: any;
  token?: string; // Authentication token
}

export class DiscoveryServer extends EventEmitter {
  private wss: WebSocketServer;
  private clients: Map<string, WebSocket> = new Map();
  private authenticatedNodes: Set<string> = new Set();
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
  }

  /**
   * Generate authentication token for a node
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

  /**
   * Validate authentication token
   */
  private validateToken(nodeId: string, token: string): boolean {
    try {
      const parts = token.split(":");
      if (parts.length !== 3) {
        logger.warn({ nodeId }, "Invalid token format");
        return false;
      }

      const [tokenNodeId, timestampStr, signature] = parts;
      const timestamp = parseInt(timestampStr, 10);

      // Check if token is for this node
      if (tokenNodeId !== nodeId) {
        logger.warn({ nodeId, tokenNodeId }, "Token node ID mismatch");
        return false;
      }

      // Check if token is recent (within 5 minutes)
      const age = Date.now() - timestamp;
      const maxAge = 5 * 60 * 1000; // 5 minutes
      if (age > maxAge || age < 0) {
        logger.warn({ nodeId, age }, "Token expired or invalid timestamp");
        return false;
      }

      // Verify signature
      const payload = `${tokenNodeId}:${timestamp}`;
      const expectedSignature = crypto
        .createHmac("sha256", GHOST_SECRET)
        .update(payload)
        .digest("hex");

      if (signature !== expectedSignature) {
        logger.warn({ nodeId }, "Invalid token signature");
        return false;
      }

      return true;
    } catch (err) {
      logger.error({ err, nodeId }, "Token validation error");
      return false;
    }
  }

  private setupHandlers(): void {
    this.wss.on("connection", (ws, req) => {
      const nodeId = req.url?.split("?")[1].split("=")[1] || "unknown";
      logger.info({ nodeId }, "New WebSocket connection");

      // Wait for authentication message
      let authenticated = false;

      ws.on("message", (data) => {
        try {
          const message: DiscoveryMessage = JSON.parse(data.toString());

          // First message must be hello with token for authentication
          if (!authenticated && message.type === "hello") {
            if (!message.token) {
              logger.warn({ nodeId }, "Connection rejected: no auth token");
              ws.send(JSON.stringify({
                type: "error",
                fromNodeId: "server",
                timestamp: new Date(),
                data: { error: "Authentication required. Provide token in hello message." }
              }));
              ws.close(4001, "Authentication required");
              return;
            }

            // Validate token
            if (!this.validateToken(nodeId, message.token)) {
              logger.warn({ nodeId }, "Connection rejected: invalid token");
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
            this.authenticatedNodes.add(nodeId);
            this.clients.set(nodeId, ws);
            logger.info({ nodeId }, "Node authenticated successfully");

            // Emit authenticated hello
            this.emit("node-hello", nodeId, message);

            // Send success response
            ws.send(JSON.stringify({
              type: "hello",
              fromNodeId: "server",
              timestamp: new Date(),
              data: { message: "Authenticated successfully", authenticated: true }
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
        logger.info({ nodeId }, "WebSocket client disconnected");
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
          data: { message: "Connected. Send hello with token to authenticate." },
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

  /** Check if node is authenticated */
  isAuthenticated(nodeId: string): boolean {
    return this.authenticatedNodes.has(nodeId);
  }

  /** Close server */
  close(): void {
    this.wss.close(() => {
      logger.info("WebSocket discovery server closed");
    });
  }
}
