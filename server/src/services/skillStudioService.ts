/**
 * No-Code Agent Skill Builder & Dynamic Tool Studio — AI Agent Command Center
 * Manages runtime custom tools, schema validation, SSRF-safe REST/mock execution,
 * and agent-level access control.
 */

import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/index.js';
import {
  CustomAgentSkill,
  CreateCustomSkillRequest,
  ToolDefinition
} from '../../../shared/types.js';
import { validateOutgoingUrl } from '../utils/ssrf.js';
import { realtimeHub } from './realtime.js';
import { systemLogger } from './logger.js';
import { AVAILABLE_TOOLS } from './sandbox.js';

export class SkillStudioService {
  /**
   * List all custom agent skills
   */
  static async listSkills(
    workspaceId = 'ws-default-command-center',
    isEnabledOnly = false
  ): Promise<CustomAgentSkill[]> {
    let query = `
      SELECT id, workspace_id, name, display_name, description, category,
             risk_level, requires_approval, execution_type, parameters_schema,
             rest_config, mock_output_template, allowed_agent_ids, is_enabled,
             created_at, updated_at
      FROM custom_agent_skills
      WHERE workspace_id = $1
    `;
    const params: any[] = [workspaceId];

    if (isEnabledOnly) {
      query += ' AND is_enabled = TRUE';
    }

    query += ' ORDER BY created_at DESC;';
    const res = await pool.query(query, params);

    return res.rows.map((r) => this.mapRowToSkill(r));
  }

  /**
   * Get single skill by ID or unique name
   */
  static async getSkill(idOrName: string): Promise<CustomAgentSkill | null> {
    const res = await pool.query(
      `
      SELECT id, workspace_id, name, display_name, description, category,
             risk_level, requires_approval, execution_type, parameters_schema,
             rest_config, mock_output_template, allowed_agent_ids, is_enabled,
             created_at, updated_at
      FROM custom_agent_skills
      WHERE id = $1 OR name = $1
      LIMIT 1;
    `,
      [idOrName]
    );

    if (res.rows.length === 0) return null;
    return this.mapRowToSkill(res.rows[0]);
  }

  /**
   * Register a new dynamic skill
   */
  static async createSkill(req: CreateCustomSkillRequest): Promise<CustomAgentSkill> {
    const rawName = String(req.name || '').trim().toLowerCase();
    if (!rawName) {
      throw new Error('Nama identifikasi skill wajib diisi.');
    }

    // Name format validation: lowercase alphanumeric and underscores
    if (!/^[a-z0-9_]{2,48}$/.test(rawName)) {
      throw new Error('Nama skill harus berupa huruf kecil, angka, atau underscore (2-48 karakter), misal: "check_stock_api".');
    }

    // Check if name collides with built-in tools
    if (AVAILABLE_TOOLS[rawName]) {
      throw new Error(`Nama "${rawName}" merupakan nama tool bawaan sistem yang tidak boleh digantikan.`);
    }

    // Check uniqueness
    const existing = await this.getSkill(rawName);
    if (existing) {
      throw new Error(`Skill dengan nama "${rawName}" sudah terdaftar.`);
    }

    const id = `skill-${uuidv4().slice(0, 8)}`;
    const workspaceId = req.workspaceId || 'ws-default-command-center';
    const displayName = (req.displayName || rawName).trim();
    const description = (req.description || '').trim();
    const category = req.category || 'CUSTOM';
    const riskLevel = req.riskLevel || 'LOW';
    const requiresApproval = Boolean(req.requiresApproval);
    const executionType = req.executionType || 'REST_API';
    const parametersSchema = req.parametersSchema || {};
    const restConfig = req.restConfig || { endpointUrl: '', method: 'GET' };
    const mockOutputTemplate = req.mockOutputTemplate || '';
    const allowedAgentIds = req.allowedAgentIds || [];
    const isEnabled = req.isEnabled !== false;
    const now = new Date().toISOString();

    await pool.query(
      `
      INSERT INTO custom_agent_skills (
        id, workspace_id, name, display_name, description, category,
        risk_level, requires_approval, execution_type, parameters_schema,
        rest_config, mock_output_template, allowed_agent_ids, is_enabled,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16);
    `,
      [
        id,
        workspaceId,
        rawName,
        displayName,
        description,
        category,
        riskLevel,
        requiresApproval,
        executionType,
        JSON.stringify(parametersSchema),
        JSON.stringify(restConfig),
        mockOutputTemplate,
        JSON.stringify(allowedAgentIds),
        isEnabled,
        now,
        now
      ]
    );

    const skill: CustomAgentSkill = {
      id,
      workspaceId,
      name: rawName,
      displayName,
      description,
      category,
      riskLevel,
      requiresApproval,
      executionType,
      parametersSchema,
      restConfig,
      mockOutputTemplate,
      allowedAgentIds,
      isEnabled,
      createdAt: now,
      updatedAt: now
    };

    realtimeHub.broadcast('skills.created', skill);
    systemLogger.info('ORCHESTRATOR', `Skill kustom baru didaftarkan: [${rawName}] ${displayName}`);

    return skill;
  }

