import path from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),
  // Quality gates are the explicit typecheck, tests and build commands.
  eslint: { ignoreDuringBuilds: true },
};
