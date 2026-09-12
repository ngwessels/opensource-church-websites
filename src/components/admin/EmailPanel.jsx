"use client";

import { Settings, X } from "lucide-react";
import { useState } from "react";

import { EmailIntegrationPanel } from "@/components/admin/EmailIntegrationPanel";
import { EmailListPanel } from "@/components/admin/EmailListPanel";
import { Button } from "@/components/ui/button";

/** Parish email list by default; Mailgun settings behind the gear in the top right. */
export function EmailPanel() {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="relative mx-auto max-w-5xl">
      <div className="mb-4 flex justify-end">
        {showSettings ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowSettings(false)}
            aria-label="Back to email list"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowSettings(true)}
            aria-label="Email settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </div>

      {showSettings ? <EmailIntegrationPanel /> : <EmailListPanel onOpenSettings={() => setShowSettings(true)} />}
    </div>
  );
}
