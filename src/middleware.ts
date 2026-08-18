import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const user = req.auth?.user;
  const isLoggedIn = !!(
    user &&
    typeof user === "object" &&
    Boolean(user.id || (user as any).username || (user.email && user.email.includes("@")))
  );
  const { pathname, searchParams } = req.nextUrl;

  const isApiAuthRoute = pathname.startsWith("/api/auth");
  const isWarehouseApiRoute = pathname.startsWith("/api/warehouse");
  const isPublicRoute =
    pathname === "/login" ||
    isWarehouseApiRoute ||
    pathname.startsWith("/_next") ||
    pathname.includes(".") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".svg");

  if (isApiAuthRoute || isPublicRoute) {
    if (pathname === "/login") {
      const isForceClear =
        searchParams.has("logout") ||
        searchParams.has("clear") ||
        searchParams.has("error");

      if (isForceClear || !isLoggedIn) {
        const response = NextResponse.next();
        response.cookies.delete("next-auth.session-token");
        response.cookies.delete("__Secure-next-auth.session-token");
        response.cookies.delete("authjs.session-token");
        return response;
      }

      if (isLoggedIn) {
        return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
      }
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    let callbackUrl = pathname;
    if (req.nextUrl.search) {
      callbackUrl += req.nextUrl.search;
    }
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", callbackUrl);
    loginUrl.searchParams.set("clear", "true");

    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete("next-auth.session-token");
    response.cookies.delete("__Secure-next-auth.session-token");
    response.cookies.delete("authjs.session-token");
    return response;
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.svg$|.*\\.webp$).*)"
  ],
};
