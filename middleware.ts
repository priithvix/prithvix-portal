import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const PUBLIC_PATHS = new Set([
  '/',
  '/login',
  '/register-dealer',
  '/forgot-password',
  '/reset-password',
]);

const MOBILE_USER_AGENT = /Mobile|Android|iPhone|iPad|iPod/i;

const WORKSPACE_COOKIE = 'workspace_mode';

const COOKIE_OPTS = {
  path: '/',
  httpOnly: false as const,
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24,
};

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.has(pathname);
}

function copySupabaseCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach(({ name, value }) => {
    to.cookies.set(name, value);
  });
}

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const path = request.nextUrl.pathname;
  const isMobile = MOBILE_USER_AGENT.test(request.headers.get('user-agent') ?? '');

  const raw = request.cookies.get(WORKSPACE_COOKIE)?.value;
  const mode = raw === 'tally' || raw === 'business_engine' ? raw : null;

  if (isPublicPath(path)) {
    if (user) {
      if (isMobile) {
        const redirect = NextResponse.redirect(new URL('/home', request.url));
        copySupabaseCookies(response, redirect);
        redirect.cookies.set(WORKSPACE_COOKIE, 'business_engine', COOKIE_OPTS);
        return redirect;
      }
      if (mode === 'tally') {
        const redirect = NextResponse.redirect(new URL('/tally', request.url));
        copySupabaseCookies(response, redirect);
        return redirect;
      }
      if (mode === 'business_engine') {
        const redirect = NextResponse.redirect(new URL('/home', request.url));
        copySupabaseCookies(response, redirect);
        return redirect;
      }
      const redirect = NextResponse.redirect(new URL('/workspace', request.url));
      copySupabaseCookies(response, redirect);
      return redirect;
    }
    return response;
  }

  if (path === '/workspace') {
    if (!user) {
      const redirect = NextResponse.redirect(new URL('/login', request.url));
      copySupabaseCookies(response, redirect);
      return redirect;
    }
    if (isMobile) {
      const redirect = NextResponse.redirect(new URL('/home', request.url));
      copySupabaseCookies(response, redirect);
      redirect.cookies.set(WORKSPACE_COOKIE, 'business_engine', COOKIE_OPTS);
      return redirect;
    }
    return response;
  }

  if (path.startsWith('/api')) {
    return response;
  }

  if (!user) {
    return response;
  }

  if (isMobile) {
    if (path.startsWith('/tally')) {
      const redirect = NextResponse.redirect(new URL('/home', request.url));
      copySupabaseCookies(response, redirect);
      redirect.cookies.set(WORKSPACE_COOKIE, 'business_engine', COOKIE_OPTS);
      return redirect;
    }
    response.cookies.set(WORKSPACE_COOKIE, 'business_engine', COOKIE_OPTS);
    return response;
  }

  if (!mode) {
    const redirect = NextResponse.redirect(new URL('/workspace', request.url));
    copySupabaseCookies(response, redirect);
    return redirect;
  }

  if (mode === 'business_engine' && path.startsWith('/tally')) {
    const redirect = NextResponse.redirect(new URL('/home', request.url));
    copySupabaseCookies(response, redirect);
    return redirect;
  }

  if (mode === 'tally' && !path.startsWith('/tally')) {
    const redirect = NextResponse.redirect(new URL('/tally', request.url));
    copySupabaseCookies(response, redirect);
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
