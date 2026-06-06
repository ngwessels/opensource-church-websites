import { DonateButton } from "@/components/donations/DonateButton";

export const metadata = {
  title: "Give",
  description: "Support our parish with a one-time or monthly donation.",
};

export default function GivePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Give</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Support our parish with a secure online donation.
        </p>
        <div className="mt-8">
          <DonateButton />
        </div>
      </div>
    </div>
  );
}
