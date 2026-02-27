'use client';

import Image from 'next/image';
import { useI18n } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';
import { configApi } from '@/lib/api';

type SectionItem = { title: string; body: string | string[] };

export default function MainTab() {
  const { t, tRaw, locale, setLocale } = useI18n();

  /** Switch locale, persisting to backend LanguageConfig */
  const switchLocale = (lang: Locale) => {
    setLocale(lang);
    configApi.update('language', { language: lang }).catch(() => {});
  };
  const sections = tRaw<SectionItem[]>('main.sections');
  const tips = tRaw<string[]>('main.tips');

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1000px] mx-auto px-6 py-8">
        {/* ── Language Toggle ── */}
        <div className="flex justify-end mb-6">
          <div className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
            <button
              onClick={() => switchLocale('en')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-150 border-none cursor-pointer ${
                locale === 'en'
                  ? 'bg-[var(--primary-color)] text-white shadow-sm'
                  : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              ENG
            </button>
            <button
              onClick={() => switchLocale('ko')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-150 border-none cursor-pointer ${
                locale === 'ko'
                  ? 'bg-[var(--primary-color)] text-white shadow-sm'
                  : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              KOR
            </button>
          </div>
        </div>

        {/* ── Logo ── */}
        <div className="flex justify-center mb-8">
          <Image
            src="/geny_full_logo_middle.png"
            alt="Geny Logo"
            width={420}
            height={160}
            priority
            className="object-contain"
          />
        </div>

        {/* ── Hero ── */}
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">{t('main.heroTitle')}</h1>
          <p className="text-base italic text-[var(--primary-color)] mb-3">{t('main.heroSubtitle')}</p>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-[640px] mx-auto">
            {t('main.heroTagline')}
          </p>
        </div>

        {/* ── Sections ── */}
        <div className="flex flex-col gap-6">
          {sections.map((section, i) => (
            <section
              key={i}
              className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5"
            >
              <h2 className="text-base font-semibold text-[var(--text-primary)] mb-3">
                {section.title}
              </h2>
              <div className="flex flex-col gap-2">
                {(Array.isArray(section.body) ? section.body : [section.body]).map((line, j) => (
                  <p key={j} className="text-[0.8125rem] text-[var(--text-secondary)] leading-[1.7]">
                    {line}
                  </p>
                ))}
              </div>
            </section>
          ))}

          {/* ── Tips ── */}
          <section className="rounded-xl border border-[rgba(59,130,246,0.2)] bg-[rgba(59,130,246,0.04)] p-5">
            <h2 className="text-base font-semibold text-[var(--primary-color)] mb-3">
              {t('main.tipTitle')}
            </h2>
            <ul className="flex flex-col gap-1.5 list-none p-0 m-0">
              {tips.map((tip, i) => (
                <li
                  key={i}
                  className="text-[0.8125rem] text-[var(--text-secondary)] leading-[1.7] pl-4 relative before:content-['›'] before:absolute before:left-0 before:text-[var(--primary-color)] before:font-bold"
                >
                  {tip}
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* ── Footer ── */}
        <p className="text-center text-xs text-[var(--text-muted)] mt-10 mb-4">
          {t('main.footerNote')}
        </p>
      </div>
    </div>
  );
}
