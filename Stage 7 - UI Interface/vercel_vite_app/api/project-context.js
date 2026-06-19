const DATASET_FACTS = {
  totalListings: "135,051",
  totalColumns: "96",
  parisListings: "120,809",
  athensListings: "14,242",
  underpricedAthens: "2,945",
  highRiskAthens: "4,695",
  priorityOverlap: "865",
  athensPricingR2: "0.676",
  parisPricingR2: "0.588",
  athensPricingMae: "29.1 euro",
  riskAuc: "0.8288",
};

const COMMON_CONTEXT = `
Project: ARIA (Agentic Real-estate Intelligence Advisor), IE Business School x KPMG Spain Corporate Capstone 2026.
Dataset: ${DATASET_FACTS.totalListings} listings x ${DATASET_FACTS.totalColumns} columns.
Paris: ${DATASET_FACTS.parisListings} listings. Athens: ${DATASET_FACTS.athensListings} listings.
Models: XGBoost pricing models for Paris and Athens; LightGBM host/listing risk model for Athens; Prophet scenario forecasts for Paris and Athens; SHAP explanations; committed RAG compliance handoff outputs.
Important limitation: the project is short-term-rental and Airbnb-style market intelligence. It is not a full residential property transaction database.
Current validated Athens outputs: ${DATASET_FACTS.underpricedAthens} underpriced listings, ${DATASET_FACTS.highRiskAthens} high-risk listings, ${DATASET_FACTS.priorityOverlap} listings that are both underpriced and high-risk.
Model quality: Athens XGBoost R squared ${DATASET_FACTS.athensPricingR2}, Paris XGBoost R squared ${DATASET_FACTS.parisPricingR2}, Athens price mean absolute error ${DATASET_FACTS.athensPricingMae}, LightGBM risk Area Under Receiver Operating Characteristic Curve ${DATASET_FACTS.riskAuc}.
`;

