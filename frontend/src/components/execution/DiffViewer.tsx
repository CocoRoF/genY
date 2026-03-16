'use client';

import { useMemo } from 'react';
import type { FileChanges, FileChangeHunk } from '@/types';
import { FileCode2, Plus, Minus, AlertTriangle } from 'lucide-react';

// ── Diff line types ──
interface DiffLine {
  type: 'added' | 'removed' | 'context' | 'header';
  content: string;
  oldLineNo?: number;
  newLineNo?: number;
}

/**
 * Parse a single edit hunk (old_str → new_str) into DiffLines.
 */
function parseHunk(hunk: FileChangeHunk): DiffLine[] {
  const lines: DiffLine[] = [];

  if (hunk.old_str) {
    const oldLines = hunk.old_str.split('\n');
    for (const line of oldLines) {
      lines.push({ type: 'removed', content: line });
    }
  }
  if (hunk.new_str) {
    const newLines = hunk.new_str.split('\n');
    for (const line of newLines) {
      lines.push({ type: 'added', content: line });
    }
  }

  return lines;
}

/**
 * Parse file changes (write/create) where all content is new.
 */
function parseWriteContent(content: string): DiffLine[] {
  return content.split('\n').map((line) => ({
    type: 'added' as const,
    content: line,
  }));
}

/**
 * Build displayable diff lines from FileChanges data.
 */
function buildDiffLines(fc: FileChanges): DiffLine[] {
  const allLines: DiffLine[] = [];

  if (fc.operation === 'write' || fc.operation === 'create') {
    // All content is new
    const content = fc.changes[0]?.new_str || '';
    allLines.push(...parseWriteContent(content));
  } else {
    // Edit or multi-edit: each hunk is a change group
    fc.changes.forEach((hunk, idx) => {
      if (idx > 0) {
        // Separator between hunks
        allLines.push({ type: 'header', content: `··· Hunk ${idx + 1} ···` });
      }
      allLines.push(...parseHunk(hunk));
    });
  }

  // Number the lines
  let oldLine = 1;
  let newLine = 1;
  for (const line of allLines) {
    if (line.type === 'header') continue;
    if (line.type === 'removed') {
      line.oldLineNo = oldLine++;
    } else if (line.type === 'added') {
      line.newLineNo = newLine++;
    } else {
      line.oldLineNo = oldLine++;
      line.newLineNo = newLine++;
    }
  }

  return allLines;
}

/**
 * Get file extension from path for language hint.
 */
function getFileExtension(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/');
  const filename = parts[parts.length - 1] || '';
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return ext;
}

function getLanguageLabel(ext: string): string {
  const map: Record<string, string> = {
    ts: 'TypeScript', tsx: 'TypeScript JSX', js: 'JavaScript', jsx: 'JavaScript JSX',
    py: 'Python', rs: 'Rust', go: 'Go', java: 'Java', rb: 'Ruby',
    cpp: 'C++', c: 'C', h: 'C Header', hpp: 'C++ Header',
    css: 'CSS', scss: 'SCSS', html: 'HTML', json: 'JSON', yaml: 'YAML', yml: 'YAML',
    md: 'Markdown', sh: 'Shell', bash: 'Bash', sql: 'SQL', toml: 'TOML',
    xml: 'XML', svg: 'SVG', dockerfile: 'Dockerfile',
  };
  return map[ext] || ext.toUpperCase();
}

// ── Diff line component ──
function DiffLineRow({ line }: { line: DiffLine }) {
  if (line.type === 'header') {
    return (
      <div className="flex items-center gap-2 px-4 py-1 bg-[rgba(59,130,246,0.06)] text-[0.625rem] text-[var(--text-muted)] select-none">
        <span className="font-mono">{line.content}</span>
      </div>
    );
  }

  const bgColor =
    line.type === 'added'
      ? 'rgba(34,197,94,0.08)'
      : line.type === 'removed'
        ? 'rgba(239,68,68,0.08)'
        : 'transparent';

  const gutterColor =
    line.type === 'added'
      ? 'rgba(34,197,94,0.5)'
      : line.type === 'removed'
        ? 'rgba(239,68,68,0.5)'
        : 'transparent';

  const textColor =
    line.type === 'added'
      ? 'var(--success-color, #22c55e)'
      : line.type === 'removed'
        ? 'var(--danger-color, #ef4444)'
        : 'var(--text-secondary)';

  const prefix = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';

  return (
    <div className="flex group hover:brightness-110 transition-all" style={{ backgroundColor: bgColor }}>
      {/* Gutter indicator */}
      <div className="w-[3px] shrink-0" style={{ backgroundColor: gutterColor }} />

      {/* Old line number */}
      <div className="w-[42px] shrink-0 text-right pr-1 select-none text-[0.625rem] leading-[20px] font-mono tabular-nums"
           style={{ color: line.type === 'removed' ? 'rgba(239,68,68,0.5)' : 'var(--text-muted)', opacity: line.type === 'added' ? 0.3 : 0.6 }}>
        {line.oldLineNo || ''}
      </div>

      {/* New line number */}
      <div className="w-[42px] shrink-0 text-right pr-2 select-none text-[0.625rem] leading-[20px] font-mono tabular-nums"
           style={{ color: line.type === 'added' ? 'rgba(34,197,94,0.5)' : 'var(--text-muted)', opacity: line.type === 'removed' ? 0.3 : 0.6 }}>
        {line.newLineNo || ''}
      </div>

      {/* Prefix (+/-/space) */}
      <div className="w-[16px] shrink-0 text-center font-mono text-[0.6875rem] leading-[20px] font-bold select-none" style={{ color: textColor }}>
        {prefix}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-4">
        <pre className="text-[0.6875rem] leading-[20px] font-mono whitespace-pre-wrap break-all m-0" style={{ color: textColor }}>
          {line.content || '\u00A0'}
        </pre>
      </div>
    </div>
  );
}

