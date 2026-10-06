import type { Classification } from "../../types/event.js";

// Stage 1 food classifier: case-insensitive, word-bounded keyword matching over
// title + description, with context rules that raise or cancel each match.

export interface ClassifierInput {
  title: string;
  description: string;
  cost?: string | null;
  isVirtual?: boolean;
  // The host ticked "food provided" (CardinalEngage). As explicit as wording gets.
  foodProvided?: boolean;
}

// Confidence bands. Keep in sync with frontend/src/constants.ts.
export const FOOD_THRESHOLD = 0.25; // at or above: hasFreeFood = true
export const LIKELY_THRESHOLD = 0.45; // "Food likely"; the UI's default minimum
export const LISTED_THRESHOLD = 0.75; // "Food listed"

const MAX_CONFIDENCE = 0.97;
const EXPLICIT_WEIGHT = 0.9;
const TITLE_BONUS = 0.15;
const EXTRA_TERM_BONUS = 0.1;
// Food at a paid event comes with the ticket: even "lunch provided" (0.9) stays unpublished.
const PAID_EVENT_FACTOR = 0.25;
// Daily listings of a multi-day exhibition mention food only for its one reception.
const EXHIBITION_FACTOR = 0.2;
// A short description sentence ending in "!" is an announcement: "Pizza and games!"
const EXCLAIMED_MAX_WORDS = 8;

interface FoodTerm {
  // Shown to users as foodDetails. null means generic "food".
  label: string | null;
  pattern: string;
  weight: number;
  // Only counts when it appears in the title.
  titleOnly?: boolean;
  // Too ambiguous alone ("treats patients", "fruits of labor"): counts only with a cue.
  needsCue?: boolean;
  // Followed by another noun it names a topic, not food: "food systems", "meal plans".
  compoundTopic?: boolean;
  // Lowercase only, so names like "Center for Food Safety" don't match.
  caseSensitive?: boolean;
  // A format that usually has food but never promises it: cues don't raise it.
  format?: boolean;
}

const FOOD_TERMS: FoodTerm[] = [
  {
    label: null,
    pattern:
      "(?<!-)free food|food (?:is |will be )?(?:provided|served)|food will be available|(?<!-)free meals?|meals? (?:is |are |will be )?provided|catered",
    weight: EXPLICIT_WEIGHT,
  },
  { label: null, pattern: "catering", weight: EXPLICIT_WEIGHT, compoundTopic: true },
  { label: null, pattern: "food (?:and|&) (?:drinks?|beverages)|food, drinks", weight: 0.55 },
  { label: "refreshments", pattern: "food (?:and|&) refreshments", weight: 0.55 },
  // Bare "food" and "meal" are mostly topics; they count only with a cue. Capitalized
  // "Food" only starts a sentence ("Food arrives at 6:15"), never a name ("Center for Food Safety").
  {
    label: null,
    pattern: String.raw`food|(?<=^|[.!?:]\s{1,3}|\n)Food`,
    weight: 0.5,
    needsCue: true,
    compoundTopic: true,
    caseSensitive: true,
  },
  { label: null, pattern: "meals?|a bite to eat", weight: 0.5, needsCue: true, compoundTopic: true },
  { label: "coffee and pastries", pattern: "coffee (?:and|&) pastries", weight: 0.55 },
  { label: "pizza", pattern: "pizzas?", weight: 0.5 },
  { label: "boba", pattern: "boba|bubble tea", weight: 0.5 },
  { label: "tacos", pattern: "tacos?", weight: 0.5 },
  { label: "sushi", pattern: "sushi", weight: 0.5 },
  { label: "burritos", pattern: "burritos?", weight: 0.5 },
  { label: "sandwiches", pattern: "sandwich(?:es)?", weight: 0.5 },
  // Restaurant names hosts use in place of the food itself.
  { label: "chick-fil-a", pattern: "chick-?fil-?a", weight: 0.5 },
  { label: "panda express", pattern: "panda express", weight: 0.5 },
  { label: "in-n-out", pattern: "in-?n-?out", weight: 0.5 },
  { label: "donuts", pattern: "donuts?|doughnuts?", weight: 0.5 },
  { label: "bagels", pattern: "bagels?", weight: 0.5 },
  { label: "pastries", pattern: "pastries|baked goods|muffins|croissants|scones|brownies", weight: 0.5 },
  { label: "snacks", pattern: "snacks?", weight: 0.5 },
  { label: "refreshments", pattern: "refreshments?", weight: 0.5 },
  { label: "light bites", pattern: "(?:light|small|savory|sweet|tasty) bites|finger foods?", weight: 0.5 },
  { label: "appetizers", pattern: "appetizers|hors d['’]?oeuvres|canap[eé]s", weight: 0.5 },
  {
    label: "cheese",
    pattern: "wine (?:and|&) cheese|cheese (?:and|&) crackers|cheese (?:plates?|boards?|platters?)|charcuterie",
    weight: 0.5,
  },
  { label: "ice cream", pattern: "ice cream|gelato|frozen yogurt|popsicles?", weight: 0.5 },
  { label: "popcorn", pattern: "popcorn", weight: 0.5 },
  { label: "mochi", pattern: "mochi", weight: 0.5 },
  { label: "mooncakes", pattern: "moon ?cakes?", weight: 0.5 },
  { label: "dumplings", pattern: "dumplings|dim sum", weight: 0.5 },
  { label: "noodles", pattern: "noodles|ramen", weight: 0.5 },
  { label: "pancakes", pattern: "pancakes?|waffles?|cr[eê]pes", weight: 0.5 },
  { label: "burgers", pattern: "(?:ham|cheese)?burgers|hot ?dogs", weight: 0.5 },
  { label: "samosas", pattern: "samosas|empanadas|tamales|churros", weight: 0.5 },
  { label: "bbq", pattern: "bbq|barbecue|cook-?out", weight: 0.45 },
  { label: "dessert", pattern: "desserts?", weight: 0.45 },
  { label: "cookies", pattern: "cookies", weight: 0.45 },
  { label: "cake", pattern: "(?:cup|cheese)?cakes?", weight: 0.45 },
  { label: "pie", pattern: "pies?(?! charts?)", weight: 0.45 },
  {
    label: "treats",
    pattern: "(?:sweet|tasty|delicious|festive|holiday|halloween|fall|frozen|baked|dessert) treats|sweets",
    weight: 0.45,
  },
  // Bare "treats" is often a verb ("Dr. Lee treats patients").
  { label: "treats", pattern: "treats|goodies", weight: 0.45, needsCue: true },
  { label: "fruit", pattern: "fresh fruit|fruit (?:platters?|trays?|cups?|salad)", weight: 0.45 },
  { label: "fruit", pattern: "fruits?(?! fl(?:y|ies))", weight: 0.45, needsCue: true },
  { label: "lunch", pattern: "lunch(?:es|eons?)?", weight: 0.45 },
  // Not Leonardo's "Last Supper".
  { label: "dinner", pattern: String.raw`dinners?|(?<!\blast )suppers?`, weight: 0.45 },
  { label: "breakfast", pattern: "breakfasts?", weight: 0.45 },
  { label: "brunch", pattern: "brunch(?:es)?", weight: 0.45 },
  // Drinks-only tastings are not food.
  {
    label: "tasting",
    pattern: "(?<!(?:wine|beer|tea|coffee|sake|whiske?y|spirits|cocktail|cider) )tastings?",
    weight: 0.4,
  },
  { label: "chocolate", pattern: "(?<!hot )chocolates?", weight: 0.4 },
  { label: "candy", pattern: "cand(?:y|ies)", weight: 0.4 },
  { label: "coffee", pattern: "coffee", weight: 0.25 },
  // Campus receptions usually have light food but rarely say so, so they stay weak.
  // In descriptions, only phrasings that describe this event's own reception count.
  // Multi-day exhibitions repeat "Opening Reception: Oct. 1" on every daily listing.
  {
    label: "reception",
    pattern:
      "reception (?:to follow|will follow|follows|following)|followed by (?:a |an )?(?:light |short |brief )?reception|(?:light|short|brief) reception",
    weight: 0.3,
    format: true,
  },
  // Not scholarship: "The Greek and Arabic Reception of Ptolemy's Almagest".
  { label: "reception", pattern: "receptions?(?! (?:of|history|theory|studies)\\b)", weight: 0.3, titleOnly: true, format: true },
  { label: "happy hour", pattern: "happy hour", weight: 0.3, format: true },
];

