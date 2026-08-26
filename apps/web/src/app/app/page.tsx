import { redirect } from 'next/navigation';

/**
 * The app is now a single-purpose tool, so its entry point is the analyzer
 * rather than the workspace list. The list still lives at /app/workspaces for
 * the people who need it (creating a client, checking an upload's history); it
 * is simply no longer the first thing an accountant lands on.
 */
export default function AppHomePage() {
  redirect('/app/chat');
}
