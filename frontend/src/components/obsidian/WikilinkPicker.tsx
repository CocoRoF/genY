'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { Link2, FileText, Calendar, Bookmark, Users, FolderKanban, Lightbulb } from 'lucide-react';
import type { MemoryFileInfo } from '@/types';

interface WikilinkPickerProps {
  files: Record<string, MemoryFileInfo>;
  onSelect: (filename: string, alias?: string) => void;
  onClose: () => void;
}

const CATEGORY_ICONS: Record<string, typeof FileText> = {
  daily: Calendar, topics: Bookmark, entities: Users,
  projects: FolderKanban, insights: Lightbulb, root: FileText,
};
const CATEGORY_COLORS: Record<string, string> = {
  daily: '#f59e0b', topics: '#3b82f6', entities: '#10b981',
  projects: '#8b5cf6', insights: '#ec4899', root: '#64748b',
};

export default function WikilinkPicker({ files, onSelect, onClose }: WikilinkPickerProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [alias, setAlias] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [showAlias, setShowAlias] = useState(false);
  const [chosenFile, setChosenFile] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const aliasRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { if (showAlias) aliasRef.current?.focus(); }, [showAlias]);

  const results = useMemo(() => {
    const entries = Object.values(files);
    if (!query.trim()) {
      return entries.sort((a, b) => (b.modified || '').localeCompare(a.modified || '')).slice(0, 20);
    }
    const q = query.toLowerCase();
    return entries
      .filter(f => f.title.toLowerCase().includes(q) || f.filename.toLowerCase().includes(q))
      .slice(0, 20);
  }, [files, query]);

  useEffect(() => { setSelectedIdx(0); }, [query]);

  const confirmSelection = (filename: string) => {
    setChosenFile(filename);
    setShowAlias(true);
  };

  const finalSelect = () => {
    if (chosenFile) {
      onSelect(chosenFile, alias.trim() || undefined);
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showAlias) {
      if (e.key === 'Enter') { e.preventDefault(); finalSelect(); }
      if (e.key === 'Escape') { setShowAlias(false); setChosenFile(null); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIdx]) confirmSelection(results[selectedIdx].filename);
    }
    else if (e.key === 'Escape') { onClose(); }
  };

  const chosenInfo = chosenFile ? files[chosenFile] : null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '18vh',
        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: 460, maxHeight: '50vh', display: 'flex', flexDirection: 'column',
        background: 'var(--obs-bg-surface)', borderRadius: 12,
        border: '1px solid var(--obs-border)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
          borderBottom: '1px solid var(--obs-border-subtle)',
        }}>
          <Link2 size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
          {!showAlias ? (
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('opsidian.wikilinkPlaceholder')}
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: 'var(--obs-text)', fontSize: 14,
              }}
            />
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 11, color: 'var(--obs-text-muted)' }}>
                {t('opsidian.wikilinkTo')}: <strong style={{ color: 'var(--obs-text)' }}>{chosenInfo?.title || chosenFile}</strong>
              </div>
              <input
                ref={aliasRef}
                value={alias}
                onChange={e => setAlias(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('opsidian.wikilinkAliasPlaceholder')}
                style={{
                  background: 'none', border: 'none', outline: 'none',
                  color: 'var(--obs-text)', fontSize: 13,
                }}
              />
            </div>
          )}
          <kbd style={{
            padding: '2px 6px', fontSize: 10, borderRadius: 3,
            background: 'var(--obs-bg-hover)', color: 'var(--obs-text-muted)',
            border: '1px solid var(--obs-border)',
          }}>ESC</kbd>
        </div>

        {/* Results (hidden when alias input shown) */}
        {!showAlias && (
          <div style={{ overflowY: 'auto', maxHeight: '40vh' }}>
            {results.map((f, i) => {
              const Icon = CATEGORY_ICONS[f.category] || FileText;
              return (
                <div
                  key={f.filename}
                  onClick={() => confirmSelection(f.filename)}
                  onMouseEnter={() => setSelectedIdx(i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px',
                    cursor: 'pointer',
                    background: i === selectedIdx ? 'var(--obs-bg-hover)' : 'transparent',
                  }}
                >
                  <Icon size={13} style={{ color: CATEGORY_COLORS[f.category] || '#64748b', flexShrink: 0 }} />
                  <span style={{
                    flex: 1, fontSize: 13, color: 'var(--obs-text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {f.title || f.filename}
                  </span>
                </div>
              );
            })}
            {results.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--obs-text-muted)', fontSize: 12 }}>
                {t('opsidian.noResults')}
              </div>
            )}
          </div>
        )}

        {/* Alias confirmation */}
        {showAlias && (
          <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              onClick={() => { setShowAlias(false); setChosenFile(null); }}
              style={{
                padding: '6px 14px', fontSize: 12, background: 'var(--obs-bg-hover)',
                color: 'var(--obs-text-dim)', border: '1px solid var(--obs-border)',
                borderRadius: 5, cursor: 'pointer',
              }}
            >
              {t('opsidian.cancel')}
            </button>
            <button
              onClick={finalSelect}
              style={{
                padding: '6px 14px', fontSize: 12, fontWeight: 600,
                background: 'var(--obs-purple)', color: '#fff',
                border: 'none', borderRadius: 5, cursor: 'pointer',
              }}
            >
              {t('opsidian.insertWikilink')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
