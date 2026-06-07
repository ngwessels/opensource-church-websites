"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  formatPresetAmountsDollars,
  getDonationConfig,
  normalizeDonationConfig,
  parsePresetAmountsDollars,
  validateDonationConfig,
} from "@/lib/donations/schema";

import { DonationSettingsFields } from "./DonationSettingsFields";

function DonationSettingsForm({ page, onClose, onSave }) {
  const initial = getDonationConfig(page);
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [presetAmounts, setPresetAmounts] = useState(
    formatPresetAmountsDollars(initial.presetAmountsCents),
  );
  const [funds, setFunds] = useState(initial.funds);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setError(null);

    const draft = {
      title: title.trim(),
      description: description.trim(),
      funds,
      presetAmountsCents: parsePresetAmountsDollars(presetAmounts),
    };

    const check = validateDonationConfig(draft);
    if (!check.ok) {
      setError(check.error);
      return;
    }

    setSaving(true);
    try {
      await onSave(normalizeDonationConfig(draft));
      onClose();
    } catch (e) {
      setError(e.message || "Failed to save donation settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="mt-6">
        <DonationSettingsFields
          title={title}
          onTitleChange={setTitle}
          description={description}
          onDescriptionChange={setDescription}
          presetAmounts={presetAmounts}
          onPresetAmountsChange={setPresetAmounts}
          funds={funds}
          onFundsChange={setFunds}
        />
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>

      <SheetFooter className="mt-8">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </SheetFooter>
    </>
  );
}

export function DonationSettingsSheet({ open, page, onClose, onSave }) {
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Donation form</SheetTitle>
          <SheetDescription>
            Configure the heading, amounts, and fund designations shown on this page.
          </SheetDescription>
        </SheetHeader>

        {open && page && (
          <DonationSettingsForm
            key={page.updatedAt || page.slug}
            page={page}
            onClose={onClose}
            onSave={onSave}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
