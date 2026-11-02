import { afterEach, describe, expect, it } from "vitest";

import {
  BROADCAST_PHRASE,
  COOLDOWN_MS,
  SCHEDULE_MAX_MS,
  audienceText,
  buildCreateBody,
  cooldownRemainingMs,
  deliverySummary,
  isBroadcast,
  isBroadcastConfirmed,
  isScheduleInRange,
  parseListParams,
  resetBroadcastCooldown,
  startBroadcastCooldown,
  toSearchParams,
} from "@/features/notifications";

afterEach(() => resetBroadcastCooldown());

describe("typed confirmation phrase", () => {
  it("matches only the exact phrase (outer and repeated spaces ignored)", () => {
    expect(isBroadcastConfirmed(BROADCAST_PHRASE)).toBe(true);
    expect(isBroadcastConfirmed(`  ${BROADCAST_PHRASE}  `)).toBe(true);
    expect(isBroadcastConfirmed("إرسال   للجميع")).toBe(true);
    expect(isBroadcastConfirmed("")).toBe(false);
    expect(isBroadcastConfirmed("إرسال")).toBe(false);
    expect(isBroadcastConfirmed(`${BROADCAST_PHRASE}!`)).toBe(false);
    expect(isBroadcastConfirmed("send to all")).toBe(false);
  });
});

describe("audience and delivery text", () => {
  it("describes the real audiences", () => {
    expect(isBroadcast("all")).toBe(true);
    expect(isBroadcast("user")).toBe(false);
    expect(audienceText({ audience: "all" })).toBe("جميع العملاء");
    expect(audienceText({ audience: "user", user_name: "سارة" })).toBe("سارة");
    expect(
      audienceText({ audience: "user", user_id: 7, user_name: null }),
    ).toBe("#7");
  });

  it("shows delivery numbers only once sent", () => {
    const counts = { recipients_count: 10, success_count: 8, failure_count: 2 };
    expect(deliverySummary({ status: "sent", ...counts })).toBe(
      "المستلمون: 10 · نجح: 8 · فشل: 2",
    );
    for (const status of [
      "queued",
      "scheduled",
      "sending",
      "cancelled",
    ] as const)
      expect(deliverySummary({ status, ...counts })).toBe("—");
  });
});

describe("schedule window", () => {
  const now = Date.parse("2026-11-02T09:00:00Z"); // 12:00 in Damascus

  it("allows 1 minute to 90 days ahead", () => {
    expect(isScheduleInRange("2026-11-02T12:00", now)).toBe(false); // now
    expect(isScheduleInRange("2026-11-02T12:00", now - 60_000)).toBe(true);
    expect(isScheduleInRange("2026-11-02T12:05", now)).toBe(true);
    expect(isScheduleInRange("2026-11-01T12:05", now)).toBe(false); // past
    expect(isScheduleInRange("2027-03-01T12:00", now)).toBe(false); // > 90 days
    expect(isScheduleInRange("garbage", now)).toBe(false);
    expect(SCHEDULE_MAX_MS).toBe(90 * 24 * 60 * 60_000);
  });
});

describe("create payload", () => {
  const base = {
    audience: "all" as const,
    customerId: null,
    title: " عرض الجمعة ",
    body: " خصم 20% ",
    link: { type: "none" as const, value: "", label: "" },
    scheduledAt: "",
  };

  it("builds a broadcast with no user_id, no link and no schedule", () => {
    expect(buildCreateBody(base)).toEqual({
      audience: "all",
      title: "عرض الجمعة",
      body: "خصم 20%",
    });
  });

  it("builds a one-customer message with its user_id", () => {
    expect(
      buildCreateBody({ ...base, audience: "user", customerId: 5 }),
    ).toEqual({
      audience: "user",
      user_id: 5,
      title: "عرض الجمعة",
      body: "خصم 20%",
    });
  });

  it("includes the link and a UTC schedule when given", () => {
    expect(
      buildCreateBody({
        ...base,
        link: { type: "product", value: "rose", label: "ورد" },
        scheduledAt: "2026-12-01T10:00",
      }),
    ).toEqual({
      audience: "all",
      title: "عرض الجمعة",
      body: "خصم 20%",
      link: { type: "product", value: "rose" },
      scheduled_at: "2026-12-01T07:00:00Z",
    });
  });
});

describe("broadcast cooldown", () => {
  it("locks for 30 seconds after a broadcast", () => {
    expect(COOLDOWN_MS).toBe(30_000);
    expect(cooldownRemainingMs(1000)).toBe(0);
    startBroadcastCooldown(1000);
    expect(cooldownRemainingMs(1000)).toBe(30_000);
    expect(cooldownRemainingMs(20_000)).toBe(11_000);
    expect(cooldownRemainingMs(31_000)).toBe(0);
  });
});

describe("history list params", () => {
  it("round-trips page, status and audience, ignoring junk", () => {
    const params = parseListParams(
      new URLSearchParams("page=3&status=sent&audience=user"),
    );
    expect(params).toEqual({ page: 3, status: "sent", audience: "user" });
    expect(toSearchParams(params).toString()).toBe(
      "page=3&status=sent&audience=user",
    );
    expect(
      parseListParams(new URLSearchParams("page=-1&status=x&audience=segment")),
    ).toEqual({ page: 1, status: "all", audience: "all" });
    expect(
      toSearchParams(parseListParams(new URLSearchParams())).toString(),
    ).toBe("");
  });
});
