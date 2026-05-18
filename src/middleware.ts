export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/employees/:path*",
    "/departments/:path*",
    "/positions/:path*",
    "/attendance/:path*",
    "/leave/:path*",
    "/permissions/:path*",
    "/payroll/:path*",
    "/reports/:path*",
    "/notifications/:path*",
    "/audit-logs/:path*",
    "/settings/:path*",
  ],
};
