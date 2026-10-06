// Attendance limits written in a listing's own text, shared by the adapters.

// Hosts often state a restriction only in the text, not in a structured field.
// Same policy as Localist's "restricted to" note: limited to Stanford groups means restricted.
const STANFORD_GROUP = String.raw`(?:(?:current|enrolled|active) )?(?:stanford(?: university)? )?(?:community(?: members)?|affiliates|students|undergraduates|undergrads|graduate students|grad students|ph\.?d\.? students|postdocs|faculty|staff|employees)`;
const LIMITED_TO_STANFORD = new RegExp(
  [
    // "exclusively for Stanford community members", "limited to current Stanford students"
    String.raw`\b(?:only|exclusively) (?:for|open to|available to)(?: all)? (?:current |enrolled )?stanford\b`,
    String.raw`\b(?:limited|restricted) to(?: all)? (?:current |enrolled )?stanford\b`,
    // "for Stanford community members only", "STANFORD AFFILIATES ONLY"
    String.raw`\bstanford(?: [\w-]+){0,3} only\b`,
    // "Open to all Stanford Undergraduates", "open to all enrolled graduate students"
    String.raw`\bopen (?:only )?to (?:all )?(?:stanford|current|enrolled)\b(?: [\w-]+){0,2}? ${STANFORD_GROUP}\b`,
  ].join("|"),
  "i",
);
// "Open to Stanford affiliates and the public" is an open event.
const PUBLIC_WELCOME = /\b(?:and|&|or) (?:the )?(?:general )?public\b|\bpublic (?:is |are )?(?:also )?welcome\b|\bopen to (?:the )?(?:general )?public\b|\beveryone\b/i;

// The sentence that limits attendance, if any.
export const restrictionInText = (text: string): string | null => {
  for (const sentence of text.split(/(?<=[.!?])\s+|\n+|\s+\|\s+/)) {
    if (LIMITED_TO_STANFORD.test(sentence) && !PUBLIC_WELCOME.test(sentence)) {
      return sentence.trim().slice(0, 200);
    }
  }
  return null;
};
