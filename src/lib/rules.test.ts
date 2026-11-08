import { describe, expect, it } from "vitest";

import {
  canStudentCancel,
  credentialsFor,
  isTrackingActive,
  validateName,
  validatePickup,
  validatePin,
} from "./rules";

// 2026-11-08 10:00:00 UTC = 15:30:00 IST
const NOW = new Date("2026-11-08T10:00:00Z");
const TODAY = "2026-11-08";
const TOMORROW = "2026-11-09";

describe("PIN rule: 1–10 digits", () => {
  it("accepts 1 digit and 10 digits", () => {
    expect(validatePin("7").ok).toBe(true);
    expect(validatePin("0123456789").ok).toBe(true);
  });
  it("rejects 11 digits, empty and non-numeric", () => {
    expect(validatePin("01234567890").ok).toBe(false);
    expect(validatePin("").ok).toBe(false);
    expect(validatePin("12a4").ok).toBe(false);
  });
});

describe("name rule", () => {
  it("rejects a single character", () => {
    expect(validateName("A").ok).toBe(false);
  });
  it("same name in different case maps to the same login", () => {
    expect(credentialsFor("student", "Ravi  Kumar", "1").email).toBe(
      credentialsFor("student", "ravi kumar", "1").email,
    );
  });
  it("student and admin logins never collide", () => {
    expect(credentialsFor("student", "Asha", "1").email).not.toBe(
      credentialsFor("admin", "Asha", "1").email,
    );
  });
});

describe("pickup time rule", () => {
  it("requires strict HH:mm", () => {
    expect(validatePickup(TOMORROW, "9:30", NOW).ok).toBe(false);
    expect(validatePickup(TOMORROW, "09:30", NOW).ok).toBe(true);
    expect(validatePickup(TOMORROW, "24:00", NOW).ok).toBe(false);
  });
  it("only allows 08:00 to 18:00 IST", () => {
    expect(validatePickup(TOMORROW, "07:59", NOW).ok).toBe(false);
    expect(validatePickup(TOMORROW, "08:00", NOW).ok).toBe(true);
    expect(validatePickup(TOMORROW, "18:00", NOW).ok).toBe(true);
    expect(validatePickup(TOMORROW, "18:01", NOW).ok).toBe(false);
  });
  it("needs a 15-minute buffer for today", () => {
    expect(validatePickup(TODAY, "15:44", NOW).ok).toBe(false);
    expect(validatePickup(TODAY, "15:45", NOW).ok).toBe(true);
  });
  it("rejects past times today and past dates", () => {
    expect(validatePickup(TODAY, "12:00", NOW).ok).toBe(false);
    expect(validatePickup("2026-11-07", "12:00", NOW).ok).toBe(false);
  });
  it("rejects dates beyond tomorrow", () => {
    expect(validatePickup("2026-11-10", "12:00", NOW).ok).toBe(false);
  });
});

describe("order rules", () => {
  it("students can cancel only while Pending or Accepted", () => {
    expect(canStudentCancel("pending")).toBe(true);
    expect(canStudentCancel("accepted")).toBe(true);
    expect(canStudentCancel("preparing")).toBe(false);
    expect(canStudentCancel("ready")).toBe(false);
  });
  it("tracking stops after delivery or cancellation", () => {
    expect(isTrackingActive("out_for_delivery")).toBe(true);
    expect(isTrackingActive("delivered")).toBe(false);
    expect(isTrackingActive("cancelled")).toBe(false);
  });
});
