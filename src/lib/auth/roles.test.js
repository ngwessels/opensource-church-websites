import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canAccessBuilder,
  canManageDonations,
  formatUserRoleLabel,
  getBuilderHomeHref,
  isAdminRole,
  isFinanceRole,
  normalizeUserRole,
  USER_ROLES,
} from "./roles.js";

describe("auth/roles", () => {
  it("exports all supported roles", () => {
    assert.deepEqual(USER_ROLES, ["admin", "finance", "member"]);
  });

  describe("normalizeUserRole", () => {
    it("keeps known roles", () => {
      assert.equal(normalizeUserRole("admin"), "admin");
      assert.equal(normalizeUserRole("finance"), "finance");
      assert.equal(normalizeUserRole("member"), "member");
    });

    it("falls back to member for unknown values", () => {
      assert.equal(normalizeUserRole("editor"), "member");
      assert.equal(normalizeUserRole(null), "member");
      assert.equal(normalizeUserRole(undefined), "member");
    });
  });

  describe("capability helpers", () => {
    it("identifies admin and finance roles", () => {
      assert.equal(isAdminRole("admin"), true);
      assert.equal(isFinanceRole("finance"), true);
      assert.equal(isAdminRole("finance"), false);
      assert.equal(isFinanceRole("admin"), false);
    });

    it("grants builder and donations access to admin and finance only", () => {
      assert.equal(canAccessBuilder("admin"), true);
      assert.equal(canAccessBuilder("finance"), true);
      assert.equal(canAccessBuilder("member"), false);
      assert.equal(canManageDonations("finance"), true);
      assert.equal(canManageDonations("member"), false);
    });
  });

  describe("getBuilderHomeHref", () => {
    it("routes finance users to donations", () => {
      assert.equal(getBuilderHomeHref("finance"), "/builder/donations");
    });

    it("routes admins to the editor", () => {
      assert.equal(getBuilderHomeHref("admin"), "/builder/edit");
    });

    it("routes members to login error", () => {
      assert.equal(getBuilderHomeHref("member"), "/login?error=admin_required");
    });
  });

  describe("formatUserRoleLabel", () => {
    it("formats role labels for display", () => {
      assert.equal(formatUserRoleLabel("admin"), "Admin");
      assert.equal(formatUserRoleLabel("finance"), "Finance");
      assert.equal(formatUserRoleLabel("member"), "Member");
      assert.equal(formatUserRoleLabel("unknown"), "Member");
    });
  });
});
