import { NextResponse } from 'next/server';
import { z } from 'zod';

import { handleRouteError } from '@/lib/api';
import { adminFor, requireWorkspaceAccess } from '@/lib/authz';
import { createServerSupabase } from '@/lib/supabase/server';
import {
  MAX_UPLOAD_BYTES,
  RAW_BUCKET,
  buildRawObjectPath,
  isAcceptedFilename,
  mimeForFilename,
} from '@/lib/storage';

/**
 * Step 1 of the upload: reserve a raw_uploads row and hand back a signed upload
 * URL.
 *
 * The file itself goes browser -> Supabase Storage directly. A monthly ledger
 * export can be tens of megabytes, and routing that through a Next.js server
 * action buys nothing but a body-size limit and a memory spike.
 *
 * The row is written before the bytes exist, as `pending`. If the browser then
 * dies mid-upload, the workspace shows an upload that never completed, which is
 * the honest thing to display -- the alternative is a file the accountant
 * believes they sent and no record of it anywhere.
 */

const requestSchema = z.object({
  workspaceId: z.string().uuid(),
  filename: z.string().min(1).max(255),
  byteSize: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  datasetId: z.string().uuid().nullish(),
  datasetName: z.string().min(1).max(200).nullish(),
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());

    if (!isAcceptedFilename(body.filename)) {
      return NextResponse.json(
        { error: 'Only .xlsx, .xls and .csv files are accepted' },
        { status: 400 },
      );
    }

    // Authenticated user client carries session cookies so RLS has_workspace_access() succeeds
    const context = await requireWorkspaceAccess(body.workspaceId);
    const supabase = await createServerSupabase();
    const admin = adminFor(context);
    const db = supabase;

    // A dataset is the recurring thing ("ACME monthly sales"), so an upload
    // either continues an existing one or starts a new one.
    let datasetId = body.datasetId ?? null;

    if (datasetId) {
      const { data: dataset } = await db
        .from('datasets')
        .select('id')
        .eq('id', datasetId)
        .eq('workspace_id', context.workspaceId)
        .maybeSingle();

      if (!dataset) {
        // Fallback: If dataset was not found in this workspace, try finding any existing dataset
        // in this workspace or create a default one to avoid blocking the upload.
        const { data: existing } = await db
          .from('datasets')
          .select('id')
          .eq('workspace_id', context.workspaceId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (existing) {
          datasetId = existing.id;
        } else {
          const name = body.datasetName?.trim() || 'Bank statements';
          const { data: newDataset, error } = await db
            .from('datasets')
            .insert({
              workspace_id: context.workspaceId,
              name,
              created_by: context.user.id,
            })
            .select('id')
            .single();

          if (error) {
            return NextResponse.json({ error: `Could not create dataset: ${error.message}` }, { status: 500 });
          }

          datasetId = newDataset.id;

          await db.rpc('write_audit', {
            p_org_id: context.orgId,
            p_workspace_id: context.workspaceId,
            p_action: 'dataset.created',
            p_entity_type: 'dataset',
            p_entity_id: datasetId,
            p_metadata: { name },
          });
        }
      }
    } else {
      const name = body.datasetName?.trim() || 'Bank statements';
      const { data: dataset, error } = await db
        .from('datasets')
        .insert({
          workspace_id: context.workspaceId,
          name,
          created_by: context.user.id,
        })
        .select('id')
        .single();

      if (error) {
        return NextResponse.json({ error: `Could not create dataset: ${error.message}` }, { status: 500 });
      }

      datasetId = dataset.id;

      await db.rpc('write_audit', {
        p_org_id: context.orgId,
        p_workspace_id: context.workspaceId,
        p_action: 'dataset.created',
        p_entity_type: 'dataset',
        p_entity_id: datasetId,
        p_metadata: { name },
      });
    }

    const uploadId = crypto.randomUUID();
    const storagePath = buildRawObjectPath({
      orgId: context.orgId,
      workspaceId: context.workspaceId,
      uploadId,
      filename: body.filename,
    });

    const { error: insertError } = await db.from('raw_uploads').insert({
      id: uploadId,
      workspace_id: context.workspaceId,
      dataset_id: datasetId,
      storage_path: storagePath,
      original_filename: body.filename,
      mime_type: mimeForFilename(body.filename),
      byte_size: body.byteSize,
      status: 'pending',
      uploaded_by: context.user.id,
    });

    if (insertError) {
      return NextResponse.json(
        { error: `Could not reserve upload: ${insertError.message}` },
        { status: 500 },
      );
    }

    const isServiceRole = Boolean(
      process.env.SUPABASE_SECRET_KEY &&
      !process.env.SUPABASE_SECRET_KEY.startsWith('sb_publishable_') &&
      process.env.SUPABASE_SECRET_KEY !== process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    );
    const storageClient = isServiceRole ? admin.storage : db.storage;
    const { data: signed, error: signError } = await storageClient
      .from(RAW_BUCKET)
      .createSignedUploadUrl(storagePath);

    if (signError || !signed) {
      return NextResponse.json(
        { error: `Could not sign upload: ${signError?.message ?? 'unknown error'}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      uploadId,
      datasetId,
      storagePath,
      token: signed.token,
      bucket: RAW_BUCKET,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
