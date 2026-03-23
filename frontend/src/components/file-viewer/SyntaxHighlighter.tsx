'use client';

import { useMemo } from 'react';
import hljs from 'highlight.js';
import { EXT_TO_HLJS_LANG, splitHighlightedLines } from './utils';

export interface SyntaxHighlighterProps {
  content: string;
  extension: string;
  wordWrap: boolean;
  maxLines?: number;
}

export default function SyntaxHighlighter({
  content,
  extension,
  wordWrap,
  maxLines = 10000,
}: SyntaxHighlighterProps) {
  const lines = useMemo(() => content.split('\n'), [content]);
  const truncated = lines.length > maxLines;
  const displayContent = useMemo(
    () => (truncated ? lines.slice(0, maxLines).join('\n') : content),
    [lines, truncated, maxLines, content],
  );

  const lang = EXT_TO_HLJS_LANG[extension];

  const highlightedLines = useMemo(() => {
    try {
      const result = lang
        ? hljs.highlight(displayContent, { language: lang, ignoreIllegals: true })
        : hljs.highlightAuto(displayContent);
      return splitHighlightedLines(result.value);
    } catch {
      return null;
    }
  }, [displayContent, lang]);

  const displayLines = useMemo(
    () => (truncated ? lines.slice(0, maxLines) : lines),
    [lines, truncated, maxLines],
  );

  // Width for the gutter (adapts to line count)
  const gutterWidth = Math.max(3, String(displayLines.length).length) * 9 + 20;

  return (
    <div
      className="flex-1 overflow-auto file-viewer-lines"
      style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" }}
    >
      {highlightedLines
        ? highlightedLines.map((lineHtml, i) => (
            <div key={i} className="flex group hover:bg-[var(--bg-hover)] transition-colors duration-75">
              {/* Line number gutter */}
              <div
                className="shrink-0 text-right pr-3 select-none text-[11px] leading-[20px] tabular-nums text-[var(--text-muted)] opacity-40 border-r border-[var(--border-color)] bg-[var(--bg-secondary)]"
                style={{ width: gutterWidth, minWidth: gutterWidth }}
              >
                {i + 1}
              </div>
              {/* Highlighted code */}
              <pre
                className={`flex-1 min-w-0 pl-4 pr-4 m-0 text-[12px] leading-[20px] ${
                  wordWrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'
                }`}
                dangerouslySetInnerHTML={{ __html: lineHtml || '\u00A0' }}
              />
            </div>
          ))
        : displayLines.map((line, i) => (
            <div key={i} className="flex group hover:bg-[var(--bg-hover)] transition-colors duration-75">
              <div
                className="shrink-0 text-right pr-3 select-none text-[11px] leading-[20px] tabular-nums text-[var(--text-muted)] opacity-40 border-r border-[var(--border-color)] bg-[var(--bg-secondary)]"
                style={{ width: gutterWidth, minWidth: gutterWidth }}
              >
                {i + 1}
              </div>
              <pre
                className={`flex-1 min-w-0 pl-4 pr-4 m-0 text-[12px] leading-[20px] text-[var(--text-primary)] ${
                  wordWrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'
                }`}
              >
                {line || '\u00A0'}
              </pre>
            </div>
          ))}

      {truncated && (
        <div className="flex items-center justify-center px-4 py-2 bg-[rgba(245,158,11,0.06)] text-[11px] text-[var(--warning-color)] border-t border-[var(--border-color)]">
          ⚠ {(lines.length - maxLines).toLocaleString()} more lines not shown
        </div>
      )}
    </div>
  );
}
