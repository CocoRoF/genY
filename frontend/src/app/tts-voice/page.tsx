'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Plus, Mic, Trash2, Upload, Check, ChevronRight,
  Loader2, Star, Play, Square,
} from 'lucide-react';
import { ttsApi, type VoiceProfile } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

const EMOTIONS = ['neutral', 'joy', 'anger', 'sadness', 'fear', 'surprise', 'disgust', 'smirk'] as const;
type Emotion = (typeof EMOTIONS)[number];

const LANGUAGES = [
  { value: 'ko', label: '한국어' },
  { value: 'ja', label: '日本語' },
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
];

const EMOTION_COLORS: Record<string, string> = {
  neutral: 'bg-gray-400',
  joy: 'bg-yellow-400',
  anger: 'bg-red-500',
  sadness: 'bg-blue-400',
  fear: 'bg-purple-400',
  surprise: 'bg-orange-400',
  disgust: 'bg-green-500',
  smirk: 'bg-pink-400',
};

export default function TtsVoicePage() {
  const { t } = useI18n();
  const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
  const [selected, setSelected] = useState<VoiceProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', display_name: '', language: 'ko' });

  const showMsg = useCallback((type: 'success' | 'error', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3000);
  }, []);

  // ── Load profiles ──
  const loadProfiles = useCallback(async () => {
    try {
      const res = await ttsApi.listProfiles();
      setProfiles(res.profiles || []);
    } catch (e: unknown) {
      showMsg('error', e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  }, [showMsg]);

  useEffect(() => {
    ttsApi.listProfiles().then(res => {
      setProfiles(res.profiles || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // ── Select profile ──
  const selectProfile = useCallback(async (name: string) => {
    try {
      const data = await ttsApi.getProfile(name);
      setSelected(data);
    } catch {
      // If no profile.json, use the list data
      const fromList = profiles.find(p => p.name === name);
      if (fromList) setSelected(fromList);
    }
  }, [profiles]);

  // ── Create profile ──
  const handleCreate = useCallback(async () => {
    if (!createForm.name || !createForm.display_name) return;
    try {
      await ttsApi.createProfile({
        name: createForm.name.replace(/[^a-zA-Z0-9_-]/g, '_'),
        display_name: createForm.display_name,
        language: createForm.language,
      });
      showMsg('success', t('ttsVoice.created'));
      setCreating(false);
      setCreateForm({ name: '', display_name: '', language: 'ko' });
      await loadProfiles();
    } catch (e: unknown) {
      showMsg('error', e instanceof Error ? e.message : String(e));
    }
  }, [createForm, loadProfiles, showMsg, t]);

  // ── Activate profile ──
  const handleActivate = useCallback(async (name: string) => {
    try {
      await ttsApi.activateProfile(name);
      showMsg('success', t('ttsVoice.activated'));
      await loadProfiles();
    } catch (e: unknown) {
      showMsg('error', e instanceof Error ? e.message : String(e));
    }
  }, [loadProfiles, showMsg, t]);

  // ── Update profile ──
  const handleUpdate = useCallback(async (name: string, field: string, value: string) => {
    try {
      const updated = await ttsApi.updateProfile(name, { [field]: value });
      setSelected(prev => prev ? { ...prev, ...updated } : prev);
      showMsg('success', t('ttsVoice.saved'));
      await loadProfiles();
    } catch (e: unknown) {
      showMsg('error', e instanceof Error ? e.message : String(e));
    }
  }, [loadProfiles, showMsg, t]);

  return (
    <div className="flex h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* ── Sidebar ── */}
      <aside
        className={`${sidebarOpen ? 'w-72' : 'w-0'} shrink-0 overflow-hidden transition-all duration-200 border-r border-[var(--border-color)] bg-[var(--bg-secondary)] flex flex-col`}
      >
        <div className="flex items-center justify-between h-14 px-4 border-b border-[var(--border-color)]">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-[0.8125rem] text-[var(--text-muted)] hover:text-[var(--text-primary)] no-underline transition-colors"
          >
            <ArrowLeft size={14} />
            {t('ttsVoice.backToApp')}
          </Link>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center justify-center w-7 h-7 rounded-md bg-[var(--primary-color)] text-white border-none cursor-pointer hover:opacity-90 transition-opacity"
            title={t('ttsVoice.newProfile')}
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Profile list */}
        <nav className="flex-1 overflow-y-auto py-2">
          {loading ? (
            <p className="px-4 py-3 text-[0.8125rem] text-[var(--text-muted)]">{t('ttsVoice.loading')}</p>
          ) : profiles.length === 0 ? (
            <p className="px-4 py-3 text-[0.8125rem] text-[var(--text-muted)]">{t('ttsVoice.noProfiles')}</p>
          ) : (
            profiles.map((p) => (
              <button
                key={p.name}
                onClick={() => selectProfile(p.name)}
                className={`flex items-center gap-2 w-full px-4 py-2.5 text-left text-[0.8125rem] border-none cursor-pointer transition-colors duration-100 ${
                  selected?.name === p.name
                    ? 'bg-[var(--primary-subtle)] text-[var(--primary-color)] font-medium'
                    : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Mic size={14} className="shrink-0 opacity-60" />
                <span className="truncate flex-1">{p.display_name || p.name}</span>
                {p.active && (
                  <span className="flex items-center gap-0.5 text-[0.625rem] text-[var(--success-color)] font-semibold uppercase">
                    <Star size={10} fill="currentColor" />
                  </span>
                )}
                <span className="text-[0.625rem] text-[var(--text-muted)]">
                  {Object.keys(p.has_refs || {}).length}
                </span>
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
            onClick={() => setSidebarOpen(v => !v)}
            className="flex items-center justify-center w-8 h-8 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer transition-all duration-150 mr-3"
          >
            <ChevronRight size={14} className={`transition-transform duration-200 ${sidebarOpen ? 'rotate-180' : ''}`} />
          </button>
          <h1 className="text-[0.9375rem] font-semibold truncate">
            {selected ? (selected.display_name || selected.name) : t('ttsVoice.title')}
          </h1>
          {selected?.active && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-[0.625rem] font-semibold bg-[rgba(34,197,94,0.15)] text-[var(--success-color)]">
              ACTIVE
            </span>
          )}
        </div>

        {/* Toast */}
        {msg && (
          <div className={`mx-4 mt-3 px-4 py-2 rounded-lg text-[0.8125rem] font-medium ${
            msg.type === 'success'
              ? 'bg-[rgba(34,197,94,0.1)] text-[var(--success-color)] border border-[rgba(34,197,94,0.2)]'
              : 'bg-[rgba(239,68,68,0.1)] text-[var(--danger-color)] border border-[rgba(239,68,68,0.2)]'
          }`}>
            {msg.text}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {creating ? (
            <CreateProfileForm
              form={createForm}
              setForm={setCreateForm}
              onCreate={handleCreate}
              onCancel={() => setCreating(false)}
              t={t}
            />
          ) : selected ? (
            <ProfileDetail
              profile={selected}
              onUpdate={handleUpdate}
              onActivate={handleActivate}
              onRefresh={async () => { await loadProfiles(); await selectProfile(selected.name); }}
              showMsg={showMsg}
              t={t}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-[var(--text-muted)] text-[0.875rem]">{t('ttsVoice.selectProfile')}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}


// ── Create Profile Form ──
function CreateProfileForm({
  form, setForm, onCreate, onCancel, t,
}: {
  form: { name: string; display_name: string; language: string };
  setForm: (f: { name: string; display_name: string; language: string }) => void;
  onCreate: () => void;
  onCancel: () => void;
  t: (k: string) => string;
}) {
  return (
    <div className="max-w-lg mx-auto px-6 py-10">
      <h2 className="text-lg font-semibold mb-6">{t('ttsVoice.newProfile')}</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-[0.75rem] font-medium text-[var(--text-muted)] mb-1">{t('ttsVoice.profileName')}</label>
          <input
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="my_voice"
            className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-[0.875rem] outline-none focus:border-[var(--primary-color)]"
          />
          <p className="mt-1 text-[0.6875rem] text-[var(--text-muted)]">{t('ttsVoice.profileNameHint')}</p>
        </div>
        <div>
          <label className="block text-[0.75rem] font-medium text-[var(--text-muted)] mb-1">{t('ttsVoice.displayName')}</label>
          <input
            value={form.display_name}
            onChange={e => setForm({ ...form, display_name: e.target.value })}
            placeholder={t('ttsVoice.displayNamePlaceholder')}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-[0.875rem] outline-none focus:border-[var(--primary-color)]"
          />
        </div>
        <div>
          <label className="block text-[0.75rem] font-medium text-[var(--text-muted)] mb-1">{t('ttsVoice.language')}</label>
          <select
            value={form.language}
            onChange={e => setForm({ ...form, language: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-[0.875rem] outline-none focus:border-[var(--primary-color)]"
          >
            {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>
        <div className="flex gap-2 pt-2">
          <button
            onClick={onCreate}
            disabled={!form.name || !form.display_name}
            className="px-4 py-2 rounded-lg bg-[var(--primary-color)] text-white text-[0.8125rem] font-medium border-none cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('ttsVoice.create')}
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)] text-[0.8125rem] font-medium border border-[var(--border-color)] cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
          >
            {t('ttsVoice.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}


// ── Profile Detail ──
function ProfileDetail({
  profile, onUpdate, onActivate, onRefresh, showMsg, t,
}: {
  profile: VoiceProfile;
  onUpdate: (name: string, field: string, value: string) => void;
  onActivate: (name: string) => void;
  onRefresh: () => Promise<void>;
  showMsg: (type: 'success' | 'error', text: string) => void;
  t: (k: string) => string;
}) {
  const [promptText, setPromptText] = useState(profile.prompt_text || '');
  const [promptLang, setPromptLang] = useState(profile.prompt_lang || 'ko');
  const [uploading, setUploading] = useState<string | null>(null);

  // Sync state when profile changes using key-derived initial values
  const profileKey = `${profile.name}|${profile.prompt_text}|${profile.prompt_lang}`;
  useEffect(() => {
    setPromptText(profile.prompt_text || '');
    setPromptLang(profile.prompt_lang || 'ko');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileKey]);

  const handleUpload = useCallback(async (emotion: Emotion, file: File, text?: string, lang?: string) => {
    setUploading(emotion);
    try {
      await ttsApi.uploadRef(profile.name, emotion, file, text, lang);
      showMsg('success', `${emotion} ${t('ttsVoice.uploaded')}`);
      await onRefresh();
    } catch (e: unknown) {
      showMsg('error', e instanceof Error ? e.message : String(e));
    }
    setUploading(null);
  }, [profile.name, onRefresh, showMsg, t]);

  const handleDeleteRef = useCallback(async (emotion: string) => {
    try {
      await ttsApi.deleteRef(profile.name, emotion);
      showMsg('success', `${emotion} ${t('ttsVoice.deleted')}`);
      await onRefresh();
    } catch (e: unknown) {
      showMsg('error', e instanceof Error ? e.message : String(e));
    }
  }, [profile.name, onRefresh, showMsg, t]);

  const handleUpdateEmotionRef = useCallback(async (emotion: string, body: { prompt_text?: string; prompt_lang?: string }) => {
    try {
      await ttsApi.updateEmotionRef(profile.name, emotion, body);
      showMsg('success', t('ttsVoice.saved'));
      await onRefresh();
    } catch (e: unknown) {
      showMsg('error', e instanceof Error ? e.message : String(e));
    }
  }, [profile.name, onRefresh, showMsg, t]);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
      {/* ── Actions ── */}
      <div className="flex items-center gap-3">
        {!profile.active && (
          <button
            onClick={() => onActivate(profile.name)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--primary-color)] text-white text-[0.8125rem] font-medium border-none cursor-pointer hover:opacity-90 transition-opacity"
          >
            <Star size={14} />
            {t('ttsVoice.activate')}
          </button>
        )}
        {profile.active && (
          <span className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[rgba(34,197,94,0.1)] text-[var(--success-color)] text-[0.8125rem] font-medium border border-[rgba(34,197,94,0.2)]">
            <Check size={14} />
            {t('ttsVoice.currentActive')}
          </span>
        )}
      </div>

      {/* ── Fallback Prompt Settings ── */}
      <section>
        <h3 className="text-[0.875rem] font-semibold mb-1 text-[var(--text-primary)]">
          {t('ttsVoice.fallbackPrompt')}
        </h3>
        <p className="text-[0.6875rem] text-[var(--text-muted)] mb-3">{t('ttsVoice.fallbackPromptHint')}</p>
        <div className="space-y-3 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <div>
            <label className="block text-[0.75rem] font-medium text-[var(--text-muted)] mb-1">
              {t('ttsVoice.promptText')}
            </label>
            <div className="flex gap-2">
              <input
                value={promptText}
                onChange={e => setPromptText(e.target.value)}
                placeholder={t('ttsVoice.promptTextPlaceholder')}
                className="flex-1 px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-[0.8125rem] outline-none focus:border-[var(--primary-color)]"
              />
              <button
                onClick={() => onUpdate(profile.name, 'prompt_text', promptText)}
                className="px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)] text-[0.75rem] border border-[var(--border-color)] cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
              >
                {t('ttsVoice.save')}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-[0.75rem] font-medium text-[var(--text-muted)] mb-1">
              {t('ttsVoice.promptLanguage')}
            </label>
            <select
              value={promptLang}
              onChange={e => {
                setPromptLang(e.target.value);
                onUpdate(profile.name, 'prompt_lang', e.target.value);
              }}
              className="px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-[0.8125rem] outline-none focus:border-[var(--primary-color)]"
            >
              {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* ── Emotion Reference Audio ── */}
      <section>
        <h3 className="text-[0.875rem] font-semibold mb-1 text-[var(--text-primary)]">
          {t('ttsVoice.emotionRefs')}
        </h3>
        <p className="text-[0.6875rem] text-[var(--text-muted)] mb-3">{t('ttsVoice.emotionRefsHint')}</p>
        <div className="grid grid-cols-1 gap-3">
          {EMOTIONS.map(emotion => (
            <EmotionRefCard
              key={emotion}
              profileName={profile.name}
              emotion={emotion}
              hasRef={!!profile.has_refs?.[emotion]}
              emotionRef={profile.emotion_refs?.[emotion]}
              uploading={uploading === emotion}
              onUpload={(file, text, lang) => handleUpload(emotion, file, text, lang)}
              onDelete={() => handleDeleteRef(emotion)}
              onUpdatePrompt={(body) => handleUpdateEmotionRef(emotion, body)}
              t={t}
            />
          ))}
        </div>
      </section>
    </div>
  );
}


// ── Emotion Reference Card (redesigned: audio + prompt pair) ──
function EmotionRefCard({
  profileName, emotion, hasRef, emotionRef, uploading, onUpload, onDelete, onUpdatePrompt, t,
}: {
  profileName: string;
  emotion: Emotion;
  hasRef: boolean;
  emotionRef?: { file: string; prompt_text?: string; prompt_lang?: string };
  uploading: boolean;
  onUpload: (file: File, text?: string, lang?: string) => void;
  onDelete: () => void;
  onUpdatePrompt: (body: { prompt_text?: string; prompt_lang?: string }) => void;
  t: (k: string) => string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [localPromptText, setLocalPromptText] = useState(emotionRef?.prompt_text || '');
  const [localPromptLang, setLocalPromptLang] = useState(emotionRef?.prompt_lang || 'ko');

  // Sync local state when parent data changes
  const refKey = `${profileName}|${emotion}|${emotionRef?.prompt_text}|${emotionRef?.prompt_lang}`;
  useEffect(() => {
    setLocalPromptText(emotionRef?.prompt_text || '');
    setLocalPromptLang(emotionRef?.prompt_lang || 'ko');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refKey]);

  const togglePlay = useCallback(() => {
    if (!hasRef) return;
    if (playing && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
      return;
    }
    const url = ttsApi.getRefAudioUrl(profileName, emotion);
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.play();
    setPlaying(true);
    audio.onended = () => setPlaying(false);
    audio.onerror = () => setPlaying(false);
  }, [hasRef, playing, profileName, emotion]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return (
    <div className={`rounded-xl border transition-colors ${
      hasRef
        ? 'border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.03)]'
        : 'border-[var(--border-color)] bg-[var(--bg-secondary)]'
    }`}>
      {/* ── Top row: emotion label + action buttons ── */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span className={`w-3 h-3 rounded-full shrink-0 ${EMOTION_COLORS[emotion] || 'bg-gray-400'}`} />
        <div className="flex-1 min-w-0">
          <p className="text-[0.8125rem] font-medium capitalize">{emotion}</p>
          <p className="text-[0.6875rem] text-[var(--text-muted)]">
            {hasRef ? `ref_${emotion}.wav` : t('ttsVoice.noRef')}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {uploading ? (
            <Loader2 size={14} className="animate-spin text-[var(--primary-color)]" />
          ) : (
            <>
              {hasRef && (
                <button
                  onClick={togglePlay}
                  className={`flex items-center justify-center w-7 h-7 rounded-md border cursor-pointer transition-all ${
                    playing
                      ? 'bg-[var(--primary-color)] border-[var(--primary-color)] text-white'
                      : 'bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--primary-color)] hover:border-[var(--primary-color)]'
                  }`}
                  title={playing ? t('ttsVoice.stop') : t('ttsVoice.play')}
                >
                  {playing ? <Square size={10} /> : <Play size={12} />}
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".wav"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) onUpload(f, localPromptText || undefined, localPromptLang || undefined);
                  e.target.value = '';
                }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center justify-center w-7 h-7 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--primary-color)] hover:border-[var(--primary-color)] cursor-pointer transition-all"
                title={t('ttsVoice.upload')}
              >
                <Upload size={12} />
              </button>
              {hasRef && (
                <button
                  onClick={onDelete}
                  className="flex items-center justify-center w-7 h-7 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--danger-color)] hover:border-[var(--danger-color)] cursor-pointer transition-all"
                  title={t('ttsVoice.delete')}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Bottom row: per-emotion prompt text + language (shown when audio exists) ── */}
      {hasRef && (
        <div className="px-4 pb-3 pt-0 space-y-2 border-t border-[var(--border-color)] mt-0 pt-2">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-[0.6875rem] font-medium text-[var(--text-muted)] mb-0.5">
                {t('ttsVoice.refPromptText')}
              </label>
              <input
                value={localPromptText}
                onChange={e => setLocalPromptText(e.target.value)}
                onBlur={() => {
                  if (localPromptText !== (emotionRef?.prompt_text || '')) {
                    onUpdatePrompt({ prompt_text: localPromptText });
                  }
                }}
                placeholder={t('ttsVoice.refPromptPlaceholder')}
                className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-[0.75rem] outline-none focus:border-[var(--primary-color)]"
              />
            </div>
            <div className="shrink-0">
              <label className="block text-[0.6875rem] font-medium text-[var(--text-muted)] mb-0.5">
                {t('ttsVoice.refLang')}
              </label>
              <select
                value={localPromptLang}
                onChange={e => {
                  setLocalPromptLang(e.target.value);
                  onUpdatePrompt({ prompt_lang: e.target.value });
                }}
                className="px-2 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-[0.75rem] outline-none focus:border-[var(--primary-color)]"
              >
                {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
