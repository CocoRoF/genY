'use client';

import { useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { agentApi } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Play, Square, Loader2, Terminal, Zap, Wrench } from 'lucide-react';

// ── Level badge colours (same palette as LogsTab) ──
const LEVEL_STYLE: Record<string, React.CSSProperties> = {
  DEBUG:    { backgroundColor: 'rgba(113, 113, 122, 0.2)', color: 'var(--text-muted)' },
  INFO:     { backgroundColor: 'rgba(59, 130, 246, 0.2)',  color: 'var(--primary-color)' },
  WARNING:  { backgroundColor: 'rgba(245, 158, 11, 0.2)',  color: 'var(--warning-color)' },
  ERROR:    { backgroundColor: 'rgba(239, 68, 68, 0.2)',   color: 'var(--danger-color)' },
  COMMAND:  { backgroundColor: 'rgba(16, 185, 129, 0.2)',  color: 'var(--success-color)' },
  RESPONSE: { backgroundColor: 'rgba(168, 85, 247, 0.2)',  color: '#a78bfa' },
  ITER:     { backgroundColor: 'rgba(251, 146, 60, 0.2)',  color: '#fb923c' },
  TOOL:     { backgroundColor: 'rgba(34, 211, 238, 0.2)',  color: '#22d3ee' },
  TOOL_RES: { backgroundColor: 'rgba(6, 182, 212, 0.15)',  color: '#06b6d4' },
  STREAM:   { backgroundColor: 'rgba(148, 163, 184, 0.2)', color: '#94a3b8' },
  GRAPH:    { backgroundColor: 'rgba(139, 92, 246, 0.2)',  color: '#8b5cf6' },
};

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export default function CommandTab() {
  const { selectedSessionId, sessions, isExecuting, setIsExecuting, getSessionData, updateSessionData } = useAppStore();
  const { t } = useI18n();
  const outputEndRef = useRef<HTMLDivElement>(null);

  const session = sessions.find(s => s.session_id === selectedSessionId);
  const sessionData = selectedSessionId ? getSessionData(selectedSessionId) : null;

  // Auto-scroll output area when new content arrives
  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessionData?.output]);

  const handleExecute = useCallback(async () => {
    if (!selectedSessionId || !sessionData?.input?.trim()) return;
    setIsExecuting(true);
    updateSessionData(selectedSessionId, {
      status: 'running',
      statusText: t('commandTab.statusExecuting'),
      output: '',
      logEntries: [],
    });

    try {
      await agentApi.executeStream(
        selectedSessionId,
        { prompt: sessionData.input },
        (eventType, eventData) => {
          switch (eventType) {
            case 'log': {
              const entry = eventData as unknown as LogEntry;
              // Append log entry to structured log list
              updateSessionData(selectedSessionId, {
                logEntries: [
                  ...(useAppStore.getState().sessionDataCache[selectedSessionId]?.logEntries || []),
                  entry,
                ],
              });
              break;
            }

            case 'status': {
              const status = eventData.status as string;
              const msg = eventData.message as string;
              if (status === 'running') {
                updateSessionData(selectedSessionId, { status: 'running', statusText: msg });
              } else if (status === 'completed') {
                updateSessionData(selectedSessionId, { status: 'success', statusText: msg });
              } else if (status === 'error') {
                updateSessionData(selectedSessionId, { status: 'error', statusText: msg });
              }
              break;
            }

            case 'result': {
              const result = eventData;
              const success = result.success as boolean;
              const output = (result.output || result.error || t('common.noOutput')) as string;
              const durationMs = result.duration_ms as number | undefined;
              updateSessionData(selectedSessionId, {
                output,
                status: success ? 'success' : 'error',
                statusText: success
                  ? `${t('commandTab.statusSuccess')}${durationMs ? ` (${(durationMs / 1000).toFixed(1)}s)` : ''}`
                  : `${(result.error || t('commandTab.statusFailed')) as string}`,
              });
              break;
            }

            case 'error': {
              updateSessionData(selectedSessionId, {
                output: (eventData.error || t('commandTab.requestFailed')) as string,
                status: 'error',
                statusText: t('commandTab.statusFailed'),
              });
              break;
            }
          }
        },
      );
    } catch (e: unknown) {
      updateSessionData(selectedSessionId, {
        output: e instanceof Error ? e.message : t('commandTab.requestFailed'),
        status: 'error',
        statusText: t('commandTab.requestFailed'),
      });
    } finally {
      setIsExecuting(false);
    }
  }, [selectedSessionId, sessionData?.input, setIsExecuting, updateSessionData, t]);

  const handleStop = useCallback(async () => {
    if (!selectedSessionId) return;
    try {
      await agentApi.stop(selectedSessionId);
      updateSessionData(selectedSessionId, { statusText: t('commandTab.statusStopped') });
    } catch { /* ignore */ }
  }, [selectedSessionId, updateSessionData, t]);

  if (!selectedSessionId || !session) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <h3 className="text-[1rem] font-medium text-[var(--text-secondary)] mb-2">{t('commandTab.selectSession')}</h3>
          <p className="text-[0.8125rem] text-[var(--text-muted)]">{t('commandTab.selectSessionDesc')}</p>
        </div>
      </div>
    );
  }

  const logEntries: LogEntry[] = sessionData?.logEntries || [];

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Session Header Bar */}
      <div className="shrink-0 px-3 md:px-6 py-3 md:py-4 bg-gradient-to-r from-[rgba(59,130,246,0.06)] to-transparent border-b border-[var(--border-color)]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-[var(--primary-color)] flex items-center justify-center shadow-[0_0_12px_rgba(59,130,246,0.25)] shrink-0">
              <Terminal size={16} className="text-white md:hidden" />
              <Terminal size={18} className="text-white hidden md:block" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[0.9375rem] font-semibold text-[var(--text-primary)] leading-tight">
                {session.session_name || t('sidebar.sessionFallback', { id: session.session_id.substring(0, 8) })}
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase tracking-wider"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                >
                  {session.role}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6875rem] bg-[rgba(100,116,139,0.12)] border border-[var(--border-color)] text-[var(--text-muted)]">
                  <Zap size={10} />
                  {session.graph_name || t('commandTab.single')}
                </span>
                {session.tool_preset_name && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6875rem] bg-[rgba(100,116,139,0.12)] border border-[var(--border-color)] text-[var(--text-muted)]">
                    <Wrench size={10} />
                    {session.tool_preset_name}
                  </span>
                )}
                {session.max_turns && <span className="text-[0.6875rem] text-[var(--text-muted)]">{t('commandTab.maxTurns')}: {session.max_turns}</span>}
              </div>
            </div>
          </div>
          {sessionData?.statusText && (
            <div className={`hidden sm:inline-flex items-center gap-1.5 px-2 md:px-3 py-1 md:py-1.5 rounded-full text-[0.6875rem] md:text-[0.75rem] font-medium shrink-0 ${
              sessionData.status === 'success' ? 'bg-[rgba(16,185,129,0.1)] text-[var(--success-color)] border border-[rgba(16,185,129,0.2)]'
                : sessionData.status === 'error' ? 'bg-[rgba(239,68,68,0.1)] text-[var(--danger-color)] border border-[rgba(239,68,68,0.2)]'
                : 'bg-[rgba(245,158,11,0.1)] text-[var(--warning-color)] border border-[rgba(245,158,11,0.2)]'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                sessionData.status === 'success' ? 'bg-[var(--success-color)]'
                  : sessionData.status === 'error' ? 'bg-[var(--danger-color)]'
                  : 'bg-[var(--warning-color)] animate-pulse'
              }`} />
              {sessionData.statusText}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col flex-1 p-3 md:p-6 gap-3 md:gap-5 min-h-0">
        {/* Command Input Area */}
        <div className="flex flex-col gap-3 shrink-0">
          <div className="relative">
            <textarea
              className="w-full p-3 md:p-4 pr-[100px] md:pr-[140px] bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-[0.8125rem] md:text-[0.875rem] font-[inherit] resize-y min-h-[80px] md:min-h-[120px] transition-all placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary-color)] focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]"
              placeholder={t('commandTab.placeholder')}
              value={sessionData?.input || ''}
              onChange={e => updateSessionData(selectedSessionId, { input: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleExecute(); }}
            />
            <div className="absolute bottom-3 right-3 flex items-center gap-2">
              {isExecuting && (
                <button
                  className="h-9 px-3.5 bg-[var(--danger-color)] hover:brightness-110 text-white text-[0.8125rem] font-medium rounded-lg cursor-pointer transition-all duration-150 border-none inline-flex items-center gap-1.5 shadow-md"
                  onClick={handleStop}
                >
                  <Square size={13} /> {t('commandTab.stopBtn')}
                </button>
              )}
              <button
                className="h-9 px-4 bg-[var(--primary-color)] hover:bg-[var(--primary-hover)] text-white text-[0.8125rem] font-semibold rounded-lg cursor-pointer transition-all duration-150 border-none disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5 shadow-[0_2px_8px_rgba(59,130,246,0.3)] hover:shadow-[0_4px_12px_rgba(59,130,246,0.4)]"
                disabled={isExecuting || !sessionData?.input?.trim()}
                onClick={() => handleExecute()}
              >
                {isExecuting ? <><Loader2 size={14} className="animate-spin" /> {t('commandTab.executingBtn')}</> : <><Play size={14} /> {t('commandTab.executeBtn')}</>}
              </button>
            </div>
          </div>
          <div className="text-[0.6875rem] text-[var(--text-muted)] pl-1">Ctrl + Enter</div>
        </div>

        {/* Output Area — real-time streaming logs + final result */}
        <div className="flex-1 flex flex-col min-h-[200px]">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-[0.75rem] font-semibold text-[var(--text-muted)] uppercase tracking-[0.08em] inline-flex items-center gap-1.5">
              <Terminal size={12} />
              {t('commandTab.output')}
              {logEntries.length > 0 && (
                <span className="ml-1 text-[0.625rem] font-normal text-[var(--text-muted)]">
                  ({logEntries.length} events)
                </span>
              )}
            </h3>
          </div>

          <div className="flex-1 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] overflow-auto font-mono text-[0.8125rem]">
            {logEntries.length > 0 ? (
              <div className="p-1">
                {logEntries.map((entry, idx) => (
                  <div
                    key={idx}
                    className="py-1.5 px-3 hover:bg-[var(--bg-tertiary)] rounded-[4px] mb-[1px] transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[var(--text-muted)] whitespace-nowrap text-[0.6875rem]">{entry.timestamp}</span>
                      <span
                        className="inline-block py-[1px] px-1.5 rounded-[3px] text-[0.5625rem] font-semibold min-w-[48px] text-center uppercase tracking-[0.025em]"
                        style={LEVEL_STYLE[entry.level] || {}}
                      >
                        {entry.level}
                      </span>
                    </div>
                    <span className="text-[var(--text-secondary)] break-words whitespace-pre-wrap leading-[1.6]">
                      {entry.message}
                    </span>
                  </div>
                ))}
                <div ref={outputEndRef} />
              </div>
            ) : sessionData?.output && sessionData.output !== t('common.noOutput') ? (
              <pre className="p-5 whitespace-pre-wrap break-words text-[var(--text-secondary)] leading-[1.7]">
                {sessionData.output}
              </pre>
            ) : (
              <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-[0.8125rem]">
                {t('common.noOutput')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
