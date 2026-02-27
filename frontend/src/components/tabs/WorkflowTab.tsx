'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import NodePalette from '@/components/workflow/NodePalette';
import PropertyPanel from '@/components/workflow/PropertyPanel';
import WorkflowCanvas from '@/components/workflow/WorkflowCanvas';
import CompiledViewModal from '@/components/modals/CompiledViewModal';
import { NodeIcon } from '@/components/workflow/icons';
import { workflowApi } from '@/lib/workflowApi';
import { useI18n } from '@/lib/i18n';
import type { WorkflowDefinition } from '@/types/workflow';

// ==================== Workflow Meta Editor ====================

function WorkflowMetaEditor() {
  const { currentWorkflow, updateWorkflowMeta } = useWorkflowStore();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Sync local state when workflow changes or panel opens
  useEffect(() => {
    if (currentWorkflow && open) {
      setName(currentWorkflow.name);
      setDesc(currentWorkflow.description || '');
    }
  }, [currentWorkflow, open]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as HTMLElement) &&
        btnRef.current && !btnRef.current.contains(e.target as HTMLElement)
      ) {
        // Apply changes before closing
        applyAndClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  });

  const applyAndClose = useCallback(() => {
    if (currentWorkflow && !currentWorkflow.is_template) {
      const trimmedName = name.trim();
      if (trimmedName && (trimmedName !== currentWorkflow.name || desc !== (currentWorkflow.description || ''))) {
        updateWorkflowMeta(trimmedName, desc);
      }
    }
    setOpen(false);
  }, [currentWorkflow, name, desc, updateWorkflowMeta]);

  if (!currentWorkflow) return null;

  const isTemplate = currentWorkflow.is_template;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen(!open)}
        title={t('workflowEditor.editMetaTooltip')}
        className={`
          h-7 px-2 text-[11px] font-medium rounded-md
          border transition-colors duration-150 whitespace-nowrap
          ${open
            ? 'text-[var(--primary-color)] border-[rgba(59,130,246,0.3)] bg-[rgba(59,130,246,0.1)]'
            : 'text-[var(--text-secondary)] border-[var(--border-color)] bg-[var(--bg-tertiary)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]'
          }
        `}
      >
        <NodeIcon name="pencil" size={13} className="inline -mt-px" />
        <span className="ml-1">{t('workflowEditor.editMeta')}</span>
      </button>

      {open && (
        <div
          ref={panelRef}
          className="
            absolute top-full left-0 mt-1 z-50 w-[320px]
            bg-[var(--bg-secondary)] border border-[var(--border-color)]
            rounded-lg shadow-xl p-3
          "
        >
          {/* Name field */}
          <label className="block text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1">
            {t('workflowEditor.metaName')}
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') applyAndClose(); if (e.key === 'Escape') { setOpen(false); } }}
            disabled={isTemplate}
            autoFocus
            className="
              w-full h-8 px-2.5 text-[12px]
              bg-[var(--bg-tertiary)] border border-[var(--border-color)]
              rounded-md text-[var(--text-primary)]
              focus:outline-none focus:border-[var(--primary-color)]
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          />

          {/* Description field */}
          <label className="block text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1 mt-3">
            {t('workflowEditor.metaDescription')}
          </label>
          <textarea
            value={desc}
            onChange={e => setDesc(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); } }}
            disabled={isTemplate}
            rows={3}
            className="
              w-full px-2.5 py-1.5 text-[12px] resize-y
              bg-[var(--bg-tertiary)] border border-[var(--border-color)]
              rounded-md text-[var(--text-primary)]
              focus:outline-none focus:border-[var(--primary-color)]
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          />

          {/* Footer */}
          <div className="flex items-center justify-between mt-3">
            {isTemplate && (
              <span className="text-[10px] text-[var(--text-muted)] italic">
                {t('workflowEditor.metaTemplateReadonly')}
              </span>
            )}
            {!isTemplate && (
              <span className="text-[10px] text-[var(--text-muted)]">
                {t('workflowEditor.metaHint')}
              </span>
            )}
            <button
              onClick={applyAndClose}
              className="
                h-6 px-3 text-[11px] font-medium rounded-md
                text-[var(--primary-color)] border border-[rgba(59,130,246,0.3)]
                bg-[rgba(59,130,246,0.1)] hover:bg-[rgba(59,130,246,0.18)]
                transition-colors duration-150
              "
            >
              {isTemplate ? t('common.close') : t('workflowEditor.metaApply')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== Toolbar ====================

function WorkflowToolbar() {
  const {
    workflows,
    currentWorkflow,
    isDirty,
    isLoading,
    error,
    loadWorkflow,
    saveWorkflow,
    createWorkflow,
    cloneWorkflow,
    deleteWorkflow,
    loadFromDefinition,
  } = useWorkflowStore();

  const { t } = useI18n();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [templates, setTemplates] = useState<WorkflowDefinition[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showCompiledView, setShowCompiledView] = useState(false);

  // Load templates on mount
  useEffect(() => {
    workflowApi.listTemplates().then(res => setTemplates(res.templates)).catch(() => {});
  }, []);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    await createWorkflow(newName.trim());
    setNewName('');
    setShowCreate(false);
  }, [newName, createWorkflow]);

  const handleDelete = useCallback(async () => {
    if (!currentWorkflow) return;
    if (!confirm(t('workflowStore.deleteConfirm', { name: currentWorkflow.name }))) return;
    await deleteWorkflow(currentWorkflow.id);
  }, [currentWorkflow, deleteWorkflow]);

  const handleLoadTemplate = useCallback(
    (t: WorkflowDefinition) => {
      loadFromDefinition(t);
      setShowTemplates(false);
    },
    [loadFromDefinition],
  );

  return (
    <div className="flex items-center gap-2 h-10 px-3 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] shrink-0">
      {/* Workflow selector */}
      <select
        value={currentWorkflow?.id || ''}
        onChange={e => e.target.value && loadWorkflow(e.target.value)}
        className="
          h-7 px-2 text-[11px]
          bg-[var(--bg-tertiary)] border border-[var(--border-color)]
          rounded-md text-[var(--text-primary)]
          focus:outline-none focus:border-[var(--primary-color)]
          max-w-[180px]
        "
      >
        <option value="">{t('workflowEditor.selectWorkflow')}</option>
        {workflows.map(w => (
          <option key={w.id} value={w.id}>
            {w.name} {w.is_template ? t('workflowEditor.templateSuffix') : ''}
          </option>
        ))}
      </select>

      {/* New */}
      {showCreate ? (
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder={t('workflowEditor.workflowName')}
            autoFocus
            className="h-7 px-2 text-[11px] w-[130px] bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-md text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary-color)]"
          />
          <ToolbarBtn onClick={handleCreate} title={t('workflowEditor.confirm')} disabled={!newName.trim()}>
            <NodeIcon name="check" size={14} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => setShowCreate(false)} title={t('common.cancel')}>
            <NodeIcon name="x" size={14} />
          </ToolbarBtn>
        </div>
      ) : (
        <ToolbarBtn onClick={() => setShowCreate(true)} title={t('workflowEditor.newWorkflowTooltip')}>
          <NodeIcon name="plus" size={14} className="inline -mt-px" />
          <span className="ml-1">{t('workflowEditor.new')}</span>
        </ToolbarBtn>
      )}

      {/* Templates */}
      <div className="relative">
        <ToolbarBtn onClick={() => setShowTemplates(!showTemplates)} title={t('workflowEditor.loadTemplateTooltip')}>
          <NodeIcon name="layout-list" size={13} className="inline -mt-px" />
          <span className="ml-1">{t('workflowEditor.saveTemplate')}</span>
        </ToolbarBtn>
        {showTemplates && templates.length > 0 && (
          <div className="absolute top-full left-0 mt-1 z-50 min-w-[200px] bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg shadow-xl overflow-hidden">
            {templates.map(t => (
              <button
                key={t.id}
                onClick={() => handleLoadTemplate(t)}
                className="w-full text-left px-3 py-2 text-[11px] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors border-b border-[var(--border-color)] last:border-b-0"
              >
                <div className="font-semibold">{t.name}</div>
                <div className="text-[10px] text-[var(--text-muted)]">{t.description}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-5 bg-[var(--border-color)]" />

      {/* Save */}
      <ToolbarBtn
        onClick={() => saveWorkflow()}
        disabled={!currentWorkflow || !isDirty}
        title={t('workflowEditor.saveTooltip')}
        accent={isDirty}
      >
        <NodeIcon name="save" size={13} className="inline -mt-px" />
        <span className="ml-1">{isDirty ? t('workflowEditor.saveDirty') : t('workflowEditor.save')}</span>
      </ToolbarBtn>

      {/* Clone */}
      {currentWorkflow && (
        <ToolbarBtn onClick={() => cloneWorkflow(currentWorkflow.id)} title={t('workflowEditor.cloneTooltip')}>
          <NodeIcon name="copy" size={13} className="inline -mt-px" />
          <span className="ml-1">{t('workflowEditor.clone')}</span>
        </ToolbarBtn>
      )}

      {/* Edit name / description */}
      {currentWorkflow && <WorkflowMetaEditor />}

      {/* View Compiled */}
      {currentWorkflow && (
        <ToolbarBtn onClick={() => setShowCompiledView(true)} title={t('workflowEditor.viewCompiledTooltip')}>
          <NodeIcon name="scan-search" size={13} className="inline -mt-px" />
          <span className="ml-1">{t('workflowEditor.viewCompiled')}</span>
        </ToolbarBtn>
      )}

      {/* Delete */}
      {currentWorkflow && !currentWorkflow.is_template && (
        <ToolbarBtn onClick={handleDelete} danger title={t('workflowEditor.deleteTooltip')}>
          <NodeIcon name="trash" size={13} className="inline -mt-px" />
          <span className="ml-1">{t('workflowEditor.deleteBtn')}</span>
        </ToolbarBtn>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Status */}
      {isLoading && (
        <span className="text-[10px] text-[var(--text-muted)] animate-pulse">{t('workflowEditor.loading')}</span>
      )}
      {error && (
        <span className="text-[10px] text-[var(--danger-color)] max-w-[200px] truncate inline-flex items-center gap-1" title={error}>
          <NodeIcon name="alert-triangle" size={12} /> {error}
        </span>
      )}

      {/* Workflow info */}
      {currentWorkflow && (
        <span className="text-[10px] text-[var(--text-muted)]">
          {t('workflowEditor.nodesEdges', { nodes: currentWorkflow.nodes?.length || 0, edges: currentWorkflow.edges?.length || 0 })}
        </span>
      )}

      {/* Compiled View Modal */}
      {showCompiledView && currentWorkflow && (
        <CompiledViewModal
          workflowId={currentWorkflow.id}
          workflowName={currentWorkflow.name}
          onClose={() => setShowCompiledView(false)}
        />
      )}
    </div>
  );
}

function ToolbarBtn({
  children,
  onClick,
  disabled,
  title,
  accent,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`
        inline-flex items-center gap-0.5
        h-7 px-2.5 text-[11px] font-medium rounded-md
        border transition-colors duration-150 whitespace-nowrap
        disabled:opacity-40 disabled:cursor-not-allowed
        ${danger
          ? 'text-[var(--danger-color)] border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.06)] hover:bg-[rgba(239,68,68,0.12)]'
          : accent
            ? 'text-[var(--primary-color)] border-[rgba(59,130,246,0.3)] bg-[rgba(59,130,246,0.1)] hover:bg-[rgba(59,130,246,0.18)]'
            : 'text-[var(--text-secondary)] border-[var(--border-color)] bg-[var(--bg-tertiary)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]'
        }
      `}
    >
      {children}
    </button>
  );
}

// ==================== Main Tab ====================

export default function WorkflowTab({ readOnly = false }: { readOnly?: boolean }) {
  const { loadCatalog, loadWorkflows, selectedNodeId } = useWorkflowStore();

  // Init on mount — catalog must load before workflows so nodes get proper metadata
  useEffect(() => {
    const init = async () => {
      await loadCatalog();
      if (!readOnly) await loadWorkflows();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ReactFlowProvider>
      <div className="flex flex-col h-full">
        {!readOnly && <WorkflowToolbar />}
        <div className="flex flex-1 min-h-0">
          {/* Left: Node Palette (hidden in readOnly) */}
          {!readOnly && (
            <div className="w-[240px] shrink-0 border-r border-[var(--border-color)] bg-[var(--bg-secondary)] overflow-y-auto">
              <NodePalette />
            </div>
          )}

          {/* Center: Canvas */}
          <div className="flex-1 min-w-0">
            <WorkflowCanvas readOnly={readOnly} />
          </div>

          {/* Right: Property Panel */}
          {selectedNodeId && (
            <div className="w-[300px] shrink-0 border-l border-[var(--border-color)] bg-[var(--bg-secondary)] overflow-y-auto">
              <PropertyPanel readOnly={readOnly} />
            </div>
          )}
        </div>
      </div>
    </ReactFlowProvider>
  );
}
