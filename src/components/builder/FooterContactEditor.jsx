"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * @typedef {import("@/lib/site/footer-contact").FooterContactFields} FooterContactFields
 */

/**
 * @param {Object} props
 * @param {FooterContactFields} props.value
 * @param {(fields: FooterContactFields) => void} props.onChange
 */
export function FooterContactEditor({ value, onChange }) {
  const update = (key, next) => {
    onChange({ ...value, [key]: next });
  };

  return (
    <div className="space-y-4 border-t pt-4">
      <div>
        <h4 className="text-sm font-semibold">Contact</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          Shown in the Contact column on every page.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="footerContactStreet">Street address</Label>
        <Input
          id="footerContactStreet"
          value={value.street}
          placeholder="123 Main Street"
          onChange={(e) => update("street", e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="footerContactCityLine">City, state &amp; ZIP</Label>
        <Input
          id="footerContactCityLine"
          value={value.cityLine}
          placeholder="City, ST 12345"
          onChange={(e) => update("cityLine", e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="footerContactPhone">Phone</Label>
        <Input
          id="footerContactPhone"
          value={value.phone}
          placeholder="555-555-5555"
          onChange={(e) => update("phone", e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="footerContactEmail">Email (optional)</Label>
        <Input
          id="footerContactEmail"
          type="email"
          value={value.email}
          placeholder="office@parish.org"
          onChange={(e) => update("email", e.target.value)}
        />
      </div>
    </div>
  );
}
