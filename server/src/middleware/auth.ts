/**
 * Operator Authentication & Access Control Middleware — AI Agent Command Center
 */

import { Request, Response, NextFunction } from 'express';
import { pool } from '../db/index.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  workspaceId?: string;
  workspaceRole?: string;
}

/**
 * Enforce valid Bearer session token on protected endpoints
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Autentikasi operator diperlukan. Sertakan Bearer token pada header Authorization.'
        }
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token || token.trim().length === 0) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Token otentikasi kosong atau tidak valid.'
        }
      });
    }

    const result = await pool.query(
      `SELECT id, email, display_name, role FROM human_users WHERE session_token = $1`,
      [token.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: {
          code: 'INVALID_SESSION',
          message: 'Sesi kedaluwarsa atau token tidak valid. Silakan login kembali.'
        }
      });
    }

    const row = result.rows[0];
    (req as AuthenticatedRequest).user = {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      role: row.role
    };

    next();
  } catch (err: any) {
    return res.status(500).json({
      error: {
        code: 'AUTH_ERROR',
        message: 'Gagal memverifikasi otorisasi pengguna.'
      }
    });
  }
}

/**
 * Enforce minimum system role requirement (e.g. ADMIN)
 */
export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Autentikasi operator diperlukan.' }
      });
    }

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `Akses ditolak: Peran "${user.role}" tidak memiliki izin untuk aksi ini. Diperlukan salah satu dari: ${allowedRoles.join(', ')}.`
        }
      });
    }

    next();
  };
}

/**
 * Enforce workspace membership and extract active tenant workspaceId
 */
export async function requireWorkspaceAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Autentikasi pengguna diperlukan.' } });
    }

    const requestedWsId = (
      req.headers['x-workspace-id'] ||
      req.query.workspaceId ||
      req.body?.workspaceId ||
      'ws-default-command-center'
    ).toString().trim();

    // System ADMIN has universal access
    if (authReq.user.role === 'ADMIN') {
      authReq.workspaceId = requestedWsId;
      authReq.workspaceRole = 'OWNER';
      return next();
    }

    // Check membership in workspace_members
    const memRes = await pool.query(
      `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [requestedWsId, authReq.user.id]
    );

    if (memRes.rows.length === 0) {
      return res.status(403).json({
        error: {
          code: 'WORKSPACE_ACCESS_DENIED',
          message: `Akses ditolak: Anda bukan anggota dari workspace "${requestedWsId}".`
        }
      });
    }

    authReq.workspaceId = requestedWsId;
    authReq.workspaceRole = memRes.rows[0].role;
    next();
  } catch (err: any) {
    return res.status(500).json({
      error: { code: 'AUTH_ERROR', message: `Gagal memverifikasi akses workspace: ${err.message}` }
    });
  }
}
