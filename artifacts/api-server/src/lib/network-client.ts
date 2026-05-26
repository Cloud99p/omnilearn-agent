/**
 * Network Client Helper
 * Connect to WebSocket discovery server with Clerk authentication
 * 
 * Usage:
 * ```typescript
 * import { connectToNetwork } from './network-client';
 * 
 * const ws = await connectToNetwork('ws://localhost:8765', 'my-device-id', clerkToken);
 * ```
 */

import { logger } from "./logger.js";

export interface NetworkConfig {
  wsUrl: string;
  nodeId: string;
  clerkToken: string;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
  onMessage?: (message: any) => void;
}

/**
 * Connect to WebSocket discovery server with Clerk authentication
 */
export async function connectToNetwork(config: NetworkConfig): Promise<WebSocket> {
  const { wsUrl, nodeId, clerkToken, onConnected, onDisconnected, onError, onMessage } = config;

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${wsUrl}?nodeId=${encodeURIComponent(nodeId)}`);
    let authenticated = false;

    ws.onopen = () => {
      logger.info({ nodeId }, "WebSocket connected, authenticating...");

      // Send authentication message with Clerk token
      ws.send(JSON.stringify({
        type: "hello",
        fromNodeId: nodeId,
        timestamp: new Date(),
        clerkToken: clerkToken, // Clerk JWT for authentication
      }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data.toString());

        // Handle authentication response
        if (message.type === "hello" && message.data?.authenticated) {
          authenticated = true;
          logger.info(
            { nodeId, clerkId: message.data.clerkId },
            "Authenticated successfully via Clerk"
          );

          if (onConnected) {
            onConnected();
          }
          resolve(ws);
          return;
        }

        // Handle authentication errors
        if (message.type === "error") {
          const error = new Error(message.data?.error || "Authentication failed");
          logger.error({ nodeId, error: message.data?.error }, "WebSocket auth failed");
          
          if (onError) {
            onError(error);
          }
          reject(error);
          return;
        }

        // Handle regular messages
        if (authenticated && onMessage) {
          onMessage(message);
        }
      } catch (err) {
        logger.warn({ err }, "Invalid message received");
      }
    };

    ws.onclose = (event) => {
      logger.info({ nodeId, code: event.code, reason: event.reason }, "WebSocket closed");
      
      if (onDisconnected) {
        onDisconnected();
      }

      // Reject if closed before authentication
      if (!authenticated) {
        reject(new Error(`Connection closed before authentication: ${event.reason}`));
      }
    };

    ws.onerror = (error) => {
      logger.error({ nodeId, error }, "WebSocket error");
      
      if (onError) {
        onError(error instanceof Error ? error : new Error("WebSocket error"));
      }
      
      reject(error instanceof Error ? error : new Error("WebSocket connection failed"));
    };

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!authenticated && ws.readyState === WebSocket.CONNECTING) {
        ws.close();
        reject(new Error("WebSocket authentication timeout"));
      }
    }, 10000);
  });
}

/**
 * Get Clerk token from current session
 * This should be called from the client-side (browser/mobile app)
 */
export async function getClerkToken(): Promise<string> {
  // This will be implemented in the frontend
  // Example for browser:
  // const session = await clerkClient.session.getCurrent();
  // return session?.token || '';
  
  throw new Error("getClerkToken() must be implemented in the client app");
}

/**
 * Generate a unique node ID for this device
 */
export function generateNodeId(): string {
  // Use device fingerprint or generate random ID
  const randomId = Math.random().toString(36).substring(2, 15);
  const platform = typeof navigator !== 'undefined' 
    ? navigator.platform 
    : 'unknown';
  
  return `node-${platform}-${randomId}`;
}