const CONTEXTS = {
  market: {
    intent: "market-entry and investment recommendation",
    sources: [
      "data/outputs/paris_predictions_v1.csv",
      "data/outputs/athens_predictions_v1.csv",
      "eda/ARIA_XGBoost_v1.ipynb",
      "docs/MENTOR_DEFENSE_QA.md",
    ],
    kpis: [
      { label: "Paris listings", value: DATASET_FACTS.parisListings },
      { label: "Best Paris signal", value: "19th arrondissement" },
      { label: "Runner-up", value: "20th arrondissement" },
      { label: "Secondary", value: "11th arrondissement" },
    ],
    context: `
Market-entry context:
- For Paris short-term-rental entry, the scripted project analysis identifies the 19th arrondissement (+0.41 supply-demand gap index) and 20th arrondissement (+0.37) as the strongest supply-constrained zones.
- The 11th arrondissement (+0.22) is a secondary opportunity.
- The 1st to 4th arrondissements are more saturated and regulation-constrained, so they are less attractive for new short-term-rental entry.
- If the user asks about buying a house in Paris, frame the answer as an investment / short-term-rental market-entry recommendation, not as personal mortgage or residential transaction advice.
- Recommend the 19th first, then the 20th, with the 11th as a balanced secondary option.
`,
  },
  pricing: {
    intent: "host revenue and underpricing analysis",
    sources: [
      "data/outputs/athens_underpricing_v1.csv",
      "data/outputs/shap_athens_v1.csv",
      "eda/ARIA_XGBoost_v1.ipynb",
    ],
    kpis: [
      { label: "Underpriced Athens listings", value: DATASET_FACTS.underpricedAthens },
      { label: "Athens pricing R squared", value: DATASET_FACTS.athensPricingR2 },
      { label: "Mean absolute error", value: DATASET_FACTS.athensPricingMae },
      { label: "Threshold", value: ">15 euro gap" },
    ],
    context: `
Pricing context:
- The XGBoost pricing model estimates fair nightly price from capacity, bedrooms, room type, amenities, distance to centre, host profile, reviews, availability, and neighbourhood median price.
- The Athens model is the stronger current-market pricing proof because it uses September 2025 observed prices.
- Underpricing is flagged when predicted fair price exceeds actual listed price by more than 15 euro.
- Because Athens mean absolute error is about 29.1 euro, small gaps should be treated cautiously; larger gaps above 25 to 40 euro are stronger signals.
- SHAP explanations are used to explain whether local market price, capacity, distance, reviews, or host factors drove the recommendation.
`,
  },
  risk: {
    intent: "host and listing risk prioritisation",
    sources: [
      "data/outputs/athens_risk_scores_v1.csv",
      "data/outputs/shap_athens_v1.csv",
      "eda/ARIA_LightGBM_v1.ipynb",
    ],
    kpis: [
      { label: "High-risk Athens listings", value: DATASET_FACTS.highRiskAthens },
      { label: "Priority overlap", value: DATASET_FACTS.priorityOverlap },
      { label: "Risk AUC", value: DATASET_FACTS.riskAuc },
      { label: "High-risk threshold", value: "0.70" },
    ],
    context: `
Risk context:
- The LightGBM model estimates listing or host risk in Athens.
- The risk label is a transparent proxy based on observable warning signs: low recent review velocity, high availability, negative review growth, weak review score, short host tenure, and non-superhost status.
- High risk is defined as a risk probability above 0.70.
- The most useful business segment is the overlap of underpriced and high-risk listings: ${DATASET_FACTS.priorityOverlap} listings. These are candidates for host coaching or intervention because pricing upside and vulnerability exist together.
- The model originally showed leakage; leakage-prone availability fields were removed, producing a more honest Area Under Receiver Operating Characteristic Curve of ${DATASET_FACTS.riskAuc}.
`,
  },
  compliance: {
    intent: "compliance and regulation triage",
    sources: [
      "data/outputs/rag_unlicensed_report_v1.csv",
      "data/outputs/rag_compliance_index_v1.json",
      "data/outputs/aria_rag_session_log.json",
    ],
    kpis: [
      { label: "Unlicensed Athens listings", value: "137" },
      { label: "High-risk unlicensed", value: "27" },
      { label: "Regularisable", value: "110" },
      { label: "Dataset rows", value: DATASET_FACTS.totalListings },
    ],
    context: `
Compliance context:
- The committed RAG handoff identifies 137 unlicensed Athens listings, including 27 high-risk, 89 medium-risk, and 21 low-risk cases.
- The Vercel backend can use these committed CSV/JSON handoff outputs for analyst triage.
- It does not perform live ChromaDB retrieval at request time, so final legal interpretation still requires local counsel.
`,
  },
  demand: {
    intent: "tourism demand and occupancy forecasting",
    sources: [
      "data/outputs/prophet_paris_forecast_v1.csv",
      "data/outputs/prophet_athens_forecast_v1.csv",
      "eda/ARIA_Prophet_v2.ipynb",
    ],
    kpis: [
      { label: "Committed model", value: "Prophet" },
      { label: "Forecast window", value: "12 months" },
      { label: "Cities", value: "Paris + Athens" },
      { label: "Dataset rows", value: DATASET_FACTS.totalListings },
    ],
    context: `
Demand context:
- Prophet scenario forecast CSVs are committed for Paris and Athens and consumed by the live Vercel demand agent for forecast prompts.
- The forecasts estimate monthly occupied-night demand by neighbourhood across a 12-month window.
- Present them as scenario-based demand proxies, not guaranteed booking-calendar forecasts.
`,
  },
};

function chooseContext(prompt, agentId) {
  const p = `${prompt} ${agentId}`.toLowerCase();
  if (/(buy|invest|entry|enter|region|arrondissement|neighbourhood|neighborhood|yield|house|property)/.test(p)) return CONTEXTS.market;
  if (/(price|priced|underpriced|revenue|gap|nightly|earning|income)/.test(p)) return CONTEXTS.pricing;
  if (/(risk|declin|host|vulnerab|churn|warning|priority)/.test(p)) return CONTEXTS.risk;
  if (/(license|licence|legal|law|regulation|compliance|permit)/.test(p)) return CONTEXTS.compliance;
  if (/(forecast|occupancy|tourism|demand|season|90 day|future)/.test(p)) return CONTEXTS.demand;
  return CONTEXTS.market;
}

export function buildGroundingContext({ prompt, agentId }) {
  const selected = chooseContext(prompt, agentId);
  return {
    ...selected,
    datasetFacts: DATASET_FACTS,
    contextText: `${COMMON_CONTEXT}\n${selected.context}`,
  };
}
