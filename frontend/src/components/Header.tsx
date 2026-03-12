'use client';

import Image from 'next/image';
import { useAppStore } from '@/store/useAppStore';
import { useI18n } from '@/lib/i18n';
import { Menu } from 'lucide-react';

export default function Header() {
  const { healthStatus, sessions, setMobileSidebarOpen } = useAppStore();
  const { t } = useI18n();

  const isHealthy = healthStatus === 'connected';

  return (
    <header className="flex justify-between items-center px-3 md:px-6 h-14 bg-[var(--bg-secondary)] border-b border-[var(--border-color)]">
      <div className="flex items-center gap-2 md:gap-3">
        {/* Mobile hamburger button */}
        <button
          className="flex md:hidden items-center justify-center w-10 h-10 rounded-[var(--border-radius)] bg-transparent border-none text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors duration-150"
          onClick={() => setMobileSidebarOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <span className="text-[0.9rem] text-[var(--text-tertiary)] tracking-[0.08em] italic hidden sm:inline">
          {t('header.subtitle')}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-tertiary)] rounded-full text-[0.75rem] md:text-[0.8125rem]">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              isHealthy
                ? 'bg-[var(--success-color)]'
                : 'bg-[var(--danger-color)]'
            }`}
            style={isHealthy ? { boxShadow: '0 0 8px var(--success-color)' } : undefined}
          />
          <span className="text-[var(--text-secondary)]">
            {isHealthy ? t('header.sessions', { count: sessions.length }) : t('header.disconnected')}
          </span>
        </div>
      </div>
    </header>
  );
}
