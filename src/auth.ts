import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authConfig } from "@/auth.config";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma as never),
  /**
   * Credentials provider **只支持 JWT 策略**。用 "database" 会让
   * `assertConfig` 直接抛 UnsupportedStrategy，连 /api/auth/csrf 都是 500，
   * 表现为「注册成功但自动登录失败」。
   *
   * 代价是 session 信息存在 cookie 里而非 sessions 表；因此
   * auth.ts 的 session 回调必须从 token 取 user id，并且改密码后
   * 需要重新登录才会生效（见 actions/auth.ts 的处理）。
   */
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  providers: [
    Credentials({
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const email = parsed.data.email.toLowerCase();
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const ok = await compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    /**
     * JWT 策略下，session 回调拿到的是 token 而不是 user：
     * 首次登录时 user 存在，后续请求只有 token.sub。
     */
    session({ session, token, user }) {
      const id = user?.id ?? token.sub;
      if (id) session.user.id = id;
      if (token.name) session.user.name = token.name as string;
      return session;
    },
  },
});
