'use client';

import { useState, useMemo } from 'react';
import FileViewerHeader from './FileViewerHeader';
import SyntaxHighlighter from './SyntaxHighlighter';
import MarkdownRenderer from './MarkdownRenderer';
import HtmlRenderer from './HtmlRenderer';
import {
  getFileExtension,
  getFileName,
  getLanguageLabel,
  isRenderable,
  isBinary,
  getRenderableType,
} from './utils';

export interface FileViewerProps {
  /** Raw file content */
  content: string;
  /** File name or full path (used for extension detection & display) */
  fileName: string;
  /** Additional CSS classes on the wrapper */
  className?: string;
  /** Show the header bar (default: true) */
  showHeader?: boolean;
}

export default function FileViewer({
  content,
  fileName,
  className = '',
  showHeader = true,
}: FileViewerProps) {
  const ext = useMemo(() => getFileExtension(fileName), [fileName]);
  const displayName = useMemo(() => getFileName(fileName), [fileName]);
  const langLabel = useMemo(() => getLanguageLabel(ext), [ext]);
  const canRender = useMemo(() => isRenderable(ext), [ext]);
  const renderType = useMemo(() => getRenderableType(ext), [ext]);
  const lineCount = useMemo(() => content.split('\n').length, [content]);

  const [isRendered, setIsRendered] = useState(false);
  const [wordWrap, setWordWrap] = useState(false);

  // Auto-format JSON
  const displayContent = useMemo(() => {
    if (ext === 'json') {
      try {
        return JSON.stringify(JSON.parse(content), null, 2);
      } catch {
        return content;
      }
    }
    return content;
  }, [content, ext]);

  const binary = isBinary(ext);

  // Binary files — show a placeholder
  if (binary) {
    return (
      <div className={`flex flex-col bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[var(--border-radius)] ${className}`}>
        {showHeader && (
          <FileViewerHeader
            fileName={displayName}
            extension={ext}
            languageLabel={langLabel}
            lineCount={0}
            content=""
            isRendered={false}
            canRender={false}
            wordWrap={false}
            onToggleRender={() => {}}
            onToggleWordWrap={() => {}}
          />
        )}
        <div className="flex items-center justify-center py-16 text-[var(--text-muted)] text-[13px]">
          Binary file — cannot be displayed as text
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[var(--border-radius)] min-w-0 overflow-hidden ${className}`}>
      {showHeader && (
        <FileViewerHeader
          fileName={displayName}
          extension={ext}
          languageLabel={langLabel}
          lineCount={lineCount}
          content={content}
          isRendered={isRendered}
          canRender={canRender}
          wordWrap={wordWrap}
          onToggleRender={() => setIsRendered((v) => !v)}
          onToggleWordWrap={() => setWordWrap((v) => !v)}
        />
      )}

      {/* Rendered views */}
      {isRendered && renderType === 'markdown' ? (
        <MarkdownRenderer content={content} />
      ) : isRendered && renderType === 'html' ? (
        <HtmlRenderer content={content} />
      ) : (
        <SyntaxHighlighter
          content={displayContent}
          extension={ext}
          wordWrap={wordWrap}
        />
      )}
    </div>
  );
}
