import { MyGivingPage } from "@/components/donations/donor/MyGivingPage";

export const metadata = {
  title: "My Giving",
  description: "View your donation history and manage recurring gifts.",
};

export default function GiveAccountPage() {
  return <MyGivingPage />;
}
