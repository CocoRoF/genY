'use client';

import { useMemo } from 'react';
import { FileCode2, Terminal, Copy, Check } from 'lucide-react';
import { useState, useCallback } from 'react';

/**
 * Get file extension from path.
 */
function getFileExtension(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/');
  const filename = parts[parts.length - 1] || '';
  return filename.split('.').pop()?.toLowerCase() || '';
}

function getLanguageLabel(ext: string): string {
  const map: Record<string, string> = {
    ts: 'TypeScript', tsx: 'TSX', js: 'JavaScript', jsx: 'JSX',
    py: 'Python', rs: 'Rust', go: 'Go', java: 'Java', rb: 'Ruby',
    cpp: 'C++', c: 'C', css: 'CSS', html: 'HTML', json: 'JSON',
    yaml: 'YAML', yml: 'YAML', md: 'Markdown', sh: 'Shell', sql: 'SQL',
    toml: 'TOML', xml: 'XML',
  };
  return map[ext] || ext.toUpperCase() || 'Text';
}

// ── Copy button ──
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
      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[0.5625rem] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all cursor-pointer border-none bg-transparent"
      title="Copy to clipboard"
    >
      {copied ? <Check size={10} className="text-[var(--success-color)]" /> : <Copy size={10} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

// ── Code Block with line numbers ──
export interface CodeBlockProps {
  content: string;
  filePath?: string;
  startLine?: number;
  maxLines?: number;
  variant?: 'code' | 'terminal';
  title?: string;
}

export default function CodeBlock({
  content,
  filePath,
  startLine = 1,
  maxLines = 500,
  variant = 'code',
  title,
}: CodeBlockProps) {
  const lines = useMemo(() => content.split('\n'), [content]);
  const truncated = lines.length > maxLines;
  const displayLines = truncated ? lines.slice(0, maxLines) : lines;

  const ext = filePath ? getFileExtension(filePath) : '';
  const langLabel = filePath ? getLanguageLabel(ext) : '';
  const isTerminal = variant === 'terminal';

  // Short path display
  const shortPath = filePath
    ? (() => {
        const p = filePath.replace(/\\/g, '/');
        const parts = p.split('/');
        return parts.length > 3 ? `.../${parts.slice(-3).join('/')}` : p;
      })()
    : '';

  return (
    <div className="rounded-lg border border-[var(--border-color)] overflow-hidden bg-[var(--bg-primary)]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2 min-w-0">
          {isTerminal ? (
            <Terminal size={14} className="text-[var(--text-muted)] shrink-0" />
          ) : (
            <FileCode2 size={14} className="text-[var(--text-muted)] shrink-0" />
          )}
          {title && (
            <span className="text-[0.75rem] font-medium text-[var(--text-primary)] truncate">
              {title}
            </span>
          )}
          {shortPath && (
            <span className="text-[0.75rem] font-mono text-[var(--text-primary)] truncate" title={filePath}>
              {shortPath}
            </span>
          )}
          {langLabel && (
            <span className="text-[0.5625rem] px-1.5 py-[1px] rounded bg-[rgba(100,116,139,0.1)] text-[var(--text-muted)] shrink-0">
              {langLabel}
            </span>
          )}
          {startLine > 1 && (
            <span className="text-[0.5625rem] text-[var(--text-muted)]">
              from L{startLine}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[0.5625rem] text-[var(--text-muted)]">
            {lines.length} lines
          </span>
          <CopyButton text={content} />
        </div>
      </div>

      {/* Code content */}
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        {displayLines.map((line, i) => {
          const lineNo = startLine + i;
          return (
            <div key={i} className="flex group hover:bg-[var(--bg-tertiary)] transition-colors">
              {/* Line number */}
              <div className="w-[48px] shrink-0 text-right pr-3 select-none text-[0.625rem] leading-[20px] font-mono tabular-nums text-[var(--text-muted)] opacity-50 border-r border-[var(--border-color)]">
                {lineNo}
              </div>
              {/* Content */}
              <div className="flex-1 min-w-0 pl-3 pr-4">
                <pre
                  className="text-[0.6875rem] leading-[20px] font-mono whitespace-pre m-0"
                  style={{
                    color: isTerminal ? 'var(--success-color, #22c55e)' : 'var(--text-primary)',
                  }}
                >
                  {line || '\u00A0'}
                </pre>
              </div>
            </div>
          );
        })}

        {truncated && (
          <div className="flex items-center justify-center px-4 py-2 bg-[rgba(245,158,11,0.06)] text-[0.6875rem] text-[var(--warning-color)] border-t border-[var(--border-color)]">
            {lines.length - maxLines} more lines not shown
          </div>
        )}
      </div>
    </div>
  );
}
