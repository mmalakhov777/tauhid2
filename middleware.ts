import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { guestRegex, isDevelopmentEnvironment } from './lib/constants';

// Define public routes that don't require authentication
const publicRoutes = [
  '/login',
  '/register',
  '/api/auth/guest', // Allow guest creation
  '/api/external-chat', // Allow external chat API with its own authentication
  '/api/telegram', // Allow Telegram webhook
  // Add any other public static pages here
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow health checks and other essential API routes to be public
  if (pathname.startsWith('/ping') || pathname.startsWith('/api/health')) {
    return new Response('pong', { status: 200 });
  }

  // Allow Telegram webhook to bypass all authentication
  if (pathname.startsWith('/api/telegram')) {
    return NextResponse.next();
  }

  // Let NextAuth handle its own API routes
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }
  
  // Check if the user is authenticated
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: !isDevelopmentEnvironment,
  });

  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  // If the user is authenticated
  if (token) {
    const isGuest = guestRegex.test(token?.email ?? '');
    // If a logged-in user tries to access login/register, redirect to home
    if (!isGuest && (pathname === '/login' || pathname === '/register')) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    // Otherwise, allow access
    return NextResponse.next();
  }

  // If the user is not authenticated and the route is not public
  if (!isPublicRoute) {
    // For any non-public route (like /chat/[id]), create a guest session and redirect
    const redirectUrl = encodeURIComponent(request.url);
    return NextResponse.redirect(
      new URL(`/api/auth/guest?redirectUrl=${redirectUrl}`, request.url),
    );
  }

  // Allow access to public routes for unauthenticated users
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - assets (for images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|assets).*)',
  ],
};
