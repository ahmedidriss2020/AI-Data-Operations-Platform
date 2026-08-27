import 'server-only';

/**
 * Client for the AnalyzeIt parser service (services/parser) — the Python
 * compute layer that turns messy workbooks into structured datasets.
 *
 * The parser is an internal service: it sits behind the dashboard and is
 * never exposed to browsers. Auth is a shared bearer secret over the
 * private network.
 */

const PARSER_URL = (process.env.PARSER_SERVICE_URL || process.env.HERMES_AGENT_ENDPOINT)?.replace(/\/+$/, '');
const PARSER_SECRET = process.env.PARSER_SERVICE_SECRET || process.env.HERMES_API_SECRET;

export interface ParseResult {
  rows: number;
  columns: string[];
  header_row: number;
  dropped_junk_rows: number;
  mappings?: Array<{ old_code: string; new_code: string }>;
  source_signature: string;
}

export class ParserError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ParserError';
  }
}

export function isParserConfigured(): boolean {
  return Boolean(PARSER_URL && PARSER_SECRET);
}

async function call<T>(path: string, init: RequestInit, timeoutMs = 30_000): Promise<T> {
  if (!PARSER_URL || !PARSER_SECRET) {
    throw new ParserError('Parser service is not configured', 503);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${PARSER_URL}${path}`, {
      ...init,
      headers: {
        'X-Hermes-Secret': PARSER_SECRET,
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    throw new ParserError(
      timedOut ? `Parser did not respond within ${Math.round(timeoutMs / 1000)}s` : 'Could not reach the parser service',
      504,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new ParserError(`Parser returned ${response.status}: ${text.slice(0, 300)}`, response.status);
  }
  return (await response.json()) as T;
}

/** Push raw workbook bytes to the parser so it can parse them. */
export function pushWorkbook(datasetId: string, bytes: ArrayBuffer, filename?: string): Promise<{ stored: boolean }> {
  return call(`/datasets/${encodeURIComponent(datasetId)}`, {
    method: 'POST',
    body: bytes as unknown as BodyInit,
    headers: {
      'Content-Type': 'application/octet-stream',
      ...(filename ? { 'X-Filename': encodeURIComponent(filename) } : {}),
    },
  });
}

/**
 * Fire the workbook.uploaded webhook at the parser. With Supabase Storage
 * configured on the parser side it will download the file itself; otherwise
 * pair this with pushWorkbook.
 */
export function notifyParserUpload(payload: {
  dataset_id: string;
  filename: string;
  tenant_id: string;
  workspace_id: string;
  storage_path: string;
  sha256?: string | null;
}): Promise<unknown> {
  return call('/webhooks/analyzit-workbook-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'workbook.uploaded', ...payload }),
  });
}
