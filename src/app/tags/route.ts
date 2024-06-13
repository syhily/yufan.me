import { redirect } from 'next/navigation';

/**
 * We don't plan to add a tag cloud.
 */
export async function GET(request: Request) {
  redirect(`/`);
}
