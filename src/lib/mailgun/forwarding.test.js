import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildMailgunForwardExpression,
  describeMailgunForwardingAction,
  isMailgunForwardRouteDescription,
  mailgunForwardRouteDescription,
  planMailgunForwarding,
} from "./forwarding.js";

describe("mailgun/forwarding", () => {
  it("matches every recipient on the sending domain", () => {
    assert.equal(
      buildMailgunForwardExpression("mg.example.org"),
      'match_recipient(".*@mg\\.example\\.org")',
    );
  });

  it("lower-cases and trims the domain, and has no expression without one", () => {
    assert.equal(buildMailgunForwardExpression("  MG.Example.ORG "), 'match_recipient(".*@mg\\.example\\.org")');
    assert.equal(buildMailgunForwardExpression(""), "");
  });

  it("tags its own route description", () => {
    const description = mailgunForwardRouteDescription("mg.example.org");
    assert.equal(isMailgunForwardRouteDescription(description), true);
    assert.equal(isMailgunForwardRouteDescription("someone else's route"), false);
    assert.equal(isMailgunForwardRouteDescription(undefined), false);
  });

  it("does nothing when forwarding is unset and no route exists", () => {
    const plan = planMailgunForwarding({ domain: "mg.example.org", forwardTo: "" });
    assert.equal(plan.action, "none");
    assert.equal(plan.routeId, "");
  });

  it("creates a route when an address is added", () => {
    const plan = planMailgunForwarding({ domain: "mg.example.org", forwardTo: " Office@Example.org " });
    assert.equal(plan.action, "create");
    assert.equal(plan.forwardTo, "office@example.org");
    assert.equal(plan.expression, 'match_recipient(".*@mg\\.example\\.org")');
  });

  it("updates the route when the address changes", () => {
    const plan = planMailgunForwarding({
      domain: "mg.example.org",
      forwardTo: "new@example.org",
      route: {
        id: "route-1",
        expression: 'match_recipient(".*@mg\\.example\\.org")',
        forwardTo: "old@example.org",
      },
    });
    assert.equal(plan.action, "update");
    assert.equal(plan.routeId, "route-1");
    assert.equal(plan.forwardTo, "new@example.org");
  });

  it("updates the route when the sending domain changes", () => {
    const plan = planMailgunForwarding({
      domain: "mg2.example.org",
      forwardTo: "office@example.org",
      route: {
        id: "route-1",
        expression: 'match_recipient(".*@mg\\.example\\.org")',
        forwardTo: "office@example.org",
      },
    });
    assert.equal(plan.action, "update");
    assert.equal(plan.expression, 'match_recipient(".*@mg2\\.example\\.org")');
  });

  it("leaves an unchanged route alone unless forced", () => {
    const route = {
      id: "route-1",
      expression: 'match_recipient(".*@mg\\.example\\.org")',
      forwardTo: "office@example.org",
    };
    assert.equal(
      planMailgunForwarding({ domain: "mg.example.org", forwardTo: "office@example.org", route }).action,
      "none",
    );
    assert.equal(
      planMailgunForwarding({
        domain: "mg.example.org",
        forwardTo: "office@example.org",
        route,
        force: true,
      }).action,
      "update",
    );
  });

  it("deletes the route when the address is cleared", () => {
    const plan = planMailgunForwarding({
      domain: "mg.example.org",
      forwardTo: "",
      route: { id: "route-1", expression: "x", forwardTo: "office@example.org" },
    });
    assert.equal(plan.action, "delete");
    assert.equal(plan.routeId, "route-1");
    assert.equal(plan.forwardTo, "");
  });

  it("deletes the route when the sending domain disappears", () => {
    const plan = planMailgunForwarding({
      domain: "",
      forwardTo: "office@example.org",
      route: { id: "route-1", expression: "x", forwardTo: "office@example.org" },
    });
    assert.equal(plan.action, "delete");
  });

  it("summarizes each action for the admin notice", () => {
    assert.match(
      describeMailgunForwardingAction({ action: "create", routeId: "", expression: "", forwardTo: "a@b.org" }),
      /forwarded to a@b\.org/,
    );
    assert.match(
      describeMailgunForwardingAction({ action: "update", routeId: "r", expression: "", forwardTo: "a@b.org" }),
      /updated to a@b\.org/,
    );
    assert.match(
      describeMailgunForwardingAction({ action: "delete", routeId: "r", expression: "", forwardTo: "" }),
      /removed/,
    );
    assert.equal(
      describeMailgunForwardingAction({ action: "none", routeId: "", expression: "", forwardTo: "" }),
      "",
    );
  });
});
