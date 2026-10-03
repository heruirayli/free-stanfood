import { describe, expect, it } from "vitest";
import { makeEvent } from "../../../testUtils";
import { UNEXPECTED_RESPONSE, parseEvent, parseEvents } from "../parseEvents";

describe("parseEvents", () => {
  it("accepts a list of events", () => {
    const events = [makeEvent(), makeEvent({ id: "b", endTime: null, locationName: null })];
    expect(parseEvents(JSON.parse(JSON.stringify(events)))).toEqual(events);
    expect(parseEvents([])).toEqual([]);
  });

  it.each([
    ["an HTML page", "<!doctype html><html></html>"],
    ["a wrapped object", { events: [] }],
    ["null", null],
    ["an event missing its start", [{ ...makeEvent(), startTime: undefined }]],
    ["an unparseable date", [makeEvent({ startTime: "next Tuesday" })]],
    ["an unknown audience", [{ ...makeEvent(), audience: "members" }]],
  ])("rejects %s", (_label, body) => {
    expect(() => parseEvents(body)).toThrow(UNEXPECTED_RESPONSE);
  });

  it("checks single events too", () => {
    expect(parseEvent(makeEvent())).toEqual(makeEvent());
    expect(() => parseEvent("Not found")).toThrow(UNEXPECTED_RESPONSE);
  });
});
