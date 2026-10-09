// Attendance limits written in a listing's own text, shared by the adapters.

// Hosts often state a restriction only in the text, not in a structured field.
// Same policy as Localist's "restricted to" note: an event limited to a group
// (Stanford students, a program's students, a club's members, invited guests) is
// restricted. Checked against every event the sources returned on 2026-10-09,
// with the sentences each rule matched reviewed by hand.

const STANFORD_GROUP = String.raw`(?:(?:current|enrolled|active) )?(?:stanford(?: university)? )?(?:community(?: members)?|affiliates|students|undergraduates|undergrads|graduate students|grad students|ph\.?d\.? students|postdocs|faculty|staff|employees)`;

// People an event can be limited to. Not "attendees", "participants" or
// "registrants" (that's signing up, i.e. RSVP), and not "majors" ("open to all majors").
const GROUP = String.raw`(?:students?|undergraduates?|undergrads?|postdocs?|post-docs?|postdoctoral (?:scholars|fellows)|faculty|staff|employees|affiliates|alumni|alums|fellows|scholars|trainees|residents|members)`;
// A few words naming the group: "ICME", "currently enrolled graduate", "members of the Stanford".
const WORDS = String.raw`(?: [\w&./'’-]+){0,4}?`;
// The same, but not a head count: "limited to about 6 students" is about space.
const NOT_A_COUNT = String.raw`(?: (?!\d|about\b|approximately\b|around\b|up\b|first\b)[\w&./'’-]+){0,4}?`;

const RULES: { pattern: RegExp; skip?: RegExp }[] = [
  // "exclusively for Stanford community members", "limited to current Stanford students"
  { pattern: /\b(?:only|exclusively) (?:for|open to|available to)(?: all)? (?:current |enrolled )?stanford\b/i },
  { pattern: /\b(?:limited|restricted) to(?: all)? (?:current |enrolled )?stanford\b/i },
  // "for Stanford community members only", "STANFORD AFFILIATES ONLY"
  { pattern: /\bstanford(?: [\w-]+){0,3} only\b/i },
  // "Open to all Stanford Undergraduates", "open to all enrolled graduate students"
  { pattern: new RegExp(String.raw`\bopen (?:only )?to (?:all )?(?:stanford|current|enrolled)\b(?: [\w-]+){0,2}? ${STANFORD_GROUP}\b`, "i") },
  // "an invitation-only event", "SHS members-only event", "This is a private event"
  {
    pattern:
      /\binvitation[- ]only\b|\binvite[- ]only\b|\bby invitation\b|\bprivate event\b|\bclosed (?:event|session|meeting)\b|\bmembers?[- ]only\b|\bnot open to the (?:general )?public\b/i,
  },
  // "ICME students only", "MBA students only", "SLAC Active Staff only". Not "students
  // only need to bring an ID".
  {
    pattern: new RegExp(
      String.raw`\b${GROUP}(?: (?:and|&|or) [\w-]+(?: [\w-]+)?)? only\b(?! (?:need|needs|have|has|pay|pays|get|gets|must|can|may|will|should|be|are|is|require|requires)\b)`,
      "i",
    ),
  },
  // "only open to members of the Stanford community", "open exclusively to current Stanford affiliates"
  { pattern: new RegExp(String.raw`\b(?:only|exclusively) (?:for|to|open to|available to)(?: all| any| the)?${WORDS} ${GROUP}\b`, "i") },
  // "reserved for alumni who have registered", "limited to ICME students". Seats or
  // tables set aside for a group don't close the event.
  {
    pattern: new RegExp(String.raw`\b(?:limited|restricted|reserved) (?:only )?(?:to|for)(?: all| any| the)?${NOT_A_COUNT} ${GROUP}\b`, "i"),
    skip: /\b(?:seats?|seating|rows?|tables?|parking)\b/i,
  },
  // "open to all graduate students", "open to all military-affiliated community members"
  { pattern: new RegExp(String.raw`\bopen (?:only )?to(?: all| any| the)?${WORDS} ${GROUP}\b`, "i") },
];

// "Open to Stanford affiliates and the public" is an open event ("not open to the
// public" isn't).
const PUBLIC_WELCOME =
  /\b(?:and|&|or) (?:the )?(?:general )?public\b|\bpublic (?:is |are )?(?:also )?welcome\b|(?<!\bnot )\bopen to (?:the )?(?:general )?public\b|\beveryone\b/i;

const limits = (sentence: string): boolean =>
  RULES.some(({ pattern, skip }) => pattern.test(sentence) && !skip?.test(sentence));

// The sentence that limits attendance, if any.
export const restrictionInText = (text: string): string | null => {
  for (const sentence of text.split(/(?<=[.!?])\s+|\n+|\s+\|\s+/)) {
    if (limits(sentence) && !PUBLIC_WELCOME.test(sentence)) {
      return sentence.trim().slice(0, 200);
    }
  }
  return null;
};
