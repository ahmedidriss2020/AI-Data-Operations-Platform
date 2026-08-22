import { NextResponse } from 'next/server';
import { z } from 'zod';

import { AuthzError } from '@/lib/authz';

/**
 * Single error funnel for route handlers.
 *
 * Authorization failures keep their intended status (401/403/404 carry
 * meaning). Everything else collapses to a generic 500 with the detail logged
 * server-side -- an accounting product should not leak schema or constraint
 * names to the client.
 */
export function handleRouteError(error: unknown) {
  if (error instanceof AuthzError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: 'Invalid request', issues: error.issues }, { status: 400 });
  }

  console.error('[api] unhandled error:', error);
  const detail = error instanceof Error ? error.message : String(error);
  return NextResponse.json({ error: `Server error: ${detail}` }, { status: 500 });
}
