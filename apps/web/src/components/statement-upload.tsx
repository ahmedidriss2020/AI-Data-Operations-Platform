'use client';

import { useState } from 'react';

import { UploadPanel } from '@/components/upload-panel';
import { Card } from '@/components/ui';

type Dataset = { id: string; name: string };

/**
 * Upload with the full set of options, on the analyzer page itself.
 *
 * With the workspace pages out of the navigation, uploading a statement had to
 * come to where the questions are asked -- otherwise the only route to the one
 * remaining screen's data would be a URL the accountant is never shown.
 *
 * Day to day the attachment button in the chat composer is the faster path and
 * covers the common case. This panel is where the choices that composer skips
 * get made: which statement set the file joins, and the cleaning instructions
 * recorded against it. So it starts collapsed and states what the client
 * already has.
 */
export function StatementUpload({
  workspaceId,
  workspaceName,
  datasets,
  statementCount,
}: {
  workspaceId: string;
  workspaceName: string;
  datasets: Dataset[];
  statementCount: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-100">Bank statements for {workspaceName}</p>
          <p className="mt-0.5 text-xs text-slate-400">
            {statementCount === 0
              ? 'Nothing uploaded yet. Attach one in the chat below, or open this panel to choose a statement set and add cleaning instructions.'
              : `${statementCount} statement${statementCount === 1 ? '' : 's'} uploaded. Answers are computed from these files.`}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-emerald-500/40 hover:text-emerald-300 cursor-pointer"
          style={{ borderColor: 'var(--az-border)' }}
          aria-expanded={open}
        >
          {open ? 'Hide options' : 'Upload with options'}
        </button>
      </div>

      {open && (
        <div className="az-animate-in border-t pt-4" style={{ borderColor: 'var(--az-border)' }}>
          <UploadPanel workspaceId={workspaceId} datasets={datasets} />
        </div>
      )}
    </Card>
  );
}
