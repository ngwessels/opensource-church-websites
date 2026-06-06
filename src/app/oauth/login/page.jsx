import { OAuthSignInForm } from "@/components/oauth/OAuthSignInForm";
import { Card, CardContent } from "@/components/ui/card";

export default function OAuthLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted to-accent/30 px-4 py-12">
      <Card className="relative z-10 w-full max-w-md shadow-lg">
        <CardContent className="p-8">
          <OAuthSignInForm />
        </CardContent>
      </Card>
    </div>
  );
}
