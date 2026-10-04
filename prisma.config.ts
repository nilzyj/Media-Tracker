import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // CLI / migrations use the direct connection; runtime uses the pooled DATABASE_URL
    url: env("DIRECT_URL"),
  },
});
