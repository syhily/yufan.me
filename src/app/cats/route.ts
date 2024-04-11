import { redirect } from 'next/navigation';

// The requests without category name show the default category.
export async function GET(request: Request) {
  redirect(`/`);
}
