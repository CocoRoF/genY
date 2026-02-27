'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { commandApi } from '@/lib/api';
import { twMerge } from 'tailwind-merge';
import { useI18n } from '@/lib/i18n';
import { ClipboardList, Wrench, Search, BookOpen, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import type { LogEntry } from '@/types';

function cn(...classes: (string | boolean | undefined | null)[]) {
  return twMerge(classes.filter(Boolean).join(' '));
}

// ==================== Log Group Definitions ====================
// Each group is a superset of the previous — additive layering.

interface LogGroup {
  id: string;
  /** i18n key for label (under logsTab.*) */
  labelKey: string;
  /** i18n key for description */
  descKey: string;
  /** Levels included in this group */
  levels: string[];
  /** Icon component for quick scanning */
  Icon: React.ComponentType<{ size?: number; className?: string }>;
}

const LOG_GROUPS: LogGroup[] = [
  {
    id: 'brief',
    labelKey: 'groupBrief',
    descKey: 'groupBriefDesc',
    levels: ['INFO', 'COMMAND', 'RESPONSE', 'ERROR', 'WARNING'],
    Icon: ClipboardList,
  },
  {
    id: 'default',
    labelKey: 'groupDefault',
    descKey: 'groupDefaultDesc',
    levels: ['INFO', 'COMMAND', 'RESPONSE', 'ERROR', 'WARNING', 'TOOL', 'TOOL_RES', 'ITER'],
    Icon: Wrench,
  },
  {
    id: 'detail',
    labelKey: 'groupDetail',
    descKey: 'groupDetailDesc',
    levels: ['INFO', 'COMMAND', 'RESPONSE', 'ERROR', 'WARNING', 'TOOL', 'TOOL_RES', 'ITER', 'GRAPH', 'STREAM'],
    Icon: Search,
  },
  {
    id: 'all',
    labelKey: 'groupAll',
    descKey: 'groupAllDesc',
    levels: [],  // empty = all levels, no filter
    Icon: BookOpen,
  },
];

const ALL_LEVELS = ['INFO', 'ERROR', 'WARNING', 'DEBUG', 'COMMAND', 'RESPONSE', 'GRAPH', 'ITER', 'TOOL', 'TOOL_RES', 'STREAM'] as const;

const LEVEL_STYLE_MAP: Record<string, React.CSSProperties> = {
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

export default function LogsTab() {
  const { selectedSessionId } = useAppStore();
  const { t } = useI18n();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  // filter stores either:
  //   ''            → no filter (all)
  //   'group:xxx'   → group id
  //   'LEVEL'       → single level
  const [filter, setFilter] = useState('group:default');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  /** Resolve the current filter to a comma-separated level string for the API. */
  const apiLevelParam = useMemo(() => {
    if (!filter) return undefined;                       // all
    if (filter.startsWith('group:')) {
      const groupId = filter.slice(6);
      const group = LOG_GROUPS.find(g => g.id === groupId);
      if (!group || group.levels.length === 0) return undefined;  // "all" group
      return group.levels.join(',');
    }
    return filter;  // single level
  }, [filter]);

  const fetchLogs = useCallback(async () => {
    if (!selectedSessionId) return;
    try {
      const res = await commandApi.getLogs(selectedSessionId, 200, apiLevelParam);
      setEntries(res.entries || []);
    } catch { /* ignore */ }
  }, [selectedSessionId, apiLevelParam]);

  useEffect(() => {
    fetchLogs();
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [fetchLogs, autoRefresh]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  if (!selectedSessionId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <h3 className="text-[1rem] font-medium text-[var(--text-secondary)] mb-2">{t('logsTab.selectSession')}</h3>
          <p className="text-[0.8125rem] text-[var(--text-muted)]">{t('logsTab.selectSessionDesc')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 p-6 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-3 shrink-0">
        <h3 className="text-[1rem] font-semibold">{t('logsTab.title')}</h3>
        <div className="flex gap-3 items-center">
          {/* ── Filter selector: groups + separator + individual levels ── */}
          <select
            className="py-1.5 pl-2.5 pr-7 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-[6px] text-[var(--text-primary)] text-[0.75rem] font-medium cursor-pointer appearance-none transition-all hover:border-[var(--text-muted)] hover:bg-[var(--bg-secondary)] focus:outline-none focus:border-[var(--primary-color)] focus:shadow-[0_0_0_2px_rgba(59,130,246,0.15)]"
            style={{
              backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 8px center',
            }}
            value={filter}
            onChange={e => setFilter(e.target.value)}
          >
            {/* ── Groups ── */}
            {LOG_GROUPS.map(g => (
              <option key={g.id} value={`group:${g.id}`}>
                {t(`logsTab.${g.labelKey}`)} — {t(`logsTab.${g.descKey}`)}
              </option>
            ))}
            {/* ── Separator ── */}
            <option disabled>{'─'.repeat(20)}</option>
            {/* ── Individual levels ── */}
            {ALL_LEVELS.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-[0.8125rem] text-[var(--text-secondary)] cursor-pointer">
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
            {t('logsTab.autoRefresh')}
          </label>
          <button
            className={cn(
              "py-2 px-4 bg-transparent hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] text-[0.8125rem] font-medium rounded-[var(--border-radius)] cursor-pointer transition-all duration-150 border border-[var(--border-color)]",
              "!py-1.5 !px-3 text-[0.75rem] inline-flex items-center gap-1.5",
            )}
            onClick={fetchLogs}
          >
            <RefreshCw size={12} /> {t('common.refresh')}
          </button>
        </div>
      </div>

      {/* Log Content */}
      <div className="flex-1 min-h-0 overflow-auto bg-[var(--bg-secondary)] rounded-[var(--border-radius)] p-1">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <p className="text-[0.8125rem] text-[var(--text-muted)]">{t('logsTab.noLogs')}</p>
          </div>
        ) : (
          entries.map((entry, idx) => {
            const isExpandable = entry.message.length > 200;
            const isExpanded = expandedIdx === idx;
            return (
              <div
                key={idx}
                className={`rounded-[var(--border-radius)] font-mono text-[0.8125rem] mb-[2px] transition-colors ${isExpanded ? 'bg-[var(--bg-tertiary)] p-4' : 'py-2.5 px-4 hover:bg-[var(--bg-tertiary)]'} ${isExpandable ? 'cursor-pointer' : ''}`}
                onClick={() => isExpandable && setExpandedIdx(isExpanded ? null : idx)}
              >
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-[var(--text-muted)] whitespace-nowrap">{entry.timestamp}</span>
                  <span
                    className="inline-block py-[2px] px-2 rounded-[4px] text-[0.6875rem] font-semibold min-w-[64px] text-center uppercase tracking-[0.025em]"
                    style={LEVEL_STYLE_MAP[entry.level] || {}}
                  >
                    {entry.level}
                  </span>
                  {isExpandable && (
                    <span className={`text-[0.75rem] transition-transform ${isExpanded ? 'text-[var(--primary-color)]' : 'text-[var(--text-muted)]'}`}>
                      {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </span>
                  )}
                </div>
                {isExpandable && !isExpanded ? (
                  <span className="ml-6 text-[var(--text-secondary)] whitespace-nowrap overflow-hidden text-ellipsis block max-w-full">
                    {entry.message.substring(0, 200)}...
                  </span>
                ) : isExpandable && isExpanded ? (
                  <div className="ml-6 mt-2 bg-[var(--bg-secondary)] p-3 rounded-[var(--border-radius)] max-h-[400px] overflow-y-auto whitespace-pre-wrap break-words text-[var(--text-primary)]">
                    {entry.message}
                  </div>
                ) : (
                  <span className="text-[var(--text-primary)] break-words">{entry.message}</span>
                )}
              </div>
            );
          })
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}
