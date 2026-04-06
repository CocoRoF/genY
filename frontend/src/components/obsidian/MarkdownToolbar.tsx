'use client';

import { useCallback, useRef } from 'react';
import { useI18n } from '@/lib/i18n';
import {
  Bold, Italic, Strikethrough, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Code2, Minus, Link2, FileText,
} from 'lucide-react';

interface MarkdownToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onRequestWikilink?: () => void;
  onChange?: (newValue: string) => void;
}

type WrapAction = { type: 'wrap'; before: string; after: string };
type PrefixAction = { type: 'prefix'; prefix: string };
type InsertAction = { type: 'insert'; text: string };
type ToolbarAction = WrapAction | PrefixAction | InsertAction;

const ACTIONS: Record<string, ToolbarAction> = {
  bold:          { type: 'wrap', before: '**', after: '**' },
  italic:        { type: 'wrap', before: '*', after: '*' },
  strike:        { type: 'wrap', before: '~~', after: '~~' },
  code:          { type: 'wrap', before: '`', after: '`' },
  h1:            { type: 'prefix', prefix: '# ' },
  h2:            { type: 'prefix', prefix: '## ' },
  h3:            { type: 'prefix', prefix: '### ' },
  bullet:        { type: 'prefix', prefix: '- ' },
  numbered:      { type: 'prefix', prefix: '1. ' },
  quote:         { type: 'prefix', prefix: '> ' },
  codeBlock:     { type: 'insert', text: '\n```\n\n```\n' },
  divider:       { type: 'insert', text: '\n---\n' },
  link:          { type: 'insert', text: '[text](url)' },
};

function applyAction(
  textarea: HTMLTextAreaElement,
  action: ToolbarAction,
  onChange?: (v: string) => void,
) {
  const { selectionStart: start, selectionEnd: end, value } = textarea;
  const selected = value.slice(start, end);
  let newValue: string;
  let cursorStart: number;
  let cursorEnd: number;

  if (action.type === 'wrap') {
    const inner = selected || 'text';
    const wrapped = `${action.before}${inner}${action.after}`;
    newValue = value.slice(0, start) + wrapped + value.slice(end);
    if (selected) {
      cursorStart = cursorEnd = start + wrapped.length;
    } else {
      // Select the placeholder "text" so user can type over it
      cursorStart = start + action.before.length;
      cursorEnd = cursorStart + inner.length;
    }
  } else if (action.type === 'prefix') {
    // Find line start
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const line = value.slice(lineStart, end);
    // Toggle: if line already starts with prefix, remove it
    if (line.startsWith(action.prefix)) {
      newValue = value.slice(0, lineStart) + line.slice(action.prefix.length) + value.slice(end);
      cursorStart = cursorEnd = start - action.prefix.length;
    } else {
      newValue = value.slice(0, lineStart) + action.prefix + value.slice(lineStart);
      cursorStart = cursorEnd = start + action.prefix.length;
    }
  } else {
    newValue = value.slice(0, start) + action.text + value.slice(end);
    cursorStart = cursorEnd = start + action.text.length;
  }

  // Update via React-compatible method
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype, 'value'
  )?.set;
  nativeInputValueSetter?.call(textarea, newValue);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  onChange?.(newValue);

  // Restore focus & cursor
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(cursorStart, cursorEnd);
  });
}

/**
 * Handles Ctrl+B, Ctrl+I, etc. keyboard shortcuts inside the textarea.
 */
export function useMarkdownEditorKeys(
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
  onChange?: (v: string) => void,
  onRequestWikilink?: () => void,
) {
  return useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) {
      // Handle Tab for indentation
      if (e.key === 'Tab') {
        e.preventDefault();
        const ta = textareaRef.current;
        if (!ta) return;
        const { selectionStart: start, selectionEnd: end, value } = ta;
        if (e.shiftKey) {
          // Outdent: remove leading 2 spaces or tab
          const lineStart = value.lastIndexOf('\n', start - 1) + 1;
          const line = value.slice(lineStart);
          if (line.startsWith('  ')) {
            const newValue = value.slice(0, lineStart) + line.slice(2);
            onChange?.(newValue);
            requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(Math.max(lineStart, start - 2), Math.max(lineStart, end - 2)); });
          }
        } else {
          // Indent: add 2 spaces
          const newValue = value.slice(0, start) + '  ' + value.slice(end);
          onChange?.(newValue);
          requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(start + 2, start + 2); });
        }
        return;
      }
      return;
    }

    const ta = textareaRef.current;
    if (!ta) return;

    if (e.key === 'b') { e.preventDefault(); applyAction(ta, ACTIONS.bold, onChange); return; }
    if (e.key === 'i' && !e.shiftKey) { e.preventDefault(); applyAction(ta, ACTIONS.italic, onChange); return; }
    if (e.key === 'S' || (e.key === 's' && e.shiftKey)) { e.preventDefault(); applyAction(ta, ACTIONS.strike, onChange); return; }
    if (e.key === 'K' || (e.key === 'k' && e.shiftKey)) { e.preventDefault(); applyAction(ta, ACTIONS.codeBlock, onChange); return; }
    if (e.key === 'k' && !e.shiftKey) { e.preventDefault(); applyAction(ta, ACTIONS.link, onChange); return; }
    if (e.key === 'l' && !e.shiftKey) { e.preventDefault(); onRequestWikilink?.(); return; }
  }, [textareaRef, onChange, onRequestWikilink]);
}

