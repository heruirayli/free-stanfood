import { describe, expect, it } from "vitest";
import { restrictionInText } from "../restrictions.js";

// Real sentences from the sources (2026-10-09) unless noted, and the near-misses
// each rule must leave alone.

describe("restrictionInText", () => {
  it.each([
    // Stanford-wide limits (the rules before 2026-10-09)
    "This event is exclusively for Stanford community members.",
    "Open to all Stanford Undergraduates",
    "Art & Boba Talk | STANFORD AFFILIATES ONLY",
    // A program, school, or club's own people
    "ICME students only.",
    "Lunch is for MBA students only.",
    "Please note: SLAC onsite appointments are for SLAC Active Staff only due to security access reasons.",
    "Open to all SLS students.",
    "Open to all currently enrolled graduate students.",
    "Big Earth Hackathon is a 9 week challenge, open to undergraduates, graduate students, and postdocs across all disciplines.",
    "Perfect for networking or simply unplugging, the event is open to all military-affiliated community members.",
    "Open to all other graduate students if space permits.",
    "These seminars are not streamed/recorded and are only open to members of the Stanford community.",
    "Registration is open exclusively to current Stanford affiliates and is offered on a first-come, first-served basis.",
    "* In-person attendance is reserved for alumni who have registered for Stanford Reunion Homecoming.",
    "This talk is limited to ICME students and faculty.",
    // Invitations and members
    "The ICME Research Symposium is an invitation-only event, reserved for ICME students.",
    "Stanford Historical Society (SHS) members-only event.",
    "Dinner is by invitation.",
    "This is a private event.",
    "This event is not open to the public.",
  ])("restricts %s", (sentence) => {
    expect(restrictionInText(`Free lunch. ${sentence}`)).not.toBeNull();
  });

  it("names the sentence that limits attendance", () => {
    expect(restrictionInText("Free lunch. Lunch is for MBA students only. RSVP below.")).toBe("Lunch is for MBA students only.");
  });

  it.each([
    // Space, format, or booking, not who can come
    "Space is limited to about 6 students.",
    "Seating is limited to 125 attendees and will be allocated on a first-come, first-served basis.",
    "Front rows are reserved for students.",
    "This seminar series is only offered in person.",
    "Note: This workshop is in-person only, with no virtual attendance option.",
    "Financial Counseling with Fidelity (Virtual Only)",
    "Financial Counseling with Fidelity (By Appointment Only)",
    "Please note: This is a ticket-only event.",
    "Registered attendees only.",
    // "only" that isn't a limit
    "Students only need to bring their ID.",
    "This day, the GSB begins instruction for MBA and MSx courses only.",
    // Open events. "The Stanford community" is kept on purpose (decided 2026-10-09):
    // every Stanford student can come, and the card says who it's for.
    "This event is open to the Stanford community.",
    "Open to all in the Stanford community.",
    "Open to Stanford affiliates and the general public.",
    "Free and open to the public.",
    "Open to all majors.",
    "Open to all, regardless of experience.",
    "Open to adults with diabetes and their families.",
    "A lunch for graduate students.",
  ])("leaves %s open", (sentence) => {
    expect(restrictionInText(`Free lunch. ${sentence}`)).toBeNull();
  });
});
