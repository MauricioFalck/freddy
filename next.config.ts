import type { NextConfig } from "next";

/**
 * `NEXT_PUBLIC_BASE_PATH` is set by the deploy workflow to the GitHub Pages
 * project path (e.g. `/freddy`). It is empty for local development and for any
 * host that serves the app from the domain root.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // Static export: the current deploy target (GitHub Pages) serves files, not a
  // Node server. See docs/decisions.md - this is expected to change once the
  // app needs auth and a database.
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
