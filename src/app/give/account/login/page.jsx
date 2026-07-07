import { Suspense } from "react";

import { DonorAuthForm } from "@/components/donations/donor/DonorAuthForm";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "My Giving — Sign in",
  description: "Sign in to view your donation history and manage recurring gifts.",
};

export default function DonorLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12">
      <Card className="w-full max-w-md shadow-sm">
        <CardContent className="p-8">
          <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
            <DonorAuthForm mode="login" />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
