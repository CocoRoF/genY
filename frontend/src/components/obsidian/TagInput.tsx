'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { X, Tag } from 'lucide-react';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  /** All available tags for autocomplete suggestions */
  availableTags?: string[];
  placeholder?: string;
}

export default function TagInput({ tags, onChange, availableTags = [], placeholder }: TagInputProps) {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggIdx, setSelectedSuggIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    if (!input.trim()) return [];
    const q = input.toLowerCase().trim();
    return availableTags
      .filter(t => t.toLowerCase().includes(q) && !tags.includes(t))
      .slice(0, 8);
  }, [input, availableTags, tags]);

  useEffect(() => { setSelectedSuggIdx(0); }, [suggestions]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter(t => t !== tag));
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (showSuggestions && suggestions[selectedSuggIdx]) {
        addTag(suggestions[selectedSuggIdx]);
      } else if (input.trim()) {
        addTag(input);
      }
    } else if (e.key === 'ArrowDown' && showSuggestions) {
      e.preventDefault();
      setSelectedSuggIdx(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp' && showSuggestions) {
      e.preventDefault();
      setSelectedSuggIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  // Generate a consistent color from tag name
  const tagColor = (tag: string) => {
    let hash = 0;
    for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6', '#f97316'];
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1, minWidth: 100 }}>
      <div style={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4,
        padding: '3px 6px', minHeight: 28,
        background: 'var(--obs-bg-surface)', border: '1px solid var(--obs-border)',
        borderRadius: 4, cursor: 'text',
      }}
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map(tag => {
          const c = tagColor(tag);
          return (
            <span key={tag} style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '1px 6px', fontSize: 11, borderRadius: 3,
              background: `${c}18`, color: c, border: `1px solid ${c}30`,
              whiteSpace: 'nowrap',
            }}>
              <Tag size={9} />
              {tag}
              <button
                onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
                style={{
                  display: 'flex', alignItems: 'center', background: 'none', border: 'none',
                  cursor: 'pointer', color: c, padding: 0, marginLeft: 2,
                  opacity: 0.7,
                }}
                onMouseEnter={e => { (e.target as HTMLElement).style.opacity = '1'; }}
                onMouseLeave={e => { (e.target as HTMLElement).style.opacity = '0.7'; }}
              >
                <X size={10} />
              </button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          value={input}
          onChange={e => { setInput(e.target.value); setShowSuggestions(true); }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          placeholder={tags.length === 0 ? placeholder : ''}
          style={{
            flex: 1, minWidth: 60, background: 'none', border: 'none', outline: 'none',
            color: 'var(--obs-text)', fontSize: 11, padding: '2px 0',
          }}
        />
      </div>

      {/* Autocomplete dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          marginTop: 4, background: 'var(--obs-bg-surface)',
          border: '1px solid var(--obs-border)', borderRadius: 6,
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)', overflow: 'hidden',
        }}>
          {suggestions.map((s, i) => (
            <div
              key={s}
              onClick={() => addTag(s)}
              onMouseEnter={() => setSelectedSuggIdx(i)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
                fontSize: 12, cursor: 'pointer',
                background: i === selectedSuggIdx ? 'var(--obs-bg-hover)' : 'transparent',
                color: 'var(--obs-text)',
              }}
            >
              <Tag size={11} style={{ color: tagColor(s) }} />
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
