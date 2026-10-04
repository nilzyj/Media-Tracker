import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isRegistrationAllowed } from "@/lib/config";
import { RegisterForm } from "./register-form";
import { RegistrationClosed } from "./registration-closed";

export const metadata: Metadata = { title: "注册" };

export default function RegisterPage() {
  if (!isRegistrationAllowed()) return <RegistrationClosed />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>创建账号</CardTitle>
      </CardHeader>
      <CardContent>
        <RegisterForm />
      </CardContent>
    </Card>
  );
}
