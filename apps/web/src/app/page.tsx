import { redirect } from 'next/navigation';

import { getUser } from '@/lib/authz';

export default async function RootPage() {
  const user = await getUser();
  redirect(user ? '/app' : '/login');
}
