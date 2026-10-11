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

  addClient(id: string, res: Response): void {
    this.clients.set(id, { id, res });
    
    // Send initial handshake event
    res.write(`event: connected\ndata: ${JSON.stringify({ clientId: id, timestamp: new Date().toISOString() })}\n\n`);

    // Clean up on disconnect
    res.on('close', () => {
      this.clients.delete(id);
    });
  }

  broadcast(event: string, data: any): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const [id, client] of this.clients.entries()) {
      try {
        client.res.write(payload);
      } catch (err) {
        this.clients.delete(id);
      }
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }
}

export const realtimeHub = new RealtimeHub();
