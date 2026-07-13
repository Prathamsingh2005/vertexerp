import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

function redirectWithSessionCookies(
  url: URL,
  sessionResponse: NextResponse
) {
  const redirectResponse = NextResponse.redirect(url);

  sessionResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });

  return redirectResponse;
}

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  const isAuthRoute =
    pathname === "/auth" || pathname.startsWith("/auth/");

  const isPublicRoute = pathname === "/" || isAuthRoute;

  if (!user && !isPublicRoute) {
    const authUrl = new URL("/auth", request.url);
    authUrl.searchParams.set("next", `${pathname}${search}`);

    return redirectWithSessionCookies(authUrl, response);
  }

  if (
    user &&
    (pathname === "/" || pathname === "/auth")
  ) {
    return redirectWithSessionCookies(
      new URL("/dashboard", request.url),
      response
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};