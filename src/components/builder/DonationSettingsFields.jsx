"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createDonationFund } from "@/lib/donations/schema";

/**
 * Shared donation form settings fields.
 * @param {object} props
 * @param {string} props.title
 * @param {(value: string) => void} props.onTitleChange
 * @param {string} props.description
 * @param {(value: string) => void} props.onDescriptionChange
 * @param {string} props.presetAmounts
 * @param {(value: string) => void} props.onPresetAmountsChange
 * @param {import('@/types/firestore').DonationFund[]} props.funds
 * @param {(funds: import('@/types/firestore').DonationFund[]) => void} props.onFundsChange
 */
export function DonationSettingsFields({
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  presetAmounts,
  onPresetAmountsChange,
  funds,
  onFundsChange,
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="donation-title">Form title</Label>
        <Input
          id="donation-title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Give"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="donation-description">Form description</Label>
        <textarea
          id="donation-description"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Support our parish with a secure online donation."
          rows={3}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="donation-presets">Preset amounts</Label>
        <Input
          id="donation-presets"
          value={presetAmounts}
          onChange={(e) => onPresetAmountsChange(e.target.value)}
          placeholder="25, 50, 100, 500"
        />
        <p className="text-xs text-muted-foreground">
          Comma-separated dollar amounts shown as quick-select buttons (minimum $1 each).
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <Label>Fund designations</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Donors choose where their gift is directed. All funds use the same Stripe account.
          </p>
        </div>
        <div className="space-y-3">
          {funds.map((fund, index) => (
            <div key={fund.id} className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">Fund {index + 1}</span>
                {funds.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onFundsChange(funds.filter((f) => f.id !== fund.id))}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                    aria-label={`Remove ${fund.label || "fund"}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Input
                value={fund.label}
                onChange={(e) =>
                  onFundsChange(
                    funds.map((f) => (f.id === fund.id ? { ...f, label: e.target.value } : f)),
                  )
                }
                placeholder="General Fund"
              />
              <Input
                value={fund.description || ""}
                onChange={(e) =>
                  onFundsChange(
                    funds.map((f) =>
                      f.id === fund.id ? { ...f, description: e.target.value } : f,
                    ),
                  )
                }
                placeholder="Optional description"
              />
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onFundsChange([...funds, createDonationFund("")])}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add fund
        </Button>
      </div>
    </div>
  );
}
