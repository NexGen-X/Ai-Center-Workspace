import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Modal & Dialog UI/UX Standardization Contracts', () => {
  const clientDir = path.resolve(__dirname, '../../client/src');

  it('Nexus Prime & AgentDetailModal must synchronize state when agent becomes null', () => {
    const filePath = path.join(clientDir, 'features/team/AgentDetailModal.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Verification 1: Guard must check both agent and currentAgent
    expect(content).toContain('if (!agent || !currentAgent) return null;');

    // Verification 2: useEffect must reset currentAgent to null when agent prop is null
    expect(content).toMatch(/else\s*\{\s*setCurrentAgent\(null\);/);

    // Verification 3: Escape key handler must be registered
    expect(content).toContain("e.key === 'Escape'");

    // Verification 4: Backdrop click and content stopPropagation
    expect(content).toContain('onClick={onClose}');
    expect(content).toContain('e.stopPropagation()');

    // Verification 5: Modal stacking z-index elevated above ManageTeamModal
    expect(content).toContain('z-[60]');
  });

  it('ManageTeamModal must implement Escape listener, backdrop dismiss, and type="button"', () => {
    const filePath = path.join(clientDir, 'features/team/ManageTeamModal.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toContain("e.key === 'Escape'");
    expect(content).toContain('onClick={onClose}');
    expect(content).toContain('e.stopPropagation()');
    expect(content).toMatch(/<button[^>]*type="button"[^>]*onClick=\{onClose\}/);
  });

  it('All modal files must have Escape key listener and backdrop dismissal', () => {
    const modalFiles = [
      'features/team/AgentDetailModal.tsx',
      'features/team/ManageTeamModal.tsx',
      'features/team/AddAgentModal.tsx',
      'features/tasks/TasksModal.tsx',
      'features/tasks/CreateTaskModal.tsx',
      'features/tasks/TaskDetailModal.tsx',
      'features/projects/ProjectsModal.tsx',
      'features/documents/DocumentsModal.tsx',
      'features/pipeline/PipelineModal.tsx',
      'features/playground/PlaygroundModal.tsx',
      'features/settings/SettingsModal.tsx',
      'features/providers/ManageProvidersModal.tsx',
      'features/calendar/CalendarModal.tsx',
      'features/reports/ReportsModal.tsx',
      'features/warroom/WarRoomModal.tsx',
      'features/sre/SreModal.tsx',
      'features/data-analyst/DataAnalystModal.tsx',
      'features/skills/SkillStudioModal.tsx',
      'features/memory/MemoryGraphModal.tsx',
      'components/LoginModal.tsx',
      'components/terminal/ConsoleDrawer.tsx',
      'components/common/FeedbackContext.tsx'
    ];

    for (const relPath of modalFiles) {
      const fullPath = path.join(clientDir, relPath);
      expect(fs.existsSync(fullPath)).toBe(true);
      const content = fs.readFileSync(fullPath, 'utf-8');

      // Every modal must support Escape key dismissal
      expect(content, `${relPath} should handle Escape key`).toContain("e.key === 'Escape'");

      // Modals with backdrop overlays must stop propagation on content
      if (!relPath.includes('ConsoleDrawer')) {
        expect(content, `${relPath} should stop propagation on inner dialog`).toContain('e.stopPropagation()');
      }
    }
  });

  it('Sub-modals must use valid Tailwind z-[60] arbitrary values instead of invalid z-60', () => {
    const providersModalPath = path.join(clientDir, 'features/providers/ManageProvidersModal.tsx');
    const content = fs.readFileSync(providersModalPath, 'utf-8');

    // Should not contain broken class 'z-60' without brackets
    expect(content).not.toMatch(/className="[^"]*\bz-60\b[^"]*"/);
    // Must contain z-[60]
    expect(content).toContain('z-[60]');
  });

  it('CustomSelect and CustomDatePicker must capture Escape and stopPropagation', () => {
    const selectPath = path.join(clientDir, 'components/common/CustomSelect.tsx');
    const selectContent = fs.readFileSync(selectPath, 'utf-8');
    expect(selectContent).toContain('handleKeyDownCapture');
    expect(selectContent).toContain('e.stopPropagation()');

    const datePickerPath = path.join(clientDir, 'components/common/CustomDatePicker.tsx');
    const datePickerContent = fs.readFileSync(datePickerPath, 'utf-8');
    expect(datePickerContent).toContain('handleKeyDownCapture');
    expect(datePickerContent).toContain('e.stopPropagation()');
  });

  it('All interactive dismiss buttons must have type="button" to prevent accidental form submits', () => {
    const filesToCheck = [
      'features/team/AgentDetailModal.tsx',
      'features/team/ManageTeamModal.tsx',
      'features/tasks/TasksModal.tsx',
      'features/settings/SettingsModal.tsx',
      'features/reports/ReportsModal.tsx',
      'features/calendar/CalendarModal.tsx'
    ];

    for (const relPath of filesToCheck) {
      const fullPath = path.join(clientDir, relPath);
      const content = fs.readFileSync(fullPath, 'utf-8');
      // Tutup button must have explicit type="button"
      const tutupMatches = content.match(/<button[^>]*>\s*Tutup\s*<\/button>/g);
      if (tutupMatches) {
        for (const match of tutupMatches) {
          expect(match, `${relPath} Tutup button must specify type="button"`).toContain('type="button"');
        }
      }
    }
  });
});
