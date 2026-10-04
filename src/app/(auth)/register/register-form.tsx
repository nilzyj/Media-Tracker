"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerAction, type AuthFormState } from "@/actions/auth";

export function RegisterForm() {
  const [state, action] = useActionState<AuthFormState & { ok?: boolean }, FormData>(
    registerAction,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">昵称</Label>
        <Input id="name" name="name" required minLength={2} maxLength={50} placeholder="怎么称呼你" />
        {state.errors?.name && <p className="text-xs text-destructive">{state.errors.name[0]}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">邮箱</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
        />
        {state.errors?.email && <p className="text-xs text-destructive">{state.errors.email[0]}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">密码</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
        {state.errors?.password ? (
          <p className="text-xs text-destructive">{state.errors.password[0]}</p>
        ) : (
          <p className="text-xs text-muted-foreground">至少 8 位</p>
        )}
      </div>

      {state.message && (
        <p className="flex items-start gap-1.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {state.message}
        </p>
      )}

      <SubmitButton />

      <p className="text-center text-sm text-muted-foreground">
        已有账号？
        <Link href="/login" className="ml-1 underline underline-offset-4">
          登录
        </Link>
      </p>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "创建中…" : "创建账号"}
    </Button>
  );
}
