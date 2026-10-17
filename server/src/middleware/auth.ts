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
