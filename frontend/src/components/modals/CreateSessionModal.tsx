'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { agentApi } from '@/lib/api';
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

  const [form, setForm] = useState<CreateAgentRequest>({
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
    if (form.role === 'worker') {
      agentApi.listManagers().then(setAvailableManagers).catch(() => setAvailableManagers([]));
    }
  }, [form.role]);

  const handlePromptChange = async (name: string) => {
    setSelectedPrompt(name);
    if (name) {
      const content = await loadPromptContent(name);
      if (content) setForm(f => ({ ...f, system_prompt: content }));
    }
  };

  const handleRoleChange = (role: string) => {
    setForm(f => ({ ...f, role, manager_id: role === 'manager' ? '' : f.manager_id }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await createSession(form);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create session');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Create New Session</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {error && <div className="text-[0.8125rem] text-[var(--danger-color)] bg-[rgba(239,68,68,0.1)] p-2.5 rounded-[var(--border-radius)] mb-2">{error}</div>}

          {/* Session Name */}
          <div className="form-group">
            <label>Session Name</label>
            <input
              placeholder="e.g. my-worker-1"
              value={form.session_name || ''} onChange={e => setForm(f => ({ ...f, session_name: e.target.value }))} />
          </div>

          {/* Role + Model */}
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label>Role</label>
              <select value={form.role} onChange={e => handleRoleChange(e.target.value)}>
                <option value="worker">Worker</option>
                <option value="manager">Manager</option>
              </select>
            </div>
            <div className="form-group">
              <label>Model</label>
              <select value={form.model || ''} onChange={e => setForm(f => ({ ...f, model: e.target.value }))}>
                {MODEL_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Manager selection – only for workers */}
          {form.role === 'worker' && (
            <div className="form-group">
              <label>Manager Session</label>
              <select value={form.manager_id || ''} onChange={e => setForm(f => ({ ...f, manager_id: e.target.value }))}>
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
              <small className="form-hint">Select a manager to control this worker</small>
            </div>
          )}

          {/* Prompt Template */}
          <div className="form-group">
            <label>Prompt Template</label>
            <select value={selectedPrompt} onChange={e => handlePromptChange(e.target.value)}>
              <option value="">Custom / None</option>
              {prompts.map(p => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Max Turns + Timeout */}
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label>Max Turns</label>
              <NumberStepper value={form.max_turns ?? 25} onChange={v => setForm(f => ({ ...f, max_turns: v }))} min={1} max={500} step={5} />
            </div>
            <div className="form-group">
              <label>Timeout (s)</label>
              <NumberStepper value={form.timeout ?? 300} onChange={v => setForm(f => ({ ...f, timeout: v }))} min={10} max={7200} step={30} />
            </div>
          </div>

          {/* Autonomous Mode – toggle */}
          <div className="toggle-row">
            <span className="toggle-label">Autonomous Mode</span>
            <button
              type="button"
              role="switch"
              aria-checked={form.autonomous || false}
              className={`toggle-switch${form.autonomous ? ' active' : ''}`}
              onClick={() => setForm(f => ({ ...f, autonomous: !f.autonomous }))}
            >
              <span className="toggle-knob" />
            </button>
          </div>

          {form.autonomous && (
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label>Max Iterations</label>
                <NumberStepper value={form.autonomous_max_iterations ?? 10} onChange={v => setForm(f => ({ ...f, autonomous_max_iterations: v }))} min={1} max={500} step={5} />
              </div>
            </div>
          )}

          {/* System Prompt */}
          <div className="form-group">
            <label>System Prompt</label>
            <textarea rows={4} placeholder="Optional system prompt..."
              value={form.system_prompt || ''} onChange={e => setForm(f => ({ ...f, system_prompt: e.target.value }))} />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Session'}
          </button>
        </div>
      </div>
    </div>
  );
}
