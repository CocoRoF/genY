'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useI18n, type Locale } from '@/lib/i18n';
import { configApi } from '@/lib/api';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import TabNavigation from '@/components/TabNavigation';
import TabContent from '@/components/TabContent';

export default function Home() {
  const { loadSessions, loadDeletedSessions, checkHealth, loadPrompts } = useAppStore();
  const setLocale = useI18n(s => s.setLocale);

  useEffect(() => {
    loadSessions();
    loadDeletedSessions();
    checkHealth();
    loadPrompts();

    // Sync locale from backend LanguageConfig
    configApi.get('language').then(res => {
      const lang = res.values?.language;
      if (lang === 'en' || lang === 'ko') setLocale(lang as Locale);
    }).catch(() => {});

    const healthInterval = setInterval(checkHealth, 15000);
    const sessionInterval = setInterval(loadSessions, 10000);

    return () => {
      clearInterval(healthInterval);
      clearInterval(sessionInterval);
    };
  }, [loadSessions, loadDeletedSessions, checkHealth, loadPrompts, setLocale]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-primary)]">
          <TabNavigation />
          <TabContent />
        </div>
      </div>
    </div>
  );
}
