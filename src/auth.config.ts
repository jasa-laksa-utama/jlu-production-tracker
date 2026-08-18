import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const user = auth?.user;
      const isLoggedIn = !!(
        user &&
        typeof user === "object" &&
        Boolean(user.id || (user as any).username || (user.email && user.email.includes("@")))
      );
      const isApiAuthRoute = nextUrl.pathname.startsWith('/api/auth');
      const isPublicRoute = nextUrl.pathname === '/login';

      if (isApiAuthRoute) return true;

      if (isPublicRoute) {
        const isForceClear =
          nextUrl.searchParams.has('logout') ||
          nextUrl.searchParams.has('clear') ||
          nextUrl.searchParams.has('error');

        if (isForceClear || !isLoggedIn) {
          return true;
        }

        if (isLoggedIn) {
          return Response.redirect(new URL('/dashboard', nextUrl));
        }
        return true;
      }

      if (!isLoggedIn) {
        const loginUrl = new URL('/login', nextUrl);
        loginUrl.searchParams.set('clear', 'true');
        return Response.redirect(loginUrl);
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.position = user.position;
        token.roles = user.roles;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = (token.id || token.sub) as string;
        session.user.username = (token.username || "") as string;
        session.user.position = (token.position || "") as string;
        session.user.roles = (token.roles || []) as string[];
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
} satisfies NextAuthConfig;
