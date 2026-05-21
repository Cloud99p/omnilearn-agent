/**
 * WebSocket Server for Network Discovery
 * Real-time node discovery and cluster communication
 */

import { WebSocketServer, WebSocket } from "ws";
import { EventEmitter } from "events";
import { logger } from "./logger.js";

export interface DiscoveryMessage {
  type: "hello" | "heartbeat" | "goodbye" | "cluster-update" | "query" | "response";
  fromNodeId: string;
  timestamp: Date;
  location?: { lat: number; lng: number };
  capacity?: number;
  data?: any;
}

export class DiscoveryServer extends EventEmitter {
  private wss: WebSocketServer;
  private clients: Map<string, WebSocket> = new Map();
  private port: number;

  constructor(port: number = 8765) {
    super();
    this.port = port;
    this.wss = new WebSocketServer({ port });
    this.setupHandlers();
    
    logger.info({ port }, "WebSocket discovery server starting...");
  }

  private setupHandlers(): void {
    this.wss.on("connection", (ws, req) => {
      const nodeId = req.url?.split("?")[1].split("=")[1] || "unknown";
      logger.info({ nodeId }, "New WebSocket connection");

      // Register client
      this.clients.set(nodeId, ws);

      ws.on("message", (data) => {
        try {
          const message: DiscoveryMessage = JSON.parse(data.toString());
          this.handleMessage(nodeId, message);
        } catch (err) {
          logger.warn({ err, nodeId }, "Invalid message format");
        }
      });

      ws.on("close", () => {
        logger.info({ nodeId }, "WebSocket client disconnected");
        this.clients.delete(nodeId);
        this.emit("node-offline", nodeId);
      });

      ws.on("error", (err) => {
        logger.error({ err, nodeId }, "WebSocket error");
        this.clients.delete(nodeId);
      });

      // Send welcome message
      ws.send(
        JSON.stringify({
          type: "hello",
          fromNodeId: "server",
          timestamp: new Date(),
          data: { message: "Connected to discovery server" },
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
    return this.clients.size;
  }

  /** Get connected node IDs */
  getConnectedNodeIds(): string[] {
    return Array.from(this.clients.keys());
  }

  /** Close server */
  close(): void {
    this.wss.close(() => {
      logger.info("WebSocket discovery server closed");
    });
  }
}
