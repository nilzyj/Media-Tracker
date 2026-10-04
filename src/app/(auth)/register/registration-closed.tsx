import Link from "next/link";
import { Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * 注册关闭时展示的页面。刻意不用 notFound()：站点域名本来就公开，
 * 隐藏入口反而让人反复尝试，不如明确告知。
 */
export function RegistrationClosed() {
  return (
    <Card>
      <CardHeader className="items-center text-center">
        <span className="mx-auto grid size-11 place-items-center rounded-full bg-muted">
          <Lock className="size-5 text-muted-foreground" />
        </span>
        <CardTitle>注册已关闭</CardTitle>
        <CardDescription>
          这个实例目前不再接受新账号注册。
          <br />
          如果你是管理员，需要重新开放请把环境变量{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">ALLOW_REGISTRATION</code>{" "}
          设为{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">true</code> 后重新部署。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">已有账号，去登录</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
