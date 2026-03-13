'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { commandApi } from '@/lib/api';
import { twMerge } from 'tailwind-merge';
import { useI18n } from '@/lib/i18n';
import {
  ClipboardList,
  Wrench,
  Search,
  BookOpen,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import type { LogEntry } from '@/types';

function cn(...classes: (string | boolean | undefined | null)[]) {
  return twMerge(classes.filter(Boolean).join(' '));
}

// ==================== Log Group Definitions ====================

interface LogGroup {
  id: string;
  labelKey: string;
  descKey: string;
  levels: string[];
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
    levels: [],
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

const PAGE_SIZE = 50;

export default function LogsTab() {
  const { selectedSessionId } = useAppStore();
  const { t } = useI18n();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [filter, setFilter] = useState('group:default');
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.max(1, Math.ceil(totalEntries / PAGE_SIZE));

  /** Resolve the current filter to a comma-separated level string for the API. */
  const apiLevelParam = useMemo(() => {
    if (!filter) return undefined;
    if (filter.startsWith('group:')) {
      const groupId = filter.slice(6);
      const group = LOG_GROUPS.find(g => g.id === groupId);
      if (!group || group.levels.length === 0) return undefined;
      return group.levels.join(',');
    }
    return filter;
  }, [filter]);

  const fetchLogs = useCallback(async (page: number) => {
    if (!selectedSessionId) return;
    setLoading(true);
    try {
      const offset = (page - 1) * PAGE_SIZE;
      const res = await commandApi.getLogs(selectedSessionId, PAGE_SIZE, apiLevelParam, offset);
      setEntries(res.entries || []);
      setTotalEntries(res.total_entries || 0);
      setExpandedIdx(null);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [selectedSessionId, apiLevelParam]);

  // Fetch on session/filter/page change
  useEffect(() => {
    fetchLogs(currentPage);
  }, [fetchLogs, currentPage]);

  // Reset to page 1 when session or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedSessionId, apiLevelParam]);

  // Scroll to top when entries change
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [entries]);

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

  const pageStart = (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, totalEntries);

  return (
    <div className="flex flex-col flex-1 p-3 md:p-6 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center mb-3 md:mb-4 flex-wrap gap-2 md:gap-3 shrink-0">
        <h3 className="text-[0.9375rem] md:text-[1rem] font-semibold">{t('logsTab.title')}</h3>
        <div className="flex gap-2 md:gap-3 items-center flex-wrap">
          {/* Filter selector */}
          <select
            className="py-1.5 pl-2.5 pr-7 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-[6px] text-[var(--text-primary)] text-[0.75rem] font-medium cursor-pointer appearance-none transition-all hover:border-[var(--text-muted)] hover:bg-[var(--bg-secondary)] focus:outline-none focus:border-[var(--primary-color)] focus:shadow-[0_0_0_2px_rgba(59,130,246,0.15)]"
            style={{
              backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 8px center',
            }}
            value={filter}
            onChange={e => { setFilter(e.target.value); setCurrentPage(1); }}
          >
            {LOG_GROUPS.map(g => (
              <option key={g.id} value={`group:${g.id}`}>
                {t(`logsTab.${g.labelKey}`)} — {t(`logsTab.${g.descKey}`)}
              </option>
            ))}
            <option disabled>{'─'.repeat(20)}</option>
            {ALL_LEVELS.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>

          <button
            className={cn(
              "py-2 px-4 bg-transparent hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] text-[0.8125rem] font-medium rounded-[var(--border-radius)] cursor-pointer transition-all duration-150 border border-[var(--border-color)]",
              "!py-1.5 !px-3 text-[0.75rem] inline-flex items-center gap-1.5",
              loading && "opacity-60 pointer-events-none",
            )}
            onClick={() => fetchLogs(currentPage)}
            disabled={loading}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> {t('common.refresh')}
          </button>
        </div>
      </div>

      {/* Log Content */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto bg-[var(--bg-secondary)] rounded-[var(--border-radius)] p-1">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <p className="text-[0.8125rem] text-[var(--text-muted)]">
              {loading ? 'Loading...' : t('logsTab.noLogs')}
            </p>
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
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mb-1">
                  <span className="text-[var(--text-muted)] whitespace-nowrap text-[0.6875rem] md:text-[0.8125rem]">{entry.timestamp}</span>
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block py-[2px] px-2 rounded-[4px] text-[0.625rem] md:text-[0.6875rem] font-semibold min-w-[52px] md:min-w-[64px] text-center uppercase tracking-[0.025em]"
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
      </div>

      {/* Pagination Bar */}
      {totalEntries > 0 && (
        <div className="shrink-0 flex items-center justify-between pt-3 px-1">
          <span className="text-[0.75rem] text-[var(--text-muted)]">
            {pageStart}–{pageEnd} of {totalEntries.toLocaleString()} entries (newest first)
          </span>
          <div className="flex items-center gap-1">
            <button
              className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-30 disabled:pointer-events-none border border-transparent hover:border-[var(--border-color)]"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(1)}
              title="First page"
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-30 disabled:pointer-events-none border border-transparent hover:border-[var(--border-color)]"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              title="Previous page"
            >
              <ChevronLeft size={14} />
            </button>

            {/* Page number buttons */}
            {(() => {
              const pages: number[] = [];
              const maxVisible = 5;
              let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
              const end = Math.min(totalPages, start + maxVisible - 1);
              if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
              for (let i = start; i <= end; i++) pages.push(i);
              return pages.map(p => (
                <button
                  key={p}
                  className={cn(
                    "w-8 h-8 rounded-md flex items-center justify-center text-[0.75rem] font-medium transition-colors border",
                    p === currentPage
                      ? "bg-[var(--primary-color)] text-white border-[var(--primary-color)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] border-transparent hover:border-[var(--border-color)]",
                  )}
                  onClick={() => setCurrentPage(p)}
                >
                  {p}
                </button>
              ));
            })()}

            <button
              className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-30 disabled:pointer-events-none border border-transparent hover:border-[var(--border-color)]"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              title="Next page"
            >
              <ChevronRight size={14} />
            </button>
            <button
              className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-30 disabled:pointer-events-none border border-transparent hover:border-[var(--border-color)]"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              title="Last page"
            >
              <ChevronsRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