// ── Main DiffViewer component ──
export interface DiffViewerProps {
  fileChanges: FileChanges;
  maxLines?: number;
}

export default function DiffViewer({ fileChanges, maxLines = 500 }: DiffViewerProps) {
  const diffLines = useMemo(() => buildDiffLines(fileChanges), [fileChanges]);
  const ext = useMemo(() => getFileExtension(fileChanges.file_path), [fileChanges.file_path]);
  const langLabel = useMemo(() => getLanguageLabel(ext), [ext]);

  // Truncate if too many lines
  const truncated = diffLines.length > maxLines;
  const displayLines = truncated ? diffLines.slice(0, maxLines) : diffLines;

  // Get short filename
  const shortPath = fileChanges.file_path.replace(/\\/g, '/');
  const parts = shortPath.split('/');
  const displayPath = parts.length > 3
    ? `.../${parts.slice(-3).join('/')}`
    : shortPath;

  return (
    <div className="rounded-lg border border-[var(--border-color)] overflow-hidden bg-[var(--bg-primary)]">
      {/* File header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2 min-w-0">
          <FileCode2 size={14} className="text-[var(--text-muted)] shrink-0" />
          <span className="text-[0.75rem] font-mono text-[var(--text-primary)] truncate" title={fileChanges.file_path}>
            {displayPath}
          </span>
          <span className="text-[0.5625rem] px-1.5 py-[1px] rounded bg-[rgba(100,116,139,0.1)] text-[var(--text-muted)] shrink-0">
            {langLabel}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {fileChanges.lines_added > 0 && (
            <span className="flex items-center gap-0.5 text-[0.625rem] font-mono font-bold text-[var(--success-color,#22c55e)]">
              <Plus size={10} />
              {fileChanges.lines_added}
            </span>
          )}
          {fileChanges.lines_removed > 0 && (
            <span className="flex items-center gap-0.5 text-[0.625rem] font-mono font-bold text-[var(--danger-color,#ef4444)]">
              <Minus size={10} />
              {fileChanges.lines_removed}
            </span>
          )}
          <span className="text-[0.5625rem] px-1.5 py-[1px] rounded text-[var(--text-muted)] uppercase tracking-wider font-semibold"
                style={{
                  backgroundColor: fileChanges.operation === 'create' ? 'rgba(34,197,94,0.1)' :
                    fileChanges.operation === 'edit' || fileChanges.operation === 'multi_edit' ? 'rgba(245,158,11,0.1)' :
                    'rgba(59,130,246,0.1)',
                  color: fileChanges.operation === 'create' ? 'var(--success-color)' :
                    fileChanges.operation === 'edit' || fileChanges.operation === 'multi_edit' ? 'var(--warning-color)' :
                    'var(--primary-color)',
                }}>
            {fileChanges.operation === 'multi_edit' ? `multi-edit (${fileChanges.total_edits || fileChanges.changes.length})` : fileChanges.operation}
          </span>
        </div>
      </div>

      {/* Diff content */}
      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
        {displayLines.map((line, i) => (
          <DiffLineRow key={i} line={line} />
        ))}

        {truncated && (
          <div className="flex items-center justify-center gap-2 px-4 py-2 bg-[rgba(245,158,11,0.06)] text-[0.6875rem] text-[var(--warning-color)] border-t border-[var(--border-color)]">
            <AlertTriangle size={12} />
            {diffLines.length - maxLines} more lines not shown
          </div>
        )}
      </div>

      {/* Footer summary */}
      {fileChanges.is_content_truncated && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[rgba(245,158,11,0.04)] border-t border-[var(--border-color)] text-[0.625rem] text-[var(--warning-color)]">
          <AlertTriangle size={10} />
          Content was truncated (original file too large)
        </div>
      )}
    </div>
  );
}