  /**
   * Update existing custom skill
   */
  static async updateSkill(
    id: string,
    updates: Partial<CreateCustomSkillRequest>
  ): Promise<CustomAgentSkill> {
    const existing = await this.getSkill(id);
    if (!existing) {
      throw new Error(`Skill dengan ID ${id} tidak ditemukan.`);
    }

    const displayName = updates.displayName !== undefined ? updates.displayName.trim() : existing.displayName;
    const description = updates.description !== undefined ? updates.description.trim() : existing.description;
    const category = updates.category || existing.category;
    const riskLevel = updates.riskLevel || existing.riskLevel;
    const requiresApproval = updates.requiresApproval !== undefined ? Boolean(updates.requiresApproval) : existing.requiresApproval;
    const executionType = updates.executionType || existing.executionType;
    const parametersSchema = updates.parametersSchema || existing.parametersSchema;
    const restConfig = updates.restConfig || existing.restConfig;
    const mockOutputTemplate = updates.mockOutputTemplate !== undefined ? updates.mockOutputTemplate : existing.mockOutputTemplate;
    const allowedAgentIds = updates.allowedAgentIds || existing.allowedAgentIds;
    const isEnabled = updates.isEnabled !== undefined ? Boolean(updates.isEnabled) : existing.isEnabled;
    const now = new Date().toISOString();

    await pool.query(
      `
      UPDATE custom_agent_skills
      SET display_name = $1, description = $2, category = $3, risk_level = $4,
          requires_approval = $5, execution_type = $6, parameters_schema = $7,
          rest_config = $8, mock_output_template = $9, allowed_agent_ids = $10,
          is_enabled = $11, updated_at = $12
      WHERE id = $13;
    `,
      [
        displayName,
        description,
        category,
        riskLevel,
        requiresApproval,
        executionType,
        JSON.stringify(parametersSchema),
        JSON.stringify(restConfig),
        mockOutputTemplate,
        JSON.stringify(allowedAgentIds),
        isEnabled,
        now,
        id
      ]
    );

    const updated = await this.getSkill(id);
    realtimeHub.broadcast('skills.updated', updated);
    return updated!;
  }

  /**
   * Delete custom skill
   */
  static async deleteSkill(id: string): Promise<boolean> {
    const res = await pool.query('DELETE FROM custom_agent_skills WHERE id = $1 OR name = $1;', [id]);
    const deleted = (res.rowCount || 0) > 0;
    if (deleted) {
      realtimeHub.broadcast('skills.deleted', { id });
    }
    return deleted;
  }

  /**
   * Execute custom skill dynamically at runtime
   */
  static async executeCustomSkill(
    skillNameOrId: string,
    input: Record<string, any> = {},
    context?: { agentId?: string; workspaceId?: string }
  ): Promise<{ success: boolean; output: any; durationMs: number; error?: string }> {
    const startTime = Date.now();
    const skill = await this.getSkill(skillNameOrId);
    if (!skill) {
      throw new Error(`Skill kustom "${skillNameOrId}" tidak ditemukan.`);
    }

    if (!skill.isEnabled) {
      throw new Error(`Skill "${skill.name}" saat ini dinonaktifkan oleh operator.`);
    }

    // Access control: agent allowance
    if (context?.agentId && skill.allowedAgentIds && skill.allowedAgentIds.length > 0) {
      if (!skill.allowedAgentIds.includes(context.agentId)) {
        throw new Error(`Agen "${context.agentId}" tidak memiliki hak akses untuk mengeksekusi skill "${skill.name}".`);
      }
    }

    // Input schema validation
    if (skill.parametersSchema) {
      for (const [paramName, paramDef] of Object.entries(skill.parametersSchema)) {
        if (paramDef.required && (input[paramName] === undefined || input[paramName] === null || input[paramName] === '')) {
          throw new Error(`Parameter wajib "${paramName}" (${paramDef.description}) tidak disertakan.`);
        }

        if (input[paramName] !== undefined && input[paramName] !== null) {
          const actualType = typeof input[paramName];
          if (paramDef.type === 'number' && actualType !== 'number') {
            const parsed = Number(input[paramName]);
            if (isNaN(parsed)) {
              throw new Error(`Parameter "${paramName}" harus bertipe angka.`);
            }
            input[paramName] = parsed;
          } else if (paramDef.type === 'boolean' && actualType !== 'boolean') {
            input[paramName] = String(input[paramName]).toLowerCase() === 'true';
          }
        } else if (paramDef.defaultValue !== undefined) {
          input[paramName] = paramDef.defaultValue;
        }
      }
    }

    try {
      // Branch by executionType
      if (skill.executionType === 'MOCK_RESPONSE') {
        let output = skill.mockOutputTemplate || '{"status":"ok"}';
        // Interpolate {{param}} tokens
        for (const [k, v] of Object.entries(input)) {
          const token = new RegExp(`\\{\\{${k}\\}\\}`, 'g');
          output = output.replace(token, String(v));
        }

        try {
          output = JSON.parse(output);
        } catch {
          // keep as string
        }

        return {
          success: true,
          output,
          durationMs: Date.now() - startTime
        };
      }

      // REST_API execution
      if (!skill.restConfig || !skill.restConfig.endpointUrl) {
        throw new Error(`Konfigurasi REST endpoint untuk skill "${skill.name}" belum disetel.`);
      }

      let targetUrl = skill.restConfig.endpointUrl;
      // Interpolate URL params
      for (const [k, v] of Object.entries(input)) {
        targetUrl = targetUrl.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), encodeURIComponent(String(v)));
      }

