import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Migrations need a *direct* (non-pooled) connection, so `DIRECT_URL` is
 * preferred. The Neon Vercel integration, however, injects
 * `DATABASE_URL_UNPOOLED` rather than `DIRECT_URL`, and `prisma generate` runs
 * during `postinstall` on every build — so the config must not hard-fail when
 * the variable is missing, otherwise a forgotten env var breaks the build with a
 * confusing "Cannot resolve environment variable" error instead of a clear one.
 *
 * Falls back: DIRECT_URL -> DATABASE_URL_UNPOOLED -> DATABASE_URL -> placeholder.
 * A placeholder is fine for `generate`, which never opens a connection; only
 * `migrate` / `db push` actually need a reachable URL.
 */
const placeholder = "postgresql://user:password@localhost:5432/placeholder";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url:
      process.env.DIRECT_URL ??
      process.env.DATABASE_URL_UNPOOLED ??
      process.env.DATABASE_URL ??
      placeholder,
  },
});
