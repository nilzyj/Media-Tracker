"use server";

import { hash } from "bcryptjs";
import { z } from "zod";
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

  try {
    await signIn("credentials", { email, password, redirectTo: "/" });
  } catch {
    return { message: "注册成功，但自动登录失败，请手动登录" };
  }

  return { ok: true };
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

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/",
    });
    return {};
  } catch (error) {
    if (error instanceof Error && error.message.includes("CredentialsSignin")) {
      return { message: "邮箱或密码不正确" };
    }
    return { message: "登录失败，请稍后再试" };
  }
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
