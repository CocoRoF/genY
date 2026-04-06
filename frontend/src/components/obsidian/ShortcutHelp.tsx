'use client';

import { useI18n } from '@/lib/i18n';
import { Keyboard, X } from 'lucide-react';
import { SHORTCUT_MAP, type ShortcutDef } from './useOpsidianShortcuts';

interface ShortcutHelpProps {
  onClose: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  nav: 'Navigation',
  view: 'View Modes',
  note: 'Note Actions',
  edit: 'Editing',
};

function formatKey(key: string): string {
  return key
    .split('+')
    .map(k => {
      if (k === 'ctrl') return navigator.platform.includes('Mac') ? '⌘' : 'Ctrl';
      if (k === 'shift') return '⇧';
      if (k === 'alt') return 'Alt';
      if (k === 'escape') return 'Esc';
      if (k === 'tab') return 'Tab';
      if (k === '\\') return '\\';
      if (k === '/') return '/';
      return k.toUpperCase();
    })
    .join(' + ');
}

export default function ShortcutHelp({ onClose }: ShortcutHelpProps) {
  const { t } = useI18n();

  const grouped: Record<string, ShortcutDef[]> = {};
  SHORTCUT_MAP.forEach(s => {
    if (!grouped[s.category]) grouped[s.category] = [];
    grouped[s.category].push(s);
  });

  const catLabels = CATEGORY_LABELS;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: 520, maxHeight: '80vh', overflow: 'auto',
        background: 'var(--obs-bg-surface)', borderRadius: 12,
        border: '1px solid var(--obs-border)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px',
          borderBottom: '1px solid var(--obs-border-subtle)',
        }}>
          <Keyboard size={18} style={{ color: 'var(--obs-purple-bright)' }} />
          <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: 'var(--obs-text)' }}>
            {t('opsidian.keyboardShortcuts')}
          </span>
          <button onClick={onClose} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, background: 'var(--obs-bg-hover)',
            border: '1px solid var(--obs-border)', borderRadius: 6, cursor: 'pointer',
            color: 'var(--obs-text-muted)',
          }}>
            <X size={14} />
          </button>
        </div>

        {/* Shortcut groups */}
        <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {Object.entries(grouped).map(([cat, shortcuts]) => (
            <div key={cat}>
              <div style={{
                fontSize: 11, fontWeight: 600, color: 'var(--obs-text-dim)',
                textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
              }}>
                {catLabels[cat] || cat}
              </div>
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 0,
                background: 'var(--obs-bg-panel)', borderRadius: 8,
                border: '1px solid var(--obs-border-subtle)', overflow: 'hidden',
              }}>
                {shortcuts.map(s => (
                  <div key={s.key} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 14px',
                    borderBottom: '1px solid var(--obs-border-subtle)',
                  }}>
                    <span style={{ fontSize: 12, color: 'var(--obs-text)' }}>
                      {t(`opsidian.shortcut.${s.label}`)}
                    </span>
                    <kbd style={{
                      padding: '3px 8px', fontSize: 11, borderRadius: 4,
                      background: 'var(--obs-bg-surface)', color: 'var(--obs-text-muted)',
                      border: '1px solid var(--obs-border)', fontFamily: 'var(--obs-font-mono)',
                    }}>
                      {formatKey(s.key)}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
