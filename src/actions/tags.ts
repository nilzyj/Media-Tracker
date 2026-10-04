"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { fail, ok, errorMessage, type ActionResult } from "@/lib/action-result";

const tagSchema = z.object({
  name: z.string().trim().min(1, "标签名不能为空").max(30),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "颜色需为 #RRGGBB 格式").optional(),
});

export async function createTag(input: z.input<typeof tagSchema>): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = tagSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "参数不合法");

  try {
    await prisma.tag.upsert({
      where: { userId_name: { userId: user.id, name: parsed.data.name } },
      create: { userId: user.id, name: parsed.data.name, color: parsed.data.color ?? null },
      update: { color: parsed.data.color ?? null },
    });
    revalidatePath("/", "layout");
    return ok();
  } catch (error) {
    return fail(errorMessage(error));
  }
}

export async function updateTag(
  tagId: string,
  input: z.input<typeof tagSchema>,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = tagSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "参数不合法");

  const owned = await prisma.tag.findFirst({ where: { id: tagId, userId: user.id } });
  if (!owned) return fail("未找到该标签");

  try {
    await prisma.tag.update({
      where: { id: tagId },
      data: { name: parsed.data.name, color: parsed.data.color ?? null },
    });
    revalidatePath("/", "layout");
    return ok();
  } catch (error) {
    return fail(errorMessage(error));
  }
}

export async function deleteTag(tagId: string): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await prisma.tag.deleteMany({ where: { id: tagId, userId: user.id } });
    revalidatePath("/", "layout");
    return ok();
  } catch (error) {
    return fail(errorMessage(error));
  }
}

const profileSchema = z.object({
  name: z.string().trim().min(1, "请填写昵称").max(50),
});

export async function updateProfile(input: z.input<typeof profileSchema>): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "参数不合法");

  try {
    await prisma.user.update({ where: { id: user.id }, data: { name: parsed.data.name } });
    revalidatePath("/", "layout");
    return ok();
  } catch (error) {
    return fail(errorMessage(error));
  }
}
