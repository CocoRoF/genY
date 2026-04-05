'use client';

import { useMemo } from 'react';
import { useObsidianStore } from '@/store/useObsidianStore';
import { useUserOpsidianStore } from '@/store/useUserOpsidianStore';
import { useCuratedKnowledgeStore } from '@/store/useCuratedKnowledgeStore';
import { useHubMode } from '@/components/OpsidianHubContext';
import { useI18n } from '@/lib/i18n';
import { memoryApi, userOpsidianApi, curatedKnowledgeApi } from '@/lib/api';
import {
  Tag,
  Link2,
  AlertCircle,
  FileText,
  Hash,
  BoxSelect,
  ChevronRight,
} from 'lucide-react';

const IMPORTANCE_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#3b82f6',
  low: '#64748b',
};

export default function RightPanel() {
  const hub = useHubMode();
  const { t } = useI18n();
  const isUserMode = hub?.mode === 'user';
  const isCuratorMode = hub?.mode === 'curator';

  const obsidian = useObsidianStore();
  const userStore = useUserOpsidianStore();
  const curatedStore = useCuratedKnowledgeStore();

  // Pick data source based on mode
  const selectedFile = isCuratorMode
    ? curatedStore.selectedFile
    : isUserMode ? userStore.selectedFile : obsidian.selectedFile;
  const fileDetail = isCuratorMode
    ? curatedStore.fileDetail
    : isUserMode ? userStore.fileDetail : obsidian.fileDetail;
  const files = isCuratorMode
    ? curatedStore.files
    : isUserMode ? userStore.files : obsidian.files;
  const memoryStats = (isUserMode || isCuratorMode) ? null : obsidian.memoryStats;
  const memoryIndex = isCuratorMode
    ? curatedStore.memoryIndex
    : isUserMode ? userStore.memoryIndex : obsidian.memoryIndex;
  const userStats = isUserMode ? userStore.stats : isCuratorMode ? curatedStore.stats : null;

  const fileInfo = selectedFile ? files[selectedFile] : null;

  const fileBody = fileDetail?.body ?? '';
  const headings = useMemo(() => {
    if (!fileBody) return [];
    const lines = fileBody.split('\n');
    const result: { level: number; text: string }[] = [];
    for (const line of lines) {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        result.push({ level: match[1].length, text: match[2] });
      }
    }
    return result;
  }, [fileBody]);

  const handleFileNavigate = async (filename: string) => {
    if (isUserMode) {
      userStore.openFile(filename);
      try {
        const detail = await userOpsidianApi.readFile(filename);
        userStore.setFileDetail(detail);
        userStore.setViewMode('editor');
      } catch (e) {
        console.error(e);
      }
    } else {
      obsidian.openFile(filename);
      if (obsidian.selectedSessionId) {
        try {
          const detail = await memoryApi.readFile(obsidian.selectedSessionId, filename);
          obsidian.setFileDetail(detail);
          obsidian.setViewMode('editor');
        } catch (e) {
          console.error(e);
        }
      }
    }
  };

  // Stats for vault overview
  const stats = memoryStats;
  const categories = stats?.categories || userStats?.categories || {};

  return (
    <div className="obs-rpanel">
      {fileInfo ? (
        <>
          <div className="obs-rp-section">
            <div className="obs-rp-section-title">
              <BoxSelect size={12} /> {t('opsidian.properties')}
            </div>
            <div className="obs-rp-props">
              <div className="obs-rp-prop">
                <span className="obs-rp-prop-key">{t('opsidian.category')}</span>
                <span className="obs-rp-prop-val obs-rp-capitalize">{fileInfo.category}</span>
              </div>
              <div className="obs-rp-prop">
                <span className="obs-rp-prop-key">{t('opsidian.importance')}</span>
                <span className="obs-rp-prop-val" style={{ color: IMPORTANCE_COLORS[fileInfo.importance] }}>
                  <AlertCircle size={10} />
                  {fileInfo.importance}
                </span>
              </div>
              <div className="obs-rp-prop">
                <span className="obs-rp-prop-key">{t('opsidian.source')}</span>
                <span className="obs-rp-prop-val">{fileInfo.source}</span>
              </div>
              <div className="obs-rp-prop">
                <span className="obs-rp-prop-key">Size</span>
                <span className="obs-rp-prop-val">{fileInfo.char_count.toLocaleString()} chars</span>
              </div>
              <div className="obs-rp-prop">
                <span className="obs-rp-prop-key">{t('opsidian.created')}</span>
                <span className="obs-rp-prop-val">
                  {fileInfo.created ? new Date(fileInfo.created).toLocaleString('ko-KR') : '—'}
                </span>
              </div>
              <div className="obs-rp-prop">
                <span className="obs-rp-prop-key">{t('opsidian.modified')}</span>
                <span className="obs-rp-prop-val">
                  {fileInfo.modified ? new Date(fileInfo.modified).toLocaleString('ko-KR') : '—'}
                </span>
              </div>
            </div>
          </div>

          {fileInfo.tags.length > 0 && (
            <div className="obs-rp-section">
              <div className="obs-rp-section-title">
                <Tag size={12} /> {t('opsidian.tags')}
              </div>
              <div className="obs-rp-tags">
                {fileInfo.tags.map((tag) => (
                  <span key={tag} className="obs-rp-tag">#{tag}</span>
                ))}
              </div>
            </div>
          )}

          {fileInfo.links_to.length > 0 && (
            <div className="obs-rp-section">
              <div className="obs-rp-section-title">
                <ChevronRight size={12} /> {t('opsidian.outlinksLabel')} ({fileInfo.links_to.length})
              </div>
              <div className="obs-rp-links">
                {fileInfo.links_to.map((target) => {
                  const targetFile = Object.values(files).find(
                    (f) => f.filename.toLowerCase().includes(target.toLowerCase())
                  );
                  return (
                    <button
                      key={target}
                      className="obs-rp-link"
                      onClick={() => targetFile && handleFileNavigate(targetFile.filename)}
                    >
                      <FileText size={11} />
                      {target}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {fileInfo.linked_from.length > 0 && (
            <div className="obs-rp-section">
              <div className="obs-rp-section-title">
                <Link2 size={12} /> {t('opsidian.backlinksLabel')} ({fileInfo.linked_from.length})
              </div>
              <div className="obs-rp-links">
                {fileInfo.linked_from.map((fn) => {
                  const info = files[fn];
                  return (
                    <button
                      key={fn}
                      className="obs-rp-link"
                      onClick={() => handleFileNavigate(fn)}
                    >
                      <Link2 size={11} />
                      {info?.title || fn}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {headings.length > 0 && (
            <div className="obs-rp-section">
              <div className="obs-rp-section-title">
                <Hash size={12} /> Outline
              </div>
              <div className="obs-rp-outline">
                {headings.map((h, i) => (
                  <div
                    key={i}
                    className="obs-rp-outline-item"
                    style={{ paddingLeft: (h.level - 1) * 12 + 8 }}
                  >
                    {h.text}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="obs-rp-section">
          <div className="obs-rp-section-title">
            <BoxSelect size={12} /> Vault Stats
          </div>
          <div className="obs-rp-props">
            <div className="obs-rp-prop">
              <span className="obs-rp-prop-key">Total Files</span>
              <span className="obs-rp-prop-val">{isUserMode ? (userStats?.total_files ?? 0) : (stats?.total_files ?? 0)}</span>
            </div>
            <div className="obs-rp-prop">
              <span className="obs-rp-prop-key">Total Characters</span>
              <span className="obs-rp-prop-val">{(isUserMode ? (userStats?.total_chars ?? 0) : (memoryIndex?.total_chars ?? 0)).toLocaleString()}</span>
            </div>
            {!isUserMode && (
              <>
                <div className="obs-rp-prop">
                  <span className="obs-rp-prop-key">LTM Entries</span>
                  <span className="obs-rp-prop-val">{stats?.long_term_entries ?? 0}</span>
                </div>
                <div className="obs-rp-prop">
                  <span className="obs-rp-prop-key">STM Entries</span>
                  <span className="obs-rp-prop-val">{stats?.short_term_entries ?? 0}</span>
                </div>
              </>
            )}
            <div className="obs-rp-prop">
              <span className="obs-rp-prop-key">Total Tags</span>
              <span className="obs-rp-prop-val">{isUserMode ? (userStats?.total_tags ?? 0) : (stats?.total_tags ?? 0)}</span>
            </div>
            <div className="obs-rp-prop">
              <span className="obs-rp-prop-key">Total Links</span>
              <span className="obs-rp-prop-val">{stats?.total_links ?? 0}</span>
            </div>
            {stats?.last_write && (
              <div className="obs-rp-prop">
                <span className="obs-rp-prop-key">Last Write</span>
                <span className="obs-rp-prop-val">
                  {new Date(stats.last_write).toLocaleString('ko-KR')}
                </span>
              </div>
            )}
          </div>

          {Object.keys(categories).length > 0 && (
            <div className="obs-rp-cats">
              <div className="obs-rp-section-title" style={{ marginTop: 16 }}>
                Categories
              </div>
              {Object.entries(categories)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, count]) => (
                  <div key={cat} className="obs-rp-cat-row">
                    <span className="obs-rp-capitalize">{cat}</span>
                    <div className="obs-rp-cat-bar-bg">
                      <div
                        className="obs-rp-cat-bar"
                        style={{
                          width: `${Math.min(100, (count / Math.max(...Object.values(categories))) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="obs-rp-cat-count">{count}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
