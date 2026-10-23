/**
 * Swarm Artifact Bundler & Git PR Generator Service — AI Agent Command Center
 * Compiles subtask outputs into unified reports, extracts code deliverables,
 * generates unified diff patches, and automates Git branch creation.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { pool } from '../db/index.js';
import { systemLogger } from './logger.js';
import {
  SwarmMission,
  SwarmSubtask,
  SwarmArtifactBundle,
  SwarmExtractedFile,
  CreateGitBranchResponse
} from '../../../shared/types.js';

const execFileAsync = promisify(execFile);

export class SwarmArtifactService {
  /**
   * Compiles mission deliverables into a structured artifact bundle
   */
  static async generateArtifactBundle(missionId: string): Promise<SwarmArtifactBundle> {
    const res = await pool.query(
      `SELECT m.*, a.name as coordinator_name
       FROM swarm_missions m
       LEFT JOIN ai_agents a ON m.coordinator_agent_id = a.id
       WHERE m.id = $1;`,
      [missionId]
    );

    if (res.rows.length === 0) {
      throw new Error(`Misi swarm tidak ditemukan dengan id: ${missionId}`);
    }

    const row = res.rows[0];
    const subtasks: SwarmSubtask[] = typeof row.subtasks_json === 'string'
      ? JSON.parse(row.subtasks_json)
      : (row.subtasks_json || []);

    const extractedFiles = this.extractCodeFiles(subtasks);
    const markdownReport = this.compileMarkdownReport(row, subtasks, extractedFiles);
    const unifiedPatch = this.generateUnifiedPatch(extractedFiles);

    return {
      missionId,
      missionTitle: row.title,
      objective: row.objective,
      status: row.status,
      markdownReport,
      extractedFiles,
      unifiedPatch,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Extracts code blocks and inferred file paths from subtask outputs
   */
  private static extractCodeFiles(subtasks: SwarmSubtask[]): SwarmExtractedFile[] {
    const files: SwarmExtractedFile[] = [];
    const codeBlockRegex = /```([a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g;

    for (const st of subtasks) {
      if (!st.outputResult) continue;

      let match: RegExpExecArray | null;
      let blockIndex = 0;

      while ((match = codeBlockRegex.exec(st.outputResult)) !== null) {
        blockIndex++;
        const lang = (match[1] || 'txt').toLowerCase();
        const content = match[2].trim();
        if (!content) continue;

        // Try to detect explicit file path in the first few lines of the code block or preceding text
        let filePath = this.detectFilePath(content, lang, st, blockIndex);

        files.push({
          filePath,
          language: lang,
          content,
          sourceSubtaskTitle: st.title,
          sourceAgentRole: st.role
        });
      }
    }

    return files;
  }

  private static detectFilePath(
    content: string,
    lang: string,
    subtask: SwarmSubtask,
    index: number
  ): string {
    const lines = content.split('\n').slice(0, 4);
    for (const line of lines) {
      const fileMatch = line.match(/(?:\/\/|#|\/\*|<!--|--)\s*(?:File|Path|filename):\s*([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)/i);
      if (fileMatch && fileMatch[1]) {
        return fileMatch[1].trim();
      }
    }

    // Default path inference based on role & language extension
    const extMap: Record<string, string> = {
      ts: 'ts',
      typescript: 'ts',
      js: 'js',
      javascript: 'js',
      tsx: 'tsx',
      jsx: 'jsx',
      py: 'py',
      python: 'py',
      sql: 'sql',
      sh: 'sh',
      bash: 'sh',
      json: 'json',
      md: 'md',
      yaml: 'yaml',
      yml: 'yml',
      css: 'css',
      html: 'html'
    };

    const ext = extMap[lang] || 'txt';
    const roleSlug = subtask.role.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const sanitizedTitle = subtask.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 25);
    return `artifacts/${roleSlug}/${sanitizedTitle}-${index}.${ext}`;
  }

  /**
   * Generates a comprehensive markdown report for the swarm mission
   */
  private static compileMarkdownReport(
    mission: any,
    subtasks: SwarmSubtask[],
    extractedFiles: SwarmExtractedFile[]
  ): string {
    const durationSec = Math.round((mission.total_duration_ms || 0) / 1000);
    const selfCorrections = subtasks.reduce(
      (acc, s) => acc + (s.revisions ? s.revisions.length : (s.feedbackLoopCount || 0)),
      0
    );

    let md = `# Executive Mission Deliverables: ${mission.title}\n\n`;
    md += `> **Mission ID**: \`${mission.id}\`  \n`;
    md += `> **Status**: \`${mission.status}\` | **Duration**: \`${durationSec}s\` | **Tokens**: \`${mission.total_tokens || 0}\`  \n`;
    md += `> **Coordinator**: \`${mission.coordinator_name || 'Autonomous Orchestrator'}\`  \n`;
    md += `> **Report Generated**: \`${new Date().toISOString()}\`\n\n`;

    md += `## 1. Objective & Strategic Synthesis\n\n`;
    md += `### Primary Objective\n${mission.objective}\n\n`;

    if (mission.final_synthesis) {
      md += `### Coordinator Synthesis\n${mission.final_synthesis}\n\n`;
    }

    md += `## 2. Topological Subtask DAG Breakdown\n\n`;
    md += `| Order | Subtask ID | Role | Title | Status | Duration | Self-Corrections |\n`;
    md += `| :---: | :--- | :--- | :--- | :---: | :---: | :---: |\n`;

    subtasks.forEach((st, idx) => {
      const revCount = st.revisions ? st.revisions.length : (st.feedbackLoopCount || 0);
      const stDuration = st.durationMs ? `${Math.round(st.durationMs / 1000)}s` : '-';
      md += `| ${idx + 1} | \`${st.id}\` | **${st.role}** | ${st.title} | \`${st.status}\` | ${stDuration} | ${revCount > 0 ? `**${revCount} rev**` : '0'} |\n`;
    });
    md += `\n`;

    if (selfCorrections > 0) {
      md += `### Autonomous Self-Correction & QA Audits (${selfCorrections} Iterations)\n\n`;
      for (const st of subtasks) {
        if (st.revisions && st.revisions.length > 0) {
          md += `#### Subtask: ${st.title} (${st.role})\n`;
          st.revisions.forEach((rev) => {
            md += `- **Iteration ${rev.iteration}**: ${rev.critique}\n`;
          });
          md += `\n`;
        }
      }
    }

    md += `## 3. Extracted Code Deliverables & File Changes (${extractedFiles.length} Files)\n\n`;
    if (extractedFiles.length === 0) {
      md += `*Tidak ada blok kode terpisah yang terdeteksi dalam output subtask.*\n\n`;
    } else {
      extractedFiles.forEach((f, idx) => {
        md += `### ${idx + 1}. \`${f.filePath}\`\n`;
        md += `*Source*: ${f.sourceSubtaskTitle} (${f.sourceAgentRole})  \n\n`;
        md += `\`\`\`${f.language}\n${f.content}\n\`\`\`\n\n`;
      });
    }

    md += `## 4. Detailed Subtask Execution Logs\n\n`;
    subtasks.forEach((st, idx) => {
      md += `### Subtask ${idx + 1}: ${st.title}\n`;
      md += `- **Assigned Role**: ${st.role} (${st.assignedAgentName || st.assignedAgentId || 'Agent'})\n`;
      md += `- **Status**: ${st.status}\n`;
      if (st.error) {
        md += `- **Error**: \`${st.error}\`\n`;
      }
      md += `\n**Output Result**:\n\n${st.outputResult || '*Tidak ada output tersimpan*'}\n\n---\n\n`;
    });

    md += `\n*Laporan ini dihasilkan secara otonom oleh AI Center Workspace Multi-Agent Swarm.*`;
    return md;
  }

  /**
   * Generates a unified git diff patch representing the extracted files
   */
  private static generateUnifiedPatch(files: SwarmExtractedFile[]): string {
    if (files.length === 0) return '';

    let patch = '';
    for (const f of files) {
      const lines = f.content.split('\n');
      patch += `diff --git a/${f.filePath} b/${f.filePath}\n`;
      patch += `new file mode 100644\n`;
      patch += `--- /dev/null\n`;
      patch += `+++ b/${f.filePath}\n`;
      patch += `@@ -0,0 +1,${lines.length} @@\n`;
      for (const line of lines) {
        patch += `+${line}\n`;
      }
      patch += '\n';
    }
    return patch;
  }

  /**
   * Creates an automated Git branch containing the mission report and deliverables
   */
  static async createGitBranch(
    missionId: string,
    options?: { branchName?: string; commitMessage?: string }
  ): Promise<CreateGitBranchResponse> {
    const bundle = await this.generateArtifactBundle(missionId);
    const repoRoot = path.resolve(process.cwd());

    // 1. Get current branch to safely return afterwards
    let originalBranch = 'main';
    try {
      const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: repoRoot });
      originalBranch = stdout.trim() || 'main';
    } catch {
      // Fallback
    }

    // 2. Format sanitized branch name
    const sanitizedTitle = bundle.missionTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30);
    const branchName = options?.branchName?.trim() || `feature/swarm-${sanitizedTitle || missionId.slice(0, 8)}`;

    systemLogger.info('ORCHESTRATOR', `[Git Exporter] Menyiapkan branch: ${branchName} dari ${originalBranch}`);

    try {
      // Create and checkout branch
      await execFileAsync('git', ['checkout', '-B', branchName], { cwd: repoRoot });

      // Write report to docs/swarm-reports/
      const reportDir = path.join(repoRoot, 'docs', 'swarm-reports');
      fs.mkdirSync(reportDir, { recursive: true });

      const reportFileName = `mission-${missionId}.md`;
      const reportFilePath = path.join(reportDir, reportFileName);
      fs.writeFileSync(reportFilePath, bundle.markdownReport, 'utf8');

      const filesCommitted: string[] = [`docs/swarm-reports/${reportFileName}`];

      // Stage report file
      await execFileAsync('git', ['add', `docs/swarm-reports/${reportFileName}`], { cwd: repoRoot });

      // Write and stage all extracted deliverable code files safely
      for (const file of bundle.extractedFiles) {
        const normalized = path.normalize(file.filePath).replace(/^(\.\.(\/|\\|$))+/, '');
        if (
          normalized.startsWith('.git') ||
          normalized.startsWith('node_modules') ||
          normalized.startsWith('.env')
        ) {
          continue;
        }

        const fullFilePath = path.join(repoRoot, normalized);
        const fileDir = path.dirname(fullFilePath);
        fs.mkdirSync(fileDir, { recursive: true });
        fs.writeFileSync(fullFilePath, file.content, 'utf8');
        filesCommitted.push(normalized);
        await execFileAsync('git', ['add', normalized], { cwd: repoRoot });
      }

      const commitMsg = options?.commitMessage?.trim() ||
        `feat(swarm): automated deliverables for "${bundle.missionTitle}" [${missionId}]`;

      await execFileAsync('git', [
        '-c', 'user.name=AI Agent Swarm',
        '-c', 'user.email=swarm@ai-center.local',
        'commit',
        '-m',
        commitMsg
      ], { cwd: repoRoot });

      // Retrieve new commit hash
      const { stdout: hashOut } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot });
      const commitHash = hashOut.trim();

      // Return back to original branch immediately
      await execFileAsync('git', ['checkout', originalBranch], { cwd: repoRoot });

      systemLogger.info('ORCHESTRATOR', `[Git Exporter] Berhasil commit branch ${branchName} (${commitHash.slice(0, 7)}). Kembali ke ${originalBranch}.`);

      return {
        success: true,
        branchName,
        commitHash,
        filesCommitted,
        message: `Branch Git "${branchName}" berhasil dibuat dengan commit ${commitHash.slice(0, 7)}.`
      };
    } catch (err: any) {
      // Ensure we switch back even on failure
      try {
        await execFileAsync('git', ['checkout', originalBranch], { cwd: repoRoot });
      } catch {
        // ignore
      }
      systemLogger.error('SYSTEM', `[Git Exporter Error]: ${err.message}`);
      throw new Error(`Gagal membuat branch Git: ${err.message}`);
    }
  }
}
