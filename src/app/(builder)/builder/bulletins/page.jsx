"use client";

import { collection, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getPageType } from "@/lib/bulletins/schema";
import { getFirebaseFirestore } from "@/lib/firebase/firestore";
import { COLLECTIONS } from "@/lib/firestore/paths";

export default function BulletinsRedirectPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Redirecting…");

  useEffect(() => {
    async function redirect() {
      const db = getFirebaseFirestore();
      const snap = await getDocs(collection(db, COLLECTIONS.pages));
      const bulletinsPage = snap.docs.find(
        (d) => getPageType(d.data()) === "bulletins",
      );

      if (bulletinsPage) {
        const slug = bulletinsPage.data().slug || "";
        router.replace(slug ? `/builder/edit/${slug}` : "/builder/edit");
        return;
      }

      setMessage(
        "No Bulletins page found. Create a page and set its type to Bulletins in Page Settings.",
      );
    }

    redirect();
  }, [router]);

  return (
    <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
