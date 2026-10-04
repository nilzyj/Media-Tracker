import type { NextAuthConfig } from "next-auth";

/**
 * Auth options shared between the edge-safe `proxy.ts` and the full
 * `auth.ts` instance. Keep this file free of database imports.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  trustHost: true,
  // Providers are supplied by `auth.ts`; the proxy only needs the shared bits.
  providers: [],
  callbacks: {
    authorized({ auth: session, request: { nextUrl } }) {
      const isLoggedIn = Boolean(session?.user);
      const { pathname } = nextUrl;
      const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register");

      if (isAuthPage) {
        if (isLoggedIn) return Response.redirect(new URL("/", nextUrl));
        return true;
      }
      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
