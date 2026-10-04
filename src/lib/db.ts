import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;

  // 之前这里写成 `?? ""`，缺变量时会静默降级：Prisma 在第一次查询时才抛出
  // 一个和「网络故障」难以区分的错，登录时表现为 CallbackRouteError，
  // 排查方向完全被带偏。改成在第一个查询前就抛出可操作的说明。
  if (!connectionString) {
    throw new Error(
      "缺少 DATABASE_URL 环境变量。请在 .env 或部署平台的 Environment Variables 中配置 Neon 的池化连接串（Neon 集成会自动注入）。",
    );
  }

  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
