import assert from "node:assert/strict";
import { test } from "node:test";
import { getDaysUntil, getTrimesterPercent, parseLocalCalendarDate } from "../src/utils/academicDates.ts";

test("date-only input stays on its local calendar day", () => {
  const date = parseLocalCalendarDate("2026-10-19");
  assert.equal(date?.getFullYear(), 2026);
  assert.equal(date?.getMonth(), 9);
  assert.equal(date?.getDate(), 19);
  assert.equal(date?.getHours(), 0);
  assert.equal(parseLocalCalendarDate("2026-02-30"), null);
});

test("countdowns use calendar days across midnight and daylight saving changes", () => {
  assert.equal(getDaysUntil("2026-10-19", new Date(2026, 9, 18, 23, 59)), 1);
  assert.equal(getDaysUntil("2026-10-19", new Date(2026, 9, 19, 0, 1)), 0);
  assert.equal(getDaysUntil("2026-03-09", new Date(2026, 2, 7, 12)), 2);
  assert.equal(getDaysUntil("24", new Date(2026, 9, 19)), 24);
  assert.equal(getDaysUntil("invalid", new Date(2026, 9, 19)), null);
});

test("trimester end date remains active through that local day", () => {
  assert.equal(getTrimesterPercent("2026-10-01", "2026-10-03", new Date(2026, 9, 1, 0)), 0);
  assert.equal(getTrimesterPercent("2026-10-01", "2026-10-03", new Date(2026, 9, 3, 12)), 83);
  assert.equal(getTrimesterPercent("2026-10-01", "2026-10-03", new Date(2026, 9, 4, 0)), 100);
  assert.equal(getTrimesterPercent("2026-10-03", "2026-10-01", new Date(2026, 9, 2)), null);
});
