'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const UserOpsidianView = dynamic(() => import('@/components/user-opsidian/UserOpsidianView'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        color: 'var(--text-muted)',
        fontSize: 14,
      }}
    >
      Loading Opsidian…
    </div>
  ),
});

export default function OpsidianPage() {
  return (
    <Suspense>
      <UserOpsidianView />
    </Suspense>
  );
}
