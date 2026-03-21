'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, FileText, ChevronRight } from 'lucide-react';
import { docsApi, type DocEntry, type DocContent } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

export default function WikiPage() {
  const { t, locale } = useI18n();
  const [docs, setDocs] = useState<DocEntry[]>([]);
  const [selected, setSelected] = useState<DocContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Fetch doc list
  useEffect(() => {
    docsApi.list(locale).then((res) => {
      setDocs(res.docs);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [locale]);

  // Load a document
  const loadDoc = useCallback(async (slug: string) => {
    setContentLoading(true);
    try {
      const doc = await docsApi.get(slug, locale);
      setSelected(doc);
    } catch {
      setSelected(null);
    }
    setContentLoading(false);
  }, [locale]);

  return (
    <div className="flex h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* ── Sidebar ── */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-0'
        } shrink-0 overflow-hidden transition-all duration-200 border-r border-[var(--border-color)] bg-[var(--bg-secondary)] flex flex-col`}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-[var(--border-color)]">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-[0.8125rem] text-[var(--text-muted)] hover:text-[var(--text-primary)] no-underline transition-colors"
          >
            <ArrowLeft size={14} />
            {t('wiki.backToApp')}
          </Link>
        </div>

        {/* Doc list */}
        <nav className="flex-1 overflow-y-auto py-2">
          {loading ? (
            <p className="px-4 py-3 text-[0.8125rem] text-[var(--text-muted)]">{t('wiki.loading')}</p>
          ) : docs.length === 0 ? (
            <p className="px-4 py-3 text-[0.8125rem] text-[var(--text-muted)]">{t('wiki.noDocsFound')}</p>
          ) : (
            docs.map((doc) => (
              <button
                key={doc.slug}
                onClick={() => loadDoc(doc.slug)}
                className={`flex items-center gap-2 w-full px-4 py-2.5 text-left text-[0.8125rem] border-none cursor-pointer transition-colors duration-100 ${
                  selected?.slug === doc.slug
                    ? 'bg-[var(--primary-subtle)] text-[var(--primary-color)] font-medium'
                    : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                }`}
              >
                <FileText size={14} className="shrink-0 opacity-60" />
                <span className="truncate">{doc.title}</span>
              </button>
            ))
          )}
        </nav>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center h-14 px-4 md:px-6 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] shrink-0">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="flex items-center justify-center w-8 h-8 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer transition-all duration-150 mr-3"
            title="Toggle sidebar"
          >
            <ChevronRight
              size={14}
              className={`transition-transform duration-200 ${sidebarOpen ? 'rotate-180' : ''}`}
            />
          </button>
          <h1 className="text-[0.9375rem] font-semibold truncate">
            {selected ? selected.title : t('wiki.title')}
          </h1>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          {contentLoading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-[var(--text-muted)]">{t('wiki.loading')}</p>
            </div>
          ) : selected ? (
            <article className="wiki-markdown max-w-4xl mx-auto px-6 md:px-10 py-8">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {selected.content}
              </ReactMarkdown>
            </article>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-[var(--text-muted)] text-[0.875rem]">{t('wiki.selectDoc')}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
