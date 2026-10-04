"use server";

import { hash } from "bcryptjs";
import { z } from "zod";
import { redirect } from "next/navigation";
import { CredentialsSignin } from "next-auth";
import { signIn } from "@/auth";
import { prisma } from "@/lib/db";
import { errorMessage } from "@/lib/action-result";

export type AuthFormState = {
  errors?: { name?: string[]; email?: string[]; password?: string[] };
  message?: string;
};

export type PasswordFormState = {
  errors?: { currentPassword?: string[]; newPassword?: string[] };
  message?: string;
};

/**
 * `signIn` 默认会调用 Next.js 的 `redirect()` 来跳转，而 `redirect()` 是靠**抛出**
 * 一个带 `digest` 的异常实现的。把它包在 try/catch 里会把成功登录时的跳转信号
 * 当成失败吞掉——结果就是「其实已登录、cookie 也写好了，但既不跳转又显示错误」。
 *
 * 传 `redirect: false` 后 `signIn` 不再跳转，行为变成：
 *   - 成功 -> 返回目标 URL（会话 cookie 已写入）
 *   - 凭证错误 -> **抛出 CredentialsSignin**
 *     （@auth/core 的 Auth() 在 raw 模式下走
 *      `if (isAuthError && isRaw && !isRedirect) throw error`）
 *
 * 所以失败信息要从异常里取，成功才需要显式 redirect()。
 */
const WRONG_CREDENTIALS = "邮箱或密码不正确";

function isWrongCredentials(error: unknown): boolean {
  return error instanceof CredentialsSignin;
}

/** 兜底：万一 Auth.js 改成返回带 error 参数的 URL，也能识别出来。 */
function signInErrorCode(url: string): string | null {
  try {
    return new URL(url, "http://localhost").searchParams.get("error");
  } catch {
    return "Unknown";
  }
}

const registerSchema = z.object({
  name: z.string().trim().min(2, "昵称至少 2 个字符").max(50),
  email: z.email("请输入有效的邮箱地址").trim().toLowerCase(),
  password: z.string().min(8, "密码至少 8 位").max(100),
});

export async function registerAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState & { ok?: boolean }> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { name, email, password } = parsed.data;

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return { errors: { email: ["该邮箱已被注册"] } };
    }

    await prisma.user.create({
      data: { name, email, passwordHash: await hash(password, 10) },
    });
  } catch (error) {
    return { message: errorMessage(error) };
  }

  let url: string;
  try {
    url = await signIn("credentials", {
      email,
      password,
      redirectTo: "/",
      redirect: false,
    });
  } catch (error) {
    if (isWrongCredentials(error)) {
      // 账号刚建好却校验失败，只可能是并发写入或哈希异常，如实告知
      return { message: "注册成功，但自动登录失败，请手动登录" };
    }
    return { message: `注册成功，但自动登录失败：${errorMessage(error)}` };
  }

  if (signInErrorCode(url)) {
    return { message: "注册成功，但自动登录失败，请手动登录" };
  }

  redirect("/");
}

const loginSchema = z.object({
  email: z.email("请输入有效的邮箱地址").trim().toLowerCase(),
  password: z.string().min(1, "请输入密码"),
});

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  let url: string;
  try {
    url = await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/",
      redirect: false,
    });
  } catch (error) {
    if (isWrongCredentials(error)) return { message: WRONG_CREDENTIALS };
    return { message: `登录失败：${errorMessage(error)}` };
  }

  const code = signInErrorCode(url);
  if (code) {
    return { message: code === "CredentialsSignin" ? WRONG_CREDENTIALS : `登录失败（${code}）` };
  }

  redirect("/");
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "请输入当前密码"),
  newPassword: z.string().min(8, "新密码至少 8 位").max(100),
});

export async function changePasswordAction(
  _prev: PasswordFormState,
  formData: FormData,
): Promise<PasswordFormState> {
  const { getUserId } = await import("@/lib/dal");
  const userId = await getUserId();
  if (!userId) return { message: "未登录" };

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.passwordHash) return { message: "当前账号不支持密码登录" };

  const { compare, hash: hashPassword } = await import("bcryptjs");
  if (!(await compare(parsed.data.currentPassword, user.passwordHash))) {
    return { message: "当前密码不正确" };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(parsed.data.newPassword, 10) },
    });
    return { message: "密码已更新" };
  } catch (error) {
    return { message: errorMessage(error) };
  }
}
