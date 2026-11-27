import { NextResponse } from 'next/server';
import { alternatePath, identifyPath, SITE } from './data/site.mjs';
export function middleware(request) {
  const url = request.nextUrl;
  const page = identifyPath(url.pathname);
  const requestedLanguage = url.searchParams.get('lang');
  if (page && ['hu', 'en'].includes(requestedLanguage)) {
    const target = url.clone();
    target.pathname = alternatePath(url.pathname, requestedLanguage);
    target.searchParams.delete('lang');
    return NextResponse.redirect(target, 308);
  }
  const response = NextResponse.next();
  const productionHost = new URL(SITE.origin).hostname;
  const preview = process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production';
  const privatePath = /^\/(admin(?:\/|$)|api(?:\/|$)|foglalasaim(?:\/|$)|eszkozeim(?:\/|$))/.test(url.pathname);
  const bookingQuery = ['barber', 'barberName', 'service', 'booking', 'token', 'code'].some(key => url.searchParams.has(key));
  if (preview || ![productionHost, `www.${productionHost}`].includes(url.hostname) || privatePath || bookingQuery) {
    response.headers.set('X-Robots-Tag', 'noindex, follow, noarchive');
  }
  return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|images/|hero-).*)'] };
