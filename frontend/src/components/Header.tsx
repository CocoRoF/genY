'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useAppStore } from '@/store/useAppStore';
import { useI18n } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';
import { configApi } from '@/lib/api';
import { Menu, Sun, Moon } from 'lucide-react';

export default function Header() {
  const { healthStatus, sessions, setMobileSidebarOpen } = useAppStore();
  const { t, locale, setLocale } = useI18n();
  const [isDark, setIsDark] = useState(true);

  const isHealthy = healthStatus === 'connected';

  const switchLocale = (lang: Locale) => {
    setLocale(lang);
    configApi.update('language', { language: lang }).catch(() => {});
  };

  const toggleTheme = () => {
    setIsDark(!isDark);
    // TODO: implement light mode theme switching
  };

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
      <div className="flex items-center gap-2.5">
        {/* ── Theme Toggle ── */}
        <button
          onClick={toggleTheme}
          className="flex items-center justify-center w-8 h-8 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer transition-all duration-150"
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDark ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        {/* ── Language Toggle ── */}
        <div className="inline-flex items-center gap-0.5 p-0.5 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
          <button
            onClick={() => switchLocale('en')}
            className={`px-2 py-1 text-[0.6875rem] font-medium rounded transition-all duration-150 border-none cursor-pointer ${
              locale === 'en'
                ? 'bg-[var(--primary-color)] text-white shadow-sm'
                : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            ENG
          </button>
          <button
            onClick={() => switchLocale('ko')}
            className={`px-2 py-1 text-[0.6875rem] font-medium rounded transition-all duration-150 border-none cursor-pointer ${
              locale === 'ko'
                ? 'bg-[var(--primary-color)] text-white shadow-sm'
                : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            KOR
          </button>
        </div>

        {/* ── Session Status ── */}
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
