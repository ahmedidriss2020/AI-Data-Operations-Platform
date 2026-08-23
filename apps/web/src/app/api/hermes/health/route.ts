import { NextResponse } from 'next/server';

import { handleRouteError } from '@/lib/api';
import { requireApiUser } from '@/lib/authz';
import { hermesHealth } from '@/lib/hermes';

/**
 * Liveness for the sidebar agent indicator (PRD v3 section 4: the AnalyzeIt
 * dashboard shows product state, never infrastructure controls).
 *
 * Authenticated because the endpoint URL and queue depth are operational
 * detail, not public information -- but deliberately not workspace-scoped,
 * since the agent's health is the same fact for every workspace in the org.
 *
 * Always 200. "The agent is down" is a state the dashboard renders honestly;
 * returning 503 here would make the sidebar look broken rather than informative.
 */
export async function GET() {
  try {
    await requireApiUser();
    return NextResponse.json(await hermesHealth());
  } catch (error) {
    return handleRouteError(error);
  }
}
