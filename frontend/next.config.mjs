import createNextIntlPlugin from "next-intl/plugin";

/** @type {import('next').NextConfig} */

// Single-origin proxy: the browser only ever talks to this app's own origin
// (NEXT_PUBLIC_API_URL=/api), and Next forwards /api/* to the backend
// server-side. This keeps the auth cookie first-party — no CORS / SameSite=None.
//
// BACKEND_URL is the backend service address, available at BUILD time.
// On Render, `fromService host` yields the BARE service hostname (e.g.
// "chessmaster-api-sokc") with no domain, so we append .onrender.com when the
// value has no dot and no scheme. Locally it falls back to the dev backend.
function resolveBackend() {
  let v = process.env.BACKEND_URL || "http://localhost:8000";
  if (v.startsWith("http")) return v;
  if (!v.includes(".")) v = `${v}.onrender.com`;
  return `https://${v}`;
}
const backend = resolveBackend();

const nextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${backend}/api/:path*` },
    ];
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
