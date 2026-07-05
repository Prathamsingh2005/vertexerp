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
  const { pathname } = request.nextUrl;

  const isAuthRoute =
    pathname === "/auth" || pathname.startsWith("/auth/");

  if (!user && !isAuthRoute) {
    return redirectWithSessionCookies(
      new URL("/auth", request.url),
      response
    );
  }

  if (user && pathname === "/auth") {
    return redirectWithSessionCookies(
      new URL("/", request.url),
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