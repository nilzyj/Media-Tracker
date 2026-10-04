"use client";

import { useActionState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePasswordAction, type PasswordFormState } from "@/actions/auth";
import { updateProfile } from "@/actions/tags";

export function ProfileForm({ name }: { name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(async () => {
          const result = await updateProfile({ name: String(formData.get("name") ?? "") });
          if (!result.ok) toast.error(result.error);
          else {
            toast.success("昵称已更新");
            router.refresh();
          }
        });
      }}
    >
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="profile-name">昵称</Label>
        <Input id="profile-name" name="name" defaultValue={name} required maxLength={50} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "保存中…" : "保存"}
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState<PasswordFormState, FormData>(changePasswordAction, {});

  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="currentPassword">当前密码</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
        {state.errors?.currentPassword && (
          <p className="text-xs text-destructive">{state.errors.currentPassword[0]}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="newPassword">新密码</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
        {state.errors?.newPassword && (
          <p className="text-xs text-destructive">{state.errors.newPassword[0]}</p>
        )}
      </div>

      {state.message && (
        <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
          {state.message === "密码已更新" ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
          ) : (
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          )}
          {state.message}
        </p>
      )}

      <PasswordSubmit />
    </form>
  );
}

function PasswordSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" disabled={pending}>
      {pending ? "提交中…" : "修改密码"}
    </Button>
  );
}