      // Enforce anti-SSRF protection
      const validation = validateOutgoingUrl(targetUrl);
      if (!validation.isValid) {
        throw new Error(`SSRF Blocked: ${validation.error}`);
      }

      const method = (skill.restConfig.method || 'GET').toUpperCase();
      const headers: Record<string, string> = {
        'User-Agent': 'AI-Agent-Command-Center-SkillStudio/1.0',
        ...(skill.restConfig.headers || {})
      };

      // Interpolate headers
      for (const [hk, hv] of Object.entries(headers)) {
        let val = hv;
        for (const [k, v] of Object.entries(input)) {
          val = val.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
        }
        headers[hk] = val;
      }

      let body: string | undefined;
      if (method === 'POST' || method === 'PUT') {
        if (skill.restConfig.bodyTemplate) {
          let bodyStr = skill.restConfig.bodyTemplate;
          for (const [k, v] of Object.entries(input)) {
            bodyStr = bodyStr.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
          }
          body = bodyStr;
        } else {
          headers['Content-Type'] = headers['Content-Type'] || 'application/json';
          body = JSON.stringify(input);
        }
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(targetUrl, {
        method,
        headers,
        body,
        signal: controller.signal
      });
      clearTimeout(timeout);

      const contentType = response.headers.get('content-type') || '';
      let parsedOutput: any;
      if (contentType.includes('application/json')) {
        parsedOutput = await response.json();
      } else {
        parsedOutput = await response.text();
      }

      return {
        success: response.ok,
        output: parsedOutput,
        durationMs: Date.now() - startTime,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
      };
    } catch (err: any) {
      systemLogger.warn('SECURITY', `Kegagalan eksekusi skill [${skill.name}]: ${err.message}`);
      return {
        success: false,
        output: '',
        durationMs: Date.now() - startTime,
        error: err.message
      };
    }
  }

  /**
   * Convert dynamic skills into ToolDefinition format for agent catalog
   */
  static async listToolDefinitionsForAgent(
    agentId?: string,
    workspaceId = 'ws-default-command-center'
  ): Promise<ToolDefinition[]> {
    const skills = await this.listSkills(workspaceId, true);
    const filtered = skills.filter((s) => {
      if (!agentId || !s.allowedAgentIds || s.allowedAgentIds.length === 0) return true;
      return s.allowedAgentIds.includes(agentId);
    });

    return filtered.map((s) => ({
      name: s.name,
      description: `[Skill Kustom] ${s.displayName}: ${s.description}`,
      category: s.category as any,
      riskLevel: s.riskLevel,
      requiresApproval: s.requiresApproval,
      parameters: s.parametersSchema as any
    }));
  }

  private static mapRowToSkill(r: any): CustomAgentSkill {
    return {
      id: r.id,
      workspaceId: r.workspace_id,
      name: r.name,
      displayName: r.display_name,
      description: r.description,
      category: r.category,
      riskLevel: r.risk_level,
      requiresApproval: r.requires_approval,
      executionType: r.execution_type,
      parametersSchema: r.parameters_schema || {},
      restConfig: r.rest_config || {},
      mockOutputTemplate: r.mock_output_template || '',
      allowedAgentIds: r.allowed_agent_ids || [],
      isEnabled: r.is_enabled,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }
}
