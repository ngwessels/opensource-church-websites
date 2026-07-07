"use client";

import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  emptyDonationFilters,
  getUniqueFundLabels,
  hasActiveDonationFilters,
  sumDonationAmountCents,
} from "@/lib/donations/filter";
import { formatDonationAmount } from "@/lib/donations/schema";

/** @typedef {import("@/lib/donations/filter").DonationFilters} DonationFilters */
/** @typedef {import("@/lib/donations/filter").DonationRow} DonationRow */

/**
 * @param {object} props
 * @param {DonationFilters} props.filters
 * @param {(filters: DonationFilters) => void} props.onChange
 * @param {DonationRow[]} props.donations
 * @param {DonationRow[]} props.filteredDonations
 */
export function DonationsFilters({ filters, onChange, donations, filteredDonations }) {
  const fundOptions = getUniqueFundLabels(donations);
  const totalCents = sumDonationAmountCents(filteredDonations);
  const currency = filteredDonations[0]?.currency || donations[0]?.currency || "usd";
  const showClear = hasActiveDonationFilters(filters);

  function update(patch) {
    onChange({ ...filters, ...patch });
  }

  return (
    <div className="mb-4 space-y-4 rounded-lg border border-border bg-muted/30 p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="space-y-1.5 xl:col-span-2">
          <Label htmlFor="donation-person-search" className="text-xs text-muted-foreground">
            Person
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="donation-person-search"
              type="search"
              placeholder="Name, email, phone, or address"
              value={filters.personQuery}
              onChange={(e) => update({ personQuery: e.target.value })}
              className="h-9 pl-8"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="donation-date-from" className="text-xs text-muted-foreground">
            Date from
          </Label>
          <Input
            id="donation-date-from"
            type="date"
            value={filters.dateFrom}
            onChange={(e) => update({ dateFrom: e.target.value })}
            className="h-9"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="donation-date-to" className="text-xs text-muted-foreground">
            Date to
          </Label>
          <Input
            id="donation-date-to"
            type="date"
            value={filters.dateTo}
            onChange={(e) => update({ dateTo: e.target.value })}
            className="h-9"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="donation-amount-min" className="text-xs text-muted-foreground">
              Min $
            </Label>
            <Input
              id="donation-amount-min"
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
              value={filters.amountMin}
              onChange={(e) => update({ amountMin: e.target.value })}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="donation-amount-max" className="text-xs text-muted-foreground">
              Max $
            </Label>
            <Input
              id="donation-amount-max"
              type="number"
              min="0"
              step="0.01"
              placeholder="Any"
              value={filters.amountMax}
              onChange={(e) => update({ amountMax: e.target.value })}
              className="h-9"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Gift type</Label>
          <Select
            value={filters.giftType}
            onValueChange={(value) => update({ giftType: /** @type {DonationFilters["giftType"]} */ (value) })}
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All gifts</SelectItem>
              <SelectItem value="one-time">One-time</SelectItem>
              <SelectItem value="recurring">Recurring</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Frequency</Label>
          <Select
            value={filters.frequency}
            onValueChange={(value) =>
              update({ frequency: /** @type {DonationFilters["frequency"]} */ (value) })
            }
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All frequencies</SelectItem>
              <SelectItem value="once">One-time</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Fund</Label>
          <Select value={filters.fund} onValueChange={(value) => update({ fund: value })}>
            <SelectTrigger className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All funds</SelectItem>
              {fundOptions.map((label) => (
                <SelectItem key={label} value={label}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Comments</Label>
          <Select
            value={filters.commentFilter}
            onValueChange={(value) =>
              update({
                commentFilter: /** @type {DonationFilters["commentFilter"]} */ (value),
              })
            }
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any</SelectItem>
              <SelectItem value="has">Has comment</SelectItem>
              <SelectItem value="none">No comment</SelectItem>
              <SelectItem value="contains">Contains text</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filters.commentFilter === "contains" ? (
          <div className="space-y-1.5">
            <Label htmlFor="donation-comment-search" className="text-xs text-muted-foreground">
              Comment text
            </Label>
            <Input
              id="donation-comment-search"
              type="search"
              placeholder="Search comments"
              value={filters.commentQuery}
              onChange={(e) => update({ commentQuery: e.target.value })}
              className="h-9"
            />
          </div>
        ) : (
          <div className="hidden xl:block" />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Showing {filteredDonations.length} of {donations.length} donations
          {filteredDonations.length > 0 && (
            <>
              {" "}
              · Total {formatDonationAmount(totalCents, currency)}
            </>
          )}
        </p>
        {showClear && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(emptyDonationFilters())}
          >
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