const TERM_REGEXES = FOOD_TERMS.map((term) => ({
  term,
  regex: new RegExp(`\\b(?:${term.pattern})\\b`, term.caseSensitive ? "g" : "gi"),
}));

const MEAL_LABELS = new Set(["lunch", "dinner", "breakfast", "brunch"]);

// Provision statements: the listing says the food is provided. "Gluten-free" is not "free".
const DEFINITE_BEFORE =
  /(?<![\w-])(?:free|complimentary|catered|provided|served|provid(?:e|es|ing)|serv(?:e|es|ing)|covers?|covered)\b/i;
// Checked over the next 10 words: "Light bites, fruit, and sparkling cider will be served".
const DEFINITE_AFTER =
  /\b(?:provided|served|included|offered|catered|on us|on the house|on hand|(?:is|are|be) set out|(?:handed|given|passed) out|(?:is|are) (?:free|complimentary)|while (?:supplies|they) last|courtesy of|sponsored by)\b/i;
// Limited quantities: "Dinner from Lotus Thai for the first 50 RSVPs", "first come, first served".
const FIRST_COME_AFTER = /\b(?:for|to) the first \d+|\bfirst[- ]come,? first[- ]serve/i;

// Invitations to food that is part of the event. Weaker than a provision statement:
// near a restaurant or cafe they mean attendees buy it. ("Available for purchase"
// never gets here: PRICE_NEARBY cancels the match first.)
const INVITE_BEFORE = /\b(?:enjoy(?:s|ing)?|grab(?:bing)?|followed by)\b/i;
const INVITE_AFTER =
  /\b(?:(?:will be|is|are) available|(?:to|will) follow|for (?:all )?(?:attendees|participants|guests|everyone|volunteers)|with (?:an |your )?rsvp)\b/i;

