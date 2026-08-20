import type { NextConfig } from "next";

/**
 * The app runs as a Node server.
 *
 * It used to be a static export on GitHub Pages, which was right for a
 * placeholder page. Sessions, password hashing, and per-user queries all have
 * to run somewhere the user cannot see or edit, and a static file host has
 * nowhere to put them — so `output: "export"` is gone. See
 * `docs/decisions/0002-auth-needs-a-server.md`; the replacement host is an
 * open decision.
 */
const nextConfig: NextConfig = {
  // `node:sqlite` is a Node built-in; never try to bundle it.
  serverExternalPackages: ["node:sqlite"],
};

export default nextConfig;
