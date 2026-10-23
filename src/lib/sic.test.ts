import { describe, it, expect } from "vitest";
import { sicStatus } from "./sic";

const today = new Date("2026-10-16T10:00:00");

describe("sicStatus", () => {
  it("is expired when expiry date has passed", () => {
    expect(sicStatus("2026-10-15", today)).toBe("expired");
  });
  it("is expiring when within the next 30 days", () => {
    expect(sicStatus("2026-11-15", today)).toBe("expiring");
  });
  it("is valid beyond 30 days", () => {
    expect(sicStatus("2026-11-16", today)).toBe("valid");
  });
  it("is valid when no expiry is recorded", () => {
    expect(sicStatus(null, today)).toBe("valid");
  });
});
