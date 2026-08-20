import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Two projects, because they need different environments.
 *
 * `server` runs the auth, session, and repository logic in a real Node
 * environment — it uses `node:sqlite` and `node:crypto`, which jsdom cannot
 * provide. `ui` keeps the existing jsdom setup for React components.
 */
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    projects: [
      {
        extends: true,
        resolve: {
          alias: [
            // `server-only` throws when loaded outside a React Server
            // Component. These tests call that code directly, which is exactly
            // the context the marker guards, so use the package's no-op entry.
            {
              find: /^server-only$/,
              replacement: fileURLToPath(
                new URL("./node_modules/server-only/empty.js", import.meta.url),
              ),
            },
          ],
        },
        test: {
          name: "server",
          environment: "node",
          globals: true,
          include: ["src/lib/**/*.{test,spec}.ts", "src/**/*.server.{test,spec}.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "ui",
          environment: "jsdom",
          globals: true,
          setupFiles: ["./vitest.setup.ts"],
          include: ["src/**/*.{test,spec}.tsx"],
        },
      },
    ],
  },
});
