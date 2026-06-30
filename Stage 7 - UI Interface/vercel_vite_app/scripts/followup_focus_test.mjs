// ARIA follow-up focus/context regression test (offline).
//
// Guards the bug where an opportunity/return question ("best areas for return") was followed by
// an ambiguous follow-up ("generate me a map showing the best neighborhoods") and ARIA silently
// switched the metric to "cheapest price", recommending a different area.
//
// Root cause: prior focus was inferred by regex-scanning ARIA's own previous ANSWER, which is full
// of metric-scale prose ("Lowest is 0.00, highest is 1.00", "Lower is better for affordability"),
// so metricFocus() mis-read it as a "cheapest price" request. Fix: infer prior focus from the
// USER's turns only, and represent investment/return/best as an explicit "opportunity ranking".
//
// Run:  node "Stage 7 - UI Interface/vercel_vite_app/scripts/followup_focus_test.mjs"

import { resolvePromptContext, classifyIntent } from "../api/analytics-pipeline.js";

// The real Turn-1 ARIA answer is dense with metric-scale vocabulary. These exact phrases used to
// trip metricFocus()'s cheap/affordable branch when the answer was scanned for "prior focus".
const ARIA_TURN1_ANSWER = [
  "Direct recommendation: Start with Zappeio (ΖΑΠΠΕΙΟ); it has the strongest opportunity signal among the Athens areas.",
  "Key evidence: Opportunity score: A 0 to 1 shortlist score that combines rental-market upside with pressure signals.",
  "Lowest is 0.00, highest is 1.00. Higher is better for investment screening; above 0.70 is a strong shortlist signal.",
  "Median nightly price: the middle nightly rental price in the area, in euros. Lower is better for affordability;",
  "higher can be good for revenue only if demand stays strong. Average annual revenue around EUR 15,416.",
  "Sources: neighbourhood stats.",
].join(" ");

const TURN1_USER = "I need to understand the investment opportunities for purchasing a short-term rental property in Athens, specifically identifying areas with the highest potential for return.";

const baseHistory = [
  { role: "user", text: TURN1_USER },
  { role: "assistant", text: ARIA_TURN1_ANSWER },
];

const cases = [
  {
    name: "Ambiguous follow-up keeps the opportunity metric (the reported bug)",
    prompt: "can you generate me a map showing the best neighborhoods?",
    messages: baseHistory,
    check: (ctx) => [
      ["priorFocus is opportunity, not cheapest", ctx.priorFocus === "opportunity ranking"],
      ["priorFocus is NOT affordable", ctx.priorFocus !== "affordable nightly-price ranking"],
      ["resolved city is Athens", (ctx.currentCity || ctx.priorCity) === "Athens"],
      ["intent stays market-entry", classifyIntent(ctx.analysisPrompt, "market") === "market-entry"],
    ],
  },
  {
    name: "Metric-less visual follow-up inherits the prior opportunity focus",
    prompt: "show me the map",
    messages: baseHistory,
    check: (ctx) => [
      ["prior opportunity focus is carried forward", ctx.priorFocus === "opportunity ranking"],
      ["analysisPrompt carries the opportunity focus", /opportunity ranking/i.test(ctx.analysisPrompt)],
      ["analysisPrompt does NOT inject a cheapest focus", !/affordable nightly-price/i.test(ctx.analysisPrompt)],
      ["intent stays market-entry", classifyIntent(ctx.analysisPrompt, "market") === "market-entry"],
    ],
  },
  {
    name: "Explicit new-metric follow-up still switches (cheapest overrides)",
    prompt: "now show me the cheapest areas instead",
    messages: baseHistory,
    check: (ctx) => [
      ["currentFocus switches to affordable", ctx.currentFocus === "affordable nightly-price ranking"],
    ],
  },
  {
    name: "Turn-1 investment prompt is itself recognised as opportunity focus",
    prompt: TURN1_USER,
    messages: [],
    check: (ctx) => [
      ["currentFocus is opportunity ranking", ctx.currentFocus === "opportunity ranking"],
      ["intent is market-entry", classifyIntent(ctx.analysisPrompt, "market") === "market-entry"],
    ],
  },
];

let pass = 0;
let fail = 0;

console.log("ARIA follow-up focus/context regression test (offline)\n" + "=".repeat(64));
for (const c of cases) {
  const ctx = resolvePromptContext(c.prompt, c.messages);
  console.log(`\n${c.name}`);
  console.log(`  prompt: ${JSON.stringify(c.prompt)}`);
  for (const [label, ok] of c.check(ctx)) {
    ok ? pass++ : fail++;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
  }
}

console.log("\n" + "=".repeat(64));
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
