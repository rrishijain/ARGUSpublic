import path from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  serverExternalPackages: ['esbuild'],
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),
  // srcdoc features still render; the container policy blocks a generated frame
  // navigating itself to a URL (which its own connect-src policy cannot block).
  async headers() {
    return [{source:'/:path*',headers:[{key:'Content-Security-Policy',value:"frame-src 'none'; object-src 'none'; base-uri 'self'"}]}];
  },
  // Quality gates are the explicit typecheck, tests and build commands.
  eslint: { ignoreDuringBuilds: true },
};
