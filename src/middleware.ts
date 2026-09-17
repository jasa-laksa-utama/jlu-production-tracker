import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

function clearSessionCookies(res: NextResponse) {
  res.cookies.delete("authjs.session-token");
  res.cookies.delete("__Secure-authjs.session-token");
  res.cookies.delete("next-auth.session-token");
  res.cookies.delete("__Secure-next-auth.session-token");
  res.cookies.delete("authjs.callback-url");
  res.cookies.delete("authjs.csrf-token");
  res.cookies.delete("next-auth.callback-url");
  res.cookies.delete("next-auth.csrf-token");
}

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
  const isShippingApiRoute = pathname.startsWith("/api/shipping");
  const isLoginPage = pathname === "/login";
  const isStaticAsset =
    pathname.startsWith("/_next") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".jpeg") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".webp") ||
    pathname.endsWith(".css") ||
    pathname.endsWith(".js");

  if (isApiAuthRoute || isWarehouseApiRoute || isShippingApiRoute || isStaticAsset) {
    return NextResponse.next();
  }

  if (isLoginPage) {
    const isForceClear =
      searchParams.has("logout") ||
      searchParams.has("clear") ||
      searchParams.has("error");

    if (isForceClear || !isLoggedIn) {
      const response = NextResponse.next();
      clearSessionCookies(response);
      return response;
    }

    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
    }
    return NextResponse.next();
  }

  // Jika belum login atau sesi tidak valid, langsung arahkan ke /login
  if (!isLoggedIn) {
    let callbackUrl = pathname;
    if (req.nextUrl.search) {
      callbackUrl += req.nextUrl.search;
    }
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", callbackUrl);
    loginUrl.searchParams.set("clear", "true");

    const response = NextResponse.redirect(loginUrl);
    clearSessionCookies(response);
    return response;
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.svg$|.*\\.webp$).*)",
  ],
};

