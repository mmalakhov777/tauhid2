import { signIn } from '@/app/(auth)/auth';
import { isDevelopmentEnvironment } from '@/lib/constants';
import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import { cleanupOldGuestUsers } from '@/lib/db/queries';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const redirectUrl = searchParams.get('redirectUrl') || '/';

  console.log('[guest route] Guest authentication requested, checking existing session...');

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: !isDevelopmentEnvironment,
  });

  // If user already has a valid session, redirect to home
  if (token) {
    console.log('[guest route] Valid session found, redirecting to home');
    return NextResponse.redirect(new URL('/', request.url));
  }

  console.log('[guest route] No valid session, creating guest session...');

  // Periodically clean up old unused guest users (run cleanup 10% of the time)
  if (Math.random() < 0.1) {
    console.log('[guest route] Running periodic guest user cleanup...');
    cleanupOldGuestUsers(24).catch(error => {
      console.error('[guest route] Cleanup error:', error);
    });
  }

  return signIn('guest', { redirect: true, redirectTo: redirectUrl });
}
