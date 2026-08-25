import { NextResponse } from 'next/server';
import { sendHermesWebhook } from '@/lib/hermes';

export async function POST(req: Request) {
  try {
    const datasetId = "dataset_" + Date.now();
    
    // Trigger Hermes Agent via Webhook
    await sendHermesWebhook({
      event: "workbook.uploaded",
      dataset_id: datasetId,
      filename: "acme-sales-2026-08.xlsx",
      tenant_id: "tenant_uk_01",
      workspace_id: "workspace_acme",
    });

    return NextResponse.json({ success: true, dataset_id: datasetId });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Webhook dispatch failed' },
      { status: 500 }
    );
  }
}
