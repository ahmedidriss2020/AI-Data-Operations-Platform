/**
 * Seeds a demo account so there is something to sign into after a database
 * reset.
 *
 * Local development only. It uses the service-role key and creates a user with
 * a known password, which is exactly what you never want against a real
 * project -- hence the guard below.
 *
 * Idempotent: safe to run repeatedly, and re-running after `npm run db:reset`
 * puts the same account back.
 *
 * Usage: npm run db:seed
 */

import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

loadEnv({ path: 'apps/web/.env.local', quiet: true });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

const DEMO_EMAIL = 'demo@example.test';
const DEMO_PASSWORD = 'demo-password-123';

// Creating a known-password account is only ever acceptable against a local
// stack. Refuse anywhere else rather than trusting the operator to notice.
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(SUPABASE_URL)) {
  console.error(`Refusing to seed a demo account against a non-local project: ${SUPABASE_URL}`);
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserByEmail(email: string) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`Could not list users: ${error.message}`);
  return data.users.find((user) => user.email === email) ?? null;
}

async function main() {
  let user = await findUserByEmail(DEMO_EMAIL);

  if (user) {
    // Reset the password, so the credentials printed below are always correct
    // even if someone changed them while poking around.
    await admin.auth.admin.updateUserById(user.id, { password: DEMO_PASSWORD });
    console.log(`Demo user already exists (${user.id}); password reset.`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`Could not create the demo user: ${error.message}`);
    user = data.user!;
    console.log(`Created demo user ${user.id}.`);
  }

  // The firm and workspace are created as the user, through the same RPCs the
  // application calls -- so the seed exercises the real write path and leaves a
  // genuine audit trail rather than back-dooring rows in.
  const asUser = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: signInError } = await asUser.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  if (signInError) throw new Error(`Could not sign in as the demo user: ${signInError.message}`);

  const { data: existingOrgs } = await asUser.from('organizations').select('id, name');

  if (!existingOrgs || existingOrgs.length === 0) {
    const { data: org, error: orgError } = await asUser.rpc('create_organization', {
      p_name: 'Demo Accounting LLP',
      p_slug: 'demo-accounting',
    });
    if (orgError) throw new Error(`Could not create the firm: ${orgError.message}`);

    for (const client of ['ACME Ltd', 'Northwind Supplies']) {
      const { error: wsError } = await asUser.rpc('create_workspace', {
        p_org_id: org.id,
        p_name: client,
        p_client_name: `${client} (demo client)`,
      });
      if (wsError) throw new Error(`Could not create workspace ${client}: ${wsError.message}`);
    }

    console.log('Created "Demo Accounting LLP" with two client workspaces.');
  } else {
    console.log(`Firm already set up: ${existingOrgs.map((o) => o.name).join(', ')}.`);
  }

  console.log('\n  Sign in at http://127.0.0.1:3100/login');
  console.log(`  Email:    ${DEMO_EMAIL}`);
  console.log(`  Password: ${DEMO_PASSWORD}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
