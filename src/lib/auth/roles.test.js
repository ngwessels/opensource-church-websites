import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canAccessBuilder,
  canAccessDonorPortal,
  canManageDonations,
  filterStaffUsers,
  formatUserRoleLabel,
  getBuilderHomeHref,
  isAdminRole,
  isDonorRole,
  isFinanceRole,
  isStaffUserRole,
  normalizeUserRole,
  STAFF_USER_ROLES,
  USER_ROLES,
} from "./roles.js";

describe("auth/roles", () => {
  it("exports all supported roles", () => {
    assert.deepEqual(USER_ROLES, ["admin", "finance", "member", "donor"]);
  });

  it("exports staff roles ordered by access level", () => {
    assert.deepEqual(STAFF_USER_ROLES, ["member", "finance", "admin"]);
  });

  describe("normalizeUserRole", () => {
    it("keeps known roles", () => {
      assert.equal(normalizeUserRole("admin"), "admin");
      assert.equal(normalizeUserRole("finance"), "finance");
      assert.equal(normalizeUserRole("member"), "member");
      assert.equal(normalizeUserRole("donor"), "donor");
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
      assert.equal(canAccessBuilder("donor"), false);
      assert.equal(canAccessDonorPortal("donor"), true);
      assert.equal(canAccessDonorPortal("admin"), true);
      assert.equal(isDonorRole("donor"), true);
      assert.equal(canManageDonations("finance"), true);
      assert.equal(canManageDonations("member"), false);
    });
  });

  describe("isStaffUserRole", () => {
    it("accepts the roles managed in Admin Users", () => {
      assert.equal(isStaffUserRole("admin"), true);
      assert.equal(isStaffUserRole("finance"), true);
      assert.equal(isStaffUserRole("member"), true);
    });

    it("rejects donor accounts", () => {
      assert.equal(isStaffUserRole("donor"), false);
    });

    it("treats missing and unknown roles as member", () => {
      assert.equal(isStaffUserRole(undefined), true);
      assert.equal(isStaffUserRole(null), true);
      assert.equal(isStaffUserRole("editor"), true);
    });
  });

  describe("filterStaffUsers", () => {
    it("drops donor accounts and keeps the rest in order", () => {
      const users = [
        { id: "a", role: "donor" },
        { id: "b", role: "admin" },
        { id: "c", role: "donor" },
        { id: "d", role: "finance" },
        { id: "e", role: "member" },
        { id: "f" },
      ];
      assert.deepEqual(
        filterStaffUsers(users).map((u) => u.id),
        ["b", "d", "e", "f"],
      );
    });

    it("returns an empty array for missing input", () => {
      assert.deepEqual(filterStaffUsers(undefined), []);
      assert.deepEqual(filterStaffUsers([]), []);
    });

    it("does not mutate the source list", () => {
      const users = [{ id: "a", role: "donor" }, { id: "b", role: "admin" }];
      filterStaffUsers(users);
      assert.equal(users.length, 2);
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
      assert.equal(formatUserRoleLabel("donor"), "Donor");
      assert.equal(formatUserRoleLabel("unknown"), "Member");
    });
  });
});
