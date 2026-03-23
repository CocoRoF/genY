'use client';

import { useState, useCallback } from 'react';
import {
  FileCode, FileText, FileJson, Globe, Palette, Settings, File, Terminal,
  Copy, Check, Eye, Code2, WrapText,
} from 'lucide-react';

export interface FileViewerHeaderProps {
  fileName: string;
  extension: string;
  languageLabel: string;
  lineCount: number;
  content: string;
  isRendered: boolean;
  canRender: boolean;
  wordWrap: boolean;
  onToggleRender: () => void;
  onToggleWordWrap: () => void;
}

const ICON_MAP: Record<string, (size: number, cls: string) => React.ReactNode> = {
  json:       (s, c) => <FileJson size={s} className={c} />,
  jsonl:      (s, c) => <FileJson size={s} className={c} />,
  md:         (s, c) => <FileText size={s} className={c} />,
  mdx:        (s, c) => <FileText size={s} className={c} />,
  txt:        (s, c) => <FileText size={s} className={c} />,
  log:        (s, c) => <Terminal size={s} className={c} />,
  py:         (s, c) => <FileCode size={s} className={c} />,
  js:         (s, c) => <FileCode size={s} className={c} />,
  jsx:        (s, c) => <FileCode size={s} className={c} />,
  ts:         (s, c) => <FileCode size={s} className={c} />,
  tsx:        (s, c) => <FileCode size={s} className={c} />,
  html:       (s, c) => <Globe   size={s} className={c} />,
  htm:        (s, c) => <Globe   size={s} className={c} />,
  css:        (s, c) => <Palette size={s} className={c} />,
  scss:       (s, c) => <Palette size={s} className={c} />,
  yaml:       (s, c) => <Settings size={s} className={c} />,
  yml:        (s, c) => <Settings size={s} className={c} />,
};

const EXT_ICON_COLOR: Record<string, string> = {
  json: 'text-[#f59e0b]', jsonl: 'text-[#f59e0b]',
  md: 'text-[#60a5fa]', mdx: 'text-[#60a5fa]',
  txt: 'text-[var(--text-muted)]', log: 'text-[var(--text-muted)]',
  py: 'text-[#22c55e]',
  js: 'text-[#facc15]', jsx: 'text-[#facc15]',
  ts: 'text-[#3b82f6]', tsx: 'text-[#3b82f6]',
  html: 'text-[#f97316]', htm: 'text-[#f97316]',
  css: 'text-[#a855f7]', scss: 'text-[#a855f7]',
  yaml: 'text-[#6b7280]', yml: 'text-[#6b7280]',
};

function getHeaderIcon(ext: string) {
  const factory = ICON_MAP[ext];
  const color = EXT_ICON_COLOR[ext] || 'text-[var(--text-muted)]';
  if (factory) return factory(14, color);
  return <File size={14} className="text-[var(--text-muted)]" />;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all cursor-pointer border-none bg-transparent"
      title="Copy to clipboard"
    >
      {copied ? <Check size={12} className="text-[var(--success-color)]" /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export default function FileViewerHeader({
  fileName,
  extension,
  languageLabel,
  lineCount,
  content,
  isRendered,
  canRender,
  wordWrap,
  onToggleRender,
  onToggleWordWrap,
}: FileViewerHeaderProps) {
  return (
    <div
      className="flex items-center justify-between px-3 py-2 bg-[var(--bg-tertiary)] border-b border-[var(--border-color)] shrink-0"
      style={{ borderRadius: 'var(--border-radius) var(--border-radius) 0 0' }}
    >
      {/* Left: icon + file name + language badge */}
      <div className="flex items-center gap-2 min-w-0">
        {getHeaderIcon(extension)}
        <span className="text-[13px] font-medium text-[var(--text-primary)] truncate" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
          {fileName}
        </span>
        {languageLabel && (
          <span className="text-[10px] px-1.5 py-[2px] rounded bg-[rgba(100,116,139,0.15)] text-[var(--text-muted)] shrink-0 font-medium">
            {languageLabel}
          </span>
        )}
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[10px] text-[var(--text-muted)] mr-1 tabular-nums">
          {lineCount.toLocaleString()} lines
        </span>

        {/* Word wrap toggle */}
        <button
          onClick={onToggleWordWrap}
          className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-all cursor-pointer border-none ${
            wordWrap
              ? 'bg-[var(--primary-subtle)] text-[var(--primary-color)]'
              : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
          }`}
          title={wordWrap ? 'Disable word wrap' : 'Enable word wrap'}
        >
          <WrapText size={12} />
        </button>

        {/* Render toggle for md/html */}
        {canRender && (
          <button
            onClick={onToggleRender}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-all cursor-pointer border-none ${
              isRendered
                ? 'bg-[var(--primary-color)] text-white shadow-sm'
                : 'bg-[var(--primary-subtle)] text-[var(--primary-color)] hover:bg-[rgba(59,130,246,0.2)]'
            }`}
          >
            {isRendered ? (
              <>
                <Code2 size={12} />
                Source
              </>
            ) : (
              <>
                <Eye size={12} />
                Render
              </>
            )}
          </button>
        )}

        <CopyButton text={content} />
      </div>
    </div>
  );
}
