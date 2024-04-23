import { permanentRedirect } from 'next/navigation';

// The request without page number is the same request as the homepage.
export async function GET(request: Request) {
  const target = request.url.substring(0, request.url.indexOf('/page'));
  permanentRedirect(target);
}
