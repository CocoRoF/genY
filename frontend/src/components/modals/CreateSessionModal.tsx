'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { agentApi } from '@/lib/api';
import { cn, btn, modal, form, selectArrowStyle } from '@/lib/tw';
import NumberStepper from '@/components/ui/NumberStepper';
import type { CreateAgentRequest, SessionInfo } from '@/types';

interface Props { onClose: () => void; }

const MODEL_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { value: 'claude-opus-4-0603', label: 'Claude Opus 4.5' },
  { value: 'claude-opus-4-20260115', label: 'Claude Opus 4.6' },
  { value: 'claude-sonnet-4-20260115', label: 'Claude Sonnet 4.5' },
];

export default function CreateSessionModal({ onClose }: Props) {
  const { createSession, prompts, loadPrompts, loadPromptContent } = useAppStore();

  const [formState, setFormState] = useState<CreateAgentRequest>({
    session_name: '',
    role: 'worker',
    model: '',
    max_turns: 25,
    timeout: 300,
    autonomous: false,
    autonomous_max_iterations: 10,
    manager_id: '',
    system_prompt: '',
  });
  const [selectedPrompt, setSelectedPrompt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [availableManagers, setAvailableManagers] = useState<SessionInfo[]>([]);

  useEffect(() => { loadPrompts(); }, [loadPrompts]);

  // Load managers dynamically when role is worker
  useEffect(() => {
    if (formState.role === 'worker') {
      agentApi.listManagers().then(setAvailableManagers).catch(() => setAvailableManagers([]));
    }
  }, [formState.role]);

  const handlePromptChange = async (name: string) => {
    setSelectedPrompt(name);
    if (name) {
      const content = await loadPromptContent(name);
      if (content) setFormState(f => ({ ...f, system_prompt: content }));
    }
  };

  const handleRoleChange = (role: string) => {
    setFormState(f => ({ ...f, role, manager_id: role === 'manager' ? '' : f.manager_id }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await createSession(formState);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create session');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={modal.overlay} onClick={onClose}>
      <div className={cn(modal.box, '!max-w-[480px]')} onClick={e => e.stopPropagation()}>
        <div className={modal.header}>
          <h3 className={modal.title}>Create New Session</h3>
          <button className={btn.close} onClick={onClose}>×</button>
        </div>

        <div className={modal.body}>
          {error && <div className="text-[0.8125rem] text-[var(--danger-color)] bg-[rgba(239,68,68,0.1)] p-2.5 rounded-[6px] mb-2">{error}</div>}

          {/* Session Name */}
          <div className={form.group}>
            <label className={form.label}>Session Name</label>
            <input
              className={form.input}
              placeholder="e.g. my-worker-1"
              value={formState.session_name || ''} onChange={e => setFormState(f => ({ ...f, session_name: e.target.value }))} />
          </div>

          {/* Role + Model */}
          <div className="grid grid-cols-2 gap-4">
            <div className={form.group}>
              <label className={form.label}>Role</label>
              <select className={form.select} style={selectArrowStyle} value={formState.role} onChange={e => handleRoleChange(e.target.value)}>
                <option value="worker">Worker</option>
                <option value="manager">Manager</option>
              </select>
            </div>
            <div className={form.group}>
              <label className={form.label}>Model</label>
              <select className={form.select} style={selectArrowStyle} value={formState.model || ''} onChange={e => setFormState(f => ({ ...f, model: e.target.value }))}>
                {MODEL_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Manager selection – only for workers */}
          {formState.role === 'worker' && (
            <div className={form.group}>
              <label className={form.label}>Manager Session</label>
              <select className={form.select} style={selectArrowStyle} value={formState.manager_id || ''} onChange={e => setFormState(f => ({ ...f, manager_id: e.target.value }))}>
                <option value="">None (Standalone)</option>
                {availableManagers.map(m => {
                  const statusIcon = m.status === 'running' ? '🟢' : '⚪';
                  return (
                    <option key={m.session_id} value={m.session_id} disabled={m.status !== 'running'}>
                      {statusIcon} {m.session_name || m.session_id.substring(0, 12)}
                    </option>
                  );
                })}
              </select>
              <small className={form.hint}>Select a manager to control this worker</small>
            </div>
          )}

          {/* Prompt Template */}
          <div className={form.group}>
            <label className={form.label}>Prompt Template</label>
            <select className={form.select} style={selectArrowStyle} value={selectedPrompt} onChange={e => handlePromptChange(e.target.value)}>
              <option value="">Custom / None</option>
              {prompts.map(p => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Max Turns + Timeout */}
          <div className="grid grid-cols-2 gap-4">
            <div className={form.group}>
              <label className={form.label}>Max Turns</label>
              <NumberStepper value={formState.max_turns ?? 25} onChange={v => setFormState(f => ({ ...f, max_turns: v }))} min={1} max={500} step={5} />
            </div>
            <div className={form.group}>
              <label className={form.label}>Timeout (s)</label>
              <NumberStepper value={formState.timeout ?? 300} onChange={v => setFormState(f => ({ ...f, timeout: v }))} min={10} max={7200} step={30} />
            </div>
          </div>

          {/* Autonomous Mode – toggle */}
          <div className="flex items-center justify-between py-2 mb-1">
            <span className="text-[0.8125rem] font-medium text-[var(--text-secondary)]">Autonomous Mode</span>
            <button
              type="button"
              role="switch"
              aria-checked={formState.autonomous || false}
              className={cn(
                'relative w-[42px] h-6 rounded-xl cursor-pointer transition-all duration-200 p-0 shrink-0 border',
                formState.autonomous
                  ? 'bg-[var(--primary-color)] border-[var(--primary-color)]'
                  : 'bg-[var(--bg-tertiary)] border-[var(--border-color)]',
              )}
              onClick={() => setFormState(f => ({ ...f, autonomous: !f.autonomous }))}
            >
              <span className={cn(
                'absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white transition-transform duration-200 pointer-events-none',
                formState.autonomous && 'translate-x-[18px]',
              )} />
            </button>
          </div>

          {formState.autonomous && (
            <div className="grid grid-cols-2 gap-4">
              <div className={form.group}>
                <label className={form.label}>Max Iterations</label>
                <NumberStepper value={formState.autonomous_max_iterations ?? 10} onChange={v => setFormState(f => ({ ...f, autonomous_max_iterations: v }))} min={1} max={500} step={5} />
              </div>
            </div>
          )}

          {/* System Prompt */}
          <div className={form.group}>
            <label className={form.label}>System Prompt</label>
            <textarea className={form.textarea} rows={4} placeholder="Optional system prompt..."
              value={formState.system_prompt || ''} onChange={e => setFormState(f => ({ ...f, system_prompt: e.target.value }))} />
          </div>
        </div>

        <div className={modal.footer}>
          <button className={btn.ghost} onClick={onClose}>Cancel</button>
          <button className={btn.primary} onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Session'}
          </button>
        </div>
      </div>
    </div>
  );
}
