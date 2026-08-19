/**
 * Object key layout for the raw bucket (PRD section 3):
 *
 *   {org_id}/{workspace_id}/{YYYY-MM}/{upload_id}__{original_filename}
 *
 * Org first, then workspace, because the storage policy reads the tenant
 * straight out of the path and because Week 7's per-client retention and hard
 * deletion (section 13) delete by prefix. The period segment keeps a client's
 * monthly files naturally grouped, which is also how Week 2 will partition
 * Parquet output.
 */

export const RAW_BUCKET = 'raw';

/** 50 MB, matching the bucket's own limit. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.csv'] as const;

const MIME_BY_EXTENSION: Record<string, string> = {
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.csv': 'text/csv',
};

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot).toLowerCase();
}

export function isAcceptedFilename(filename: string): boolean {
  return (ACCEPTED_EXTENSIONS as readonly string[]).includes(extensionOf(filename));
}

export function mimeForFilename(filename: string): string {
  return MIME_BY_EXTENSION[extensionOf(filename)] ?? 'application/octet-stream';
}

/**
 * Storage keys are a restricted character set, and a customer filename is
 * arbitrary text -- "ACME Ltd — Sales (final) v2.xlsx" is a realistic example.
 * Sanitise for the key but keep the original verbatim in raw_uploads, because
 * that is what the accountant recognises in the UI.
 */
export function sanitizeFilename(filename: string): string {
  const ext = extensionOf(filename);
  const stem = ext ? filename.slice(0, -ext.length) : filename;

  const safeStem =
    stem
      .normalize('NFKD')
      .replace(/[^\w.-]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'upload';

  return `${safeStem}${ext}`;
}

/** Current reporting period as YYYY-MM, in UTC to stay stable across hosts. */
export function periodSegment(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function buildRawObjectPath(params: {
  orgId: string;
  workspaceId: string;
  uploadId: string;
  filename: string;
  date?: Date;
}): string {
  const { orgId, workspaceId, uploadId, filename, date } = params;
  return [
    orgId,
    workspaceId,
    periodSegment(date),
    `${uploadId}__${sanitizeFilename(filename)}`,
  ].join('/');
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}
