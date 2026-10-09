import * as cheerio from "cheerio";

// schema.org JSON-LD in a page's <script type="application/ld+json"> blocks.
// Preferred over reading a page's HTML: it's the page's own structured summary.

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const typesOf = (node: JsonObject): string[] => {
  const type = node["@type"];
  return (Array.isArray(type) ? type : [type]).filter((t): t is string => typeof t === "string");
};

// Top-level nodes, including those in an array or an @graph.
const nodesOf = (value: unknown): JsonObject[] => {
  if (Array.isArray(value)) return value.flatMap(nodesOf);
  if (!isObject(value)) return [];
  const graph = value["@graph"];
  return [value, ...(Array.isArray(graph) ? graph.flatMap(nodesOf) : [])];
};

// The first schema.org Event (or subtype, e.g. "EducationEvent") in the page, if any.
// Blocks that aren't valid JSON are skipped.
export const findJsonLdEvent = (html: string): JsonObject | null => {
  const $ = cheerio.load(html);
  for (const script of $('script[type="application/ld+json"]').toArray()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse($(script).text());
    } catch {
      continue;
    }
    const event = nodesOf(parsed).find((node) => typesOf(node).some((type) => type.endsWith("Event")));
    if (event) return event;
  }
  return null;
};
