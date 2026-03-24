'use client';

import { useMessengerStore } from '@/store/useMessengerStore';
import { useI18n } from '@/lib/i18n';
import DiffViewer from '@/components/execution/DiffViewer';
import { X } from 'lucide-react';

export default function FileChangeDetailPanel() {
  const { fileChangeDetail, setFileChangeDetail } = useMessengerStore();
  const { t } = useI18n();

  if (!fileChangeDetail || fileChangeDetail.length === 0) return null;

  return (
    <div className="w-[480px] h-full shrink-0 border-l border-[var(--border-color)] bg-[var(--bg-primary)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <span className="text-[0.8125rem] font-semibold text-[var(--text-primary)]">
          {t('messenger.fileChanges.title')} ({fileChangeDetail.length})
        </span>
        <button
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors border-none bg-transparent cursor-pointer"
          onClick={() => setFileChangeDetail(null)}
        >
          <X size={14} />
        </button>
      </div>

      {/* Diff list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {fileChangeDetail.map((fc, i) => (
          <DiffViewer key={i} fileChanges={fc} />
        ))}
      </div>
    </div>
  );
}
