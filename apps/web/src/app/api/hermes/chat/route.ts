import { NextResponse } from 'next/server';
import { z } from 'zod';

import { handleRouteError } from '@/lib/api';
import { adminFor, requireWorkspaceAccess } from '@/lib/authz';
import { createServerSupabase } from '@/lib/supabase/server';
import { RAW_BUCKET } from '@/lib/storage';
import { isParserConfigured, pushWorkbook } from '@/lib/parser-client';
import type { Json } from '@/lib/database.types';
import { HermesError, hermesChat, isChatAvailable } from '@/lib/hermes';

/**
 * The customer-facing chat turn (PRD v3 section 4).
 *
 * Order matters here and is not negotiable: prove workspace access first, then
 * talk to the agent. The workspace id arrives from the browser, so until
 * requireWorkspaceAccess has run it is a claim, not a fact -- and forwarding an
 * unproven id to an agent that can read client financial data is precisely the
 * cross-tenant leak the isolation tests exist to catch.
 *
 * Every turn is audited. Section 17 asks for an immutable audit trail, and a
 * question an accountant asked about a client's numbers belongs in it just as
 * much as an upload does.
 */

// The parser runs a multi-round tool loop and, on Render's free tier, may
// cold-start before it begins. Give the function the most wall-clock the plan
// allows so it waits for the parser rather than aborting mid-analysis.
// Hobby caps at 60s (a higher value fails the build); Pro/Fluid allow up to 300.
export const maxDuration = 60;

const requestSchema = z.object({
  workspaceId: z.string().uuid(),
  message: z.string().trim().min(1, 'Message is empty').max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(8000),
      }),
    )
    .max(40)
    .default([]),
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());

    // Authorize before anything else touches the agent.
    const context = await requireWorkspaceAccess(body.workspaceId);

    if (!isChatAvailable()) {
      return NextResponse.json(
        {
          error:
            'Chat is not connected to this deployment yet. An administrator needs to set ' +
            'OPENROUTER_API_KEY (conversational) or HERMES_AGENT_ENDPOINT + HERMES_API_SECRET (full analysis).',
        },
        { status: 503 },
      );
    }

    // If the parser is configured, ensure any stored uploads for this workspace are pushed to the parser
    if (isParserConfigured()) {
      try {
        const supabase = await createServerSupabase();
        const { data: uploads } = await supabase
          .from('raw_uploads')
          .select('id, dataset_id, storage_path, original_filename')
          .eq('workspace_id', context.workspaceId)
          .eq('status', 'stored')
          .order('created_at', { ascending: false })
          .limit(5);

        if (uploads && uploads.length > 0) {
          for (const up of uploads) {
            const key = up.dataset_id ?? up.id;
            if (up.storage_path) {
              const { data: obj } = await supabase.storage.from(RAW_BUCKET).download(up.storage_path);
              if (obj) {
                await pushWorkbook(key, await obj.arrayBuffer(), up.original_filename);
              }
            }
          }
        }
      } catch (syncError) {
        console.warn('[hermes/chat] dataset sync warning:', syncError);
      }
    }

    const started = Date.now();
    const envelope = await hermesChat({
      workspaceId: context.workspaceId,
      orgId: context.orgId,
      userId: context.user.id,
      message: body.message,
      history: body.history,
    });

    const admin = adminFor(context);

    // The prompt is recorded; the reply is measured but not copied wholesale
    // into the audit row. The transcript lives in the run record, and an audit
    // log that grows by several KB per chat turn stops being readable -- which
    // is the only property that makes an audit trail worth having.
    await admin.rpc('write_audit', {
      p_org_id: context.orgId,
      p_workspace_id: context.workspaceId,
      p_action: 'hermes.chat',
      p_entity_type: 'workspace',
      p_entity_id: context.workspaceId,
      p_metadata: {
        prompt: body.message,
        reply_chars: envelope.result?.reply?.length ?? 0,
        status: envelope.status,
        warnings: envelope.warnings ?? [],
        duration_ms: Date.now() - started,
        // Came off the wire as JSON, so it is Json-shaped by construction;
        // the envelope's index signature is what TypeScript cannot prove.
        execution_metadata: (envelope.execution_metadata ?? {}) as Json,
      },
    });

    return NextResponse.json({
      reply: envelope.result?.reply ?? '',
      downloads: envelope.result?.downloads ?? [],
      status: envelope.status,
      warnings: envelope.warnings ?? [],
      executionMetadata: envelope.execution_metadata ?? {},
    });
  } catch (error) {
    if (error instanceof HermesError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return handleRouteError(error);
  }
}
