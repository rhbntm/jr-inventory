import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized({ req, token }) {
        if (
          req.nextUrl.pathname === "/" ||
          req.nextUrl.pathname === "/login" ||
          req.nextUrl.pathname.startsWith("/api/auth")
        ) {
          return true;
        }
        return token !== null;
      },
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};
