'use client';

import { useEffect } from 'react';
import { ensureCsrfToken } from '@/lib/client/csrf';

/** Issues the CSRF cookie without requiring Edge middleware. */
export function CsrfBootstrap() {
  useEffect(() => {
    void ensureCsrfToken();
  }, []);

  return null;
}
