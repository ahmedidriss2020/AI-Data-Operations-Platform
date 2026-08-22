'use client';

import { useActionState } from 'react';

import { createOrganization, type ActionState } from '@/app/actions';
import { ErrorText, Field, Spinner, buttonClass, buttonStyle, inputClass, inputFocusHandler, inputStyle } from '@/components/ui';

const initialState: ActionState = { error: null };

export function CreateOrgForm() {
  const [state, formAction, pending] = useActionState(createOrganization, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <Field
        label="Firm Name"
        hint="The accounting practice or bookkeeping firm managing client accounts."
      >
        <input
          className={inputClass}
          style={inputStyle}
          {...inputFocusHandler}
          name="name"
          placeholder="e.g. Acme Financial & Advisory Services"
          required
          minLength={2}
          maxLength={200}
        />
      </Field>

      <ErrorText>{state.error}</ErrorText>

      <button className={`${buttonClass} w-full`} style={buttonStyle} type="submit" disabled={pending}>
        {pending ? (
          <>
            <Spinner size={18} />
            <span>Creating Firm...</span>
          </>
        ) : (
          'Create Organization'
        )}
      </button>
    </form>
  );
}
