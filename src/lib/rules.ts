// Pure business rules shared by the UI. The database enforces the same rules.

export const CANTEEN_OPEN = "08:00";
export const CANTEEN_CLOSE = "18:00";
export const PICKUP_BUFFER_MINUTES = 15;
const IST_OFFSET_MINUTES = 330;

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
export const PIN_PATTERN = /^\d{1,10}$/;
const NAME_PATTERN = /^[A-Za-z][A-Za-z .'-]{1,49}$/;

export type Result = { ok: true } | { ok: false; error: string };

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function validateName(name: string): Result {
  const n = normalizeName(name);
  if (n.length < 2 || n.length > 50) return { ok: false, error: "Name must be 2 to 50 characters." };
  if (!NAME_PATTERN.test(n))
    return { ok: false, error: "Use letters, spaces, dots, apostrophes or hyphens only." };
  return { ok: true };
}

export function validatePin(pin: string): Result {
  if (!PIN_PATTERN.test(pin)) return { ok: false, error: "PIN must be 1 to 10 digits (numbers only)." };
  return { ok: true };
}

export function nameKey(name: string): string {
  return normalizeName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type AccountKind = "student" | "admin";

/** Sign-in identity derived from name + PIN. The PIN itself is hashed by the auth service. */
export function credentialsFor(kind: AccountKind, name: string, pin: string) {
  const domain = kind === "student" ? "students.campusbite.app" : "admins.campusbite.app";
  return {
    email: `${nameKey(name)}@${domain}`,
    password: `cb-pin-${pin}-campusbite`,
  };
}

/** Current date (YYYY-MM-DD) and seconds-since-midnight in IST. */
export function istNow(now: Date = new Date()) {
  const ist = new Date(now.getTime() + IST_OFFSET_MINUTES * 60_000);
  return {
    date: ist.toISOString().slice(0, 10),
    seconds: ist.getUTCHours() * 3600 + ist.getUTCMinutes() * 60 + ist.getUTCSeconds(),
  };
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function toSeconds(hhmm: string): number {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return h * 3600 + m * 60;
}

/** True when there is still a valid pickup slot left today. */
export function canPickupToday(now: Date = new Date()): boolean {
  const { seconds } = istNow(now);
  return seconds + PICKUP_BUFFER_MINUTES * 60 <= toSeconds(CANTEEN_CLOSE);
}

export function validatePickup(date: string, time: string, now: Date = new Date()): Result {
  const t = time.trim();
  if (!TIME_PATTERN.test(t))
    return { ok: false, error: "Enter time in 24-hour HH:mm format, e.g. 13:30." };
  const secs = toSeconds(t);
  if (secs < toSeconds(CANTEEN_OPEN) || secs > toSeconds(CANTEEN_CLOSE))
    return { ok: false, error: `Pickup must be between ${CANTEEN_OPEN} and ${CANTEEN_CLOSE} IST.` };
  const today = istNow(now);
  if (date < today.date) return { ok: false, error: "Pickup date cannot be in the past." };
  if (date > addDays(today.date, 1))
    return { ok: false, error: "Pickup can be scheduled for today or tomorrow only." };
  if (date === today.date && secs < today.seconds + PICKUP_BUFFER_MINUTES * 60)
    return {
      ok: false,
      error: `For today, pickup must be at least ${PICKUP_BUFFER_MINUTES} minutes from now (IST).`,
    };
  return { ok: true };
}

export type OrderStatus =
  | "pending"
  | "accepted"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "rejected";

export const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "rejected",
];

export const CLOSED_STATUSES: OrderStatus[] = ["delivered", "cancelled", "rejected"];

export function canStudentCancel(status: OrderStatus): boolean {
  return status === "pending" || status === "accepted";
}

export function isTrackingActive(status: OrderStatus): boolean {
  return !CLOSED_STATUSES.includes(status);
}
