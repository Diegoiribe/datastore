import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  if (process.env.VERCEL && request.nextUrl.pathname === "/") {
    const destination = request.nextUrl.clone();
    destination.pathname = "/studio";
    return NextResponse.redirect(destination);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/"] };
