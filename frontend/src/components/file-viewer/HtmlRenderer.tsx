'use client';

import { useRef, useEffect, useState } from 'react';

export interface HtmlRendererProps {
  content: string;
}

export default function HtmlRenderer({ content }: HtmlRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(400);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      try {
        const doc = iframe.contentDocument;
        if (doc?.body) {
          setHeight(Math.min(Math.max(doc.body.scrollHeight + 32, 200), 4000));
        }
      } catch {
        // Cross-origin — keep default height
      }
    };

    iframe.addEventListener('load', handleLoad);
    return () => iframe.removeEventListener('load', handleLoad);
  }, [content]);

  const styledContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    padding: 20px 28px;
    margin: 0;
    color: #e4e4e7;
    background: #18181b;
    line-height: 1.65;
    font-size: 14px;
    -webkit-font-smoothing: antialiased;
  }
  a { color: #60a5fa; }
  img { max-width: 100%; border-radius: 6px; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
  th, td { border: 1px solid #3f3f46; padding: 8px 12px; text-align: left; }
  th { background: #27272a; font-weight: 600; }
  pre {
    background: #09090b;
    padding: 14px 18px;
    border-radius: 8px;
    overflow-x: auto;
    border: 1px solid #27272a;
  }
  code {
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 0.9em;
  }
  :not(pre) > code {
    background: #27272a;
    padding: 2px 6px;
    border-radius: 4px;
  }
  h1, h2, h3, h4, h5, h6 { color: #fafafa; }
  h1 { font-size: 1.75rem; border-bottom: 1px solid #27272a; padding-bottom: 0.4rem; }
  h2 { font-size: 1.35rem; border-bottom: 1px solid #27272a; padding-bottom: 0.3rem; }
  blockquote {
    margin: 1rem 0;
    padding: 0.5rem 1rem;
    border-left: 3px solid #3b82f6;
    background: rgba(59,130,246,0.05);
    border-radius: 0 6px 6px 0;
  }
  hr { border: none; border-top: 1px solid #27272a; margin: 1.5rem 0; }
  ul, ol { padding-left: 1.5rem; }
  li { margin: 0.25rem 0; }
</style>
</head>
<body>${content}</body>
</html>`;

  return (
    <div className="flex-1 overflow-auto">
      <iframe
        ref={iframeRef}
        srcDoc={styledContent}
        sandbox="allow-same-origin"
        className="w-full border-none block"
        style={{ height: `${height}px`, background: '#18181b' }}
        title="HTML Preview"
      />
    </div>
  );
}
