import { DonorForgotPasswordForm } from "@/components/donations/donor/DonorForgotPasswordForm";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "My Giving — Reset password",
};

export default function DonorForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12">
      <Card className="w-full max-w-md shadow-sm">
        <CardContent className="p-8">
          <DonorForgotPasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
