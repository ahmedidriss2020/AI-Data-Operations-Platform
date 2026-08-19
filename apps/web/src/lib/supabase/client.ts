import { createBrowserClient } from '@supabase/ssr';

import type { Database } from '@/lib/database.types';

/**
 * Browser client. Carries the user's session, so every query it makes is
 * subject to RLS.
 *
 * Deliberately its own module: server.ts imports next/headers, and a client
 * component importing that -- even only for the browser factory -- drags the
 * server-only API into the browser bundle and fails the build.
 */
export function createBrowserSupabase() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
