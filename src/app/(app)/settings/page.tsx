import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, Palette, User, UserPlus } from "lucide-react";
import { requireUser } from "@/lib/dal";
import { isTmdbConfigured } from "@/lib/tmdb";
import { isRegistrationAllowed } from "@/lib/config";
import { ProfileForm, PasswordForm } from "@/components/settings-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = { title: "设置" };

export default async function SettingsPage() {
  const user = await requireUser();
  const tmdbReady = isTmdbConfigured();
  const registrationAllowed = isRegistrationAllowed();

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <header>
        <h1 className="text-xl font-semibold">设置</h1>
        <p className="text-sm text-muted-foreground">
          登录邮箱：{user.email}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <User className="size-4" />
            账号
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProfileForm name={user.name ?? ""} />

          <div className="border-t pt-4">
            <h3 className="mb-3 text-sm font-medium">修改密码</h3>
            <PasswordForm />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Palette className="size-4" />
            外观
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">主题（跟随系统 / 浅色 / 深色）</p>
          <ThemeToggle />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <KeyRound className="size-4" />
            数据源
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span>TMDB（电影 / 电视剧）</span>
            <Badge variant={tmdbReady ? "outline" : "destructive"}>
              {tmdbReady ? "已配置" : "未配置"}
            </Badge>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span>AniList（动漫）</span>
            <Badge variant="outline">无需密钥</Badge>
          </div>
          {!tmdbReady && (
            <p className="pt-1 text-xs text-muted-foreground">
              在项目根目录的 <code>.env</code> 中填入{" "}
              <code>TMDB_API_READ_TOKEN</code>（TMDB 后台的 API Read Access Token），重启后即可搜索电影与电视剧。
              未配置时仍可使用 AniList 与手动录入。
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <UserPlus className="size-4" />
            账号注册
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span>新用户注册</span>
            <Badge variant={registrationAllowed ? "destructive" : "outline"}>
              {registrationAllowed ? "已开放" : "已关闭"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            由环境变量 <code>ALLOW_REGISTRATION</code> 控制（
            {registrationAllowed ? "当前未设为 false" : "当前为 false"}）。
            设为 <code>false</code> 并重新部署后，<code>/register</code> 不再提供注册表单、
            注册接口也会直接拒绝；已存在的账号照常登录。
            {!registrationAllowed && " 如需再邀请用户，临时改回 true 即可。"}
          </p>
          {registrationAllowed && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              站点域名可被公开访问，开放注册意味着任何人都能创建账号。建议确认所有账号后关闭注册。
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">数据备份</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            导出与导入（JSON / CSV）、从 AniList 导入。
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link href="/settings/import-export">前往导入导出</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
