'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { createBrowserSupabase } from '@/lib/supabase/client';
import {
  ACCEPTED_EXTENSIONS,
  MAX_UPLOAD_BYTES,
  formatBytes,
  isAcceptedFilename,
  mimeForFilename,
} from '@/lib/storage';
import { ErrorText, Field, ProgressBar, Spinner, buttonClass, buttonStyle, inputClass, inputFocusHandler, inputStyle } from '@/components/ui';

type Dataset = { id: string; name: string };

type Phase = 'idle' | 'hashing' | 'uploading' | 'finalising';

const PHASE_LABEL: Record<Phase, string> = {
  idle: '',
  hashing: 'Fingerprinting file (SHA-256)…',
  uploading: 'Uploading to encrypted storage…',
  finalising: 'Recording version & audit entry…',
};

const PHASE_PROGRESS: Record<Phase, number> = {
  idle: 0,
  hashing: 25,
  uploading: 70,
  finalising: 95,
};

export function UploadPanel({
  workspaceId,
  datasets,
}: {
  workspaceId: string;
  datasets: Dataset[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [datasetId, setDatasetId] = useState<string>(datasets[0]?.id ?? '');
  const [datasetName, setDatasetName] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const creatingNewDataset = datasetId === '';
  const busy = phase !== 'idle';

  function handleFileChange(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!isAcceptedFilename(file.name)) {
      setError(`Only ${ACCEPTED_EXTENSIONS.join(', ')} files are accepted`);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`File is ${formatBytes(file.size)}; maximum allowed is ${formatBytes(MAX_UPLOAD_BYTES)}`);
      return;
    }
    setSelectedFile(file);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const file = selectedFile || inputRef.current?.files?.[0];
    if (!file) {
      setError('Select a file to upload first');
      return;
    }

    if (creatingNewDataset && datasetName.trim().length < 2) {
      setError('Provide a name for the new recurring dataset');
      return;
    }

    try {
      setPhase('hashing');
      const sha256 = await sha256Hex(file);

      setPhase('uploading');
      const signResponse = await fetch('/api/uploads/sign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          filename: file.name,
          byteSize: file.size,
          datasetId: creatingNewDataset ? null : datasetId,
          datasetName: creatingNewDataset ? datasetName.trim() : null,
        }),
      });

      const signed = await signResponse.json();
      if (!signResponse.ok) throw new Error(signed.error ?? 'Could not start the upload');

      const body = new File([file], file.name, { type: mimeForFilename(file.name) });

      const supabase = createBrowserSupabase();
      const { error: uploadError } = await supabase.storage
        .from(signed.bucket)
        .uploadToSignedUrl(signed.storagePath, signed.token, body);

      if (uploadError) throw new Error(uploadError.message);

      setPhase('finalising');
      const completeResponse = await fetch('/api/uploads/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ uploadId: signed.uploadId, workspaceId, sha256 }),
      });

      const completed = await completeResponse.json();
      if (!completeResponse.ok) throw new Error(completed.error ?? 'Could not record the upload');

      if (inputRef.current) inputRef.current.value = '';
      setSelectedFile(null);
      setDatasetName('');
      if (signed.datasetId) setDatasetId(signed.datasetId);
      router.refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed');
    } finally {
      setPhase('idle');
    }
  }

  return (
    <form onSubmit={onSubmit} method="post" className="space-y-5">
      <Field
        label="Recurring Dataset"
        hint="Group monthly client exports together under a versioned dataset."
      >
        <select
          className={inputClass}
          style={inputStyle}
          {...inputFocusHandler}
          value={datasetId}
          onChange={(e) => setDatasetId(e.target.value)}
          disabled={busy}
        >
          {datasets.map((dataset) => (
            <option key={dataset.id} value={dataset.id}>
              {dataset.name}
            </option>
          ))}
          <option value="">+ New recurring dataset…</option>
        </select>
      </Field>

      {creatingNewDataset && (
        <Field label="New Dataset Name">
          <input
            className={inputClass}
            style={inputStyle}
            {...inputFocusHandler}
            value={datasetName}
            onChange={(e) => setDatasetName(e.target.value)}
            placeholder="e.g. Monthly Sales & Ledger Export"
            maxLength={200}
            disabled={busy}
          />
        </Field>
      )}

      {/* Drag & Drop File Zone */}
      <Field label="Upload File" hint={`Supports ${ACCEPTED_EXTENSIONS.join(', ')} · Up to ${formatBytes(MAX_UPLOAD_BYTES)}`}>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            const file = e.dataTransfer.files?.[0];
            handleFileChange(file);
          }}
          onClick={() => inputRef.current?.click()}
          className="group relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all duration-200"
          style={{
            borderColor: dragActive ? 'var(--az-primary-500)' : selectedFile ? 'var(--az-success-500)' : 'var(--az-border)',
            background: dragActive ? 'rgba(99,102,241,.06)' : selectedFile ? 'rgba(16,185,129,.04)' : 'var(--az-bg-card)',
          }}
        >
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept={ACCEPTED_EXTENSIONS.join(',')}
            disabled={busy}
            onChange={(e) => handleFileChange(e.target.files?.[0])}
          />

          <div
            className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl transition-transform group-hover:scale-110"
            style={{
              background: selectedFile ? 'rgba(16,185,129,.1)' : 'var(--az-gradient-card)',
              color: selectedFile ? 'var(--az-success-500)' : 'var(--az-primary-500)',
            }}
          >
            {selectedFile ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            )}
          </div>

          {selectedFile ? (
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--az-text)' }}>
                {selectedFile.name}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--az-text-muted)' }}>
                {formatBytes(selectedFile.size)} — Click or drop to replace
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--az-text)' }}>
                Click to select or drag and drop workbook
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--az-text-subtle)' }}>
                Raw files are hashed, versioned, and stored unchanged
              </p>
            </div>
          )}
        </div>
      </Field>

      {busy && (
        <div className="az-animate-in">
          <ProgressBar progress={PHASE_PROGRESS[phase]} label={PHASE_LABEL[phase]} />
        </div>
      )}

      <ErrorText>{error}</ErrorText>

      <button className={`${buttonClass} w-full`} style={buttonStyle} type="submit" disabled={busy || !selectedFile}>
        {busy ? (
          <>
            <Spinner size={18} />
            <span>Processing Upload...</span>
          </>
        ) : (
          'Upload & Fingerprint'
        )}
      </button>
    </form>
  );
}

async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
