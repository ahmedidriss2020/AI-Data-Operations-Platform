'use client';

import { useActionState, useEffect, useRef, useState } from 'react';

import { createWorkspace, type ActionState } from '@/app/actions';
import { ErrorText, Field, Spinner, buttonClass, buttonStyle, inputClass, inputFocusHandler, inputStyle, secondaryButtonClass, secondaryButtonStyle } from '@/components/ui';

const initialState: ActionState = { error: null };

export function CreateWorkspaceForm({ orgId }: { orgId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createWorkspace, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && state.error === null && formRef.current) {
      formRef.current.reset();
      setOpen(false);
    }
  }, [pending, state]);

  if (!open) {
    return (
      <button
        className={buttonClass}
        style={buttonStyle}
        onClick={() => setOpen(true)}
        type="button"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span>New Client Workspace</span>
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="az-animate-in w-full max-w-md space-y-4 rounded-xl border p-5 shadow-lg"
      style={{
        background: 'var(--az-bg-card)',
        borderColor: 'var(--az-border)',
        boxShadow: 'var(--az-shadow-lg)',
      }}
    >
      <input type="hidden" name="orgId" value={orgId} />

      <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--az-border)' }}>
        <h3 className="text-base font-bold" style={{ color: 'var(--az-text)' }}>
          Create Client Workspace
        </h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg p-1 text-xs font-semibold hover:opacity-75"
          style={{ color: 'var(--az-text-subtle)' }}
        >
          ✕
        </button>
      </div>

      <Field label="Workspace Name" hint="e.g. Acme Corp - Monthly Reconciliations">
        <input
          className={inputClass}
          style={inputStyle}
          {...inputFocusHandler}
          name="name"
          placeholder="Acme Corp"
          required
          minLength={2}
          maxLength={200}
          autoFocus
        />
      </Field>

      <Field label="Client Entity Name (Optional)">
        <input
          className={inputClass}
          style={inputStyle}
          {...inputFocusHandler}
          name="clientName"
          placeholder="Acme Ltd (UK)"
          maxLength={200}
        />
      </Field>

      <ErrorText>{state.error}</ErrorText>

      <div className="flex justify-end gap-3 pt-2">
        <button
          className={secondaryButtonClass}
          style={secondaryButtonStyle}
          type="button"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
        <button
          className={buttonClass}
          style={buttonStyle}
          type="submit"
          disabled={pending}
        >
          {pending ? (
            <>
              <Spinner size={16} />
              <span>Creating...</span>
            </>
          ) : (
            'Create Workspace'
          )}
        </button>
      </div>
    </form>
  );
}
