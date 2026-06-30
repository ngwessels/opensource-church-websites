import { isRecaptchaEnabled } from "@/lib/recaptcha/config";

export function RecaptchaNotice() {
  if (!isRecaptchaEnabled()) {
    return null;
  }

  return (
    <p className="text-xs text-zinc-500">
      This site is protected by reCAPTCHA and the Google{" "}
      <a
        href="https://policies.google.com/privacy"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-zinc-700"
      >
        Privacy Policy
      </a>{" "}
      and{" "}
      <a
        href="https://policies.google.com/terms"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-zinc-700"
      >
        Terms of Service
      </a>{" "}
      apply.
    </p>
  );
}
