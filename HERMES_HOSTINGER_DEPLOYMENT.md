# Hermes 24/7 Deployment & Dashboard Integration Guide

This guide details how to host **Hermes Agent** on Hostinger VPS for 24/7 continuous operation and integrate it with the **AnalyzeIt Data Operations Platform**.

---

## 1. System Architecture

```
 ┌──────────────────────────────────────┐                     ┌──────────────────────────────────────┐
 │        Hostinger VPS (24/7)          │                     │    AnalyzeIt Dashboard (Vercel/Next) │
 │                                      │   HTTP / Webhooks   │                                      │
 │   • Hermes Agent (FastAPI / Python)  │ ──────────────────> │   • Next.js App (apps/web)           │
 │   • PM2 Daemon / Systemd Service     │ <────────────────── │   • Supabase Postgres DB             │
 │   • DuckDB / Polars Execution        │  Tool Contract Calls│   • Supabase Storage (Raw / Parquet) │
 └──────────────────────────────────────┘                     └──────────────────────────────────────┘
```

---

## 2. Step-by-Step Hostinger VPS Setup (24/7 Deployment)

### Step 2.1: Server Provisioning
1. Access your Hostinger VPS control panel (Ubuntu 22.04 or 24.04 LTS recommended).
2. SSH into your VPS:
   ```bash
   ssh root@YOUR_HOSTINGER_VPS_IP
   ```

### Step 2.2: Dependencies & Python Environment
```bash
# Update OS packages
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3-pip python3-venv git curl build-essential

# Create dedicated app directory
mkdir -p /var/www/hermes-agent
cd /var/www/hermes-agent

# Clone your agent service repo
git clone https://github.com/your-org/hermes-agent.git .

# Create virtualenv and install packages
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install fastapi uvicorn supabase polars duckdb pydantic python-dotenv
```

### Step 2.3: Environment Configuration
Create `/var/www/hermes-agent/.env`:
```env
PORT=8000
HERMES_API_SECRET=hermes_sec_key_prod_987654321
SUPABASE_URL=https://jweclsvkndyvltchnbcl.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
OPENAI_API_KEY=your_openai_api_key
KIMI_API_KEY=your_kimi_api_key
```

### Step 2.4: 24/7 Daemonizing with PM2
```bash
# Install Node.js & PM2 globally
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2

# Start Hermes app via PM2
pm2 start "venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000" --name "hermes-agent"

# Configure auto-restart on server reboot
pm2 save
pm2 startup
```

---

## 3. Connecting Hermes to AnalyzeIt Dashboard

### Step 3.1: Environment Variables on Next.js Dashboard
In `apps/web/.env.local` (and Vercel environment settings):
```env
NEXT_PUBLIC_SUPABASE_URL=https://jweclsvkndyvltchnbcl.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_JY2wD5RWkxDH2TCjvhOlVw_ybsoGf2r

# Hermes Hostinger Integration
HERMES_AGENT_ENDPOINT=http://YOUR_HOSTINGER_VPS_IP:8000
HERMES_API_SECRET=hermes_sec_key_prod_987654321
```

### Step 3.2: API Integration Bridge (`apps/web/src/lib/hermes.ts`)
```typescript
export async function triggerHermesAction(action: string, payload: Record<string, unknown>) {
  const response = await fetch(`${process.env.HERMES_AGENT_ENDPOINT}/api/v1/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.HERMES_API_SECRET}`,
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

## 4. Verification & Operational Health Checks

1. **Ping Health Check**:
   ```bash
   curl http://YOUR_HOSTINGER_VPS_IP:8000/health
   # Expected output: {"status": "healthy", "agent": "Hermes", "uptime": "..."}
   ```

2. **Upload Trigger Verification**:
   - Upload a `.xlsx` or `.csv` file in AnalyzeIt Dashboard workspace.
   - Run `pm2 logs hermes-agent` on Hostinger to observe real-time workbook parsing, signature matching, and invariant execution.
   - Verify immutable logs generated in AnalyzeIt Audit Trail page (`/app/audit`).

---

## 5. What's Missing for Full Data Operations (Dashboard Feature Gap Analysis)

To make AnalyzeIt **100% operational** for real accounting firms processing monthly client data, the following features need to be added to the dashboard:

| Missing Feature | Description | Priority |
|---|---|---|
| **Recipe Management & Editor UI** | Read, edit, disable, or reorder step sequences for a recurring dataset recipe. | **P0 (Critical)** |
| **Materiality Exception Review Queue** | Grouped approval UI sorted by GBP financial impact (not row count) for ambiguous vendor matches or new columns. | **P0 (Critical)** |
| **Invariant Status & Canary Indicator** | Visual alert cards showing post-run checks (row count drift, totals reconciliation, reporting period validity). | **P0 (Critical)** |
| **Provenance Drill-Down Modal** | Clickable financial numbers showing SQL executed, dataset version, and source row IDs in 1 click. | **P1 (High)** |
| **Interactive Parquet / Dataset Viewer** | In-app data grid to inspect raw vs cleaned dataset versions without exporting. | **P1 (High)** |
| **Live Agent Health Status Widget** | Real-time status indicator showing Hostinger Hermes agent uptime, active workers, and queue backlog. | **P2 (Medium)** |
