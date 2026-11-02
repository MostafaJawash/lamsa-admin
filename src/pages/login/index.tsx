import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/features/auth";
import { login } from "@/lib/auth/session";
import { errorMessage } from "@/lib/errors";
import { m } from "@/messages";

const schema = z.object({
  phone: z.string().trim().min(1, m.auth.validation.phoneRequired),
  password: z.string().min(1, m.auth.validation.passwordRequired),
});
type LoginValues = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const session = useSession();
  const [failure, setFailure] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { phone: "", password: "" },
  });

  const notice = session.status === "anonymous" ? session.notice : null;
  const message = failure ?? notice;

  async function onSubmit(values: LoginValues) {
    setFailure(null);
    try {
      await login(values.phone, values.password);
      await navigate("/", { replace: true });
    } catch (error) {
      setFailure(errorMessage(error));
    }
  }

  return (
    <main className="grid min-h-svh grid-cols-1 place-items-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <p className="font-display text-3xl font-bold text-brand">
            {m.app.name}
          </p>
          <h1 className="text-lg font-semibold">{m.auth.loginTitle}</h1>
          <CardDescription>{m.auth.loginHint}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">{m.auth.phone}</Label>
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="username"
                dir="ltr"
                className="text-start"
                placeholder={m.auth.phonePlaceholder}
                aria-invalid={errors.phone ? true : undefined}
                {...register("phone")}
              />
              {errors.phone ? (
                <p className="text-sm text-danger">{errors.phone.message}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">{m.auth.password}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                dir="ltr"
                className="text-start"
                aria-invalid={errors.password ? true : undefined}
                {...register("password")}
              />
              {errors.password ? (
                <p className="text-sm text-danger">{errors.password.message}</p>
              ) : null}
            </div>
            {message ? (
              <p
                role="alert"
                className="rounded-lg bg-destructive/10 p-3 text-sm text-danger"
              >
                {message}
              </p>
            ) : null}
            <Button type="submit" size="lg" disabled={isSubmitting}>
              {isSubmitting ? m.auth.submitting : m.auth.submit}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
