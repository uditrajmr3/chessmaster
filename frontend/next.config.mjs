/** @type {import('next').NextConfig} */

// Single-origin proxy: the browser only ever talks to this app's own origin
// (NEXT_PUBLIC_API_URL=/api), and Next forwards /api/* to the backend
// server-side. This keeps the auth cookie first-party — no CORS / SameSite=None.
//
// BACKEND_URL is the backend service address, available at BUILD time.
// On Render it's injected from the backend service host (no scheme), so we
// prefix https:// when needed. Locally it falls back to the dev backend.
const raw = process.env.BACKEND_URL || "http://localhost:8000";
const backend = raw.startsWith("http") ? raw : `https://${raw}`;

const nextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${backend}/api/:path*` },
    ];
  },
};

export default nextConfig;
