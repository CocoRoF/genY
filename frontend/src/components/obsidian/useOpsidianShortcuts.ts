'use client';

import { useEffect, useCallback, useRef } from 'react';

/**
 * Opsidian keyboard shortcut definitions.
 * Each shortcut has a key combo string and metadata for the help modal.
 */
export interface ShortcutDef {
  key: string;          // e.g. "ctrl+p", "ctrl+shift+k"
  label: string;        // i18n key suffix
  category: 'nav' | 'view' | 'note' | 'edit';
}

export const SHORTCUT_MAP: ShortcutDef[] = [
  // Navigation
  { key: 'ctrl+p',           label: 'quickSearch',      category: 'nav' },
  { key: 'ctrl+tab',         label: 'nextTab',          category: 'nav' },
  { key: 'ctrl+shift+tab',   label: 'prevTab',          category: 'nav' },
  { key: 'ctrl+w',           label: 'closeTab',         category: 'nav' },
  { key: 'ctrl+\\',          label: 'toggleSidebar',    category: 'nav' },
  { key: 'ctrl+shift+\\',    label: 'toggleRightPanel', category: 'nav' },
  // View modes
  { key: 'ctrl+1',           label: 'editorView',       category: 'view' },
  { key: 'ctrl+2',           label: 'graphView',        category: 'view' },
  { key: 'ctrl+3',           label: 'searchView',       category: 'view' },
  // Note actions
  { key: 'ctrl+n',           label: 'newNote',          category: 'note' },
  { key: 'ctrl+e',           label: 'toggleEdit',       category: 'note' },
  { key: 'ctrl+s',           label: 'saveNote',         category: 'note' },
  { key: 'ctrl+shift+d',     label: 'deleteNote',       category: 'note' },
  { key: 'escape',           label: 'cancelOrClose',    category: 'note' },
  { key: 'ctrl+/',           label: 'showShortcuts',    category: 'note' },
  // Editing (handled separately in MarkdownToolbar)
  { key: 'ctrl+b',           label: 'bold',             category: 'edit' },
  { key: 'ctrl+i',           label: 'italic',           category: 'edit' },
  { key: 'ctrl+shift+s',     label: 'strikethrough',    category: 'edit' },
  { key: 'ctrl+shift+k',     label: 'codeBlock',        category: 'edit' },
  { key: 'ctrl+l',           label: 'insertWikilink',   category: 'edit' },
  { key: 'ctrl+k',           label: 'insertLink',       category: 'edit' },
];

interface ShortcutActions {
  onQuickSearch?: () => void;
  onNewNote?: () => void;
  onToggleEdit?: () => void;
  onSave?: () => void;
  onDelete?: () => void;
  onCancel?: () => void;
  onToggleSidebar?: () => void;
  onToggleRightPanel?: () => void;
  onNextTab?: () => void;
  onPrevTab?: () => void;
  onCloseTab?: () => void;
  onEditorView?: () => void;
  onGraphView?: () => void;
  onSearchView?: () => void;
  onShowShortcuts?: () => void;
  /** true when user is in a text input / textarea */
  isEditing?: boolean;
}

function matchesCombo(e: KeyboardEvent, combo: string): boolean {
  const parts = combo.toLowerCase().split('+');
  const needCtrl = parts.includes('ctrl');
  const needShift = parts.includes('shift');
  const needAlt = parts.includes('alt');
  const key = parts.filter(p => !['ctrl', 'shift', 'alt'].includes(p))[0];

  const mod = e.ctrlKey || e.metaKey;
  if (needCtrl !== mod) return false;
  if (needShift !== e.shiftKey) return false;
  if (needAlt !== e.altKey) return false;

  // Special key names
  if (key === 'tab' && e.key === 'Tab') return true;
  if (key === 'escape' && e.key === 'Escape') return true;
  if (key === '\\' && e.key === '\\') return true;
  if (key === '/' && e.key === '/') return true;

  return e.key.toLowerCase() === key;
}

/**
 * Hook that registers global keyboard shortcuts for Opsidian views.
 * Editing shortcuts (bold, italic, etc.) are handled by MarkdownToolbar directly.
 */
export function useOpsidianShortcuts(actions: ShortcutActions) {
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  const handler = useCallback((e: KeyboardEvent) => {
    const a = actionsRef.current;
    // Don't intercept shortcuts when typing in non-opsidian inputs
    const target = e.target as HTMLElement;
    const inInput = target.tagName === 'INPUT' || target.tagName === 'SELECT';
    const inTextarea = target.tagName === 'TEXTAREA';

    // These shortcuts always work
    if (matchesCombo(e, 'ctrl+p'))           { e.preventDefault(); a.onQuickSearch?.(); return; }
    if (matchesCombo(e, 'ctrl+/'))           { e.preventDefault(); a.onShowShortcuts?.(); return; }
    if (matchesCombo(e, 'escape'))           { a.onCancel?.(); return; }

    // These shortcuts are suppressed when in text input
    if (inInput || inTextarea) return;

    if (matchesCombo(e, 'ctrl+n'))           { e.preventDefault(); a.onNewNote?.(); return; }
    if (matchesCombo(e, 'ctrl+e'))           { e.preventDefault(); a.onToggleEdit?.(); return; }
    if (matchesCombo(e, 'ctrl+s'))           { e.preventDefault(); a.onSave?.(); return; }
    if (matchesCombo(e, 'ctrl+shift+d'))     { e.preventDefault(); a.onDelete?.(); return; }
    if (matchesCombo(e, 'ctrl+\\'))          { e.preventDefault(); a.onToggleSidebar?.(); return; }
    if (matchesCombo(e, 'ctrl+shift+\\'))    { e.preventDefault(); a.onToggleRightPanel?.(); return; }
    if (matchesCombo(e, 'ctrl+tab'))         { e.preventDefault(); a.onNextTab?.(); return; }
    if (matchesCombo(e, 'ctrl+shift+tab'))   { e.preventDefault(); a.onPrevTab?.(); return; }
    if (matchesCombo(e, 'ctrl+w'))           { e.preventDefault(); a.onCloseTab?.(); return; }
    if (matchesCombo(e, 'ctrl+1'))           { e.preventDefault(); a.onEditorView?.(); return; }
    if (matchesCombo(e, 'ctrl+2'))           { e.preventDefault(); a.onGraphView?.(); return; }
    if (matchesCombo(e, 'ctrl+3'))           { e.preventDefault(); a.onSearchView?.(); return; }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handler]);
}

export default useOpsidianShortcuts;
