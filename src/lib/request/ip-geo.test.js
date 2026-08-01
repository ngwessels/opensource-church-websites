import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getClientIpFromHeaders,
  getIpCityFromHeaders,
  getIpCountryFromHeaders,
  getSubmissionIpGeoFromRequest,
} from "./ip-geo.js";

describe("request/ip-geo", () => {
  it("reads the first forwarded client IP", () => {
    assert.equal(
      getClientIpFromHeaders(new Headers({ "x-forwarded-for": "203.0.113.1, 10.0.0.1" })),
      "203.0.113.1",
    );
    assert.equal(getClientIpFromHeaders(new Headers({ "x-real-ip": "198.51.100.2" })), "198.51.100.2");
    assert.equal(getClientIpFromHeaders(new Headers()), "");
  });

  it("reads country headers and normalizes codes", () => {
    assert.equal(getIpCountryFromHeaders(new Headers({ "x-vercel-ip-country": "us" })), "US");
    assert.equal(
      getIpCountryFromHeaders(new Headers({ "cloudfront-viewer-country": "CA" })),
      "CA",
    );
    assert.equal(getIpCountryFromHeaders(new Headers({ "x-vercel-ip-country": "??" })), "");
  });

  it("decodes city headers", () => {
    assert.equal(
      getIpCityFromHeaders(new Headers({ "x-vercel-ip-city": "Portland" })),
      "Portland",
    );
    assert.equal(
      getIpCityFromHeaders(new Headers({ "x-vercel-ip-city": "S%C3%A3o%20Paulo" })),
      "São Paulo",
    );
    assert.equal(getIpCityFromHeaders(new Headers()), "");
  });

  it("returns all submission geo fields from a request", () => {
    const request = {
      headers: new Headers({
        "x-forwarded-for": "203.0.113.1",
        "x-vercel-ip-country": "US",
        "x-vercel-ip-city": "Portland",
      }),
    };

    assert.deepEqual(getSubmissionIpGeoFromRequest(request), {
      ipAddress: "203.0.113.1",
      ipCountry: "US",
      ipCity: "Portland",
    });
  });
});
