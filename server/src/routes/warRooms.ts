/**
 * Multi-Agent War Room & Live Debate API Routes — AI Agent Command Center
 */

import { Router, Request, Response } from 'express';
import { WarRoomService } from '../services/warRoomService.js';
import { systemLogger } from '../services/logger.js';

export const warRoomsRouter = Router();

// GET /api/war-rooms — List all War Rooms
warRoomsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const workspaceId = (req.query.workspaceId as string) || 'ws-default-command-center';
    const rooms = await WarRoomService.getWarRooms(workspaceId);
    res.json(rooms);
  } catch (err: any) {
    systemLogger.error('API', `Gagal mengambil daftar War Rooms: ${err.message}`);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /api/war-rooms — Create a new War Room
warRoomsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { title, topic, agentIds, roles } = req.body;
    const workspaceId = (req.body.workspaceId as string) || 'ws-default-command-center';

    if (!title || !topic || !Array.isArray(agentIds) || agentIds.length === 0) {
      return res.status(400).json({
        error: 'Parameter title, topic, dan minimal 1 agentId wajib diisi.'
      });
    }

    const warRoom = await WarRoomService.createWarRoom(
      { title, topic, agentIds, roles },
      workspaceId
    );
    res.status(201).json(warRoom);
  } catch (err: any) {
    systemLogger.error('API', `Gagal membuat War Room: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

// GET /api/war-rooms/:id — Get details of a single War Room with full transcript
warRoomsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const room = await WarRoomService.getWarRoom(req.params.id);
    if (!room) {
      return res.status(404).json({ error: 'War Room tidak ditemukan.' });
    }
    res.json(room);
  } catch (err: any) {
    systemLogger.error('API', `Gagal mengambil War Room ${req.params.id}: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/war-rooms/:id/messages — Post a user message/interjection
warRoomsRouter.post('/:id/messages', async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Konten pesan wajib disediakan.' });
    }

    const message = await WarRoomService.postUserMessage(req.params.id, content);
    res.status(201).json(message);
  } catch (err: any) {
    systemLogger.error('API', `Gagal mengirim pesan ke War Room: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

// POST /api/war-rooms/:id/deliberate — Trigger a round of multi-agent debate
warRoomsRouter.post('/:id/deliberate', async (req: Request, res: Response) => {
  try {
    const { roundNumber, userPrompt, targetAgentId } = req.body;
    const newMessages = await WarRoomService.deliberateRound(req.params.id, {
      roundNumber,
      userPrompt,
      targetAgentId
    });
    res.json({
      success: true,
      messages: newMessages,
      roundNumber: newMessages[0]?.roundNumber || roundNumber || 1
    });
  } catch (err: any) {
    systemLogger.error('API', `Gagal mengeksekusi ronde debat War Room: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

// POST /api/war-rooms/:id/conclude — Synthesize consensus and conclude session
warRoomsRouter.post('/:id/conclude', async (req: Request, res: Response) => {
  try {
    const updated = await WarRoomService.synthesizeConsensus(req.params.id);
    res.json(updated);
  } catch (err: any) {
    systemLogger.error('API', `Gagal menyelesaikan War Room: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

// POST /api/war-rooms/:id/convert-to-task — 1-click convert consensus to project Task
warRoomsRouter.post('/:id/convert-to-task', async (req: Request, res: Response) => {
  try {
    const { title, projectId, priority } = req.body;
    const task = await WarRoomService.convertConsensusToTask(req.params.id, {
      title,
      projectId,
      priority
    });
    res.status(201).json(task);
  } catch (err: any) {
    systemLogger.error('API', `Gagal mengonversi War Room ke Task: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});