export default function MarkdownToolbar({ textareaRef, onRequestWikilink, onChange }: MarkdownToolbarProps) {
  const { t } = useI18n();

  const run = (name: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    applyAction(ta, ACTIONS[name], onChange);
  };

  const btnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, background: 'none', border: '1px solid transparent',
    borderRadius: 4, cursor: 'pointer', color: 'var(--obs-text-muted)',
    padding: 0, transition: 'all 120ms ease',
  };
  const sep: React.CSSProperties = {
    width: 1, height: 18, background: 'var(--obs-border-subtle)', margin: '0 2px',
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 2, padding: '4px 8px',
      borderBottom: '1px solid var(--obs-border-subtle)',
      background: 'var(--obs-bg-panel)', flexWrap: 'wrap',
    }}>
      <button style={btnStyle} onClick={() => run('bold')} title={`${t('opsidian.shortcut.bold')} (Ctrl+B)`}
        onMouseEnter={e => { (e.target as HTMLElement).style.background = 'var(--obs-bg-hover)'; }}
        onMouseLeave={e => { (e.target as HTMLElement).style.background = 'none'; }}
      ><Bold size={14} /></button>
      <button style={btnStyle} onClick={() => run('italic')} title={`${t('opsidian.shortcut.italic')} (Ctrl+I)`}
        onMouseEnter={e => { (e.target as HTMLElement).style.background = 'var(--obs-bg-hover)'; }}
        onMouseLeave={e => { (e.target as HTMLElement).style.background = 'none'; }}
      ><Italic size={14} /></button>
      <button style={btnStyle} onClick={() => run('strike')} title={`${t('opsidian.shortcut.strikethrough')} (Ctrl+Shift+S)`}
        onMouseEnter={e => { (e.target as HTMLElement).style.background = 'var(--obs-bg-hover)'; }}
        onMouseLeave={e => { (e.target as HTMLElement).style.background = 'none'; }}
      ><Strikethrough size={14} /></button>
      <div style={sep} />
      <button style={btnStyle} onClick={() => run('h1')} title="Heading 1"
        onMouseEnter={e => { (e.target as HTMLElement).style.background = 'var(--obs-bg-hover)'; }}
        onMouseLeave={e => { (e.target as HTMLElement).style.background = 'none'; }}
      ><Heading1 size={14} /></button>
      <button style={btnStyle} onClick={() => run('h2')} title="Heading 2"
        onMouseEnter={e => { (e.target as HTMLElement).style.background = 'var(--obs-bg-hover)'; }}
        onMouseLeave={e => { (e.target as HTMLElement).style.background = 'none'; }}
      ><Heading2 size={14} /></button>
      <button style={btnStyle} onClick={() => run('h3')} title="Heading 3"
        onMouseEnter={e => { (e.target as HTMLElement).style.background = 'var(--obs-bg-hover)'; }}
        onMouseLeave={e => { (e.target as HTMLElement).style.background = 'none'; }}
      ><Heading3 size={14} /></button>
      <div style={sep} />
      <button style={btnStyle} onClick={() => run('bullet')} title="Bullet List"
        onMouseEnter={e => { (e.target as HTMLElement).style.background = 'var(--obs-bg-hover)'; }}
        onMouseLeave={e => { (e.target as HTMLElement).style.background = 'none'; }}
      ><List size={14} /></button>
      <button style={btnStyle} onClick={() => run('numbered')} title="Numbered List"
        onMouseEnter={e => { (e.target as HTMLElement).style.background = 'var(--obs-bg-hover)'; }}
        onMouseLeave={e => { (e.target as HTMLElement).style.background = 'none'; }}
      ><ListOrdered size={14} /></button>
      <button style={btnStyle} onClick={() => run('quote')} title="Block Quote"
        onMouseEnter={e => { (e.target as HTMLElement).style.background = 'var(--obs-bg-hover)'; }}
        onMouseLeave={e => { (e.target as HTMLElement).style.background = 'none'; }}
      ><Quote size={14} /></button>
      <div style={sep} />
      <button style={btnStyle} onClick={() => run('code')} title="Inline Code"
        onMouseEnter={e => { (e.target as HTMLElement).style.background = 'var(--obs-bg-hover)'; }}
        onMouseLeave={e => { (e.target as HTMLElement).style.background = 'none'; }}
      ><Code2 size={14} /></button>
      <button style={btnStyle} onClick={() => run('codeBlock')} title={`${t('opsidian.shortcut.codeBlock')} (Ctrl+Shift+K)`}
        onMouseEnter={e => { (e.target as HTMLElement).style.background = 'var(--obs-bg-hover)'; }}
        onMouseLeave={e => { (e.target as HTMLElement).style.background = 'none'; }}
      ><Code2 size={14} style={{ color: 'var(--obs-purple-bright)' }} /></button>
      <button style={btnStyle} onClick={() => run('divider')} title="Divider (---)"
        onMouseEnter={e => { (e.target as HTMLElement).style.background = 'var(--obs-bg-hover)'; }}
        onMouseLeave={e => { (e.target as HTMLElement).style.background = 'none'; }}
      ><Minus size={14} /></button>
      <div style={sep} />
      <button style={btnStyle} onClick={() => onRequestWikilink?.()} title={`${t('opsidian.shortcut.insertWikilink')} (Ctrl+L)`}
        onMouseEnter={e => { (e.target as HTMLElement).style.background = 'var(--obs-bg-hover)'; }}
        onMouseLeave={e => { (e.target as HTMLElement).style.background = 'none'; }}
      ><FileText size={14} style={{ color: '#f59e0b' }} /></button>
      <button style={btnStyle} onClick={() => run('link')} title={`${t('opsidian.shortcut.insertLink')} (Ctrl+K)`}
        onMouseEnter={e => { (e.target as HTMLElement).style.background = 'var(--obs-bg-hover)'; }}
        onMouseLeave={e => { (e.target as HTMLElement).style.background = 'none'; }}
      ><Link2 size={14} /></button>
    </div>
  );
}
