import { Suspense } from "react";

import { SignInForm } from "@/components/auth/SignInForm";
import { Card, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted to-accent/30 px-4 py-12">
      <Card className="relative z-10 w-full max-w-md shadow-lg">
        <CardContent className="p-8">
          <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
            <SignInForm mode="login" />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
