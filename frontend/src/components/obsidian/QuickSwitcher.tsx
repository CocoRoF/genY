'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { Search, FileText, Calendar, Bookmark, Users, FolderKanban, Lightbulb, Plus } from 'lucide-react';
import type { MemoryFileInfo } from '@/types';

interface QuickSwitcherProps {
  files: Record<string, MemoryFileInfo>;
  onSelect: (filename: string) => void;
  onClose: () => void;
  onCreateNote?: () => void;
}

const CATEGORY_ICONS: Record<string, typeof FileText> = {
  daily: Calendar, topics: Bookmark, entities: Users,
  projects: FolderKanban, insights: Lightbulb, root: FileText,
};
const CATEGORY_COLORS: Record<string, string> = {
  daily: '#f59e0b', topics: '#3b82f6', entities: '#10b981',
  projects: '#8b5cf6', insights: '#ec4899', root: '#64748b',
};

function fuzzyMatch(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return 100 - t.indexOf(q); // exact substring match
  let qi = 0;
  let score = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) { score += 10; qi++; }
  }
  return qi === q.length ? score : 0;
}

export default function QuickSwitcher({ files, onSelect, onClose, onCreateNote }: QuickSwitcherProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = useMemo(() => {
    const entries = Object.values(files);
    if (!query.trim()) {
      // Show all, sorted by modified desc
      return entries.sort((a, b) =>
        (b.modified || '').localeCompare(a.modified || '')
      ).slice(0, 30);
    }
    return entries
      .map(f => ({
        file: f,
        score: Math.max(
          fuzzyMatch(query, f.title),
          fuzzyMatch(query, f.filename),
          ...f.tags.map(tag => fuzzyMatch(query, tag) * 0.8),
        ),
      }))
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map(r => r.file);
  }, [files, query]);

  useEffect(() => { setSelectedIdx(0); }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[selectedIdx] as HTMLElement;
    item?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, results.length - (onCreateNote && query ? 0 : 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIdx === results.length && onCreateNote && query) {
        onCreateNote();
        onClose();
      } else if (results[selectedIdx]) {
        onSelect(results[selectedIdx].filename);
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '15vh',
        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: 520, maxHeight: '60vh', display: 'flex', flexDirection: 'column',
        background: 'var(--obs-bg-surface)', borderRadius: 12,
        border: '1px solid var(--obs-border)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        overflow: 'hidden',
      }}>
        {/* Search input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
          borderBottom: '1px solid var(--obs-border-subtle)',
        }}>
          <Search size={16} style={{ color: 'var(--obs-text-muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('opsidian.quickSwitcherPlaceholder')}
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: 'var(--obs-text)', fontSize: 14,
            }}
          />
          <kbd style={{
            padding: '2px 6px', fontSize: 10, borderRadius: 3,
            background: 'var(--obs-bg-hover)', color: 'var(--obs-text-muted)',
            border: '1px solid var(--obs-border)',
          }}>ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ overflowY: 'auto', maxHeight: '50vh' }}>
          {results.map((f, i) => {
            const Icon = CATEGORY_ICONS[f.category] || FileText;
            const isSelected = i === selectedIdx;
            return (
              <div
                key={f.filename}
                onClick={() => { onSelect(f.filename); onClose(); }}
                onMouseEnter={() => setSelectedIdx(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px',
                  cursor: 'pointer',
                  background: isSelected ? 'var(--obs-bg-hover)' : 'transparent',
                  transition: 'background 80ms ease',
                }}
              >
                <Icon size={14} style={{ color: CATEGORY_COLORS[f.category] || '#64748b', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, color: 'var(--obs-text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {f.title || f.filename}
                  </div>
                  {f.tags.length > 0 && (
                    <div style={{
                      fontSize: 10, color: 'var(--obs-text-muted)', marginTop: 1,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {f.tags.slice(0, 4).join(' · ')}
                    </div>
                  )}
                </div>
                <span style={{
                  fontSize: 10, color: CATEGORY_COLORS[f.category] || '#64748b',
                  padding: '2px 6px', borderRadius: 3,
                  background: `${CATEGORY_COLORS[f.category] || '#64748b'}15`,
                }}>
                  {f.category}
                </span>
              </div>
            );
          })}

          {/* Create new note option */}
          {onCreateNote && query && (
            <div
              onClick={() => { onCreateNote(); onClose(); }}
              onMouseEnter={() => setSelectedIdx(results.length)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px',
                cursor: 'pointer', borderTop: '1px solid var(--obs-border-subtle)',
                background: selectedIdx === results.length ? 'var(--obs-bg-hover)' : 'transparent',
              }}
            >
              <Plus size={14} style={{ color: 'var(--obs-purple-bright)' }} />
              <span style={{ fontSize: 13, color: 'var(--obs-purple-bright)' }}>
                {t('opsidian.createNoteWith')} "{query}"
              </span>
            </div>
          )}

          {results.length === 0 && !query && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--obs-text-muted)', fontSize: 12 }}>
              {t('opsidian.emptyVault')}
            </div>
          )}
          {results.length === 0 && query && !onCreateNote && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--obs-text-muted)', fontSize: 12 }}>
              {t('opsidian.noResults')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
