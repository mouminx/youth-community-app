import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Middleware refreshes the Supabase auth session on every request and
// redirects unauthenticated users away from /c/* routes.
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session (important for token rotation).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Gate: /c/* routes require authentication.
  if (!user && request.nextUrl.pathname.startsWith("/c")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // If logged in and hitting root or /login, redirect to community list.
  if (user && (request.nextUrl.pathname === "/" || request.nextUrl.pathname === "/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/communities";
    return NextResponse.redirect(url);
  }

  supabaseResponse.headers.set("x-pathname", request.nextUrl.pathname);
  return supabaseResponse;
}

export const config = {
  matcher: [
    // Run on page routes only — skip all _next, api, and static file requests.
    "/((?!_next|api|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js)$).*)",
  ],
};
