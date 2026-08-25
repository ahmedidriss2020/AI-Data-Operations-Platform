# HERMES_WEBHOOK_INTEGRATION.md

## Hermes Agent VPS Webhook & API Integration Guide (Hostinger `srv1927440`)

This document details the configuration and TypeScript integration bridge for connecting the **AnalyzeIt Dashboard (Next.js)** to **Hermes Agent** running on Hostinger VPS (`srv1927440`).

---

### 1. Environment Configuration (`apps/web/.env.local`)

Add the following environment variables to `apps/web/.env.local` (and your production deployment platform):

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://jweclsvkndyvltchnbcl.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_JY2wD5RWkxDH2TCjvhOlVw_ybsoGf2r

# Hermes Hostinger VPS Integration (srv1927440)
HERMES_AGENT_ENDPOINT=http://srv1927440:8000
HERMES_API_SECRET=<set-in-.env.local-only>

# Hermes Webhook Trigger
HERMES_WEBHOOK_URL=http://srv1927440:8644/webhooks/analyzit-workbook-upload
HERMES_WEBHOOK_SECRET=<set-in-.env.local-only>

# OpenRouter Reasoning Provider
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
MODEL_PRIMARY=stealth/ox-alpha
```

---

### 2. Next.js Webhook & Action Dispatcher (`apps/web/src/lib/hermes.ts`)

Create or update `apps/web/src/lib/hermes.ts`:

```typescript
import 'server-only';

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
```

---

### 3. Usage Example in Upload Route (`apps/web/src/app/api/upload/route.ts`)

```typescript
import { NextResponse } from 'next/server';
import { sendHermesWebhook } from '@/lib/hermes';

export async function POST(req: Request) {
  // ... Handle file upload to Supabase Storage ...
  
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
}
```
