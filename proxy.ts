import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── No Supabase configured → pass through (demo/local mode) ───────────────
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.next();
  }

  // ── Build a mutable response and a Supabase client that refreshes tokens ──
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        // Propagate updated cookies to both the mutated request and response
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: getUser() validates the session JWT server-side.
  // Never use getSession() for auth checks — it doesn't validate the token.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── Route protection ───────────────────────────────────────────────────────

  // Unauthenticated user hitting a protected route → redirect to login
  if (pathname.startsWith("/workspace") && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated user visiting login → redirect to workspace
  if (pathname === "/login" && user) {
    const workspaceUrl = request.nextUrl.clone();
    workspaceUrl.pathname = "/workspace";
    return NextResponse.redirect(workspaceUrl);
  }

  return response;
}

// Next.js 16: the "proxy" file convention replaces "middleware"
// Run on all pages except static assets and API routes
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon\\.ico|.*\\.png$|.*\\.svg$).*)"],
};
