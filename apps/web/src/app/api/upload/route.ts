import { NextResponse } from 'next/server';
import { z } from 'zod';

import { handleRouteError } from '@/lib/api';
import { requireWorkspaceAccess } from '@/lib/authz';
import { isParserConfigured } from '@/lib/parser-client';
import { createAdminSupabase } from '@/lib/supabase/server';
import { RAW_BUCKET } from '@/lib/storage';

/**
 * Workbook upload intake: stores the file in Supabase Storage under the
 * caller's workspace and records the pending raw_uploads row. The actual
 * parsing is triggered by /api/uploads/complete once the object is verified.
 */

const requestSchema = z.object({
  workspaceId: z.string().uuid(),
  filename: z.string().trim().min(1).max(255),
});

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File exceeds 25 MB limit' }, { status: 413 });
    }

    const parsed = requestSchema.safeParse({
      workspaceId: form.get('workspaceId'),
      filename: file.name,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
    }

    const context = await requireWorkspaceAccess(parsed.data.workspaceId);
    const admin = createAdminSupabase();

    // Reserve the row first so the storage path carries a real id.
    const { data: upload, error: insertError } = await admin
      .from('raw_uploads')
      .insert({
        workspace_id: context.workspaceId,
        original_filename: parsed.data.filename,
        status: 'pending',
        storage_path: `pending/${crypto.randomUUID()}/${encodeURIComponent(parsed.data.filename)}`,
        uploaded_by: context.user.id,
      })
      .select('id, dataset_id')
      .maybeSingle();

    if (insertError || !upload) {
      return NextResponse.json(
        { error: `Could not reserve upload: ${insertError?.message ?? 'no row returned'}` },
        { status: 500 },
      );
    }

    const storagePath = `${context.workspaceId}/${upload.id}/${encodeURIComponent(parsed.data.filename)}`;

    const { error: storeError } = await admin.storage
      .from(RAW_BUCKET)
      .upload(storagePath, await file.arrayBuffer(), { upsert: false });

    if (storeError) {
      await admin.from('raw_uploads').update({ status: 'failed' }).eq('id', upload.id);
      return NextResponse.json({ error: `Storage failed: ${storeError.message}` }, { status: 500 });
    }

    await admin
      .from('raw_uploads')
      .update({ storage_path: storagePath })
      .eq('id', upload.id);

    return NextResponse.json({
      uploadId: upload.id,
      datasetId: upload.dataset_id,
      storagePath,
      parserConfigured: isParserConfigured(),
      next: '/api/uploads/complete',
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
