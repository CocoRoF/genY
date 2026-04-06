'use client';

import { useEffect, useRef } from 'react';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  divider?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = `${x - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = `${y - rect.height}px`;
    }
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed', left: x, top: y, zIndex: 10000,
        minWidth: 180, background: 'var(--obs-bg-surface)',
        border: '1px solid var(--obs-border)', borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
        padding: '4px 0', overflow: 'hidden',
      }}
    >
      {items.map((item, i) => {
        if (item.divider) {
          return <div key={i} style={{ height: 1, background: 'var(--obs-border-subtle)', margin: '4px 0' }} />;
        }
        return (
          <button
            key={i}
            onClick={() => { item.onClick(); onClose(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '7px 14px',
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, textAlign: 'left',
              color: item.danger ? '#ef4444' : 'var(--obs-text)',
              transition: 'background 80ms ease',
            }}
            onMouseEnter={e => { (e.target as HTMLElement).style.background = 'var(--obs-bg-hover)'; }}
            onMouseLeave={e => { (e.target as HTMLElement).style.background = 'none'; }}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
