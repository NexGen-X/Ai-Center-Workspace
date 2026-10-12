/**
 * Real-time SSE (Server-Sent Events) Service — AI Agent Command Center
 */

import { Response } from 'express';

interface Client {
  id: string;
  res: Response;
}

class RealtimeHub {
  private clients: Map<string, Client> = new Map();
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Send periodic SSE keep-alive heartbeat every 25 seconds to prevent proxy/firewall timeouts
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, 25000);
  }

  addClient(id: string, res: Response): void {
    this.clients.set(id, { id, res });
    
    // Send initial handshake event
    try {
      res.write(`event: connected\ndata: ${JSON.stringify({ clientId: id, timestamp: new Date().toISOString() })}\n\n`);
    } catch {
      this.clients.delete(id);
      return;
    }

    // Clean up on disconnect
    res.on('close', () => {
      this.clients.delete(id);
    });

    res.on('error', () => {
      this.clients.delete(id);
    });
  }

  broadcast(event: string, data: any): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const [id, client] of this.clients.entries()) {
      try {
        client.res.write(payload);
      } catch {
        this.clients.delete(id);
      }
    }
  }

  private sendHeartbeat(): void {
    if (this.clients.size === 0) return;
    const heartbeatPayload = `: keepalive ${Date.now()}\n\n`;
    for (const [id, client] of this.clients.entries()) {
      try {
        client.res.write(heartbeatPayload);
      } catch {
        this.clients.delete(id);
      }
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }

  closeAll(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    for (const [id, client] of this.clients.entries()) {
      try {
        client.res.end();
      } catch {
        // ignore
      }
      this.clients.delete(id);
    }
  }
}

export const realtimeHub = new RealtimeHub();