// Determiners, adjectives and earlier list items between a cue and the food word:
// "join us for a light lunch", "a mixer with music and dinner".
const FILLER_WORDS = String.raw`a|an|all|some|our|plenty of|lots of|light|free|fresh|hot|warm|healthy|delicious|tasty|homemade|sweet|savory|catered|complimentary|boxed|buffet|hearty|local|vegan|vegetarian|assorted|and|&|or|\d+|[\w'’-]+['’]s|[\w'’-]+,|[\w'’-]+ (?:and|&)`;
const FILLER = String.raw`(?:\s+(?:${FILLER_WORDS})){0,5}$`;
// After "for", "the" is fine ("stay for the pizza"); after "including" it names a topic.
const FILLER_THE = String.raw`(?:\s+(?:the|${FILLER_WORDS})){0,5}$`;

const cueRegex = (cue: string, filler: string): RegExp => new RegExp(`(?:${cue})${filler}`, "i");

// Phrases that offer attendees the food word right after them.
const OFFER_BEFORE: RegExp[] = [
  // "join us at 11:40 AM for lunch", "join current students and alumni for food"
  cueRegex(String.raw`\bjoin\b(?:\s+\S+){0,8}?\s+for`, FILLER_THE),
  cueRegex(String.raw`\b(?:stay|come|stop by|drop by|drop in|swing by|stick around|rsvp)\b(?:\s+\S+){0,3}?\s+for`, FILLER_THE),
  // "conversation over boba", "networking over light refreshments"
  cueRegex(String.raw`\bover`, FILLER),
  // "sessions include lunch"; never "including the dumpling emoji"
  cueRegex(String.raw`\binclud(?:e|es|ed|ing)`, FILLER),
  // The event's own program: "concludes with a light snack", "starts with a tasting"
  cueRegex(String.raw`\b(?:conclud|end|clos|finish|wrap|start|begin|kick|continu|celebrat)\w*(?:\s+(?:up|off|things off))?\s+with`, FILLER),
  cueRegex(String.raw`\b(?:reception|mixer|social|party|celebration|gathering|hangout|picnic|break|festivities|evening|night|afternoon|morning)\s+with`, FILLER),
  cueRegex(String.raw`\b(?:there(?:'ll|’ll| will) be|there (?:is|are)|we(?:'ll|’ll| will) (?:have|bring|order)|we(?:'re|’re| are) (?:having|bringing|ordering|serving|providing)|we(?:'ve|’ve| have)? (?:got|ordered))`, FILLER),
  // Head counts: "RSVP so we can order enough food"
  cueRegex(String.raw`\b(?:order|get|have|bring|plan for|prepare|make)\s+enough|\bhead ?count for`, FILLER),
  // Pick-up and fuel: "attendees can pick up a boxed lunch", "keep you fueled with cookies"
  cueRegex(String.raw`\bpick(?:ing)? up|\bfuel(?:ed|led|ing)?(?: up)? (?:with|on)|\b(?:invited|welcome) to (?:taste|sample|try)`, FILLER),
  // A logistics heading: "Food: pizza and salad", "Eats: Ike's sandwiches"
  cueRegex(String.raw`\b(?:food|eats|grub|menu)\s*:`, FILLER),
  // "invites you to our annual welcome lunch": the meal is the event itself.
  /\binvit(?:e|es|ed|ing)\b(?:\s+\S+){0,4}?\s+to\s+(?:our|an?|this|the)(?:\s+(?!(?:about|on|of|for|with|regarding|in|at)\b)[\w'’-]+){0,3}$/i,
];
// "RSVPs help us know how much boba to bring"
const HEADCOUNT_BEFORE = /\bhow (?:much|many)$/i;
const HEADCOUNT_AFTER = /^to (?:bring|order|get|prepare|make|have)\b/i;
// A named caterer right after the food: "Dinner from Lotus Thai Bistro". Case-sensitive on purpose.
const PROVIDER_AFTER =
  /^from (?!(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day\b|(?:January|February|March|April|May|June|July|August|September|October|November|December|Noon)\b)[A-Z]/;
// Food on the event's own schedule: "lunch at 12pm", "pizza after the talk".
const SCHEDULED_AFTER =
  /^[,\s]*(?:(?:will be |is |are )?(?:served |available |arrives? |arriving )?(?:starting |beginning |from )?at (?:the (?:door|entrance)|noon|\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b|(?:\w+ )?(?:after|before|following|prior to) (?:the|each|every|our|this) (?:talks?|lectures?|seminars?|events?|programs?|presentations?|panels?|discussions?|sessions?|workshops?|meetings?|screenings?|performances?|concerts?|shows?|readings?|ceremony|games?|tours?|class(?:es)?|recitals?|conversations?)\b)/i;

// Local context that cancels a single match. NEGATING_BEFORE must end right at
// the food word: "no pizza", "(no meal provided)", "bring your own lunch",
// "bring water and your own lunch", "pack a lunch", "BYO snacks".
const NEGATING_BEFORE =
  /(?:^|\s)[("“‘]?(?:no(?: (?:free|complimentary|more|outside|extra))?|byo|(?:bring|pack)(?: (?:your|a|an|the|some))?(?: own)?(?: [a-z]+)?|grab your(?: own)?|(?:your|their) own|eat(?: (?:a|an|your))?(?: (?:full|good|light|healthy|hearty|big))?)$/i;
// "We'll bring pizza", "our officers will bring snacks": the hosts offer it.
const HOST_BRINGS =
  /\b(?:we|they|officers|organizers|hosts|volunteers|board|staff|team|club|department|center)(?:'ll|’ll| will| are)? bring(?:ing)?(?: [\w'’-]+){0,2}$/i;
// Checked within the food's own clause, so "Lunch provided, dinner on your own" keeps the lunch.
const NEGATING_AFTER =
  /\b(?:not|cannot|can['’]?t|won['’]?t|isn['’]?t|aren['’]?t|wasn['’]?t|weren['’]?t|no longer) (?:be )?(?:provided|served|included|available|allowed|permitted)\b|\bon your own\b|\bbring (?:your|their) own\b|\b(?:at|on) (?:your|their) own (?:expense|cost|dime)\b|\b(?:pay|pays|cover|covers) (?:for )?(?:your|their) own\b/i;
// Food said to be free right before it ("a free lunch and a $25 gift card") is never priced.
const FREE_BEFORE = /(?<![\w-])(?:free|complimentary)(?: [\w'’-]+)?$/i;
// "Provided" about something else: "Lunch with the speaker, parking provided."
const NONFOOD_PROVIDED =
  /\b(?:parking|materials?|recordings?|transportation|shuttles?|childcare|interpretation|captions?|captioning|tools|supplies|equipment|instructions?|training|certificates?|t-shirts?|shirts|swag|prizes|seating|slides|notes|resources|laptops|computers|tickets|lodging|housing|stipends?|travel|accommodations?)(?: will be| is| are| be)? (?:provided|served|included|offered|available)\b/gi;
// A negated offer earlier in the sentence: "we cannot provide lunch", "we won't have
// pizza this week", "will not be serving dinner".
const NEGATED_OFFER =
  /\b(?:not|cannot|can['’]?t|won['’]?t|don['’]?t|doesn['’]?t|unable to|never)(?: be)?(?: able to)? (?:provid|serv|offer|supply|cater|hav)\w*(?: [\w'’-]+){0,2}$/i;
// "$0" is free, not a price.
const PRICE_NEARBY =
  /\$\s?(?!0(?:\.00)?\b)\d|\b\d+(?:\.\d{2})? dollars\b|\bfor (?:purchase|sale)\b|\bpurchas(?:es?|ed|ing)\b|\bbuy\b(?!-)|\bfor a fee\b|\bpay(?:s|ing)?\b|\b(?:sold(?! out)|sells?|selling)\b|\bconcessions?\b|\bticketed\b|\btuition\b|(?<!\bno )\bfees?\b|\b\d+\.\d{2} (?:each|per|apiece)\b|\bcash bar\b/i;
// Prices anywhere in the same sentence, for food that is offered but not said to be
// free: "The fee includes breakfast and lunch", "Registration is $25 and includes a catered lunch".
const PRICE_IN_SENTENCE =
  /\$\s?(?!0(?:\.00)?\b)\d|\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty)(?:\.\d{2})? dollars\b|\b(?:charge|cost) of\b|\bfees? (?:includes?|covers?|is|are)\b|\btuition\b|\bfor (?:purchase|sale)\b|\bno-host\b/i;
// "No registration fee", "free of charge", "at no cost" are the opposite of a price,
// and "a $25 gift card" is paid to attendees, not by them.
const NO_PRICE =
  /\b(?:no|without|zero)(?: \w+)? (?:fees?|costs?|charge|purchase)\b|\bfree of charge\b|\bat no (?:cost|charge)\b|\bfees? (?:is |are )?waived\b|\$\s?\d+(?:\.\d{2})?(?: \w+)? (?:gift cards?|stipends?|honorari(?:um|a)|prizes?|awards?|raffle|rewards?|credits?)\b/gi;
// Meal words as time references: "after lunch", "pre-dinner".
const MEAL_TIME_BEFORE = /(?:^|\s)(?:after|before|until|till|post-?|pre-?)$/i;
// Meal words as time slots: "lunch break", "coffee and lunch breaks", "lunch hour".
const MEAL_SLOT_AFTER = /^(?:(?:,|and|&|or)\s+(?:[\w'’-]+\s+)?|-)?(?:breaks?|hours?|time|period|slots?|recess)\b/i;
const COFFEE_SLOT_AFTER = /^(?:(?:,|and|&|or)\s+(?:[\w'’-]+\s+)?)?breaks?\b/i;
// A meal word naming the format ("Lunch & Learn", "lunch talk") doesn't say a meal is served.
const MEAL_FORMAT_AFTER =
  /^(?:(?:&|and) learn|talks?|seminars?|lectures?|series|club|discussions?|presentations?|panels?|forums?|colloqui(?:um|a)|workshops?|meetings?|sessions?|webinars?|symposi(?:um|a)|roundtables?|conversations?|chats?|programs?|poster)\b/i;
// Restaurants and cafes as the location: attendees buy their own.
const VENUE_NEARBY = /\b(?:restaurants?|caf[eé]s?|eatery|eateries|dining halls?|cafeterias?|food courts?)\b/i;
const MEAL_VENUE_AFTER = /^(?:options|spots|places|venues|menus?|vendors?|reservations?|nearby)\b/i;
// Food as the subject of the event: "the history of pizza", "a documentary about sushi chefs".
const TOPIC_BEFORE =
  /\b(?:(?:history|histories|science|chemistry|culture|politics|economics|future|ethics|anthropology|sociology|psychology|origins?|evolution|role|impact|effects?|benefits|nutrition|art|meaning|stories|story|study) of|(?:talks?|lectures?|webinars?|seminars?|discussions?|panels?|presentations?|conversations?|books?|films?|documentar(?:y|ies)|research|articles?|papers?|essays?|courses?|podcasts?) (?:on|about|exploring)|discuss(?:es|ing)?|explor(?:e|es|ing)|examin(?:e|es|ing)|stud(?:ies|ying)|investigat(?:e|es|ing)|debat(?:e|es|ing)|trac(?:e|es|ing))(?:\s+(?:the|a|an|how|why|what|whether|school|american|global|healthy|sustainable|traditional|local|our|their|its|[\w'’-]+,|[\w'’-]+ (?:and|&))){0,4}$/i;
// Bare "food" or "meal" followed by another noun is a topic: "food systems", "meal plans".
const GENERIC_FOLLOWERS =
  /^(?:\s*(?:[,.;:!?)–—]|$)|\s+(?:and|&|or|will|is|are|arrives?|arriving|provided|served|available|from|at|for|to|while|on|with|in|after|afterwards|before|following|during|courtesy|sponsored|together|too|as|by|plus|here|there|options)\b)/i;
const IDIOM_AFTER = /^\s+(?:for thought|of)\b/i;
// A food word modifying a topic noun is the topic, unless said to be free: "school
// lunch standards", "breakfast cereals", "a regional pizza chain", "next to the taco truck".
const TOPIC_HEAD_AFTER =
  /^\s*(?:standards?|polic(?:y|ies)|programs?|industry|industries|chains?|trucks?|cereals?|consumption|intake|questionnaires?|insecurity|security|systems?|research|science|history|culture|economics|politics|marketing|labels?|labeling|waste|deserts?|justice|safety|supply|production)\b/i;
// A talk format before a colon makes the rest of the title its subject:
// "Seminar: Ultra-Processed Snacks and the Adolescent Brain", "Book Talk: 'The Last Bagel'".
const TITLE_TOPIC =
  /\b(?:seminars?|lectures?|talks?|colloqui(?:um|a)|workshops?|panels?|symposi(?:um|a)|webinars?|readings?|screenings?|films?|discussions?|conversations?|forums?)\s*[:|]/i;
// Biographies mention food as someone's work: "She designed the boba tea emoji."
const BIO_SENTENCE = /^(?:She|He|They|His|Her|Their)\b/;

// Text anywhere in the listing that rules out free food entirely.
const NO_FOOD =
  /\bno (?:outside )?food\b|\bfood (?:and|or|&) drinks? (?:are |is )?not (?:allowed|permitted)\b|\b(?:food|refreshments|meals?) (?:is |are |will )?not (?:be )?(?:provided|served|included)\b/i;
// Bring-your-own meal formats cancel meal matches (not e.g. "dessert provided").
const BYO_MEAL =
  /\bbring (?:your|a|an) (?:own )?(?:bag |sack |packed )?(?:lunch|dinner|breakfast|meal|food)\b|\bbrown[- ]bag\b|\b(?:bag|sack|packed) lunch(?:es)?\b/i;
// Online-only events can't feed anyone, even when the virtual flag is missing.
const ONLINE_ONLY =
  /\b(?:event|session|talk|seminar|webinar|workshop|class|meeting|program|lecture|panel) (?:is|will be) (?:held |hosted )?(?:entirely |fully |exclusively |only )?(?:online|virtual|on zoom|via zoom)\b|\b(?:online|virtual|zoom)[- ]only\b|\bvirtual event only\b/i;
const IN_PERSON = /\bin[- ]person\b|\bhybrid\b/i;
// Exhibition listings repeat daily; their food is for a reception on one of those days.
const EXHIBITION = /\bon view:|\bgallery hours\b/i;

interface Penalty {
  pattern: RegExp;
  factor: number;
  // Skipped when the listing calls some of its food free: "one free meal ticket per person".
  unlessFree?: boolean;
}

// Topics that mention food, and drinks-only formats: they make a bare mention
// doubtful but don't override an explicit provision statement.
const TOPIC_PENALTIES: Penalty[] = [
  {
    pattern: /\bfood (?:insecurity|security|justice|polic(?:y|ies)|systems?|sovereignty|access)\b/i,
    factor: 0.7,
  },
  // Everyone buys their own: no-host gatherings, split checks.
  {
    pattern: /\bprices? vary\b|\bno-host\b|\b(?:everyone|attendees) pays?\b|\bpays? (?:your|their) own way\b|\bsplit (?:the )?checks?\b|\boff the menu\b/i,
    factor: 0.4,
  },
  // Collecting food: the food words are donations, but "Free lunch provided! Bring a
  // canned item for the food drive" still feeds the volunteers.
  { pattern: /\bfood (?:drives?|donations?|recovery)\b|\bcanned (?:food|goods)\b/i, factor: 0.2 },
];
// Formats where food isn't free to attendees, whatever the wording.
const FORMAT_PENALTIES: Penalty[] = [
  // Food for people in need, not a perk of attending.
  { pattern: /\bfood (?:pantr(?:y|ies)|banks?|distribution)\b/i, factor: 0.2 },
  // Not "(Not a Potluck!)".
  { pattern: /(?<!\b(?:not|no) (?:a )?)\bpotluck\b/i, factor: 0.3 },
  // Trucks sell their food; a free one says so.
  { pattern: /\bfood trucks?\b/i, factor: 0.25, unlessFree: true },
];

// Idioms that only look like food, blanked out before matching.
const IDIOMS = /\b(?:there(?:'s|’s| is| ain't| ain’t) )?no such thing as a free lunch\b/gi;

interface Match {
  term: FoodTerm;
  start: number;
  end: number;
  inTitle: boolean;
}

// The words around a match, within its sentence.
interface Context {
  before: string; // last 3 words
  lead: string; // last 12 words
  after: string; // first 6 words
  clauseAfter: string; // first 6 words, stopping at the end of the food's clause
  tail: string; // first 10 words
  next: string; // raw text right after the match
  sentence: string; // the sentence up to the match
  rest: string; // the sentence after the match
  clause: string; // the whole sentence
  exclaimed: boolean; // a short description sentence ending in "!"
}

type Cue = "definite" | "invited" | null;
// Why a match was cancelled. Price, negation, venue and topic also discount the
// same food elsewhere ("Brunch" in the title, "Brunch tickets: $20" below).
type Cancel = "negated" | "price" | "venue" | "topic" | "slot" | "compound";
const SPREADING_CANCELS = new Set<Cancel>(["negated", "price", "venue", "topic"]);

interface ScoredMatch {
  match: Match;
  score: number;
  explicit: boolean;
  // Said to be free: "free pizza", "complimentary dinner".
  free: boolean;
}

// Periods after these never end a sentence: "Dr. Lee", "Oct. 1", "St. Louis".
const NON_TERMINAL = new Set([
  "dr", "mr", "mrs", "ms", "mx", "prof", "rev", "st", "mt", "no", "vol", "vs", "approx",
  "dept", "rm", "bldg", "ste", "ave", "blvd", "rd", "e.g", "i.e", "cf",
  "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec",
  "mon", "tue", "tues", "wed", "thu", "thur", "thurs", "fri", "sat", "sun",
]);

// A period ends a sentence only before whitespace and a capital (or the end), and
// not after an abbreviation or an initial: "$2.50", URLs and "Dr. Lee" don't split.
const endsSentence = (text: string, index: number): boolean => {
  const char = text[index];
  if (char === "\n" || char === "!" || char === "?" || char === ";") return true;
  if (char !== ".") return false;
  if (index + 1 < text.length && !/\s/.test(text[index + 1] ?? "")) return false;
  const word = /[A-Za-z.]*$/.exec(text.slice(Math.max(0, index - 12), index))?.[0] ?? "";
  if (NON_TERMINAL.has(word.toLowerCase()) || /^[A-Z]$/.test(word)) return false;
  return !/^\s*[a-z]/.test(text.slice(index + 1, index + 12));
};

const sentenceBefore = (text: string, index: number): string => {
  let start = index;
  while (start > 0 && !endsSentence(text, start - 1)) start--;
  return text.slice(start, index);
};

const sentenceAfter = (text: string, index: number): string => {
  let end = index;
  while (end < text.length && !endsSentence(text, end)) end++;
  return text.slice(index, end);
};

// Where the food's own clause ends: "Lunch provided, dinner on your own", "Lunch & Learn: Pay Transparency".
const CLAUSE_END = /[,;:(—–]|\sbut\s/;

const words = (value: string): string[] => value.trim().split(/\s+/).filter(Boolean);

const lastWords = (value: string, count: number): string => words(value).slice(-count).join(" ");

const firstWords = (value: string, count: number): string => words(value).slice(0, count).join(" ");

// "a.m." would otherwise end the sentence in "join us at 11:40 a.m. for lunch".
// Idioms are blanked with spaces so match offsets stay put.
const normalize = (value: string): string =>
  value
    .trim()
    .replace(/\b([ap])\.m\./gi, "$1m")
    .replace(IDIOMS, (idiom) => " ".repeat(idiom.length));

const contextOf = (text: string, match: Match): Context => {
  const sentence = sentenceBefore(text, match.start);
  const rest = sentenceAfter(text, match.end);
  const sentenceWords = words(sentence).length + 1 + words(rest).length;
  return {
    before: lastWords(sentence, 3),
    lead: lastWords(sentence, 12),
    after: firstWords(rest, 6),
    clauseAfter: firstWords(rest.split(CLAUSE_END)[0] ?? "", 6),
    tail: firstWords(rest, 10),
    next: text.slice(match.end, match.end + 40),
    sentence: sentence.trimStart(),
    rest,
    clause: text.slice(match.start - sentence.length, match.end + rest.length),
    exclaimed: !match.inTitle && text[match.end + rest.length] === "!" && sentenceWords <= EXCLAIMED_MAX_WORDS,
  };
};

const findMatches = (text: string, titleLength: number): Match[] => {
  const all: Match[] = [];
  for (const { term, regex } of TERM_REGEXES) {
    for (const found of text.matchAll(regex)) {
      const start = found.index;
      if (term.titleOnly && start >= titleLength) continue;
      all.push({ term, start, end: start + found[0].length, inTitle: start < titleLength });
    }
  }
  // Longest match wins where matches overlap ("coffee and pastries" over "coffee").
  all.sort((a, b) => b.end - b.start - (a.end - a.start));
  const kept: Match[] = [];
  for (const match of all) {
    if (!kept.some((k) => match.start < k.end && k.start < match.end)) kept.push(match);
  }
  return kept.sort((a, b) => a.start - b.start);
};

const isMeal = (match: Match): boolean => match.term.label !== null && MEAL_LABELS.has(match.term.label);

const labelOf = (match: Match): string => match.term.label ?? "food";

const namesFormat = (match: Match, ctx: Context): boolean =>
  (isMeal(match) || match.term.label === "coffee") && MEAL_FORMAT_AFTER.test(ctx.tail);

const isInvited = (ctx: Context): boolean =>
  INVITE_BEFORE.test(ctx.before) ||
  OFFER_BEFORE.some((regex) => regex.test(ctx.lead)) ||
  (HEADCOUNT_BEFORE.test(ctx.lead) && HEADCOUNT_AFTER.test(ctx.tail)) ||
  INVITE_AFTER.test(ctx.after) ||
  PROVIDER_AFTER.test(ctx.tail) ||
  SCHEDULED_AFTER.test(ctx.tail) ||
  ctx.exclaimed;

// How strongly the words around the match say this food is provided.
const cueOf = (match: Match, ctx: Context): Cue => {
  if (match.term.weight >= EXPLICIT_WEIGHT) return "definite";
  if (match.term.format || namesFormat(match, ctx)) return null;
  const tail = ctx.tail.replace(NONFOOD_PROVIDED, " ");
  if (DEFINITE_BEFORE.test(ctx.before) || DEFINITE_AFTER.test(tail) || FIRST_COME_AFTER.test(tail)) {
    return "definite";
  }
  return isInvited(ctx) ? "invited" : null;
};

const isTimeSlot = (match: Match, ctx: Context): boolean => {
  if (isMeal(match)) return MEAL_TIME_BEFORE.test(ctx.before) || MEAL_SLOT_AFTER.test(ctx.tail);
  return match.term.label === "coffee" && COFFEE_SLOT_AFTER.test(ctx.tail);
};

const isTopicCompound = (match: Match, ctx: Context): boolean =>
  match.term.compoundTopic === true && (!GENERIC_FOLLOWERS.test(ctx.next) || IDIOM_AFTER.test(ctx.next));

const isAtVenue = (match: Match, ctx: Context): boolean =>
  VENUE_NEARBY.test(ctx.lead) || VENUE_NEARBY.test(ctx.tail) || (isMeal(match) && MEAL_VENUE_AFTER.test(ctx.tail));

const isNegated = (ctx: Context): boolean =>
  (NEGATING_BEFORE.test(ctx.before) && !HOST_BRINGS.test(ctx.lead)) ||
  NEGATING_AFTER.test(ctx.clauseAfter) ||
  NEGATED_OFFER.test(ctx.lead);

// Food said to be free is never cancelled by a price elsewhere in its sentence. A price
// earlier in the sentence covers even provided food ("Registration is $25 and includes a
// catered lunch"); a later one only cancels food that isn't said to be provided.
const isPriced = (ctx: Context, cue: Cue): boolean =>
  !FREE_BEFORE.test(ctx.before) &&
  (PRICE_NEARBY.test(ctx.before) ||
    PRICE_NEARBY.test(ctx.clauseAfter) ||
    PRICE_IN_SENTENCE.test((cue === "definite" ? ctx.sentence : ctx.clause).replace(NO_PRICE, " ")));

// Inside a quoted title the food names a work: 'Jiro Dreams of Sushi', “The Last Bagel”.
const OPEN_QUOTE = /(?:^|[\s:(—–])["“‘'][^"“”‘’']*$/;
const CLOSE_QUOTE = /^(?:[^"“”‘’']*?[\w.!?])?["”’'](?!\w)/;
const isQuoted = (ctx: Context): boolean => OPEN_QUOTE.test(ctx.sentence) && CLOSE_QUOTE.test(ctx.rest);

const cancelReason = (match: Match, ctx: Context, cue: Cue): Cancel | null => {
  if (isNegated(ctx)) return "negated";
  if (isPriced(ctx, cue)) return "price";
  if (isTimeSlot(match, ctx)) return "slot";
  if (isTopicCompound(match, ctx)) return "compound";
  if (cue === "definite") return null;
  if (isAtVenue(match, ctx)) return "venue";
  if (TOPIC_BEFORE.test(ctx.lead) || TOPIC_HEAD_AFTER.test(ctx.next)) return "topic";
  if (cue === null && (isQuoted(ctx) || (match.inTitle && TITLE_TOPIC.test(ctx.sentence)))) return "topic";
  return null;
};

const scoreMatch = (match: Match, cue: Cue, free: boolean): ScoredMatch => {
  const explicit = cue !== null;
  // "Coffee provided" is a real signal but not a meal: cap weak terms at "likely".
  const strongBase = match.term.weight >= 0.4 ? EXPLICIT_WEIGHT : LIKELY_THRESHOLD;
  const base = explicit ? Math.max(match.term.weight, strongBase) : match.term.weight;
  return { match, score: base + (match.inTitle ? TITLE_BONUS : 0), explicit, free };
};

// A bare mention in a biography or without its required cue is not an offer.
const isOffered = ({ match, explicit }: ScoredMatch, ctx: Context): boolean =>
  explicit || (!match.term.needsCue && !BIO_SENTENCE.test(ctx.sentence));

const scoreMatches = (text: string, titleLength: number): ScoredMatch[] => {
  const byoMeal = BYO_MEAL.test(text);
  const discounted = new Set<string>();
  const scored: ScoredMatch[] = [];
  for (const match of findMatches(text, titleLength)) {
    const ctx = contextOf(text, match);
    const cue = cueOf(match, ctx);
    // A brown-bag format only cancels meals the listing doesn't say are provided.
    if (byoMeal && isMeal(match) && cue !== "definite") continue;
    const cancel = cancelReason(match, ctx, cue);
    if (cancel) {
      if (SPREADING_CANCELS.has(cancel)) discounted.add(labelOf(match));
      continue;
    }
    // "free" sits before the food, or starts the match itself ("free meal").
    const free = FREE_BEFORE.test(ctx.before) || /^free\b/i.test(text.slice(match.start, match.end));
    const result = scoreMatch(match, cue, free);
    if (isOffered(result, ctx)) scored.push(result);
  }
  return scored.filter((s) => s.explicit || !discounted.has(labelOf(s.match)));
};

const penaltyFactor = (penalties: Penalty[], text: string): number =>
  penalties.reduce((total, { pattern, factor }) => (pattern.test(text) ? total * factor : total), 1);

// True when the listed cost names a price above zero for everyone. Only "$" amounts,
// "N dollars" or a bare number count, so "RSVP by 10/15" is not a price; "Free" or a
// "$0" tier ("$0 - $25", "Students $0, general $10") means some attend free.
export const isPaidCost = (cost: string | null | undefined): boolean => {
  if (!cost) return false;
  if (/\bfree\b/i.test(cost)) return false;
  const bare = /^\s*\d+(?:\.\d+)?\s*$/.test(cost) ? [cost] : [];
  const priced = [...cost.matchAll(/\$\s?(\d+(?:\.\d+)?)|\b(\d+(?:\.\d+)?) dollars\b/gi)].map((m) => m[1] ?? m[2] ?? "");
  const amounts = [...bare, ...priced].map(Number);
  return amounts.length > 0 && Math.min(...amounts) > 0;
};

const noFood = (): Classification => ({
  hasFreeFood: false,
  foodConfidence: 0,
  foodDetails: null,
  classifiedBy: "keywords",
});

const round2 = (value: number): number => Math.round(value * 100) / 100;

const isOnlineOnly = (text: string): boolean => ONLINE_ONLY.test(text) && !IN_PERSON.test(text);

export const classifyByKeywords = (input: ClassifierInput): Classification => {
  const fromText = classifyText(input);
  // A host's "food provided" checkbox counts as an explicit offer, except where
  // nobody can be fed (online only) or the food comes with a paid ticket.
  if (!input.foodProvided || fromText.foodConfidence >= EXPLICIT_WEIGHT || isPaidCost(input.cost)) return fromText;
  const text = `${input.title}\n${input.description}`;
  if (input.isVirtual || isOnlineOnly(text)) return fromText;
  return { ...fromText, hasFreeFood: true, foodConfidence: EXPLICIT_WEIGHT };
};

const classifyText = (input: ClassifierInput): Classification => {
  if (input.isVirtual) return noFood();

  const title = normalize(input.title);
  const text = `${title}\n${normalize(input.description)}`;
  if (isOnlineOnly(text)) return noFood();

  const scored = scoreMatches(text, title.length);
  // "No food in the galleries" rules food out unless the listing offers some
  // explicitly elsewhere ("a reception with refreshments follows in the courtyard").
  if (scored.length === 0 || (NO_FOOD.test(text) && !scored.some((s) => s.explicit))) return noFood();

  // Topic penalties only discount matches that aren't explicit offers.
  const topic = penaltyFactor(TOPIC_PENALTIES, text);
  const value = (s: ScoredMatch): number => (s.explicit ? s.score : s.score * topic);
  const best = scored.reduce((a, b) => (value(b) > value(a) ? b : a));
  const distinctLabels = new Set(scored.map((s) => labelOf(s.match)));
  // Capped before the multipliers, so a long food list can't lift a paid event over the line.
  let confidence = Math.min(MAX_CONFIDENCE, best.score + EXTRA_TERM_BONUS * (distinctLabels.size - 1));
  if (!best.explicit) confidence *= topic;

  const saysFree = scored.some((s) => s.free);
  confidence *= penaltyFactor(FORMAT_PENALTIES.filter((p) => !(p.unlessFree && saysFree)), text);
  if (EXHIBITION.test(text) && !scored.some((s) => s.match.inTitle)) confidence *= EXHIBITION_FACTOR;
  if (isPaidCost(input.cost)) confidence *= PAID_EVENT_FACTOR;

  confidence = round2(Math.min(MAX_CONFIDENCE, Math.max(0, confidence)));
  const hasFreeFood = confidence >= FOOD_THRESHOLD;
  const details = [...new Set(scored.flatMap((s) => (s.match.term.label ? [s.match.term.label] : [])))];

  return {
    hasFreeFood,
    foodConfidence: confidence,
    foodDetails: hasFreeFood && details.length > 0 ? details.join(", ") : null,
    classifiedBy: "keywords",
  };
};
