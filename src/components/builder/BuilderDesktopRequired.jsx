"use client";

import Link from "next/link";
import { Monitor } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BUILDER_MIN_VIEWPORT_WIDTH } from "@/lib/design/admin-tokens";

export function BuilderDesktopRequired() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted px-6 text-center">
      <div className="flex max-w-md flex-col items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Monitor className="h-7 w-7" aria-hidden />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-foreground">Desktop required</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            The website builder works best on a desktop or laptop with a screen at least{" "}
            {BUILDER_MIN_VIEWPORT_WIDTH}px wide. Please switch to a larger device or widen
            your browser window to continue editing.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/">View live site</Link>
        </Button>
      </div>
    </div>
  );
}
