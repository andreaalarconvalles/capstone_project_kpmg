// ARIA scope-routing smoke test.
//
// Offline by default: checks the deterministic scope gate (isInScopeDomain) and the
// in-scope intent classifier against a fixed prompt set, so you can eyeball routing
// behaviour before a demo without any cloud credentials.
//
// Run:  node "Stage 7 - UI Interface/vercel_vite_app/scripts/scope_smoke_test.mjs"
//
// Lanes:
//   in_scope   -> obvious ARIA domain prompt, skips the LLM router, runs the analytics pipeline.
//   router     -> not obviously in-scope, sent to the Gemini Flash router, which returns
//                 in_scope | general | other_city. We list the lane we EXPECT the router to pick.

import { isInScopeDomain, classifyIntent } from "../api/analytics-pipeline.js";

// gate: what the deterministic isInScopeDomain() should return.
//   "in_scope" -> gate returns true (skips router)
//   "router"   -> gate returns false (goes to LLM router)
// expect: the lane a correct end-to-end run should ultimately land in.
const CASES = [
  // --- Obvious in-scope: must skip the router ---
  { prompt: "Where should I invest in Paris for short-term rentals?", gate: "in_scope", expect: "in_scope" },
  { prompt: "Which Athens areas are highest risk for hosts?", gate: "in_scope", expect: "in_scope" },
  { prompt: "Is my listing underpriced?", gate: "in_scope", expect: "in_scope" },
  { prompt: "What does the Loi Le Meur registration rule require?", gate: "in_scope", expect: "in_scope" },
  { prompt: "Show me the saturation map for arrondissements", gate: "in_scope", expect: "in_scope" },
  { prompt: "What is the opportunity score and how is it built?", gate: "in_scope", expect: "in_scope" },
  { prompt: "Forecast Athens occupancy with Prophet", gate: "in_scope", expect: "in_scope" },

  // --- General: gate defers, router should say general ---
  { prompt: "what time is it now?", gate: "router", expect: "general" },
  { prompt: "what is 17 times 23?", gate: "router", expect: "general" },
  { prompt: "who are you?", gate: "router", expect: "general" },
  { prompt: "write me a haiku about the sea", gate: "router", expect: "general" },
  { prompt: "what's the capital of Japan?", gate: "router", expect: "general" },

  // --- Other city: gate defers, router should say other_city ---
  { prompt: "Is Lisbon a good market for short-term rentals?", gate: "router", expect: "other_city" },
  { prompt: "Compare investing in Berlin vs Madrid", gate: "router", expect: "other_city" },

  // --- Ambiguous: gate defers, router should lean in_scope ---
  { prompt: "what about there?", gate: "router", expect: "in_scope (follow-up, uses prior city)" },
];

let pass = 0;
let fail = 0;

console.log("ARIA scope-routing smoke test (offline gate)\n" + "=".repeat(60));
for (const c of CASES) {
  const inScope = isInScopeDomain(c.prompt);
  const actualGate = inScope ? "in_scope" : "router";
  const ok = actualGate === c.gate;
  ok ? pass++ : fail++;
  const intent = inScope ? `  intent=${classifyIntent(c.prompt, "market")}` : "";
  console.log(
    `${ok ? "PASS" : "FAIL"}  gate=${actualGate.padEnd(8)} expect=${c.expect.padEnd(22)} ${JSON.stringify(c.prompt)}${intent}`
  );
}

console.log("=".repeat(60));
console.log(`${pass} passed, ${fail} failed, ${CASES.length} total`);
console.log("\nNote: 'router' rows are classified live by Gemini Flash at request time;");
console.log("the 'expect' column documents the lane a correct router run should choose.");

process.exit(fail === 0 ? 0 : 1);
