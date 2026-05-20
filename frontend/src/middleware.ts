import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Route protection. Everything under `/` except the auth pages and public
 * assets requires a signed-in Supabase user.
 */
const PUBLIC_PATHS = [
  "/signin",
  "/auth/callback",
  "/_next",
  "/favicon.ico",
  "/fonts",
];

export async function middleware(request: NextRequest) {
  // Skip entirely if Supabase isn't configured — lets local dev still boot.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    // Still refresh the session cookie even on public paths.
    const { response } = await updateSession(request);
    return response;
  }

  const { response, user } = await updateSession(request);

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Apply to every path EXCEPT static files and _next internals.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ttf|woff2)$).*)",
  ],
};
