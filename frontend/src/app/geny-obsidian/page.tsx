'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GenyObsidianPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/opsidian');
  }, [router]);

  return (
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
      Redirecting…
    </div>
  );
}
