import 'server-only';

import { mintScopeToken } from '@/lib/tool-layer/scope-token';

export interface WebhookEventPayload {
  event: string;
  dataset_id: string;
  filename: string;
  tenant_id: string;
  workspace_id: string;
  [key: string]: unknown;
}

/**
 * Sends a webhook event to Hermes Agent when a workbook is uploaded or changed.
 */
export async function sendHermesWebhook(payload: WebhookEventPayload) {
  const webhookUrl = process.env.HERMES_WEBHOOK_URL || 'http://srv1927440:8644/webhooks/analyzit-workbook-upload';
  const secret = process.env.HERMES_WEBHOOK_SECRET;

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hermes-Secret': secret || '',
      'Authorization': `Bearer ${secret}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send Hermes Webhook [${response.status}]: ${errorText}`);
  }

  return response.json();
}

/**
 * Directly invokes a tool or chat turn on Hermes Agent.
 */
export async function triggerHermesAction(action: string, payload: Record<string, unknown>) {
  const endpoint = process.env.HERMES_AGENT_ENDPOINT || 'http://srv1927440:8000';
  const secret = process.env.HERMES_API_SECRET;

  const response = await fetch(`${endpoint}/api/v1/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${secret}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Hermes agent action failed [${response.status}]: ${response.statusText}`);
  }

  return response.json();
}

/** Envelope every Hermes tool returns (PRD v3 section 7). */
export type HermesEnvelope<T = unknown> = {
  status: 'ok' | 'error' | 'blocked';
  result: T;
  evidence?: unknown;
  warnings?: string[];
  execution_metadata?: {
    tool?: string;
    duration_ms?: number;
    model?: string;
    dry_run?: boolean;
    [key: string]: unknown;
  };
};

export type HermesHealth = {
  configured: boolean;
  reachable: boolean;
  status?: string;
  uptime?: string;
  queueDepth?: number;
  activeWorkers?: number;
  /** Present when reachable is false. Safe to show a user; never contains secrets. */
  detail?: string;
};

export type HermesChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export class HermesError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'HermesError';
  }
}

const DEFAULT_TIMEOUT_MS = 60_000;
const HEALTH_TIMEOUT_MS = 5_000;

function endpoint(): string | null {
  const raw = process.env.HERMES_AGENT_ENDPOINT?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, '');
}

/**
 * Whether the bridge has both halves of its configuration.
 */
export function isHermesConfigured(): boolean {
  return Boolean(endpoint() && process.env.HERMES_API_SECRET);
}

async function call<T>(
  path: string,
  payload: unknown,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<T> {
  const base = endpoint();
  const secret = process.env.HERMES_API_SECRET;

  if (!base || !secret) {
    throw new HermesError(
      'Hermes is not configured. Set HERMES_AGENT_ENDPOINT and HERMES_API_SECRET on the server.',
      503,
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    throw new HermesError(
      timedOut
        ? `Hermes did not respond within ${Math.round(timeoutMs / 1000)}s`
        : 'Could not reach the Hermes agent',
      504,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    console.error(`[hermes] ${path} responded ${response.status}`);
    throw new HermesError(
      response.status === 401 || response.status === 403
        ? 'Hermes rejected the credentials for this deployment'
        : `Hermes returned an error (${response.status})`,
      502,
    );
  }

  return (await response.json()) as T;
}

/**
 * Liveness for the sidebar indicator.
 */
export async function hermesHealth(): Promise<HermesHealth> {
  const base = endpoint();

  if (!isHermesConfigured()) {
    return { configured: false, reachable: false, detail: 'Not configured' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

  try {
    const response = await fetch(`${base}/health`, {
      headers: { authorization: `Bearer ${process.env.HERMES_API_SECRET}` },
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      return { configured: true, reachable: false, detail: `HTTP ${response.status}` };
    }

    const body = (await response.json()) as {
      status?: string;
      uptime?: string;
      queue_depth?: number;
      active_workers?: number;
    };

    return {
      configured: true,
      reachable: true,
      status: body.status,
      uptime: body.uptime,
      queueDepth: body.queue_depth,
      activeWorkers: body.active_workers,
    };
  } catch {
    return { configured: true, reachable: false, detail: 'Unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ask Hermes a question inside one workspace.
 */
export async function hermesChat(input: {
  workspaceId: string;
  orgId: string;
  userId: string;
  message: string;
  history: HermesChatMessage[];
}): Promise<HermesEnvelope<{ reply: string }>> {
  const scopeToken = mintScopeToken({
    orgId: input.orgId,
    workspaceId: input.workspaceId,
    userId: input.userId,
  });

  return call<HermesEnvelope<{ reply: string }>>('/api/v1/chat', {
    workspace_id: input.workspaceId,
    org_id: input.orgId,
    message: input.message,
    history: input.history,
    scope_token: scopeToken,
    tool_layer_url: process.env.TOOL_LAYER_PUBLIC_URL ?? null,
  });
}

/**
 * Invoke one tool from the contract in PRD v3 section 7.
 */
export async function hermesTool<T = unknown>(
  tool: string,
  params: Record<string, unknown>,
  options: { dryRun?: boolean; timeoutMs?: number } = {},
): Promise<HermesEnvelope<T>> {
  const { dryRun = true, timeoutMs } = options;
  return call<HermesEnvelope<T>>(
    `/api/v1/tools/${tool}`,
    { ...params, dry_run: dryRun },
    { timeoutMs },
  );
}
