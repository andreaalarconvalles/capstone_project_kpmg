// ARIA response-quality evaluation harness.
//
// Purpose: turn "good answer" from a vibe into a deterministic pass/fail signal,
// matching the self-check rubric in
// .codex/skills/aria-response-quality/references/response-contract.md and the
// backend qualityCheck pass bar (score >= 97) in analytics-pipeline.js.
//
// Run:  node "response-quality.eval.mjs"
// Exit: 0 if all gold answers score >= 97, the policy is complete, and the rubric
//       correctly flags the bad answers; 1 otherwise.

import { buildGroundedAnalysis, classifyIntent, resolvePromptContext } from "./analytics-pipeline.js";
import { ARIA_RESPONSE_POLICY } from "./aria-response-policy.js";

const PASS_BAR = 97;

/* ------------------------------ rubric scorer ------------------------------ */

const JARGON_TERMS = [
  "saturation",
  "opportunity score",
  "underpricing gap",
  "risk probability",
  "occupancy",
  "shap",
];

const LENGTH_RANGES = {
  simple: [12, 200],
  analytical: [120, 520],
  decision: [300, 900],
};

export function scoreAnswer(answer, opts = {}) {
  const { tier = "analytical", geographic = true } = opts;
  const a = String(answer || "");
  const lower = a.toLowerCase();
  const issues = [];
  let score = 100;

  const deduct = (points, reason) => {
    score -= points;
    issues.push(`-${points} ${reason}`);
  };

  // 1. Lead with the decision.
  const firstLine = a.split("\n").find((l) => l.trim()) || "";
  const leadsWithRec =
    /^(\*\*)?\s*direct recommendation/i.test(firstLine.trim()) ||
    /\b(enter|choose|prioriti|focus on|target|avoid|raise|lower|start with|pick|consider|stay|expand|hold off|re-?price)\b/i.test(
      firstLine
    );
  if (tier !== "simple" && !leadsWithRec) deduct(15, "no recommendation in the first line");

  // 2. Every number interpreted in plain language.
  const numbers = a.match(/(€\s?\d[\d.,]*|\b\d+(?:\.\d+)?%|\b0\.\d+\b)/g) || [];
  const interpCues = (
    lower.match(
      /\b(means|higher|lower|low|high|better|worse|scale|0 to 1|0% to 100%|because|indicates|which means|crowd|calmer|stronger|weaker|cutoff|healthy|signal|positive|negative|meaningful|unlikely)\b/g
    ) || []
  ).length;
  if (numbers.length && interpCues < Math.min(numbers.length, 3))
    deduct(15, "numbers not interpreted in plain language");

  // 3. Technical terms defined on first use (look for a parenthetical near first mention).
  for (const term of JARGON_TERMS) {
    const idx = lower.indexOf(term);
    if (idx >= 0) {
      const window = a.slice(idx, idx + term.length + 90);
      if (!/\(/.test(window)) {
        deduct(12, `term not defined on first use: ${term}`);
        break;
      }
    }
  }

  // 4. Length matches the prompt tier.
  const wc = a.trim().split(/\s+/).filter(Boolean).length;
  const [lo, hi] = LENGTH_RANGES[tier] || LENGTH_RANGES.analytical;
  if (wc < lo || wc > hi) deduct(10, `length ${wc} words outside ${tier} range ${lo}-${hi}`);

  // 5. Next actions on analytical answers.
  if (tier !== "simple" && !/next actions?:/i.test(a)) deduct(8, "no next actions");

  // 6. Visualization guidance when relevant.
  if (tier !== "simple" && geographic && !/\b(map|chart|visuali|graph)\b/i.test(a))
    deduct(8, "no visualization guidance");

  // 7. Clean final Sources line.
  if (!/\n?sources:\s*\S+/i.test(a)) deduct(8, "missing or empty Sources line");

  // 8. Not a dense single paragraph.
  const sections = a.split(/\n{2,}/).filter((s) => s.trim());
  if (tier !== "simple" && sections.length < 3) deduct(6, "too few sections (reads dense)");

  // 9. Out-of-scope handling, when applicable.
  if (opts.outOfScope && !/(outside|boundary|general guidance|not (?:in )?aria|does not (?:have|cover))/i.test(lower))
    deduct(10, "out-of-scope answer does not state the data boundary");

  // 9b. Requested geography discipline.
  if (opts.requestedCity && opts.forbiddenCity) {
    const requested = String(opts.requestedCity).toLowerCase();
    const forbidden = String(opts.forbiddenCity).toLowerCase();
    const recommendsForbidden = new RegExp(`\\b(recommend|enter|choose|prioriti[sz]e|start with|focus on|target)\\b[^\\n.]{0,120}\\b${forbidden}\\b`, "i").test(a)
      || new RegExp(`\\b${forbidden}\\b[^\\n.]{0,120}\\b(recommend|better|stronger|first|lead|prioriti[sz]e)\\b`, "i").test(a);
    const omitsRequested = !lower.includes(requested);
    if (recommendsForbidden || omitsRequested) deduct(25, `answer does not stay within requested geography: ${opts.requestedCity}`);
  }

  // 9c. Follow-up answers should use context instead of repeating the prior answer.
  if (opts.followUp) {
    if (/ask aria a follow-up|shortlist the strongest areas or listings above/i.test(a)) {
      deduct(18, "follow-up answer repeats generic initial-answer next actions");
    }
    for (const phrase of opts.mustMention || []) {
      if (!lower.includes(String(phrase).toLowerCase())) {
        deduct(10, `follow-up answer misses required context: ${phrase}`);
      }
    }
  }

  // 10. No invented metric, score, or capability claim (automatic fail).
  if (/(live regulation retrieval is active|quality \d{1,3}\/100|confidence score|evidence-strength)/i.test(a))
    deduct(40, "forbidden/invented claim");

  return { score: Math.max(0, score), issues };
}

/* --------------------------- policy completeness --------------------------- */

const REQUIRED_POLICY_MARKERS = [
  "Lead with the decision",
  "Persona adaptation",
  "Requested geography discipline",
  "Adaptive length",
  "Explaining numbers",
  "Concept explanations",
  "Visual behavior",
  "Compliance-first routing",
  "Out-of-scope questions",
  "Citations and sources",
  "Hard rules",
];

function checkPolicyCompleteness() {
  const missing = REQUIRED_POLICY_MARKERS.filter((m) => !ARIA_RESPONSE_POLICY.includes(m));
  return { passed: missing.length === 0, missing };
}

/* ----------------------------- routing checks ----------------------------- */

const PARIS_ONLY_PROPHET_PROMPT = "For a KPMG client considering a small short-term-rental portfolio in Paris, where should they enter first over the next 12 months? Use ARIA's Prophet demand forecast and neighbourhood data to recommend the best Paris arrondissement or area only. Show the result on a Paris map, compare the top Paris areas with the most useful charts, explain the business reasoning in plain language, include the main risks and next actions, and end with sources. Do not compare Paris with Athens unless I explicitly ask for a cross-city comparison.";

const COMPLIANCE_ROUTING_PROMPTS = [
  "Is AMA registration mandatory for Athens short-term rentals?",
  "Can an unlicensed central Athens listing regularize after the Dec 2024 freeze?",
  "What happens when enforcement removes unlicensed Athens listings?",
  "What does Loi Le Meur change for Paris primary residences?",
  "Compare central Athens freeze risk with near-zone regularisation options and cite relevant source passages.",
];

function checkRouting() {
  const failures = [];
  const firstContext = resolvePromptContext(PARIS_ONLY_PROPHET_PROMPT, []);
  const firstIntent = classifyIntent(firstContext.analysisPrompt, "market");
  if (firstContext.currentCity !== "Paris") {
    failures.push(`Paris-only prompt resolved city as ${firstContext.currentCity || "none"}`);
  }
  if (firstIntent !== "demand") {
    failures.push(`Paris-only Prophet prompt routed to ${firstIntent}, expected demand`);
  }

  const followUp = "Why is that Paris area better than the next two options, and what should the client validate before acquiring the first property?";
  const secondContext = resolvePromptContext(followUp, [
    { role: "user", text: PARIS_ONLY_PROPHET_PROMPT },
    { role: "assistant", text: "Direct recommendation: Enter Paris through Bourse first because it leads the Prophet demand scenario. Sources: Prophet forecast outputs, neighbourhood stats" },
  ]);
  const secondIntent = classifyIntent(secondContext.analysisPrompt, "market");
  if (secondIntent !== "demand") {
    failures.push(`Paris forecast follow-up routed to ${secondIntent}, expected demand`);
  }

  for (const prompt of COMPLIANCE_ROUTING_PROMPTS) {
    const intent = classifyIntent(prompt, "market");
    if (intent !== "compliance") {
      failures.push(`Compliance prompt routed to ${intent}, expected compliance: ${prompt}`);
    }
  }

  return { passed: failures.length === 0, failures };
}

async function checkVisualSanity() {
  const failures = [];
  const analysis = await buildGroundedAnalysis({ prompt: PARIS_ONLY_PROPHET_PROMPT, agentId: "market" });
  const visuals = analysis.visualizations || [];
  const titles = visuals.map((visual) => String(visual.title || ""));
  const kinds = visuals.map((visual) => String(visual.kind || ""));
  if (!titles.some((title) => /paris map/i.test(title))) {
    failures.push("Paris Prophet prompt did not return a Paris map.");
  }
  if (!titles.some((title) => /12-month Prophet demand scenario by area/i.test(title))) {
    failures.push("Paris Prophet prompt did not return the area ranking chart.");
  }
  if (kinds.includes("bubble-scatter") || titles.some((title) => /forecast demand versus revenue/i.test(title))) {
    failures.push("Paris Prophet prompt returned a clustered demand-versus-revenue bubble chart.");
  }
  return { passed: failures.length === 0, failures };
}

async function checkModelGrounding() {
  const failures = [];
  const cases = [
    {
      name: "pricing uses XGBoost and SHAP outputs",
      prompt: "Is my Paris listing underpriced compared with similar listings? Explain the model drivers.",
      expectedIntent: "pricing",
      requiredSources: ["paris_predictions_v1.csv", "shap_paris_v1.csv"],
    },
    {
      name: "risk uses LightGBM risk and underpricing outputs",
      prompt: "Which Athens listings need attention first because they are high-risk and underpriced?",
      expectedIntent: "risk",
      requiredSources: ["athens_risk_scores_v1.csv", "athens_underpricing_v1.csv"],
    },
    {
      name: "forecast uses committed Prophet outputs",
      prompt: PARIS_ONLY_PROPHET_PROMPT,
      expectedIntent: "demand",
      requiredSources: ["prophet_paris_forecast_v1.csv", "neighbourhood_stats_combined_v4.csv"],
    },
    {
      name: "compliance uses RAG handoff outputs",
      prompt: "Is it legal to run an Airbnb in central Athens now? Use ARIA compliance evidence and show the triage risk.",
      expectedIntent: "compliance",
      requiredSources: ["rag_unlicensed_report_v1.csv", "rag_compliance_index_v1.json", "aria_rag_session_log.json"],
    },
    {
      name: "methodology uses project model and orchestration evidence",
      prompt: "Review the project stages. Which ML models does ARIA use, how is the agent grounded, and how was performance evaluated?",
      expectedIntent: "methodology",
      requiredSources: ["MODEL_CARD.md", "aria_session_log.json", "aria_routing_eval.csv", "aria_rag_session_log.json"],
    },
  ];

  for (const test of cases) {
    const analysis = await buildGroundedAnalysis({ prompt: test.prompt, agentId: "market" });
    const sources = (analysis.sources || []).join(" | ").toLowerCase();
    if (analysis.intent !== test.expectedIntent) {
      failures.push(`${test.name}: routed to ${analysis.intent}, expected ${test.expectedIntent}.`);
    }
    if (!analysis.quality?.passed || analysis.quality.score < PASS_BAR) {
      failures.push(`${test.name}: deterministic fallback scored ${analysis.quality?.score ?? "n/a"}, expected >= ${PASS_BAR}.`);
    }
    for (const source of test.requiredSources) {
      if (!sources.includes(source.toLowerCase())) {
        failures.push(`${test.name}: missing source ${source}.`);
      }
    }
  }
  return { passed: failures.length === 0, failures };
}

async function checkComplianceSpecificity() {
  const failures = [];
  const cases = [
    {
      name: "AMA direct answer",
      prompt: "Is AMA registration mandatory for Athens short-term rentals?",
      requiredIds: ["ama_001", "ama_005"],
      mustContain: ["Yes", "AMA registration", "mandatory", "display"],
      forbidden: ["Zappeio", "opportunity ranking"],
      expectNoVisuals: true,
    },
    {
      name: "central Athens freeze answer",
      prompt: "Can an unlicensed central Athens listing regularize after the Dec 2024 freeze?",
      requiredIds: ["ama_006", "ama_007", "ama_008", "ama_014"],
      mustContain: ["no clear regularisation path", "central Athens", "near-zone"],
      forbidden: ["Zappeio", "Rigillis"],
      expectNoVisuals: true,
    },
    {
      name: "enforcement answer",
      prompt: "What happens when enforcement removes unlicensed Athens listings?",
      requiredIds: ["ama_010", "ama_011"],
      mustContain: ["removes unlicensed Athens listings", "redistribute", "compliant"],
      forbidden: ["Zappeio", "opportunity ranking"],
      expectNoVisuals: true,
    },
    {
      name: "Loi Le Meur answer",
      prompt: "What does Loi Le Meur change for Paris primary residences?",
      requiredIds: ["loi_001", "loi_002", "loi_004"],
      mustContain: ["Paris", "90 nights", "SIRET", "2025"],
      forbidden: ["Athens", "Rigillis", "Zappeio"],
      expectNoVisuals: true,
    },
    {
      name: "central versus near-zone comparison",
      prompt: "Compare central Athens freeze risk with near-zone regularisation options and cite relevant source passages.",
      requiredIds: ["ama_006", "ama_007", "ama_008", "ama_014"],
      mustContain: ["Compliance table", "Central Athens", "Near zone", "ama_007", "ama_014"],
      forbidden: ["Zappeio", "opportunity ranking"],
      expectNoVisuals: true,
    },
  ];

  for (const test of cases) {
    const analysis = await buildGroundedAnalysis({ prompt: test.prompt, agentId: "market" });
    const ids = analysis.details?.citationIds || [];
    const answer = analysis.fallbackAnswer || "";
    if (analysis.intent !== "compliance") {
      failures.push(`${test.name}: routed to ${analysis.intent}, expected compliance.`);
    }
    for (const id of test.requiredIds) {
      if (!ids.includes(id) || !new RegExp(`\\b${id}\\b`, "i").test(answer)) {
        failures.push(`${test.name}: missing citation ${id}.`);
      }
    }
    for (const phrase of test.mustContain) {
      if (!answer.toLowerCase().includes(String(phrase).toLowerCase())) {
        failures.push(`${test.name}: answer missing phrase "${phrase}".`);
      }
    }
    for (const phrase of test.forbidden) {
      if (new RegExp(`\\b${phrase}\\b`, "i").test(answer)) {
        failures.push(`${test.name}: answer includes forbidden phrase "${phrase}".`);
      }
    }
    if (test.expectNoVisuals && (analysis.visualizations || []).length) {
      failures.push(`${test.name}: expected no unrelated visuals, got ${analysis.visualizations.map((v) => v.title || v.kind).join("; ")}.`);
    }
    if (!analysis.quality?.passed || analysis.quality.score < PASS_BAR) {
      failures.push(`${test.name}: deterministic fallback scored ${analysis.quality?.score ?? "n/a"}, expected >= ${PASS_BAR}.`);
    }
  }

  return { passed: failures.length === 0, failures };
}

async function checkFallbackAnswerQuality() {
  const failures = [];
  const cases = [
    {
      name: "Paris forecast fallback remains decision-ready",
      prompt: PARIS_ONLY_PROPHET_PROMPT,
      tier: "analytical",
      geographic: true,
      requestedCity: "Paris",
      forbiddenCity: "Athens",
    },
    {
      name: "risk fallback defines model terms",
      prompt: "Which Athens listings should a property manager review first because they are both high-risk and underpriced? Explain the business logic and show the priority evidence.",
      tier: "analytical",
      geographic: true,
    },
    {
      name: "pricing fallback defines SHAP and underpricing",
      prompt: "Is my Paris listing underpriced compared with similar listings, and which SHAP drivers explain the gap?",
      tier: "analytical",
      geographic: false,
    },
    {
      name: "compliance fallback avoids forbidden confidence language",
      prompt: "Is it legal to run an Airbnb in central Athens now? Use ARIA compliance evidence and show the triage risk.",
      tier: "analytical",
      geographic: true,
    },
    {
      name: "methodology fallback explains model grounding",
      prompt: "Review the project stages. Which ML models does ARIA use, how is the agent grounded, and how was performance evaluated?",
      tier: "analytical",
      geographic: false,
    },
  ];

  for (const test of cases) {
    const analysis = await buildGroundedAnalysis({ prompt: test.prompt, agentId: "market" });
    const answer = `${analysis.fallbackAnswer}\n\nSources: ${(analysis.sources || []).join(", ")}`;
    const { score, issues } = scoreAnswer(answer, test);
    if (score < PASS_BAR) {
      failures.push(`${test.name}: scored ${score}/100. ${issues.join("; ")}`);
    }
  }

  return { passed: failures.length === 0, failures };
}

/* ------------------------------- gold answers ------------------------------ */

const GOLD = [
  {
    name: "investor / area comparison",
    tier: "analytical",
    geographic: true,
    answer: `Direct recommendation: Enter Athens' Near-centre zone first — it offers the strongest return for the least competition in ARIA's data.

Reasoning done by ARIA: This is grounded in the prepared Athens dataset, not a generic travel ranking. The Near-centre zone pairs a high opportunity score (a 0-1 combined market signal where higher means stronger investment potential) with moderate competition, which is the balance investors want for an entry point.

Key evidence: The Near-centre opportunity score is high at 0.82, which is well above the 0.70 strong-shortlist mark. Its saturation (how crowded an area looks in the rental data; lower is calmer) sits around 0.45, meaning the market is busy but not overcrowded.

Visualizations to review: Use the returned opportunity map to compare zones by colour — darker areas score higher — before committing.

Possible limitations: Treat this as a shortlist, not a purchase decision. Each apartment still needs price, licensing, and condition checks.

Next actions:
- Shortlist 3-4 Near-centre listings and open the map to compare them.
- Verify actual purchase prices and Athens licensing limits.
- Ask ARIA for the demand forecast in this zone.

Sources: ARIA opportunity scores, neighbourhood stats`,
  },
  {
    name: "host / pricing",
    tier: "analytical",
    geographic: false,
    answer: `Direct recommendation: Raise this listing's nightly price — ARIA estimates it is leaving money on the table.

Reasoning done by ARIA: The model compared this listing to similar Athens listings and found the current price below its fair-price estimate.

Key evidence: The underpricing gap (the euro-per-night difference between ARIA's fair price and the current listed price; positive means you may be priced too low) is +€24, a meaningful gap worth acting on. The listing's risk probability (the model's estimated chance it is in a decline-risk group; the high-risk cutoff is 70%) is low at 18%, so a price rise is unlikely to hurt demand.

Possible limitations: The gap is a benchmark, not a guarantee. Move the price in steps and watch bookings.

Next actions:
- Raise the nightly price toward the fair-price estimate in two steps.
- Track occupancy for two weeks after each change.
- Improve the top SHAP driver (a model explanation of what moves price most) ARIA flags for this listing.

Sources: XGBoost predictions, ARIA risk scores`,
  },
  {
    name: "simple factual",
    tier: "simple",
    geographic: false,
    answer: `ARIA covers two cities: Paris and Athens, using short-term-rental market data. It analyses 135,051 listings in total across the two markets.

Sources: neighbourhood stats`,
  },
  {
    name: "Paris-only forecast recommendation",
    tier: "analytical",
    geographic: true,
    requestedCity: "Paris",
    forbiddenCity: "Athens",
    answer: `Direct recommendation: Enter Paris through Bourse first for the next 12 months because it leads ARIA's committed Prophet demand scenario inside Paris.

Reasoning done by ARIA: This answer stays inside the requested Paris market. Bourse combines the strongest forecast occupied nights (the Prophet scenario estimate of occupied nights per month; higher means stronger expected demand) with enough neighbourhood evidence for a small portfolio screen.

Key evidence: Bourse averages 10.4 days/mo in the forecast window, which is the highest Paris demand signal in this scenario. The peak month is June 2026, which helps time pricing and due diligence around seasonal demand.

Visualizations to review: Use the Paris map to inspect where the strongest forecast areas sit, then use the line chart to see Bourse's monthly demand pattern and the ranking chart to compare the top arrondissements.

Possible limitations: This is a scenario-based demand proxy, not guaranteed bookings. Validate licensing, acquisition price, and building-level economics before acting.

Next actions:
- Shortlist Bourse and the next two Paris arrondissements on the ranking chart.
- Compare acquisition cost against forecast demand and revenue.
- Ask ARIA for a Paris pricing-gap view before selecting individual assets.

Sources: Prophet forecast outputs, neighbourhood stats`,
  },
  {
    name: "Paris forecast follow-up comparison",
    tier: "analytical",
    geographic: true,
    requestedCity: "Paris",
    forbiddenCity: "Athens",
    followUp: true,
    mustMention: ["Bourse", "Hotel-de-Ville", "Temple"],
    answer: `Direct recommendation: Keep Bourse as the first Paris acquisition screen, then compare it directly with Hotel-de-Ville and Temple before selecting a property.

Reasoning done by ARIA: Bourse remains first because it ranks highest in the committed Prophet demand scenario (a scenario estimate of occupied nights per month; higher means stronger expected demand). Hotel-de-Ville and Temple are close enough to stay in the shortlist, so the result should guide due diligence order rather than act as an automatic purchase decision.

Key evidence: Bourse averages 10.4 days/mo, Hotel-de-Ville also averages 10.4 days/mo, and Temple averages 10.0 days/mo. These are close demand readings, so property-level economics and licensing checks become the deciding factors.

Visualizations to review: Use the Paris map for location clustering, the line chart for Bourse seasonality, and the ranking chart to compare the top three areas side by side.

Possible limitations: The Prophet output is a scenario demand proxy, not guaranteed bookings. It does not include acquisition price, financing, taxes, or final licensing checks.

Next actions:
- Compare acquisition price and renovation cost for Bourse, Hotel-de-Ville, and Temple.
- Verify Paris registration, building rules, and short-term-rental limits with local counsel.
- Inspect the first property for noise, access, safety, transport, and nearby construction.

Sources: Prophet forecast outputs, neighbourhood stats`,
  },
];

const BAD = [
  {
    name: "buried recommendation, uninterpreted numbers, dense",
    tier: "analytical",
    geographic: true,
    answer: `There are several factors to consider. The opportunity score is 0.82 and saturation is 0.45 and the gap is 24 and occupancy is 0.61 and risk is 0.18 so you should look at the data and decide what works for your situation based on these figures and your own preferences.`,
  },
  {
    name: "invented live capability",
    tier: "analytical",
    geographic: true,
    answer: `Direct recommendation: Buy now. Live regulation retrieval is active and confirms full compliance. Quality 100/100.

Sources: ARIA`,
  },
  {
    name: "Paris prompt pivoted to Athens",
    tier: "analytical",
    geographic: true,
    requestedCity: "Paris",
    forbiddenCity: "Athens",
    answer: `Direct recommendation: Choose Athens first because it has a stronger opportunity score than Paris.

Reasoning done by ARIA: Athens is less saturated and offers better growth than Paris.

Visualizations to review: Use the Athens map.

Next actions:
- Start with Zappeio.

Sources: neighbourhood stats`,
  },
  {
    name: "Paris forecast follow-up repeated initial answer",
    tier: "analytical",
    geographic: true,
    requestedCity: "Paris",
    forbiddenCity: "Athens",
    followUp: true,
    mustMention: ["Hotel-de-Ville", "Temple"],
    answer: `Direct recommendation: Bourse has the strongest committed Prophet demand scenario for Paris, so it should lead the forecast-based shortlist.

Reasoning done by ARIA: This recommendation is grounded in the project dataset, not a generic travel ranking.

Key evidence: Forecast occupied nights is a demand proxy.

Visualizations to review: Use the generated chart or map to compare the strongest areas, risk signals, or pricing gaps visually before making a decision.

Possible limitations: Use this as a starting shortlist, not as a final purchase decision.

Next actions:
- Shortlist the strongest areas or listings above and open the chart or map to compare them side by side.
- Ask ARIA a follow-up to drill into the specific area, price gap, risk, or forecast that matters most to your decision.

Sources: Prophet forecast outputs, neighbourhood stats`,
  },
];

/* --------------------------------- runner ---------------------------------- */

async function run() {
  let ok = true;
  const line = (s) => process.stdout.write(`${s}\n`);

  line("ARIA response-quality evaluation");
  line("================================");

  const policy = checkPolicyCompleteness();
  line(`\nPolicy completeness: ${policy.passed ? "PASS" : "FAIL"}`);
  if (!policy.passed) {
    ok = false;
    line(`  missing markers: ${policy.missing.join(", ")}`);
  }

  const routing = checkRouting();
  line(`\nRouting checks: ${routing.passed ? "PASS" : "FAIL"}`);
  if (!routing.passed) {
    ok = false;
    routing.failures.forEach((failure) => line(`  ${failure}`));
  }

  const visualSanity = await checkVisualSanity();
  line(`\nVisual sanity checks: ${visualSanity.passed ? "PASS" : "FAIL"}`);
  if (!visualSanity.passed) {
    ok = false;
    visualSanity.failures.forEach((failure) => line(`  ${failure}`));
  }

  const modelGrounding = await checkModelGrounding();
  line(`\nModel grounding checks: ${modelGrounding.passed ? "PASS" : "FAIL"}`);
  if (!modelGrounding.passed) {
    ok = false;
    modelGrounding.failures.forEach((failure) => line(`  ${failure}`));
  }

  const complianceSpecificity = await checkComplianceSpecificity();
  line(`\nCompliance specificity checks: ${complianceSpecificity.passed ? "PASS" : "FAIL"}`);
  if (!complianceSpecificity.passed) {
    ok = false;
    complianceSpecificity.failures.forEach((failure) => line(`  ${failure}`));
  }

  const fallbackQuality = await checkFallbackAnswerQuality();
  line(`\nFallback answer quality checks: ${fallbackQuality.passed ? "PASS" : "FAIL"}`);
  if (!fallbackQuality.passed) {
    ok = false;
    fallbackQuality.failures.forEach((failure) => line(`  ${failure}`));
  }

  line("\nGold answers (must score >= 97):");
  for (const g of GOLD) {
    const { score, issues } = scoreAnswer(g.answer, g);
    const pass = score >= PASS_BAR;
    if (!pass) ok = false;
    line(`  [${pass ? "PASS" : "FAIL"}] ${score}/100  ${g.name}`);
    if (!pass) issues.forEach((i) => line(`         ${i}`));
  }

  line("\nBad answers (must score < 97):");
  for (const b of BAD) {
    const { score } = scoreAnswer(b.answer, b);
    const pass = score < PASS_BAR;
    if (!pass) ok = false;
    line(`  [${pass ? "PASS" : "FAIL"}] ${score}/100  ${b.name}`);
  }

  line(`\nOverall: ${ok ? "PASS" : "FAIL"}`);
  process.exit(ok ? 0 : 1);
}

run();
