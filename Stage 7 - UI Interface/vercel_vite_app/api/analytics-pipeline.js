const DEFAULT_REPO = {
  owner: "lukatcheishvili",
  name: "capstone_project_kpmg",
  branch: "main",
};

const RAW_BASE = process.env.ARIA_GITHUB_RAW_BASE
  || `https://raw.githubusercontent.com/${process.env.ARIA_GITHUB_OWNER || DEFAULT_REPO.owner}/${process.env.ARIA_GITHUB_REPO || DEFAULT_REPO.name}/${process.env.ARIA_GITHUB_BRANCH || DEFAULT_REPO.branch}/`;

const CACHE_TTL_MS = Number(process.env.ARIA_DATA_CACHE_TTL_MS || 20 * 60 * 1000);

const FILES = {
  neighbourhoodStats: "data/processed/neighbourhood_stats_combined_v4.csv",
  athensUnderpricing: "data/outputs/athens_underpricing_v1.csv",
  athensRisk: "data/outputs/athens_risk_scores_v1.csv",
  shapAthens: "data/outputs/shap_athens_v1.csv",
  shapParis: "data/outputs/shap_paris_v1.csv",
  parisPredictions: "data/outputs/paris_predictions_v1.csv",
  prophetParisForecast: "data/outputs/prophet_paris_forecast_v1.csv",
  prophetAthensForecast: "data/outputs/prophet_athens_forecast_v1.csv",
  ragUnlicensedReport: "data/outputs/rag_unlicensed_report_v1.csv",
  ragComplianceIndex: "data/outputs/rag_compliance_index_v1.json",
  ragSessionLog: "data/outputs/aria_rag_session_log.json",
  langGraphSessionLog: "data/outputs/aria_session_log.json",
  langGraphRoutingEval: "data/outputs/aria_routing_eval.csv",
};

const analysisCache = new Map();

function now() {
  return Date.now();
}

function cached(key, loader) {
  const hit = analysisCache.get(key);
  if (hit && now() - hit.at < CACHE_TTL_MS) return hit.value;
  const value = Promise.resolve(loader()).then((data) => {
    analysisCache.set(key, { at: now(), value: Promise.resolve(data) });
    return data;
  });
  analysisCache.set(key, { at: now(), value });
  return value;
}

function rawUrl(path) {
  const base = RAW_BASE.endsWith("/") ? RAW_BASE : `${RAW_BASE}/`;
  return `${base}${path.split("/").map(encodeURIComponent).join("/")}`;
}

async function fetchCsv(path) {
  const headers = { Accept: "text/plain" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(rawUrl(path), { headers });
  if (!res.ok) {
    throw new Error(`Could not load ${path} from GitHub (${res.status}).`);
  }
  return res.text();
}

async function fetchJson(path) {
  const text = await fetchCsv(path);
  return JSON.parse(text);
}

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "\"") {
      if (quoted && line[i + 1] === "\"") {
        cur += "\"";
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === "," && !quoted) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function eachCsvRow(text, onRow) {
  const lines = text.split(/\r?\n/);
  const headerLine = lines.shift();
  if (!headerLine) return;
  const headers = parseCsvLine(headerLine);
  for (const line of lines) {
    if (!line.trim()) continue;
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });
    onRow(row);
  }
}

function num(value, fallback = 0) {
  if (value == null || value === "") return fallback;
  const n = Number(String(value).replace(/[€,%]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

function truthy(value) {
  return ["1", "true", "yes", "y"].includes(String(value).trim().toLowerCase());
}

function fmtInt(value) {
  return Math.round(num(value)).toLocaleString("en-US");
}

function fmtEuro(value) {
  const rounded = Math.round(num(value));
  const prefix = rounded < 0 ? "-€" : "€";
  return `${prefix}${Math.abs(rounded).toLocaleString("en-US")}`;
}

function fmtPct(value, digits = 1) {
  return `${num(value).toFixed(digits)}%`;
}

function fmtScore(value, digits = 2) {
  return num(value).toFixed(digits);
}

function fmtDays(value, digits = 1) {
  return `${num(value).toFixed(digits)} days/mo`;
}

const METRIC_GUIDES = {
  opportunity: {
    label: "Opportunity score",
    meaning: "A 0 to 1 shortlist score that combines rental-market upside with pressure signals.",
    range: "Lowest is 0.00, highest is 1.00.",
    good: "Higher is better for investment screening; above 0.70 is a strong shortlist signal, while below 0.30 is weak.",
    optimal: "A good choice has a high opportunity score without extreme saturation or unusually thin listing evidence.",
  },
  saturation: {
    label: "Saturation score",
    meaning: "A 0 to 1 signal for how crowded or competitive the short-term-rental area looks.",
    range: "Lowest is 0.00, highest is 1.00.",
    good: "Lower is better for a calmer place to live or a less crowded entry point; below 0.30 is calmer, above 0.60 is crowded.",
    optimal: "The optimal range depends on the goal: investors can accept moderate saturation if revenue is strong, but family/living prompts prefer lower saturation.",
  },
  medianNightlyPrice: {
    label: "Median nightly price",
    meaning: "The middle nightly rental price in the area, in euros, not the home purchase price.",
    range: "There is no fixed universal maximum; compare it against nearby areas in the same city.",
    good: "Lower is better for affordability; higher can be good for revenue only if demand stays strong.",
    optimal: "The best choice balances a fair price with enough occupancy and revenue potential.",
  },
  averageRevenue: {
    label: "Average revenue",
    meaning: "The average rental revenue signal in the prepared project data.",
    range: "Higher values generally indicate stronger short-term-rental earning potential.",
    good: "Higher is better for hosts and investors, but it should be checked against saturation, risk, and local rules.",
    optimal: "A good choice has strong revenue together with sustainable demand and manageable competition.",
  },
  occupancy: {
    label: "Occupancy",
    meaning: "The share of available nights that appear booked or used in the rental data.",
    range: "Lowest is 0%, highest is 100%.",
    good: "Higher usually means stronger demand; very low occupancy suggests weak demand, while extremely high occupancy can also mean constrained supply.",
    optimal: "For screening, roughly 60% to 80% is usually a healthy demand signal before checking price and seasonality.",
  },
  forecastOccupiedNights: {
    label: "Forecast occupied nights",
    meaning: "The Prophet scenario estimate of occupied nights per month for an area.",
    range: "Higher values indicate stronger expected demand in the 12-month forecast window.",
    good: "Higher is better for demand screening, but this is a scenario-based demand proxy rather than a guarantee of future bookings.",
    optimal: "Use it with revenue, saturation, risk, and local rules before choosing an area.",
  },
  listings: {
    label: "Listings reviewed",
    meaning: "The number of listings included in the calculation.",
    range: "Higher counts provide a more stable market signal; very small counts are less reliable.",
    good: "More observations are generally better for confidence, but many listings can also mean more competition.",
    optimal: "Use high-count areas for reliable benchmarking, then compare competition and revenue before deciding.",
  },
  underpricingGap: {
    label: "Underpricing gap",
    meaning: "The estimated euro-per-night difference between the model's fair price and the current listed price.",
    range: "Positive means the listing may be underpriced; negative means it may already be high versus the model.",
    good: "A larger positive gap is useful for host revenue action, but very large gaps should be checked manually.",
    optimal: "A good action is a positive gap that is large enough to matter and still reasonable for the neighbourhood.",
  },
  predictedPrice: {
    label: "Predicted fair price",
    meaning: "The model's estimated fair nightly price for a listing or area.",
    range: "It is an estimate, not a guaranteed achievable price.",
    good: "It is useful when compared with the current price; the difference matters more than the estimate alone.",
    optimal: "Use it as a pricing benchmark, then check demand, reviews, amenities, and seasonality.",
  },
  shapImpact: {
    label: "SHAP value",
    meaning: "A model explanation showing which variables moved the pricing model most.",
    range: "Higher impact means the feature mattered more to the model's price estimate.",
    good: "Good drivers are interpretable and business-relevant, such as neighbourhood price level or distance zone.",
    optimal: "Use driver impact to explain why the model made a recommendation, not as a standalone decision score.",
  },
  highRiskShare: {
    label: "High-risk share",
    meaning: "The percentage of listings in an area above the model's high-risk threshold.",
    range: "Lowest is 0%, highest is 100%.",
    good: "Lower is safer; higher means the area needs closer review before action.",
    optimal: "For risk avoidance, lower is better. For intervention planning, higher helps identify where to act first.",
  },
  riskProbability: {
    label: "Risk probability",
    meaning: "The model probability that a listing belongs to the high-risk group.",
    range: "Lowest is 0%, highest is 100%; the current high-risk cutoff is 70%.",
    good: "Lower is better for safety; above 70% should be treated as a review flag.",
    optimal: "Use it to prioritize analyst review, not as a final judgement about a host or neighbourhood.",
  },
  priorityOverlap: {
    label: "Priority overlap",
    meaning: "Listings that are both high-risk and underpriced.",
    range: "Higher counts mean more listings need attention in that action queue.",
    good: "For operations, higher is more urgent; for an individual investor, lower risk exposure is better.",
    optimal: "Use this to decide where host coaching or manual review should start.",
  },
  threshold: {
    label: "Threshold",
    meaning: "The cutoff used to convert a model probability into a high-risk flag.",
    range: "In this project, 70% means a listing is flagged high risk.",
    good: "Higher probabilities above the threshold need more attention.",
    optimal: "The threshold is a triage setting: strict enough to focus review, but not a final decision by itself.",
  },
  complianceRisk: {
    label: "Compliance risk level",
    meaning: "A RAG handoff triage category for unlicensed Athens listings based on regulatory exposure and regularisation path.",
    range: "LOW, MEDIUM, or HIGH; HIGH is the most urgent analyst-review category.",
    good: "Lower is safer for acquisition; higher can signal enforcement risk or demand redistribution opportunity around compliant neighbours.",
    optimal: "Use it to prioritise legal review and acquisition due diligence, not as final legal advice.",
  },
  regularisable: {
    label: "Regularisable listing",
    meaning: "Whether the RAG handoff says an unlicensed Athens listing may still have a path to AMA registration.",
    range: "True means a potential path exists; false means the output flags no apparent path under the documented freeze logic.",
    good: "Regularisable listings are easier to review; non-regularisable central listings should be treated as high legal risk.",
    optimal: "Confirm the path with local counsel and building-permit checks before acting.",
  },
  ragSimilarity: {
    label: "RAG similarity score",
    meaning: "How closely the selected compliance document matched the listing's compliance context in the notebook handoff.",
    range: "Higher means a closer retrieval match, but it is not a legal certainty measure.",
    good: "Higher is useful for triage evidence, but every compliance conclusion still needs human legal review.",
    optimal: "Use it to identify the most relevant citation, not to automate a legal decision.",
  },
  readiness: {
    label: "Readiness score",
    meaning: "A demo-readiness percentage for whether a workflow layer is usable now.",
    range: "Lowest is 0%, highest is 100%.",
    good: "Higher means more ready; lower means planned or incomplete.",
    optimal: "Use high-readiness layers for demo decisions and treat low-readiness layers as roadmap items.",
  },
};

function metricGuides(keys) {
  return [...new Set(keys)].map((key) => METRIC_GUIDES[key]).filter(Boolean);
}

function kpiHelpFor(label) {
  const l = String(label || "").toLowerCase();
  if (l.includes("citation")) return "Source IDs used for this compliance answer.";
  if (l.includes("ama status")) return "Registration requirement status from the RAG compliance corpus.";
  if (l.includes("display rule")) return "Whether the AMA number must be visible on platform listings.";
  if (l.includes("central path")) return "Whether a central Athens unlicensed listing can still obtain a new AMA registration.";
  if (l.includes("near-zone path")) return "Whether listings outside the freeze zone may still apply after document checks.";
  if (l.includes("mechanism")) return "How the compliance rule is enforced in the RAG handoff.";
  if (l.includes("demand effect")) return "Expected booking-demand movement after non-compliant supply is removed.";
  if (l.includes("primary cap")) return "Short-term-rental night limit for Paris primary residences.";
  if (l === "registration" || l.includes("siret")) return "Registration requirement highlighted by the Paris compliance corpus.";
  if (l.includes("avg gap")) return "Average euro-per-night difference between model fair price and current listed price.";
  if (l.includes("opportunity")) return "0-1 score. Higher is better; above 0.70 is a strong shortlist signal.";
  if (l.includes("saturation")) return "0-1 crowding score. Lower is calmer; above 0.60 means a more crowded market.";
  if (l.includes("median nightly") || l.includes("price")) return "Euro nightly rental price, not purchase price. Lower helps affordability; higher needs strong demand.";
  if (l.includes("revenue")) return "Rental revenue signal. Higher is better only if demand, risk, and saturation are acceptable.";
  if (l.includes("forecast") || l.includes("occupied nights")) return "Prophet scenario estimate of occupied nights per month. Higher means stronger expected demand, but it is not a guaranteed booking forecast.";
  if (l.includes("peak month")) return "Month with the highest forecast demand in the 12-month scenario window.";
  if (l.includes("occupancy") || l.includes("demand")) return "Booked-night share. Higher usually means stronger demand; around 60-80% is a healthy screen.";
  if (l.includes("listing")) return "Number of listings behind the calculation. More data improves confidence but can also mean more competition.";
  if (l.includes("gap") || l.includes("underpricing")) return "Euro-per-night pricing upside. Positive means the model thinks the current price may be low.";
  if (l.includes("risk")) return "Risk signal. Lower is safer; above 70% probability is treated as high-risk.";
  if (l.includes("priority overlap")) return "Listings that are both high-risk and underpriced. Higher means more urgent review.";
  if (l.includes("threshold")) return "Model cutoff. In this project, 70% or above is flagged for high-risk review.";
  if (l.includes("status") || l.includes("readiness")) return "Readiness indicator. Higher means the workflow is more usable in the current demo.";
  return "";
}

function attachKpiHelp(kpis = []) {
  return kpis.map((item) => ({
    ...item,
    help: item.help || kpiHelpFor(item.label),
  }));
}

function normalizeKpiText(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function uniqueKpis(kpis = [], fallbackKpis = []) {
  const output = [];
  const seenLabels = new Set();
  const seenPairs = new Set();
  for (const item of [...kpis, ...fallbackKpis]) {
    if (!item?.label || item.value === undefined || item.value === null || item.value === "") continue;
    const labelKey = normalizeKpiText(item.label);
    const pairKey = `${labelKey}:${normalizeKpiText(item.value)}`;
    if (seenLabels.has(labelKey) || seenPairs.has(pairKey)) continue;
    seenLabels.add(labelKey);
    seenPairs.add(pairKey);
    output.push(item);
    if (output.length === 4) break;
  }
  return output;
}

function metricNoteForKey(key, fallbackLabel = "") {
  const guideKey = {
    opportunity: "opportunity",
    score: "opportunity",
    saturation: "saturation",
    price: "medianNightlyPrice",
    medianPrice: "medianNightlyPrice",
    revenue: "averageRevenue",
    occupancy: "occupancy",
    forecast: "forecastOccupiedNights",
    forecastAvg: "forecastOccupiedNights",
    forecastPeak: "forecastOccupiedNights",
    share: "highRiskShare",
    count: "listings",
    listings: "listings",
    gap: "underpricingGap",
    predicted: "predictedPrice",
    impact: "shapImpact",
  }[key] || "";
  const byLabel = kpiHelpFor(fallbackLabel);
  const guide = METRIC_GUIDES[guideKey];
  if (guide) return `${guide.label}: ${guide.meaning} ${guide.good}`;
  return byLabel || "";
}

const FEATURE_LABELS = new Map([
  ["neighbourhood_median_price", "Neighbourhood median price"],
  ["neighborhood_median_price", "Neighbourhood median price"],
  ["median_price_eur", "Median nightly price"],
  ["mean_price_eur", "Average nightly price"],
  ["price_eur", "Nightly price"],
  ["actual_price_eur", "Current nightly price"],
  ["predicted_price_eur", "Predicted fair price"],
  ["prediction_gap_eur", "Predicted price gap"],
  ["underpricing_gap_eur", "Underpricing gap"],
  ["review_scores_rating", "Guest rating"],
  ["host_tenure_days", "Host tenure"],
  ["calculated_host_listings_count", "Host listing count"],
  ["availability_365", "Annual availability"],
  ["minimum_nights", "Minimum nights"],
  ["number_of_reviews", "Review count"],
  ["accommodates", "Guest capacity"],
  ["bedrooms", "Bedrooms"],
  ["dist_zone", "Distance zone"],
  ["mean_dist_km", "Distance from centre"],
  ["mean_occupancy", "Average occupancy"],
  ["mean_revenue_eur", "Average revenue"],
  ["opportunity_score", "Opportunity score"],
  ["competitive_saturation_score", "Saturation score"],
  ["supply_demand_imbalance", "Supply-demand balance"],
  ["risk_probability", "Risk probability"],
  ["host_risk_score", "Host risk score"],
]);

function humanizeFeatureName(feature) {
  const raw = String(feature || "").trim();
  if (!raw) return "Model feature";
  if (FEATURE_LABELS.has(raw)) return FEATURE_LABELS.get(raw);

  const [base, category] = raw.split(/[=:]/);
  const baseLabel = FEATURE_LABELS.get(base) || base
    .replace(/_/g, " ")
    .replace(/\beur\b/gi, "")
    .replace(/\bkm\b/gi, "km")
    .replace(/\s+/g, " ")
    .trim();
  const readableBase = baseLabel.charAt(0).toUpperCase() + baseLabel.slice(1);
  if (!category) return readableBase;
  const readableCategory = String(category).replace(/_/g, " ").trim();
  return `${readableBase}: ${readableCategory}`;
}

const GREEK_PLACE_LABELS = new Map([
  ["ΖΑΠΠΕΙΟ", "Zappeio"],
  ["ΑΚΡΟΠΟΛΗ", "Akropoli"],
  ["ΚΟΥΚΑΚΙ-ΜΑΚΡΥΓΙΑΝΝΗ", "Koukaki-Makrygianni"],
  ["ΑΓΙΟΣ ΕΛΕΥΘΕΡΙΟΣ", "Agios Eleftherios"],
  ["ΑΓΙΟΣ ΚΩΝΣΤΑΝΤΙΝΟΣ-ΠΛΑΤΕΙΑ ΒΑΘΗΣ", "Agios Konstantinos-Plateia Vathis"],
  ["ΑΓΙΟΣ ΝΙΚΟΛΑΟΣ", "Agios Nikolaos"],
]);

const GREEK_CHARS = /[\u0370-\u03ff]/;

function hasGreek(text) {
  return GREEK_CHARS.test(String(text || ""));
}

function transliterateGreek(text) {
  const map = {
    Α: "A", Β: "V", Γ: "G", Δ: "D", Ε: "E", Ζ: "Z", Η: "I", Θ: "Th", Ι: "I", Κ: "K", Λ: "L", Μ: "M",
    Ν: "N", Ξ: "X", Ο: "O", Π: "P", Ρ: "R", Σ: "S", Τ: "T", Υ: "Y", Φ: "F", Χ: "Ch", Ψ: "Ps", Ω: "O",
    Ά: "A", Έ: "E", Ή: "I", Ί: "I", Ό: "O", Ύ: "Y", Ώ: "O", Ϊ: "I", Ϋ: "Y",
    α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th", ι: "i", κ: "k", λ: "l", μ: "m",
    ν: "n", ξ: "x", ο: "o", π: "p", ρ: "r", σ: "s", ς: "s", τ: "t", υ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o",
    ά: "a", έ: "e", ή: "i", ί: "i", ό: "o", ύ: "y", ώ: "o", ϊ: "i", ϋ: "y", ΐ: "i", ΰ: "y",
  };
  return String(text || "").split("").map((ch) => map[ch] || ch).join("");
}

function titleCaseArea(text) {
  return String(text || "")
    .toLowerCase()
    .split(/([ -])/)
    .map((part) => /^[a-z]/.test(part) ? part.charAt(0).toUpperCase() + part.slice(1) : part)
    .join("");
}

function displayArea(name) {
  const cleaned = String(name || "Unknown").replace(/ Arrondissement$/i, "").trim();
  if (!hasGreek(cleaned)) return cleaned;
  const upper = cleaned.toUpperCase();
  const english = GREEK_PLACE_LABELS.get(upper) || titleCaseArea(transliterateGreek(cleaned));
  return `${english} (${cleaned})`;
}

function shortArea(name) {
  return displayArea(name);
}

export function localizePlaceNames(text) {
  let out = String(text || "");
  for (const [original, english] of GREEK_PLACE_LABELS.entries()) {
    const replacement = `${english} (${original})`;
    const bare = new RegExp(original, "g");
    out = out.replace(bare, replacement);
    out = out.replace(new RegExp(`${english} \\(${english} \\(${original}\\)\\)`, "g"), replacement);
    out = out.replace(new RegExp(`${english} \\(${original}\\) \\(${original}\\)`, "g"), replacement);
  }
  return out;
}

function normaliseCityName(city) {
  const c = String(city || "").trim().toLowerCase();
  if (c === "paris") return "Paris";
  if (c === "athens") return "Athens";
  return city || "";
}

function promptTokens(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/[a-z]+/g) || [];
}

function editDistance(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  const dp = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));
  for (let i = 0; i <= left.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= right.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[left.length][right.length];
}

const CITY_ALIASES = {
  Paris: new Set(["paris", "pari", "pariss"]),
  Athens: new Set(["athens", "athen", "athns", "athnes", "athans", "athina", "athenas"]),
};

function cityMentionsFromPrompt(prompt) {
  const tokens = promptTokens(prompt);
  const mentions = new Set();
  for (const token of tokens) {
    if (CITY_ALIASES.Paris.has(token)) mentions.add("Paris");
    if (CITY_ALIASES.Athens.has(token)) mentions.add("Athens");
  }
  if (mentions.size) return mentions;

  for (const token of tokens) {
    if (token.length >= 4 && editDistance(token, "paris") <= 1) mentions.add("Paris");
    if (token.length >= 5 && editDistance(token, "athens") <= 2) mentions.add("Athens");
  }
  return mentions;
}

function geographyScopeText(prompt) {
  return String(prompt || "")
    .replace(/\bdo\s+not\s+(?:compare|benchmark|contrast)[^.?!]*(?:[.?!]|$)/gi, " ")
    .replace(/\bwithout\s+(?:comparing|benchmarking|contrasting)[^.?!]*(?:[.?!]|$)/gi, " ")
    .replace(/\bunless\s+i\s+explicitly\s+ask[^.?!]*(?:[.?!]|$)/gi, " ")
    .replace(/\bnot\s+(?:paris|athens)\b/gi, " ");
}

function cityMentionsFromScope(prompt) {
  return cityMentionsFromPrompt(geographyScopeText(prompt));
}

function topN(items, scoreKey, n = 6, desc = true) {
  return [...items]
    .filter((d) => Number.isFinite(num(d[scoreKey], NaN)))
    .sort((a, b) => desc ? num(b[scoreKey]) - num(a[scoreKey]) : num(a[scoreKey]) - num(b[scoreKey]))
    .slice(0, n);
}

function confidenceRank(confidence) {
  const c = String(confidence || "").trim().toLowerCase();
  if (c === "observed") return 3;
  if (c === "mixed") return 2;
  if (c === "estimated") return 1;
  return 0;
}

function mapRegionRows(rows, city, metricKey, lowerIsBetter) {
  const byRegion = new Map();
  rows.forEach((row) => {
    const regionId = boundaryRegionId(city, row.area || row.label);
    if (!regionId || !Number.isFinite(num(row[metricKey], NaN))) return;
    const current = byRegion.get(regionId);
    if (!current) {
      byRegion.set(regionId, row);
      return;
    }

    const rowConfidence = confidenceRank(row.confidence);
    const currentConfidence = confidenceRank(current.confidence);
    if (rowConfidence > currentConfidence) {
      byRegion.set(regionId, row);
      return;
    }
    if (rowConfidence < currentConfidence) return;

    const rowMetric = num(row[metricKey]);
    const currentMetric = num(current[metricKey]);
    const better = lowerIsBetter ? rowMetric < currentMetric : rowMetric > currentMetric;
    if (better) byRegion.set(regionId, row);
  });

  return [...byRegion.values()]
    .sort((a, b) => lowerIsBetter ? num(a[metricKey]) - num(b[metricKey]) : num(b[metricKey]) - num(a[metricKey]));
}

function weightedAverage(sum, weight) {
  return weight ? sum / weight : 0;
}

function isComplianceIntentPrompt(text) {
  const p = String(text || "").toLowerCase();
  const directCompliance = /\b(ama|aade|siret|loi\s+le\s+meur|registration|registrations|register|registered|license|licence|licensing|legal|law|regulation|regulatory|compliance|permit|unlicensed|unlicenced|regulari[sz](?:e|es|ed|ing|ation|able)|freeze|frozen|enforcement|primary residence|primary residences|90[-\s]?night|str law|short[-\s]?term rental law)\b/.test(p);
  const removalCompliance = /\b(remove|removal|deactivate|deactivation|platform audit|platform removal)\b/.test(p)
    && /\b(unlicensed|unlicenced|ama|compliance|listing|listings|platform)\b/.test(p);
  return directCompliance || removalCompliance;
}

export function classifyIntent(prompt, agentId) {
  const p = `${prompt} ${agentId}`.toLowerCase();
  const scopeP = `${geographyScopeText(prompt)} ${agentId}`.toLowerCase();
  const cityMentions = cityMentionsFromScope(prompt);
  const hasSingleCity = cityMentions.size === 1;
  const asksCrossCityComparison = (
    (cityMentions.has("Paris") && cityMentions.has("Athens"))
    || /\b(which city|between cities|paris or athens|athens or paris|city strategy|city comparison|compare cities|compare markets)\b/.test(scopeP)
  );
  const asksForecast = /(prophet|forecast|occupancy|tourist|demand|season|90 day|next\s+\d+\s+months|future|summer|peak)/.test(p);
  const asksMethodology = /(how (?:is|was|does|did)|what (?:models?|method|architecture|pipeline)|which models?|trained|training|evaluate|evaluation|performance|technical|theoretical|methodology|stages?|phases?|langgraph|xgboost|lightgbm|model card|ml model|machine learning)/.test(p);
  const asksCompliance = isComplianceIntentPrompt(p);
  if (asksCrossCityComparison) return "portfolio-comparison";
  if (asksCompliance) return "compliance";
  if (asksMethodology) return "methodology";
  if (/(high-risk|risk|priority|attention|intervention|coach).{0,80}underpric|underpric.{0,80}(high-risk|risk|priority|attention|intervention|coach)/.test(p)) return "risk";
  if (/(underprice|underpriced|fair price|predicted price|pricing gap|price gap|shap|model driver)/.test(p)) return "pricing";
  if (asksForecast) return "demand";
  if (/(risk|high-risk|declin|vulnerab|priority|churn|warning)/.test(p)) return "risk";
  if (/(portfolio|50-unit|fifty-unit)/.test(p) && !hasSingleCity) return "portfolio-comparison";
  if (/(family|safe|safest|live|living|cheap|cheapest|affordable|budget|expensive|costliest|premium|luxury|rent|rental)/.test(p)) return "market-entry";
  if (/(opportunity|saturat|distance zone|segment|heat.?map|short-term rental|market|investment|nightly prices?|median nightly|median price|highest price|highest priced|most expensive|revenue.*saturation|saturation.*revenue)/.test(p)) return "market-entry";
  if (/(map|region|regions|area comparison|compare areas|compare regions|neighbourhoods|neighborhoods|arrondissements|districts|where in|which areas|which regions)/.test(p)) return "market-entry";
  if (/(underprice|price|pricing|revenue|nightly|gap|earning|income|adr)/.test(p)) return "pricing";
  if (/(saturat|avoid|invest|entry|arrondissement|neighbourhood|neighborhood|yield|region|where|area)/.test(p)) return "market-entry";
  if (agentId === "host-revenue") return "pricing";
  if (agentId === "demand") return "demand";
  if (agentId === "gentrification" || agentId === "crime") return "risk";
  return "market-entry";
}

function cityFromPrompt(prompt) {
  const mentions = cityMentionsFromScope(prompt);
  if (mentions.has("Paris") && !mentions.has("Athens")) return "Paris";
  if (mentions.has("Athens") && !mentions.has("Paris")) return "Athens";
  return "";
}

function compactContextText(text, max = 700) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trim()}…` : clean;
}

function normaliseContextMessages(messages = []) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((message) => message && (message.role === "user" || message.role === "assistant"))
    .map((message) => ({
      role: message.role,
      text: compactContextText(message.text || message.content || ""),
    }))
    .filter((message) => message.text)
    .slice(-8);
}

function lastSingleCity(messages = []) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const mentions = cityMentionsFromScope(messages[i].text);
    if (mentions.size === 1) return [...mentions][0];
  }
  return "";
}

function metricFocus(prompt) {
  const p = String(prompt || "");
  if (/(prophet|forecast|forecasted|occupied nights|next\s+\d+\s+months|seasonality|seasonal|demand scenario)/i.test(p)) return "forecast demand";
  if (/(expensive|costliest|costly|premium|luxury|highest (?:median |nightly |rental |rent )?price|highest priced|most expensive|pricey)/i.test(p)) return "expensive nightly-price ranking";
  if (/(cheap|cheapest|affordable|budget|low price|lowest|least expensive|lowest (?:median |nightly |rental |rent )?price)/i.test(p)) return "affordable nightly-price ranking";
  if (/(saturat|avoid|too high|crowd|overbuilt|worst places|worst areas)/i.test(p)) return "saturation and avoidance";
  if (/(revenue|income|earning|yield)/i.test(p)) return "revenue";
  if (/(occupancy|demand|booked|tourist)/i.test(p)) return "demand";
  if (/(risk|high-risk|declin|vulnerab|priority|churn|warning)/i.test(p)) return "risk";
  if (/(underprice|underpriced|fair price|predicted price|pricing gap|price gap|shap|model driver)/i.test(p)) return "pricing gap";
  if (/(family|safe|safest|live|living)/i.test(p)) return "livability and saturation";
  return "";
}

function isFollowUpPrompt(prompt) {
  const p = String(prompt || "").trim();
  const words = promptTokens(p);
  return words.length <= 14
    || /\b(there|that|those|these|same|it|them|they|their|also|what about|how about|and which|which are|where are)\b/i.test(p);
}

export function resolvePromptContext(prompt, messages = []) {
  const history = normaliseContextMessages(messages);
  const currentCity = cityFromPrompt(prompt);
  const priorCity = lastSingleCity(history);
  const currentFocus = metricFocus(prompt);
  const priorFocus = [...history].reverse().map((message) => metricFocus(message.text)).find(Boolean) || "";
  const notes = [];
  let analysisPrompt = String(prompt || "").trim();

  if (!currentCity && priorCity && isFollowUpPrompt(prompt)) {
    notes.push(`Use ${priorCity} as the city because this is a follow-up in the same conversation.`);
    analysisPrompt += `\nContext city: ${priorCity}. Interpret location words such as "there", "that area", or "same city" as ${priorCity}.`;
  }

  if (!currentFocus && priorFocus && isFollowUpPrompt(prompt)) {
    notes.push(`Continue the previous analytical focus: ${priorFocus}.`);
    analysisPrompt += `\nContext focus: continue the previous ${priorFocus} question unless the current user asks for a different metric.`;
  }

  return {
    analysisPrompt,
    history,
    currentCity,
    priorCity,
    currentFocus,
    priorFocus,
    notes,
    summary: notes.length ? notes.join(" ") : "No prior chat context was needed to resolve this prompt.",
  };
}

function normaliseAreaKey(area) {
  return String(area || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

const CITY_MAP_META = {
  Paris: {
    center: { lat: 48.8566, lon: 2.3522 },
    zoom: 12,
    label: "Paris, France",
    geoJsonUrl: "/api/chat?geo=paris-arrondissements",
    regionIdProperty: "code",
    regionNameProperty: "nom",
  },
  Athens: {
    center: { lat: 37.9838, lon: 23.7275 },
    zoom: 12,
    label: "Athens, Greece",
  },
};

const REGION_COORDS = new Map([
  ["Paris|HOTEL-DE-VILLE", { lat: 48.8566, lon: 2.3522 }],
  ["Paris|ELYSEE", { lat: 48.8698, lon: 2.3078 }],
  ["Paris|PANTHEON", { lat: 48.8462, lon: 2.3455 }],
  ["Paris|LOUVRE", { lat: 48.8606, lon: 2.3376 }],
  ["Paris|BOURSE", { lat: 48.8686, lon: 2.3431 }],
  ["Paris|OPERA", { lat: 48.8720, lon: 2.3320 }],
  ["Paris|TEMPLE", { lat: 48.8647, lon: 2.3600 }],
  ["Paris|ENTREPOT", { lat: 48.8763, lon: 2.3593 }],
  ["Paris|PALAIS-BOURBON", { lat: 48.8616, lon: 2.3186 }],
  ["Paris|LUXEMBOURG", { lat: 48.8469, lon: 2.3370 }],
  ["Paris|MENILMONTANT", { lat: 48.8687, lon: 2.3980 }],
  ["Paris|GOBELINS", { lat: 48.8326, lon: 2.3554 }],
  ["Paris|REUILLY", { lat: 48.8412, lon: 2.3887 }],
  ["Paris|OBSERVATOIRE", { lat: 48.8295, lon: 2.3265 }],
  ["Paris|VAUGIRARD", { lat: 48.8410, lon: 2.2990 }],
  ["Paris|POPINCOURT", { lat: 48.8590, lon: 2.3820 }],
  ["Paris|PASSY", { lat: 48.8576, lon: 2.2712 }],
  ["Paris|BATIGNOLLES-MONCEAU", { lat: 48.8874, lon: 2.3095 }],
  ["Paris|ENCLOS-ST-LAURENT", { lat: 48.8757, lon: 2.3605 }],
  ["Paris|BUTTES-MONTMARTRE", { lat: 48.8925, lon: 2.3444 }],
  ["Paris|BUTTES-CHAUMONT", { lat: 48.8805, lon: 2.3822 }],
  ["Athens|ΖΑΠΠΕΙΟ", { lat: 37.9699, lon: 23.7330 }],
  ["Athens|1Ο ΝΕΚΡΟΤΑΦΕΙΟ", { lat: 37.9615, lon: 23.7360 }],
  ["Athens|ΑΚΡΟΠΟΛΗ", { lat: 37.9680, lon: 23.7247 }],
  ["Athens|ΣΤΑΔΙΟ", { lat: 37.9681, lon: 23.7415 }],
  ["Athens|ΘΗΣΕΙΟ", { lat: 37.9760, lon: 23.7195 }],
  ["Athens|ΚΟΛΩΝΟΣ", { lat: 38.0025, lon: 23.7150 }],
  ["Athens|ΣΤΑΘΜΟΣ ΛΑΡΙΣΗΣ", { lat: 37.9920, lon: 23.7210 }],
  ["Athens|ΓΚΑΖΙ", { lat: 37.9785, lon: 23.7138 }],
  ["Athens|ΑΝΩ ΠΑΤΗΣΙΑ", { lat: 38.0235, lon: 23.7350 }],
  ["Athens|ΓΟΥΒΑ", { lat: 37.9558, lon: 23.7430 }],
  ["Athens|ΑΚΑΔΗΜΙΑ ΠΛΑΤΩΝΟΣ", { lat: 37.9925, lon: 23.7065 }],
  ["Athens|ΑΓΙΟΣ ΕΛΕΥΘΕΡΙΟΣ", { lat: 38.0220, lon: 23.7310 }],
  ["Athens|ΑΝΩ ΚΥΨΕΛΗ", { lat: 38.0050, lon: 23.7400 }],
  ["Athens|ΝΕΑ ΚΥΨΕΛΗ", { lat: 38.0070, lon: 23.7440 }],
  ["Athens|ΝΙΡΒΑΝΑ", { lat: 38.0180, lon: 23.7330 }],
  ["Athens|ΠΕΝΤΑΓΩΝΟ", { lat: 38.0000, lon: 23.7770 }],
  ["Athens|ΡΗΓΙΛΛΗΣ", { lat: 37.9755, lon: 23.7440 }],
  ["Athens|ΒΟΤΑΝΙΚΟΣ", { lat: 37.9810, lon: 23.7050 }],
  ["Athens|ΚΕΡΑΜΕΙΚΟΣ", { lat: 37.9780, lon: 23.7160 }],
  ["Athens|ΚΟΥΚΑΚΙ-ΜΑΚΡΥΓΙΑΝΝΗ", { lat: 37.9650, lon: 23.7240 }],
  ["Athens|ΕΜΠΟΡΙΚΟ ΤΡΙΓΩΝΟ-ΠΛΑΚΑ", { lat: 37.9750, lon: 23.7290 }],
  ["Athens|ΝΕΟΣ ΚΟΣΜΟΣ", { lat: 37.9580, lon: 23.7280 }],
  ["Athens|ΚΟΛΩΝΑΚΙ", { lat: 37.9760, lon: 23.7420 }],
  ["Athens|ΠΑΓΚΡΑΤΙ", { lat: 37.9680, lon: 23.7510 }],
  ["Athens|ΠΕΤΡΑΛΩΝΑ", { lat: 37.9690, lon: 23.7100 }],
  ["Athens|ΜΟΥΣΕΙΟ-ΕΞΑΡΧΕΙΑ-ΝΕΑΠΟΛΗ", { lat: 37.9870, lon: 23.7330 }],
  ["Athens|ΚΥΨΕΛΗ", { lat: 38.0020, lon: 23.7390 }],
  ["Athens|ΛΥΚΑΒΗΤΤΟΣ", { lat: 37.9820, lon: 23.7430 }],
]);

const PARIS_BOUNDARY_IDS = new Map([
  ["LOUVRE", "75101"],
  ["BOURSE", "75102"],
  ["TEMPLE", "75103"],
  ["HOTEL-DE-VILLE", "75104"],
  ["HÔTEL-DE-VILLE", "75104"],
  ["PANTHEON", "75105"],
  ["PANTHÉON", "75105"],
  ["LUXEMBOURG", "75106"],
  ["PALAIS-BOURBON", "75107"],
  ["ELYSEE", "75108"],
  ["ÉLYSÉE", "75108"],
  ["OPERA", "75109"],
  ["OPÉRA", "75109"],
  ["ENTREPOT", "75110"],
  ["ENTREPÔT", "75110"],
  ["ENCLOS-ST-LAURENT", "75110"],
  ["POPINCOURT", "75111"],
  ["REUILLY", "75112"],
  ["GOBELINS", "75113"],
  ["OBSERVATOIRE", "75114"],
  ["VAUGIRARD", "75115"],
  ["PASSY", "75116"],
  ["BATIGNOLLES-MONCEAU", "75117"],
  ["BUTTES-MONTMARTRE", "75118"],
  ["BUTTES-CHAUMONT", "75119"],
  ["MENILMONTANT", "75120"],
  ["MÉNILMONTANT", "75120"],
]);

function boundaryRegionId(city, area) {
  if (city !== "Paris") return normaliseAreaKey(area);
  return PARIS_BOUNDARY_IDS.get(normaliseAreaKey(area)) || normaliseAreaKey(area);
}

function fallbackRegionCoord(city, area) {
  const meta = CITY_MAP_META[city] || CITY_MAP_META.Paris;
  const key = normaliseAreaKey(area);
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  const angle = (hash % 360) * Math.PI / 180;
  const ring = 0.012 + ((hash % 19) / 19) * 0.025;
  return {
    lat: Number((meta.center.lat + Math.sin(angle) * ring).toFixed(5)),
    lon: Number((meta.center.lon + Math.cos(angle) * ring * 1.35).toFixed(5)),
  };
}

function regionCoord(city, area) {
  const key = `${city}|${normaliseAreaKey(area)}`;
  const coord = REGION_COORDS.get(key);
  if (coord) return { ...coord, coordinateSource: "known" };
  return { ...fallbackRegionCoord(city, area), coordinateSource: "fallback" };
}

function groupMetric(map, key, patch) {
  const groupKey = key || "Unknown";
  const current = map.get(groupKey) || {};
  map.set(groupKey, patch(current));
}

async function loadNeighbourhoodStats() {
  return cached("neighbourhood-stats", async () => {
    const text = await fetchCsv(FILES.neighbourhoodStats);
    const rows = [];
    eachCsvRow(text, (row) => {
      rows.push({
        city: normaliseCityName(row.city),
        area: row.neighbourhood,
        listings: num(row.n_listings),
        medianPrice: num(row.median_price_eur),
        meanPrice: num(row.mean_price_eur),
        occupancy: num(row.mean_occupancy),
        revenue: num(row.mean_revenue_eur),
        distance: num(row.mean_dist_km),
        supplyDemand: num(row.supply_demand_imbalance),
        saturation: num(row.competitive_saturation_score),
        opportunity: num(row.opportunity_score),
        confidence: row.price_confidence,
        zone: row.dist_zone,
      });
    });
    return rows;
  });
}

function forecastFileForCity(city) {
  return city === "Paris" ? FILES.prophetParisForecast : FILES.prophetAthensForecast;
}

function monthLabel(value) {
  const text = String(value || "").slice(0, 7);
  const [year, rawMonth] = text.split("-");
  const monthIndex = Number(rawMonth) - 1;
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  if (!year || monthIndex < 0 || monthIndex > 11) return text || "Month";
  return `${names[monthIndex]} ${year}`;
}

async function loadProphetForecast(city) {
  const normalCity = normaliseCityName(city) || "Athens";
  const sourceFile = forecastFileForCity(normalCity);
  return cached(`prophet-forecast-${normalCity}`, async () => {
    const text = await fetchCsv(sourceFile);
    const rows = [];
    eachCsvRow(text, (row) => {
      const yhat = num(row.yhat, NaN);
      if (!Number.isFinite(yhat)) return;
      const forecastMonth = row.forecast_month || String(row.ds || "").slice(0, 7);
      rows.push({
        city: normaliseCityName(row.city) || normalCity,
        area: row.neighbourhood || "Unknown",
        date: row.ds,
        month: forecastMonth,
        monthLabel: monthLabel(forecastMonth),
        yhat,
        lower: num(row.yhat_lower, NaN),
        upper: num(row.yhat_upper, NaN),
        baseline: num(row.monthly_baseline, NaN),
        annualBaseline: num(row.annual_occupancy_baseline, NaN),
        reviewGrowth: num(row.review_growth_24_25_capped, NaN),
        seasonality: num(row.seasonality_multiplier, NaN),
        momentum: num(row.momentum_multiplier, NaN),
        listings: num(row.n_listings),
        modelLevel: row.model_level,
        scenarioProxy: truthy(row.is_scenario_proxy),
        trainingStart: row.training_start,
        trainingEnd: row.training_end,
        methodologyNote: row.methodology_note || "",
      });
    });
    return rows.filter((row) => row.city === normalCity);
  });
}

function aggregateForecastAreas(forecastRows, statsRows = []) {
  const statsByArea = new Map(statsRows.map((row) => [normaliseAreaKey(row.area), row]));
  const groups = new Map();
  forecastRows.forEach((row) => {
    const key = normaliseAreaKey(row.area);
    const group = groups.get(key) || {
      area: row.area,
      rows: [],
      sum: 0,
      lowerSum: 0,
      upperSum: 0,
      count: 0,
      listings: 0,
      methodologyNote: row.methodologyNote,
      scenarioProxy: row.scenarioProxy,
    };
    group.rows.push(row);
    group.sum += row.yhat;
    if (Number.isFinite(row.lower)) group.lowerSum += row.lower;
    if (Number.isFinite(row.upper)) group.upperSum += row.upper;
    group.count += 1;
    group.listings = Math.max(group.listings, row.listings || 0);
    groups.set(key, group);
  });

  return [...groups.entries()].map(([key, group]) => {
    const stats = statsByArea.get(key) || {};
    const sortedRows = [...group.rows].sort((a, b) => String(a.month).localeCompare(String(b.month)));
    const peak = sortedRows.reduce((best, row) => row.yhat > (best?.yhat ?? -Infinity) ? row : best, null);
    const trough = sortedRows.reduce((best, row) => row.yhat < (best?.yhat ?? Infinity) ? row : best, null);
    const forecastAvg = weightedAverage(group.sum, group.count);
    const forecastLowAvg = weightedAverage(group.lowerSum, group.count);
    const forecastHighAvg = weightedAverage(group.upperSum, group.count);
    return {
      area: group.area,
      forecastAvg,
      forecastAvgDisplay: fmtDays(forecastAvg),
      forecastLowAvg,
      forecastLowAvgDisplay: fmtDays(forecastLowAvg),
      forecastHighAvg,
      forecastHighAvgDisplay: fmtDays(forecastHighAvg),
      forecastPeak: peak?.yhat || 0,
      forecastPeakDisplay: fmtDays(peak?.yhat || 0),
      peakMonth: peak?.monthLabel || "",
      forecastTrough: trough?.yhat || 0,
      forecastTroughDisplay: fmtDays(trough?.yhat || 0),
      troughMonth: trough?.monthLabel || "",
      listings: group.listings || stats.listings || 0,
      medianPrice: stats.medianPrice || 0,
      revenue: stats.revenue || 0,
      occupancy: stats.occupancy || 0,
      opportunity: stats.opportunity || 0,
      saturation: stats.saturation || 0,
      confidence: stats.confidence || "forecast",
      methodologyNote: group.methodologyNote,
      scenarioProxy: group.scenarioProxy,
      rows: sortedRows,
    };
  }).sort((a, b) => b.forecastAvg - a.forecastAvg);
}

function forecastLineChart(city, areaForecast) {
  return makeViz(`${city} Prophet scenario: ${shortArea(areaForecast.area)} monthly demand`, areaForecast.rows.map((row) => ({
    label: row.monthLabel,
    value: row.yhat,
    display: fmtDays(row.yhat),
    forecastDisplay: fmtDays(row.yhat),
    lowerDisplay: Number.isFinite(row.lower) ? fmtDays(row.lower) : "",
    upperDisplay: Number.isFinite(row.upper) ? fmtDays(row.upper) : "",
  })), "Forecast occupied nights", "forecast", {
    kind: "line",
    metricNote: "Line chart: best for forecast prompts. Each point is the Prophet scenario estimate of occupied nights per month for the recommended area.",
  });
}

async function loadAthensUnderpricing() {
  return cached("athens-underpricing", async () => {
    const text = await fetchCsv(FILES.athensUnderpricing);
    const byArea = new Map();
    const listingIds = new Set();
    let total = 0;
    let gapSum = 0;
    eachCsvRow(text, (row) => {
      const gap = num(row.underpricing_gap_eur);
      const actual = num(row.actual_price_eur || row.price_eur);
      const predicted = num(row.predicted_price_eur);
      const highRisk = num(row.host_risk_score) >= 0.7 || truthy(row.at_risk_host);
      if (row.listing_id) listingIds.add(String(row.listing_id));
      total++;
      gapSum += gap;
      groupMetric(byArea, row.neighbourhood, (g = {}) => ({
        area: row.neighbourhood || "Unknown",
        count: (g.count || 0) + 1,
        gapSum: (g.gapSum || 0) + gap,
        actualSum: (g.actualSum || 0) + actual,
        predictedSum: (g.predictedSum || 0) + predicted,
        highRisk: (g.highRisk || 0) + (highRisk ? 1 : 0),
      }));
    });
    const areas = [...byArea.values()].map((g) => ({
      ...g,
      avgGap: weightedAverage(g.gapSum, g.count),
      avgActual: weightedAverage(g.actualSum, g.count),
      avgPredicted: weightedAverage(g.predictedSum, g.count),
      highRiskShare: weightedAverage(g.highRisk, g.count) * 100,
    }));
    return {
      total,
      averageGap: weightedAverage(gapSum, total),
      listingIds,
      areas,
    };
  });
}

async function loadParisPricing() {
  return cached("paris-pricing", async () => {
    const text = await fetchCsv(FILES.parisPredictions);
    const byArea = new Map();
    let total = 0;
    let positive = 0;
    let gapSum = 0;
    eachCsvRow(text, (row) => {
      const gap = num(row.prediction_gap_eur);
      const actual = num(row.actual_price_eur || row.price_eur);
      const predicted = num(row.predicted_price_eur);
      total++;
      if (gap > 0) positive++;
      gapSum += gap;
      groupMetric(byArea, row.neighbourhood || row.district, (g = {}) => ({
        area: row.neighbourhood || row.district || "Unknown",
        count: (g.count || 0) + 1,
        positive: (g.positive || 0) + (gap > 0 ? 1 : 0),
        gapSum: (g.gapSum || 0) + gap,
        actualSum: (g.actualSum || 0) + actual,
        predictedSum: (g.predictedSum || 0) + predicted,
      }));
    });
    const areas = [...byArea.values()].map((g) => ({
      ...g,
      avgGap: weightedAverage(g.gapSum, g.count),
      positiveShare: weightedAverage(g.positive, g.count) * 100,
      avgActual: weightedAverage(g.actualSum, g.count),
      avgPredicted: weightedAverage(g.predictedSum, g.count),
    }));
    return {
      total,
      positive,
      averageGap: weightedAverage(gapSum, total),
      areas,
    };
  });
}

async function loadAthensRisk() {
  return cached("athens-risk", async () => {
    const text = await fetchCsv(FILES.athensRisk);
    const byArea = new Map();
    const bins = [
      { label: "0%-20%", min: 0, max: 0.2, count: 0 },
      { label: "20%-40%", min: 0.2, max: 0.4, count: 0 },
      { label: "40%-60%", min: 0.4, max: 0.6, count: 0 },
      { label: "60%-70%", min: 0.6, max: 0.7, count: 0 },
      { label: "70%-85%", min: 0.7, max: 0.85, count: 0 },
      { label: "85%-100%", min: 0.85, max: 1.01, count: 0 },
    ];
    const highIds = new Set();
    let total = 0;
    let high = 0;
    let riskSum = 0;
    eachCsvRow(text, (row) => {
      const risk = num(row.risk_probability);
      const isHigh = row.high_risk_flag !== "" ? truthy(row.high_risk_flag) : risk >= 0.7;
      total++;
      high += isHigh ? 1 : 0;
      if (isHigh && row.listing_id) highIds.add(String(row.listing_id));
      riskSum += risk;
      const bin = bins.find((b) => risk >= b.min && risk < b.max);
      if (bin) bin.count += 1;
      groupMetric(byArea, row.neighbourhood, (g = {}) => ({
        area: row.neighbourhood || "Unknown",
        count: (g.count || 0) + 1,
        high: (g.high || 0) + (isHigh ? 1 : 0),
        riskSum: (g.riskSum || 0) + risk,
      }));
    });
    const areas = [...byArea.values()].map((g) => ({
      ...g,
      avgRisk: weightedAverage(g.riskSum, g.count),
      highShare: weightedAverage(g.high, g.count) * 100,
    }));
    return {
      total,
      high,
      highIds,
      avgRisk: weightedAverage(riskSum, total),
      areas,
      bins: bins.map((b) => ({
        label: b.label,
        count: b.count,
        share: weightedAverage(b.count, total) * 100,
      })),
    };
  });
}

async function loadShap(path, cacheKey) {
  return cached(cacheKey, async () => {
    const text = await fetchCsv(path);
    const sums = new Map();
    let rows = 0;
    eachCsvRow(text, (row) => {
      rows++;
      Object.entries(row).forEach(([feature, value]) => {
        if (feature === "listing_index" || feature === "listing_id") return;
        sums.set(feature, (sums.get(feature) || 0) + Math.abs(num(value)));
      });
    });
    return [...sums.entries()]
      .map(([feature, sum]) => ({
        feature,
        displayFeature: humanizeFeatureName(feature),
        impact: weightedAverage(sum, rows),
      }))
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 6);
  });
}

async function loadRagCompliance() {
  return cached("rag-compliance", async () => {
    const [reportText, index, session] = await Promise.all([
      fetchCsv(FILES.ragUnlicensedReport),
      fetchJson(FILES.ragComplianceIndex).catch(() => ({})),
      fetchJson(FILES.ragSessionLog).catch(() => ({})),
    ]);
    const byArea = new Map();
    const riskCounts = new Map([["HIGH", 0], ["MEDIUM", 0], ["LOW", 0]]);
    const citations = new Map();
    let total = 0;
    let revenueAtRisk = 0;
    let regularisable = 0;
    let highRisk = 0;

    eachCsvRow(reportText, (row) => {
      const risk = String(row.risk_level || "UNKNOWN").trim().toUpperCase();
      const revenue = num(row.rev_est);
      const isRegularisable = truthy(row.regularisable);
      total++;
      revenueAtRisk += revenue;
      if (isRegularisable) regularisable++;
      if (risk === "HIGH") highRisk++;
      riskCounts.set(risk, (riskCounts.get(risk) || 0) + 1);
      if (row.top_doc_title) {
        const key = row.top_doc_title;
        const current = citations.get(key) || {
          title: row.top_doc_title,
          citation: row.top_citation || "",
          count: 0,
          similaritySum: 0,
        };
        current.count += 1;
        current.similaritySum += num(row.similarity_score);
        citations.set(key, current);
      }
      groupMetric(byArea, row.neighbourhood, (g = {}) => ({
        area: row.neighbourhood || "Unknown",
        count: (g.count || 0) + 1,
        high: (g.high || 0) + (risk === "HIGH" ? 1 : 0),
        medium: (g.medium || 0) + (risk === "MEDIUM" ? 1 : 0),
        low: (g.low || 0) + (risk === "LOW" ? 1 : 0),
        regularisable: (g.regularisable || 0) + (isRegularisable ? 1 : 0),
        revenue: (g.revenue || 0) + revenue,
      }));
    });

    const areas = [...byArea.values()]
      .map((area) => ({
        ...area,
        highShare: weightedAverage(area.high || 0, area.count) * 100,
        mediumShare: weightedAverage(area.medium || 0, area.count) * 100,
        regularisableShare: weightedAverage(area.regularisable || 0, area.count) * 100,
      }))
      .sort((a, b) => (b.high - a.high) || (b.count - a.count));
    const topCitations = [...citations.values()]
      .map((citation) => ({
        ...citation,
        avgSimilarity: weightedAverage(citation.similaritySum, citation.count),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      total,
      highRisk,
      regularisable,
      revenueAtRisk,
      riskCounts,
      areas,
      topCitations,
      index,
      session,
    };
  });
}

function sourceDetails(sourceFiles, methodology, limitations, extra = [], metricGuides = []) {
  return {
    methodology,
    sourceFiles,
    limitations,
    extra,
    metricGuides,
  };
}

function makeViz(title, data, yLabel = "Score", yKey = "value", options = {}) {
  return [{
    kind: options.kind || "bar",
    title,
    xKey: options.xKey || "label",
    yKey,
    yLabel,
    metricNote: options.metricNote || metricNoteForKey(yKey, yLabel),
    series: options.series,
    xLabel: options.xLabel,
    data: data.map((d) => ({
      label: shortArea(d.label),
      [yKey]: Number(num(d.value).toFixed(2)),
      display: d.display || String(d.value),
      ...Object.fromEntries(Object.entries(d)
        .filter(([key]) => !["label", "value", "display"].includes(key))
        .map(([key, value]) => [key, Number.isFinite(num(value, NaN)) ? Number(num(value).toFixed(2)) : value])),
    })),
  }];
}

function visualizationRequest(prompt) {
  const p = String(prompt || "").toLowerCase();
  return {
    map: wantsRegionMap(prompt),
    heatmap: /(heat.?map|matrix|segment|segments|grid|quadrant)/i.test(p),
    distribution: /(distribution|spread|range|histogram|how many|score range|price range|risk range)/i.test(p),
    composition: /(share|breakdown|split|composition|mix|portion|percentage of|what percent)/i.test(p),
    relationship: /(relationship|correlation|trade.?off|balance|versus| vs |compare .*with|price.*revenue|revenue.*price|revenue.*saturation|saturation.*revenue|opportunity.*saturation|saturation.*opportunity)/i.test(p),
  };
}

function metricFormatter(metricKey) {
  if (metricKey === "medianPrice" || metricKey === "meanPrice" || metricKey === "revenue" || metricKey === "avgGap" || metricKey === "avgActual" || metricKey === "avgPredicted") return fmtEuro;
  if (metricKey === "occupancy" || metricKey === "highShare" || metricKey === "highRiskShare" || metricKey === "share") return fmtPct;
  return fmtScore;
}

function makeHistogram(title, rows, metricKey, metricLabel, options = {}) {
  const formatter = options.formatter || metricFormatter(metricKey);
  const values = rows.map((r) => num(r[metricKey], NaN)).filter(Number.isFinite);
  if (!values.length) return makeViz(title, [], metricLabel, "count", { kind: "histogram" });
  const min = Math.min(...values);
  const max = Math.max(...values);
  const bins = Math.min(options.bins || 6, Math.max(3, Math.ceil(Math.sqrt(values.length))));
  const width = Math.max((max - min) / bins, 0.0001);
  const data = Array.from({ length: bins }, (_, i) => {
    const lo = min + i * width;
    const hi = i === bins - 1 ? max : min + (i + 1) * width;
    return { label: `${formatter(lo)}-${formatter(hi)}`, value: 0, count: 0, display: "0 regions" };
  });
  values.forEach((value) => {
    const idx = Math.min(bins - 1, Math.max(0, Math.floor((value - min) / width)));
    data[idx].value += 1;
    data[idx].count += 1;
    data[idx].display = `${data[idx].count} regions`;
  });
  return makeViz(title, data, "Regions", "count", {
    kind: "histogram",
    metricNote: options.metricNote || `${metricLabel} distribution: each bar shows how many regions fall into that value range.`,
  });
}

function humanizeSegmentLabel(value) {
  const raw = String(value || "Unknown").trim();
  const known = {
    near_1_3km: "Near centre, 1-3 km",
    mid_3_5km: "Mid distance, 3-5 km",
    outer_5km_plus: "Outer area, 5+ km",
    centre_0_1km: "Central core, 0-1 km",
    center_0_1km: "Central core, 0-1 km",
    observed: "Observed data",
    mixed: "Mixed confidence",
    estimated: "Estimated data",
  };
  const key = raw.toLowerCase();
  if (known[key]) return known[key];
  return raw
    .replace(/_/g, " ")
    .replace(/\bkm\b/gi, "km")
    .replace(/\bplus\b/gi, "+")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (ch) => ch.toUpperCase());
}

function makeDonut(title, rows, labelKey, valueKey, valueLabel, options = {}) {
  const formatter = options.formatter || (valueKey === "listings" || valueKey === "count" ? fmtInt : metricFormatter(valueKey));
  const total = rows.reduce((sum, row) => sum + num(row[valueKey]), 0);
  return [{
    kind: "donut",
    title,
    xKey: "label",
    yKey: "value",
    yLabel: valueLabel,
    metricNote: options.metricNote || `${valueLabel} breakdown: each slice shows its share of the selected total.`,
    data: rows.map((row) => {
      const value = num(row[valueKey]);
      const share = total ? value / total * 100 : 0;
      return {
        label: options.labelFormatter ? options.labelFormatter(row[labelKey] || row.label) : shortArea(row[labelKey] || row.label),
        value: Number(value.toFixed(2)),
        display: formatter(value),
        shareDisplay: `${share.toFixed(1)}% of total`,
      };
    }),
  }];
}

function numericSpread(values = [], precision = 2) {
  const clean = values.map((value) => num(value, NaN)).filter(Number.isFinite);
  if (clean.length < 2) return { count: clean.length, distinct: clean.length, range: 0, ratio: 0 };
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const range = max - min;
  const meanAbs = clean.reduce((sum, value) => sum + Math.abs(value), 0) / clean.length;
  const distinct = new Set(clean.map((value) => Number(value.toFixed(precision)))).size;
  return {
    count: clean.length,
    distinct,
    range,
    ratio: meanAbs ? range / meanAbs : 0,
  };
}

function crowdedPointShare(rows = [], xKey, yKey) {
  const points = rows
    .map((row) => ({ x: num(row[xKey], NaN), y: num(row[yKey], NaN) }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (points.length < 4) return 1;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const xRange = maxX - minX;
  const yRange = maxY - minY;
  if (!xRange || !yRange) return 1;

  const buckets = new Map();
  points.forEach((point) => {
    const bx = Math.min(4, Math.max(0, Math.floor(((point.x - minX) / xRange) * 5)));
    const by = Math.min(4, Math.max(0, Math.floor(((point.y - minY) / yRange) * 5)));
    const key = `${bx}:${by}`;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  });
  return Math.max(...buckets.values()) / points.length;
}

function bubbleScatterIsReadable(data = [], xKey, yKey, options = {}) {
  const minPoints = options.minPoints || 4;
  const minDistinct = options.minDistinct || Math.min(4, minPoints);
  const minXSpreadRatio = options.minXSpreadRatio ?? 0.08;
  const minYSpreadRatio = options.minYSpreadRatio ?? 0.12;
  const maxCrowdedShare = options.maxCrowdedShare ?? 0.45;
  const x = numericSpread(data.map((row) => row[xKey]));
  const y = numericSpread(data.map((row) => row[yKey]));
  const crowding = crowdedPointShare(data, xKey, yKey);
  return data.length >= minPoints
    && x.distinct >= minDistinct
    && y.distinct >= minDistinct
    && x.ratio >= minXSpreadRatio
    && y.ratio >= minYSpreadRatio
    && crowding <= maxCrowdedShare;
}

function makeBubbleScatter(title, rows, options = {}) {
  const xKey = options.xKey || "saturation";
  const yKey = options.yKey || "revenue";
  const sizeKey = options.sizeKey || "listings";
  const data = rows.map((r) => {
    const sizeValue = Math.max(1, Number(num(r[sizeKey] || r.count || 1).toFixed(0)));
    return {
      label: shortArea(r.area || r.label),
      [xKey]: Number(num(r[xKey]).toFixed(2)),
      [yKey]: Number(num(r[yKey]).toFixed(2)),
      [sizeKey]: sizeValue,
      display: options.display ? options.display(r) : "",
      listingsDisplay: fmtInt(r[sizeKey] || r.count || 0),
    };
  });
  if (!options.allowCrowded && !bubbleScatterIsReadable(data, xKey, yKey, options)) return [];
  return [{
    kind: "bubble-scatter",
    title,
    xKey,
    yKey,
    sizeKey,
    xLabel: options.xLabel || "Saturation score",
    yLabel: options.yLabel || "Average revenue",
    metricNote: options.metricNote || "Bubble chart: position shows the trade-off between two metrics, while bubble size reflects listing volume.",
    data,
  }];
}

function makeSegmentHeatmap(title, rows, metricKey, metricLabel, options = {}) {
  const groups = new Map();
  rows.forEach((row) => {
    const y = humanizeSegmentLabel(row.zone || "Unknown zone");
    const x = humanizeSegmentLabel(row.confidence || "Unknown confidence");
    const key = `${y}|${x}`;
    const current = groups.get(key) || { y, x, weight: 0, weighted: 0, label: row.area };
    const weight = Math.max(1, num(row.listings || row.count || 1));
    current.weight += weight;
    current.weighted += num(row[metricKey]) * weight;
    if (num(row[metricKey]) > num(rows.find((r) => r.area === current.label)?.[metricKey], -Infinity)) current.label = row.area;
    groups.set(key, current);
  });
  const formatter = options.formatter || metricFormatter(metricKey);
  return [{
    kind: "heatmap",
    title,
    tone: options.tone || "opportunity",
    metricNote: options.metricNote || `${metricLabel} heatmap: darker cells show stronger average values across market segments.`,
    data: [...groups.values()].map((g) => {
      const value = weightedAverage(g.weighted, g.weight);
      return {
        x: g.x,
        y: g.y,
        xLabel: g.x,
        yLabel: g.y,
        value: Number(value.toFixed(2)),
        display: formatter(value),
        label: shortArea(g.label),
      };
    }),
  }];
}

function wantsRegionMap(prompt) {
  return /(\bmap\b|region|regions|\barea\b|area comparison|compare areas|compare regions|neighbourhoods|neighborhoods|arrondissements|districts|where in|which areas|which regions)/i.test(prompt);
}

function makeRegionMap(title, city, rows, metricKey, metricLabel, displayFormatter = fmtScore, options = {}) {
  const meta = CITY_MAP_META[city] || CITY_MAP_META.Paris;
  const sortedRows = mapRegionRows(rows, city, metricKey, Boolean(options.lowerIsBetter));
  const mapRows = sortedRows.slice(0, city === "Paris" ? 20 : 12).map((r) => {
    const area = r.area || r.label;
    const regionId = boundaryRegionId(city, area);
    return {
      regionId,
      regionName: shortArea(area),
      label: shortArea(area),
      value: Number(num(r[metricKey]).toFixed(2)),
      display: displayFormatter(r[metricKey]),
      ...regionCoord(city, area),
      listings: Number(num(r.listings).toFixed(0)),
      listingsDisplay: fmtInt(r.listings),
      priceDisplay: fmtEuro(r.medianPrice),
      revenueDisplay: fmtEuro(r.revenue),
      opportunityDisplay: fmtScore(r.opportunity),
      saturationDisplay: fmtScore(r.saturation),
      occupancyDisplay: fmtPct(r.occupancy),
    };
  });
  return [{
    kind: "region-map",
    city,
    title,
    mapLabel: meta.label,
    center: meta.center,
    zoom: options.zoom || meta.zoom,
    geoJsonUrl: meta.geoJsonUrl,
    regionIdProperty: meta.regionIdProperty,
    regionNameProperty: meta.regionNameProperty,
    highlightedRegions: mapRows.slice(0, 4).map((row) => row.regionId),
    metricKey: "value",
    metricLabel,
    metricNote: options.metricNote || metricNoteForKey(metricKey, metricLabel),
    tone: options.tone || "opportunity",
    lowerIsBetter: Boolean(options.lowerIsBetter),
    legendLow: options.legendLow || "lower",
    legendHigh: options.legendHigh || "higher",
    data: mapRows,
  }];
}

async function marketAnalysis(prompt) {
  const rows = await loadNeighbourhoodStats();
  const city = cityFromPrompt(prompt) || "Paris";
  const cityRows = rows.filter((r) => r.city === city);
  const expensive = /(expensive|costliest|costly|premium|luxury|highest (?:median |nightly |rental |rent )?price|highest priced|most expensive|pricey)/i.test(prompt);
  const cheap = /(cheap|cheapest|affordable|budget|low price|lowest|nightly price|median price|rent price|rental price|monthly rent)/i.test(prompt);
  const revenue = /(revenue|income|earning|yield)/i.test(prompt);
  const demand = /(occupancy|demand|booked|tourist)/i.test(prompt);
  const family = /(family|safe|safest|live|living)/i.test(prompt);
  const saturated = /(saturat|avoid|too high|crowd|overbuilt)/i.test(prompt);
  const scoreKey = expensive || cheap ? "medianPrice" : revenue ? "revenue" : demand ? "occupancy" : saturated ? "saturation" : family ? "saturation" : "opportunity";
  const lowerIsBetter = cheap || family;
  const ranked = topN(cityRows, scoreKey, 6, !lowerIsBetter);
  const mapSourceRows = cityRows;
  const best = ranked[0] || cityRows[0] || {};
  const totalListings = cityRows.reduce((s, r) => s + r.listings, 0);
  const chartMetric = expensive || cheap ? "medianPrice" : revenue ? "revenue" : demand ? "occupancy" : saturated ? "saturation" : family ? "saturation" : "opportunity";
  const chartTitle = expensive
    ? `${city} highest median nightly prices`
    : cheap
      ? `${city} lowest median nightly prices`
      : revenue
      ? `${city} average revenue by region`
      : demand
        ? `${city} occupancy by region`
        : family
          ? `${city} lower-saturation areas for a calmer shortlist`
          : saturated
            ? `${city} areas with highest saturation pressure`
            : `${city} opportunity ranking`;
  const mainKpi = expensive ? "Most expensive area" : cheap ? "Cheapest area" : revenue ? "Top revenue area" : demand ? "Top demand area" : family ? "Lower-pressure area" : saturated ? "Highest saturation" : "Best opportunity";
  const mainScoreLabel = expensive || cheap ? "Median nightly price" : revenue ? "Average revenue" : demand ? "Average occupancy" : family || saturated ? "Saturation score" : "Opportunity score";
  const mainScoreValue = expensive || cheap ? fmtEuro(best.medianPrice) : revenue ? fmtEuro(best.revenue) : demand ? fmtPct(best.occupancy) : fmtScore(best[chartMetric]);
  const supportingKpis = expensive || cheap
    ? [
      { label: "Opportunity score", value: fmtScore(best.opportunity) },
      { label: "Listings reviewed", value: fmtInt(totalListings) },
      { label: "Average revenue", value: fmtEuro(best.revenue) },
      { label: "Saturation score", value: fmtScore(best.saturation) },
    ]
    : revenue
      ? [
        { label: "Median nightly price", value: fmtEuro(best.medianPrice) },
        { label: "Average occupancy", value: fmtPct(best.occupancy) },
        { label: "Listings reviewed", value: fmtInt(totalListings) },
      ]
      : demand
        ? [
          { label: "Average revenue", value: fmtEuro(best.revenue) },
          { label: "Median nightly price", value: fmtEuro(best.medianPrice) },
          { label: "Listings reviewed", value: fmtInt(totalListings) },
        ]
        : family || saturated
          ? [
            { label: "Opportunity score", value: fmtScore(best.opportunity) },
            { label: "Median nightly price", value: fmtEuro(best.medianPrice) },
            { label: "Listings reviewed", value: fmtInt(totalListings) },
          ]
          : [
            { label: "Median nightly price", value: fmtEuro(best.medianPrice) },
            { label: "Average revenue", value: fmtEuro(best.revenue) },
            { label: "Listings reviewed", value: fmtInt(totalListings) },
          ];
  const mapRequested = wantsRegionMap(prompt);
  const vizRequest = visualizationRequest(prompt);
  const metricLabel = expensive || cheap ? "Median nightly price" : revenue ? "Average revenue" : demand ? "Average occupancy" : saturated || family ? "Saturation score" : "Opportunity score";
  const metricDisplay = expensive || cheap || revenue ? fmtEuro : demand ? fmtPct : fmtScore;
  const rankingVisualization = makeViz(chartTitle, ranked.map((r) => ({
    label: r.area,
    value: r[chartMetric],
    display: metricDisplay(r[chartMetric]),
  })), metricLabel, expensive || cheap ? "price" : revenue ? "revenue" : demand ? "occupancy" : "score", { kind: "horizontal-bar" });
  const mapTitle = expensive
    ? `${city} map: highest nightly prices`
    : cheap
      ? `${city} map: lowest nightly prices`
      : revenue
      ? `${city} map: strongest revenue regions`
      : demand
        ? `${city} map: strongest occupancy regions`
        : family
          ? `${city} map: calmer regions to live`
          : saturated
            ? `${city} map: highest saturation pressure`
            : `${city} map: best opportunity regions`;
  const visualizations = mapRequested
    ? [
      ...makeRegionMap(
      mapTitle,
      city,
        mapSourceRows,
        chartMetric,
        metricLabel,
        metricDisplay,
      {
        tone: expensive || cheap ? "price" : family ? "livability" : saturated ? "risk" : revenue ? "price" : "opportunity",
        lowerIsBetter,
        legendLow: expensive || cheap ? "cheaper" : family ? "calmer" : "lower",
        legendHigh: expensive || cheap ? "costlier" : family ? "more saturated" : "higher",
      }
      ),
      ...rankingVisualization,
    ]
    : vizRequest.heatmap
      ? makeSegmentHeatmap(`${city} ${metricLabel.toLowerCase()} by segment`, cityRows, chartMetric, metricLabel, {
        formatter: metricDisplay,
        tone: expensive || cheap ? "price" : family ? "livability" : saturated ? "risk" : "opportunity",
      })
    : vizRequest.relationship
      ? makeBubbleScatter(`${city} revenue versus saturation trade-off`, topN(cityRows, "opportunity", 10, true), {
        xKey: "saturation",
        yKey: "revenue",
        sizeKey: "listings",
        xLabel: "Saturation score",
        yLabel: "Average revenue",
        metricNote: "Bubble chart: use this when the question is about trade-offs. Higher revenue is attractive, while lower saturation means less competitive pressure; bubble size shows listing volume.",
      })
    : vizRequest.distribution
      ? makeHistogram(`${city} ${metricLabel.toLowerCase()} distribution`, cityRows, chartMetric, metricLabel, {
        formatter: metricDisplay,
      })
    : vizRequest.composition
      ? makeDonut(`${city} listing share by distance zone`, [...cityRows.reduce((map, row) => {
        const key = row.zone || "Unknown zone";
        const current = map.get(key) || { label: key, listings: 0 };
        current.listings += row.listings;
        map.set(key, current);
        return map;
      }, new Map()).values()].sort((a, b) => b.listings - a.listings), "label", "listings", "Listings", {
        formatter: fmtInt,
        labelFormatter: humanizeSegmentLabel,
        metricNote: "Donut chart: best for share questions. Each slice shows how much of the city dataset sits in each distance zone.",
      })
    : rankingVisualization;
  return {
    intent: "market-entry",
    title: `${city} market-entry recommendation`,
    recommendation: expensive
      ? `${shortArea(best.area)} is the highest-price area in the current ${city} neighbourhood summary, so treat it as the clearest premium-cost area in this short-term-rental dataset.`
      : cheap
        ? `${shortArea(best.area)} is the lowest-price area in the current ${city} neighbourhood summary, so it is the clearest affordability shortlist.`
        : revenue
        ? `${shortArea(best.area)} has the strongest average revenue signal among the ${city} regions in the prepared project data.`
        : demand
          ? `${shortArea(best.area)} has the strongest occupancy signal among the ${city} regions in the prepared project data.`
      : family
        ? `${shortArea(best.area)} is a calmer first shortlist because it combines lower saturation with enough listing activity to benchmark the market.`
        : saturated
      ? `Avoid starting with ${shortArea(best.area)}; it has the strongest saturation signal among the ${city} areas in the project data.`
      : `Start with ${shortArea(best.area)}; it has the strongest opportunity signal among the ${city} areas in the project data.`,
    facts: [
      `${city} has ${fmtInt(totalListings)} listings represented in neighbourhood summary data.`,
      `${shortArea(best.area)} has an opportunity score of ${fmtScore(best.opportunity)} and saturation score of ${fmtScore(best.saturation)}.`,
      `Median nightly price in ${shortArea(best.area)} is ${fmtEuro(best.medianPrice)} with average annual revenue around ${fmtEuro(best.revenue)}.`,
    ],
    kpis: uniqueKpis([
      { label: mainKpi, value: shortArea(best.area) },
      { label: mainScoreLabel, value: mainScoreValue },
      ...supportingKpis,
    ]),
    visualizations,
    details: sourceDetails(
      [FILES.neighbourhoodStats],
      mapRequested
        ? "Rank neighbourhoods using the prepared neighbourhood summary table and render a real city map with approximate ARIA neighbourhood overlays. The map zooms to the city detected in the prompt and colors regions by the selected metric: opportunity, saturation, median nightly price, average revenue, or occupancy."
        : "Rank neighbourhoods using the prepared neighbourhood summary table. The chart metric changes with the prompt: opportunity for investment, saturation for avoid/family-style shortlist prompts, median nightly price for affordability or premium-price prompts, average revenue for revenue prompts, and occupancy for demand prompts.",
      ["This is short-term-rental market intelligence, not a complete home-purchase or mortgage dataset."],
      ranked.map((r) => `${shortArea(r.area)}: opportunity ${fmtScore(r.opportunity)}, saturation ${fmtScore(r.saturation)}, median price ${fmtEuro(r.medianPrice)}`),
      metricGuides(["opportunity", "saturation", "medianNightlyPrice", "averageRevenue", "occupancy", "listings"])
    ),
  };
}

async function pricingAnalysis(prompt) {
  const city = cityFromPrompt(prompt);
  const isParis = city === "Paris";
  const pricing = isParis ? await loadParisPricing() : await loadAthensUnderpricing();
  const shap = await loadShap(isParis ? FILES.shapParis : FILES.shapAthens, isParis ? "shap-paris" : "shap-athens");
  const ranked = topN(pricing.areas, "avgGap", 6, true);
  const best = ranked[0] || pricing.areas[0] || {};
  const driverFocused = /(why|driver|explain|feature|shap|model|reason)/i.test(prompt);
  const compareFocused = /(actual|predicted|fair|compare|versus|vs|current)/i.test(prompt);
  const vizRequest = visualizationRequest(prompt);
  const mapMode = wantsRegionMap(prompt);
  const cityName = isParis ? "Paris" : "Athens";
  const bestGap = num(best.avgGap, 0);
  const hasPositiveAreaGap = bestGap > 0;
  const pricingRankingChart = makeViz(`${cityName} average underpricing gap by area`, ranked.map((r) => ({
    label: r.area,
    value: r.avgGap,
    display: fmtEuro(r.avgGap),
  })), "Avg gap", "gap", { kind: "horizontal-bar" });
  const sourceFiles = isParis
    ? [FILES.parisPredictions, FILES.shapParis]
    : [FILES.athensUnderpricing, FILES.shapAthens];
  const chart = driverFocused
    ? makeViz(`${cityName} main pricing model drivers`, shap.map((s) => ({
      label: s.displayFeature,
      value: s.impact,
      display: fmtScore(s.impact, 3),
    })), "Average SHAP impact", "impact", { kind: "horizontal-bar" })
    : mapMode
      ? [
        ...makeRegionMap(`${cityName} map: average pricing gap`, cityName, pricing.areas, "avgGap", "Average pricing gap", fmtEuro, {
          tone: "price",
          lowerIsBetter: false,
          legendLow: "lower gap",
          legendHigh: "higher gap",
        }),
        ...pricingRankingChart,
      ]
    : compareFocused
      ? makeViz(`${cityName} current vs predicted nightly price`, ranked.slice(0, 5).map((r) => ({
        label: r.area,
        actual: r.avgActual,
        predicted: r.avgPredicted,
        value: r.avgPredicted,
      })), "Nightly price", "predicted", {
        kind: "grouped-bar",
        series: [
          { key: "actual", name: "Current price" },
          { key: "predicted", name: "Predicted fair price" },
        ],
      })
      : vizRequest.distribution
        ? makeHistogram(`${cityName} pricing-gap distribution`, pricing.areas, "avgGap", "Average pricing gap", {
          formatter: fmtEuro,
          metricNote: "Histogram: best for seeing whether pricing upside is concentrated in a few areas or spread across the market.",
        })
        : vizRequest.relationship
          ? makeBubbleScatter(`${cityName} current versus fair price relationship`, topN(pricing.areas, "count", 10, true), {
            xKey: "avgActual",
            yKey: "avgPredicted",
            sizeKey: "count",
            xLabel: "Current average price",
            yLabel: "Predicted fair price",
            metricNote: "Bubble chart: best for comparing current price against model fair price. Points above the diagonal suggest pricing upside; larger bubbles represent more listings.",
          })
      : pricingRankingChart;
  return {
    intent: "pricing",
    title: `${isParis ? "Paris" : "Athens"} pricing opportunity`,
    recommendation: hasPositiveAreaGap
      ? `${shortArea(best.area)} shows the clearest pricing upside, with an average model gap of ${fmtEuro(best.avgGap)} per night.`
      : `${shortArea(best.area)} is the closest area-level pricing benchmark, but its average gap is ${fmtEuro(best.avgGap)} per night, so review listing-level positive-gap records before calling it underpriced.`,
    facts: [
      isParis
        ? `${fmtInt(pricing.positive)} of ${fmtInt(pricing.total)} Paris listings have a positive predicted price gap.`
        : `${fmtInt(pricing.total)} Athens listings are flagged as underpriced in the project output.`,
      hasPositiveAreaGap
        ? `The strongest area-level average gap is ${fmtEuro(best.avgGap)} in ${shortArea(best.area)}.`
        : `The strongest area-level benchmark is still slightly negative at ${fmtEuro(best.avgGap)} in ${shortArea(best.area)}, so the positive-gap opportunity is listing-specific rather than area-wide.`,
      `The most important model drivers include ${shap.slice(0, 3).map((s) => s.displayFeature).join(", ")}.`,
    ],
    kpis: [
      { label: "Top pricing area", value: shortArea(best.area) },
      { label: "Avg gap", value: fmtEuro(best.avgGap) },
      { label: isParis ? "Positive-gap listings" : "Underpriced listings", value: fmtInt(isParis ? pricing.positive : pricing.total) },
      { label: "Main driver", value: shap[0]?.displayFeature || "Model features" },
    ],
    visualizations: chart,
    details: sourceDetails(
      sourceFiles,
      "Use XGBoost prediction outputs to compare model-predicted fair nightly price with observed nightly price, then select the visualization that matches the prompt: price-gap ranking, current-versus-predicted comparison, or SHAP driver importance.",
      ["Small nightly gaps should be interpreted cautiously because pricing models have forecast error.", "If the user has a specific listing ID, it should be supplied for listing-level analysis."],
      shap.map((s) => `${s.displayFeature}: average absolute SHAP impact ${fmtScore(s.impact, 3)}`),
      metricGuides(["underpricingGap", "predictedPrice", "shapImpact", "medianNightlyPrice", "listings"])
    ),
  };
}

async function riskAnalysis(prompt) {
  const risk = await loadAthensRisk();
  const underpricing = await loadAthensUnderpricing();
  const priorityOverlap = [...underpricing.listingIds].filter((id) => risk.highIds.has(id)).length;
  const ranked = topN(risk.areas, "highShare", 6, true);
  const priorityRanked = topN(underpricing.areas, "highRisk", 6, true);
  const priorityMode = /(priority|underprice|underpriced|intervention|action|coach|first)/i.test(prompt);
  const distributionMode = /(distribution|threshold|score range|risk score|how many|spread)/i.test(prompt);
  const mapMode = wantsRegionMap(prompt);
  const vizRequest = visualizationRequest(prompt);
  const best = ranked[0] || risk.areas[0] || {};
  const priorityBest = priorityRanked[0] || {};
  const chart = mapMode
    ? [{
      kind: "region-map",
      city: "Athens",
      title: "Athens high-risk regional map",
      mapLabel: CITY_MAP_META.Athens.label,
      center: CITY_MAP_META.Athens.center,
      zoom: CITY_MAP_META.Athens.zoom,
      metricKey: "value",
      metricLabel: "High-risk share",
      tone: "risk",
      lowerIsBetter: false,
      legendLow: "lower risk",
      legendHigh: "higher risk",
      data: ranked.slice(0, 12).map((r) => ({
        label: shortArea(r.area),
        value: Number(num(r.highShare).toFixed(2)),
        display: fmtPct(r.highShare),
        ...regionCoord("Athens", r.area),
        listings: Number(num(r.count).toFixed(0)),
        listingsDisplay: fmtInt(r.count),
        priceDisplay: null,
        revenueDisplay: null,
        opportunityDisplay: null,
        saturationDisplay: null,
        occupancyDisplay: null,
      })),
    }, ...makeViz("Athens high-risk share by neighbourhood", ranked.map((r) => ({
      label: r.area,
      value: r.highShare,
      display: fmtPct(r.highShare),
    })), "High-risk share", "share", { kind: "horizontal-bar" })]
    : vizRequest.relationship
      ? makeBubbleScatter("Athens risk versus underpricing trade-off", priorityRanked.slice(0, 10), {
        xKey: "highRiskShare",
        yKey: "avgGap",
        sizeKey: "count",
        xLabel: "High-risk share",
        yLabel: "Average underpricing gap",
        metricNote: "Bubble chart: best for action-priority questions. Higher risk and larger positive pricing gaps identify areas that may need review first.",
      })
    : vizRequest.composition
      ? makeDonut("Athens high-risk listing share", [
        { label: "High-risk listings", count: risk.high },
        { label: "Not high-risk", count: Math.max(0, risk.total - risk.high) },
      ], "label", "count", "Listings", {
        formatter: fmtInt,
        metricNote: "Donut chart: best for share questions. It separates listings above the risk threshold from the rest of the Athens dataset.",
      })
    : distributionMode
    ? makeViz("Athens risk-score distribution", risk.bins.map((b) => ({
      label: b.label,
      value: b.share,
      display: fmtPct(b.share),
      count: b.count,
    })), "Share of listings", "share", { kind: "histogram", metricNote: "Histogram: best for risk spread questions. Each bar shows the share of listings within a risk-score band." })
    : priorityMode
      ? makeViz("High-risk and underpriced listings by area", priorityRanked.map((r) => ({
        label: r.area,
        value: r.highRisk,
        display: fmtInt(r.highRisk),
      })), "Priority listings", "count", { kind: "horizontal-bar" })
      : makeViz("Athens high-risk share by neighbourhood", ranked.map((r) => ({
        label: r.area,
        value: r.highShare,
        display: fmtPct(r.highShare),
      })), "High-risk share", "share", { kind: "horizontal-bar" });
  return {
    intent: "risk",
    title: "Athens host-risk prioritisation",
    recommendation: priorityMode && priorityBest.area
      ? `${shortArea(priorityBest.area)} should be reviewed first because it has the largest count of listings that are both underpriced and high risk.`
      : `${shortArea(best.area)} should be watched first because it has the highest share of high-risk listings in the Athens risk output.`,
    facts: [
      `${fmtInt(risk.high)} of ${fmtInt(risk.total)} Athens listings are above the high-risk threshold.`,
      `${fmtInt(priorityOverlap)} listings are both underpriced and high risk, making them strong coaching or intervention candidates.`,
      `${shortArea(best.area)} has ${fmtPct(best.highShare)} high-risk share in the grouped risk output.`,
    ],
    kpis: [
      { label: "High-risk listings", value: fmtInt(risk.high) },
      { label: "Priority overlap", value: fmtInt(priorityOverlap) },
      { label: priorityMode ? "Priority area" : "Highest-risk area", value: shortArea(priorityMode && priorityBest.area ? priorityBest.area : best.area) },
      { label: "Threshold", value: "70%" },
    ],
    visualizations: chart,
    details: sourceDetails(
      [FILES.athensRisk, FILES.athensUnderpricing],
      mapMode
        ? "Aggregate LightGBM risk probabilities by neighbourhood and render a real Athens map with approximate ARIA neighbourhood overlays for risk-by-area comparison prompts."
        : "Aggregate LightGBM risk probabilities by neighbourhood and combine them with the underpricing output. The visualization changes with the prompt: high-risk share, priority overlap count, or risk-score distribution.",
      ["Risk is a prioritisation signal for analyst review, not a final decision about a host."],
      ranked.map((r) => `${shortArea(r.area)}: ${fmtPct(r.highShare)} high-risk share, ${fmtInt(r.high)} high-risk listings`),
      metricGuides(["highRiskShare", "riskProbability", "priorityOverlap", "threshold", "listings"])
    ),
  };
}

async function demandAnalysis(prompt) {
  const rows = await loadNeighbourhoodStats();
  const city = cityFromPrompt(prompt) || "Athens";
  const cityRows = rows.filter((r) => r.city === city);
  const forecastAsked = /(forecast|90 day|future|summer|season|peak)/i.test(prompt);
  const revenueAsked = /(revenue|income|earning|yield)/i.test(prompt);
  const vizRequest = visualizationRequest(prompt);
  const mapMode = wantsRegionMap(prompt);
  const forecastRows = forecastAsked ? await loadProphetForecast(city) : [];
  const forecastRanked = forecastRows.length ? aggregateForecastAreas(forecastRows, cityRows) : [];

  if (forecastAsked && forecastRanked.length) {
    const rankedForecasts = forecastRanked.slice(0, 6);
    const bestForecast = rankedForecasts[0];
    const months = [...new Set(forecastRows.map((row) => row.month).filter(Boolean))].sort();
    const forecastWindow = months.length ? `${monthLabel(months[0])}-${monthLabel(months[months.length - 1])}` : "12 months";
    const sourceFile = forecastFileForCity(city);
    const forecastRankingChart = makeViz(`${city} 12-month Prophet demand scenario by area`, rankedForecasts.map((r) => ({
      label: r.area,
      value: r.forecastAvg,
      display: fmtDays(r.forecastAvg),
      forecastAvgDisplay: fmtDays(r.forecastAvg),
    })), "Forecast occupied nights", "forecastAvg", {
      kind: "horizontal-bar",
      metricNote: "Ranking bar: best for choosing areas. Higher bars indicate stronger average monthly occupied-night demand in the committed Prophet scenario output.",
    });
    const lineChart = forecastLineChart(city, bestForecast);
    const mapChart = mapMode ? makeRegionMap(`${city} map: strongest Prophet demand forecast`, city, forecastRanked, "forecastAvg", "Forecast occupied nights", fmtDays, {
      tone: "opportunity",
      lowerIsBetter: false,
      legendLow: "lower demand",
      legendHigh: "higher demand",
      metricNote: "Map: use this to compare where the forecast demand scenario is strongest. Athens currently uses centroid overlays because exact neighbourhood boundary polygons are not committed.",
    }) : [];
    const forecastTradeoffAsked = /(relationship|correlation|trade.?off|\bversus\b|\bvs\b|forecast.*revenue|revenue.*forecast|demand.*revenue|revenue.*demand|occupancy.*revenue|revenue.*occupancy)/i.test(prompt);
    const relationshipChart = forecastTradeoffAsked || (revenueAsked && vizRequest.relationship)
      ? makeBubbleScatter(`${city} forecast demand versus revenue`, forecastRanked.slice(0, 10), {
        xKey: "revenue",
        yKey: "forecastAvg",
        sizeKey: "listings",
        xLabel: "Average revenue",
        yLabel: "Forecast occupied nights",
        metricNote: "Bubble chart: best for demand-revenue trade-offs. Higher revenue and higher forecast occupied nights together are more attractive; bubble size shows listing evidence.",
      })
      : [];
    const chart = [
      ...mapChart,
      ...lineChart,
      ...forecastRankingChart,
      ...relationshipChart,
    ];
    return {
      intent: "demand",
      title: `${city} Prophet demand forecast`,
      recommendation: `${shortArea(bestForecast.area)} has the strongest committed Prophet demand scenario for ${city}, so it should lead the forecast-based shortlist.`,
      facts: [
        `${shortArea(bestForecast.area)} averages ${fmtDays(bestForecast.forecastAvg)} across the ${forecastWindow} window, where higher means stronger expected monthly demand.`,
        `Its peak month is ${bestForecast.peakMonth} at ${fmtDays(bestForecast.forecastPeak)}, which helps time pricing and acquisition review around seasonal demand.`,
        "The forecast is a scenario-based Prophet demand proxy built from annual occupancy, assumed short-term-rental seasonality, and review-growth momentum.",
      ],
      kpis: [
        { label: "Top forecast area", value: shortArea(bestForecast.area) },
        { label: "Avg forecast demand", value: fmtDays(bestForecast.forecastAvg) },
        { label: "Peak month", value: bestForecast.peakMonth },
        { label: "Forecast window", value: forecastWindow },
      ],
      visualizations: chart,
      details: sourceDetails(
        [sourceFile, FILES.neighbourhoodStats],
        "Load the committed Prophet forecast CSV for the detected city, aggregate forecast occupied nights by neighbourhood, then combine it with neighbourhood summary fields for map, ranking, and trade-off visuals. The Prophet output is used only as a scenario demand screen, not as a guaranteed booking forecast.",
        [
          "The Prophet files are scenario-based proxies, not forecasts trained on observed booking/calendar time series.",
          "Forecast intervals in the notebook were below the target coverage, so use this as a demand screen before property-level diligence.",
          "The result does not include acquisition cost, financing, tax, or final licensing checks.",
        ],
        rankedForecasts.map((r) => `${shortArea(r.area)}: average forecast ${fmtDays(r.forecastAvg)}, peak ${fmtDays(r.forecastPeak)} in ${r.peakMonth}, ${fmtInt(r.listings)} listings`),
        metricGuides(["forecastOccupiedNights", "averageRevenue", "occupancy", "listings"])
      ),
    };
  }

  const ranked = topN(cityRows, "occupancy", 6, true);
  const best = ranked[0] || cityRows[0] || {};
  const occupancyRankingChart = makeViz(`${city} occupancy by neighbourhood`, ranked.map((r) => ({
    label: r.area,
    value: r.occupancy,
    display: fmtPct(r.occupancy),
  })), "Occupancy", "occupancy", { kind: "horizontal-bar" });
  const chart = mapMode
    ? [
      ...makeRegionMap(`${city} map: strongest occupancy regions`, city, cityRows, "occupancy", "Occupancy", fmtPct, {
        tone: "opportunity",
        lowerIsBetter: false,
        legendLow: "lower demand",
        legendHigh: "higher demand",
      }),
      ...occupancyRankingChart,
    ]
    : vizRequest.distribution
    ? makeHistogram(`${city} occupancy distribution`, cityRows, "occupancy", "Occupancy", {
      formatter: fmtPct,
      metricNote: "Histogram: best for demand-spread questions. Each bar shows how many areas fall into an occupancy range.",
    })
    : vizRequest.composition
      ? makeDonut(`${city} listing share by demand tier`, [
        { label: "High occupancy", listings: cityRows.filter((r) => r.occupancy >= 70).reduce((s, r) => s + r.listings, 0) },
        { label: "Medium occupancy", listings: cityRows.filter((r) => r.occupancy >= 50 && r.occupancy < 70).reduce((s, r) => s + r.listings, 0) },
        { label: "Lower occupancy", listings: cityRows.filter((r) => r.occupancy < 50).reduce((s, r) => s + r.listings, 0) },
      ], "label", "listings", "Listings", {
        formatter: fmtInt,
        metricNote: "Donut chart: best for share questions. It shows how much listing supply sits in higher, medium, or lower occupancy tiers.",
      })
    : revenueAsked || forecastAsked || vizRequest.relationship
      ? makeBubbleScatter(forecastAsked ? `${city} demand proxy: occupancy vs revenue` : `${city} revenue-demand trade-off`, topN(cityRows, "revenue", 10, true), {
        xKey: "revenue",
        yKey: "occupancy",
        sizeKey: "listings",
        xLabel: "Average revenue",
        yLabel: "Occupancy",
        metricNote: "Bubble chart: best for demand trade-offs. Higher revenue and higher occupancy are better together; bubble size shows how much listing evidence supports the point.",
      })
    : occupancyRankingChart;
  return {
    intent: "demand",
    title: `${city} occupancy signal`,
    recommendation: `${shortArea(best.area)} has the strongest occupancy signal in the current prepared neighbourhood data.`,
    facts: [
      `${shortArea(best.area)} has average occupancy of ${fmtPct(best.occupancy)} in the neighbourhood summary output.`,
      `Average annual revenue in ${shortArea(best.area)} is around ${fmtEuro(best.revenue)}.`,
      "For explicit forecast prompts, ARIA now uses the committed Prophet scenario forecast files; this demand view is the current occupancy proxy.",
    ],
    kpis: [
      { label: "Top demand area", value: shortArea(best.area) },
      { label: "Avg occupancy", value: fmtPct(best.occupancy) },
      { label: "Avg revenue", value: fmtEuro(best.revenue) },
      { label: "City", value: city },
    ],
    visualizations: chart,
    details: sourceDetails(
      [FILES.neighbourhoodStats],
      "Use prepared neighbourhood-level occupancy and revenue fields as a current demand proxy. Explicit forecast prompts use the committed Prophet forecast CSVs instead.",
      ["This current-demand view is not the Prophet scenario forecast; ask a forecast-oriented prompt to use the committed Prophet output."],
      ranked.map((r) => `${shortArea(r.area)}: occupancy ${fmtPct(r.occupancy)}, average revenue ${fmtEuro(r.revenue)}`),
      metricGuides(["occupancy", "averageRevenue", "medianNightlyPrice", "listings"])
    ),
  };
}

async function portfolioAnalysis(prompt = "") {
  const rows = await loadNeighbourhoodStats();
  const cities = ["Paris", "Athens"].map((city) => {
    const cityRows = rows.filter((r) => r.city === city);
    const listings = cityRows.reduce((s, r) => s + r.listings, 0);
    const revenue = weightedAverage(cityRows.reduce((s, r) => s + r.revenue * r.listings, 0), listings);
    const opportunity = weightedAverage(cityRows.reduce((s, r) => s + r.opportunity * r.listings, 0), listings);
    const saturation = weightedAverage(cityRows.reduce((s, r) => s + r.saturation * r.listings, 0), listings);
    const best = topN(cityRows, "opportunity", 1)[0] || {};
    return { city, listings, revenue, opportunity, saturation, bestArea: best.area };
  });
  const winner = [...cities].sort((a, b) => b.opportunity - a.opportunity)[0];
  const revenueAsked = /(revenue|income|earning|money|yield)/i.test(prompt);
  const scaleAsked = /(scale|listings|size|supply)/i.test(prompt);
  const saturationAsked = /(saturat|avoid|competition|crowd|overbuilt)/i.test(prompt);
  const vizRequest = visualizationRequest(prompt);
  const mapMetric = saturationAsked ? "saturation" : scaleAsked ? "listings" : revenueAsked ? "revenue" : "opportunity";
  const mapMetricLabel = saturationAsked ? "Saturation score" : scaleAsked ? "Listings reviewed" : revenueAsked ? "Average revenue" : "Opportunity score";
  const mapMetricDisplay = scaleAsked ? fmtInt : revenueAsked ? fmtEuro : fmtScore;
  const mapTone = saturationAsked ? "risk" : revenueAsked ? "price" : "opportunity";
  const mapSubject = saturationAsked
    ? "saturation pressure"
    : scaleAsked
      ? "listing supply by area"
      : revenueAsked
        ? "revenue opportunity"
        : "best opportunity neighbourhoods";
  const cityComparisonChart = vizRequest.composition || scaleAsked
    ? makeDonut("Listing share by city", cities, "city", "listings", "Listings", {
      formatter: fmtInt,
      metricNote: "Donut chart: best for portfolio share questions. It shows how much of the available listing evidence comes from each city.",
    })
    : vizRequest.relationship
      ? makeBubbleScatter("City opportunity versus saturation", cities.map((c) => ({
        area: c.city,
        opportunity: c.opportunity,
        saturation: c.saturation,
        listings: c.listings,
      })), {
        xKey: "saturation",
        yKey: "opportunity",
        sizeKey: "listings",
        xLabel: "Saturation score",
        yLabel: "Opportunity score",
        minPoints: 2,
        minDistinct: 2,
        minXSpreadRatio: 0.05,
        minYSpreadRatio: 0.05,
        maxCrowdedShare: 1,
        metricNote: "Bubble chart: best for strategy trade-offs. Higher opportunity is better, lower saturation is calmer, and bubble size shows market scale.",
      })
    : revenueAsked
    ? makeViz("Average revenue by city", cities.map((c) => ({
      label: c.city,
      value: c.revenue,
      display: fmtEuro(c.revenue),
    })), "Average revenue", "revenue", { kind: "bar" })
      : [{
        kind: "grouped-bar",
        title: "Opportunity vs saturation by city",
        xKey: "label",
        yKey: "opportunity",
        yLabel: "Score",
        series: [
          { key: "opportunity", name: "Opportunity" },
          { key: "saturation", name: "Saturation" },
        ],
        data: cities.map((c) => ({
          label: c.city,
          opportunity: Number(num(c.opportunity).toFixed(2)),
          saturation: Number(num(c.saturation).toFixed(2)),
        })),
      }];
  const chart = [
      ...makeRegionMap(
        `Athens map: ${mapSubject}`,
        "Athens",
        rows.filter((r) => r.city === "Athens"),
        mapMetric,
        mapMetricLabel,
        mapMetricDisplay,
        {
          tone: mapTone,
          lowerIsBetter: saturationAsked,
          legendLow: saturationAsked ? "calmer" : "lower",
          legendHigh: saturationAsked ? "more saturated" : "higher",
        }
      ),
      ...makeRegionMap(
        `Paris map: ${mapSubject}`,
        "Paris",
        rows.filter((r) => r.city === "Paris"),
        mapMetric,
        mapMetricLabel,
        mapMetricDisplay,
        {
          tone: mapTone,
          lowerIsBetter: saturationAsked,
          legendLow: saturationAsked ? "calmer" : "lower",
          legendHigh: saturationAsked ? "more saturated" : "higher",
        }
      ),
      ...cityComparisonChart,
    ];
  return {
    intent: "portfolio-comparison",
    title: "Paris vs Athens portfolio comparison",
    recommendation: `${winner.city} has the stronger average opportunity signal for a small short-term-rental portfolio in the current project data.`,
    facts: cities.map((c) => `${c.city}: ${fmtInt(c.listings)} listings, opportunity ${fmtScore(c.opportunity)}, average revenue ${fmtEuro(c.revenue)}, best area ${shortArea(c.bestArea)}.`),
    kpis: [
      { label: "Recommended city", value: winner.city },
      { label: "Paris listings", value: fmtInt(cities.find((c) => c.city === "Paris")?.listings) },
      { label: "Athens listings", value: fmtInt(cities.find((c) => c.city === "Athens")?.listings) },
      { label: "Best first area", value: shortArea(winner.bestArea) },
    ],
    visualizations: chart,
    details: sourceDetails(
      [FILES.neighbourhoodStats],
      "Compare city-level weighted averages from neighbourhood summaries. The visualization changes with the prompt: opportunity versus saturation for strategic choice, average revenue for revenue questions, and listing count for scale/supply questions.",
      ["The comparison is strategic market intelligence; final investment decisions still require property cost, financing, and regulation checks."],
      cities.map((c) => `${c.city}: saturation ${fmtScore(c.saturation)}, average revenue ${fmtEuro(c.revenue)}, best area ${shortArea(c.bestArea)}`),
      metricGuides(["opportunity", "saturation", "averageRevenue", "occupancy", "listings"])
    ),
  };
}

async function methodologyAnalysis() {
  const [langGraph, ragSession] = await Promise.all([
    fetchJson(FILES.langGraphSessionLog).catch(() => ({})),
    fetchJson(FILES.ragSessionLog).catch(() => ({})),
  ]);
  const routing = langGraph.routing_eval || {};
  const nQueries = routing.n_queries || 12;
  const personaAccuracy = num(routing.persona_accuracy, 1) * 100;
  const intentRecall = num(routing.intent_recall, 1) * 100;
  const intentPrecision = num(routing.intent_precision, 1) * 100;
  const ragDocs = ragSession?.corpus?.n_docs || 20;
  const ragUnlicensed = ragSession?.unlicensed?.total || 137;
  const chart = makeViz("ARIA model-output grounding by stage", [
    { label: "XGBoost pricing", value: 100, display: "wired" },
    { label: "LightGBM risk", value: 100, display: "wired" },
    { label: "Prophet forecast", value: 100, display: "wired" },
    { label: "RAG compliance", value: 100, display: "handoff triage" },
    { label: "LangGraph evidence", value: 100, display: "notebook proof" },
  ], "Grounding readiness", "readiness", {
    kind: "horizontal-bar",
    metricNote: "Readiness bar: shows which research-stage outputs are committed and available to the live Vercel agent or documentation story.",
  });
  return {
    intent: "methodology",
    title: "ARIA model and stage grounding",
    recommendation: "Present ARIA as a model-output-grounded decision-support system: the live agent should use committed ML/RAG outputs for evidence and the LangGraph notebook as orchestration proof, not claim live retraining inside chat.",
    facts: [
      "XGBoost pricing outputs are wired through Paris and Athens prediction CSVs plus SHAP values (model explanations showing which variables moved a prediction) for explainable pricing and underpricing answers.",
      "LightGBM risk outputs are wired through Athens risk scores and combined with underpricing outputs to identify priority review candidates.",
      "Prophet scenario forecasts are wired through committed Paris and Athens forecast CSVs for 12-month demand prompts.",
      `RAG compliance handoff outputs cover ${fmtInt(ragUnlicensed)} Athens unlicensed listings and ${fmtInt(ragDocs)} indexed compliance documents for analyst triage.`,
      `LangGraph routing evidence reports ${fmtPct(personaAccuracy, 0)} persona accuracy, ${fmtPct(intentRecall, 0)} intent recall, and ${fmtPct(intentPrecision, 0)} intent precision across ${fmtInt(nQueries)} notebook evaluation queries.`,
    ],
    kpis: [
      { label: "Live ML outputs", value: "XGB + LGBM + Prophet" },
      { label: "RAG triage rows", value: fmtInt(ragUnlicensed) },
      { label: "LangGraph eval", value: `${fmtPct(personaAccuracy, 0)} persona` },
      { label: "Quality bar", value: "97/100" },
    ],
    visualizations: chart,
    details: sourceDetails(
      ["README.md", "models/MODEL_CARD.md", FILES.langGraphSessionLog, FILES.langGraphRoutingEval, FILES.ragSessionLog],
      "Review the project stages and expose only the committed evidence that the live Vercel agent can safely use: XGBoost/SHAP pricing outputs, LightGBM risk scores, Prophet forecast CSVs, RAG handoff outputs, and LangGraph routing/session artifacts. The response-quality harness then checks that generated answers meet the 97/100 policy bar.",
      ["The live chat consumes committed outputs and does not retrain XGBoost, LightGBM, Prophet, or embeddings at request time.", "LangGraph is the research orchestration proof; the Vercel backend mirrors the routing concept in JavaScript rather than executing the Python graph service."],
      [
        "Phase 1: EDA and feature engineering define the modelling dataset and business signals.",
        "Phase 2: XGBoost predicts fair nightly price and SHAP explains pricing drivers.",
        "Phase 3: LightGBM estimates Athens host/listing risk after leakage correction.",
        "Phase 4: Prophet scenario CSVs provide 12-month neighbourhood demand signals.",
        "Phase 5: RAG handoff files provide compliance triage and citation context.",
        "Phase 6: LangGraph notebook proves multi-agent routing, synthesis, HITL, and PDF flow.",
        "Phase 7: Vercel turns committed outputs into answer, KPI, chart, map, source, and PDF payloads.",
      ],
      metricGuides(["readiness", "shapImpact", "riskProbability", "forecastOccupiedNights", "complianceRisk"])
    ),
  };
}

function complianceDocs(rag, ids) {
  const byId = new Map((rag.index?.documents || []).map((doc) => [doc.id, doc]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

const COMPLIANCE_EVIDENCE_SUMMARIES = new Map([
  ["ama_001", "AMA registration is mandatory for Greek short-term rentals under Law 4276/2014. Each compliant Athens listing needs a valid AMA number."],
  ["ama_005", "Greek platform listings must display a valid AMA number. Listings without one can be flagged for removal."],
  ["ama_006", "New AMA registrations were suspended in central Athens from 31 December 2024."],
  ["ama_007", "Unlicensed listings in the central Athens freeze zone cannot obtain new AMA registration after the freeze."],
  ["ama_008", "The freeze covers central Athens areas, while near and mid distance zones remain outside the freeze."],
  ["ama_009", "The freeze creates a supply cap that can strengthen the position of existing compliant central Athens operators."],
  ["ama_010", "AMA enforcement uses platform audits and local authority inspections; confirmed violations can lead to removal orders."],
  ["ama_011", "When unlicensed listings are removed, bookings can shift to surviving compliant listings in the same neighbourhood."],
  ["ama_014", "Near-zone unlicensed listings may still apply for AMA registration if building and property documents pass checks."],
  ["ama_016", "Existing AMA registration can act as a competitive moat in central Athens freeze zones."],
  ["loi_001", "Loi Le Meur limits French primary-residence short-term rentals to 90 nights per calendar year."],
  ["loi_002", "Paris STR operators need SIRET or business registration in the documented income or non-primary-residence cases."],
  ["loi_004", "Enforcement began in January 2025; stricter local caps can change the Paris supply outlook for investors."],
]);

function firstCompleteSentence(text, max = 260) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  const sentence = clean.split(/(?<=[.!?])\s+/).find(Boolean) || clean;
  if (sentence.length <= max) return sentence.replace(/\s*[.!?]\s*$/, ".");
  const truncated = sentence.slice(0, max).replace(/\s+\S*$/, "").trim();
  return `${truncated}.`;
}

function complianceEvidenceSummary(doc) {
  return COMPLIANCE_EVIDENCE_SUMMARIES.get(doc?.id) || firstCompleteSentence(doc?.text || "", 260);
}

function complianceEvidenceLines(docs) {
  return docs.map((doc) => `${doc.id}: ${complianceEvidenceSummary(doc)}`);
}

function complianceSourceDetails(rag, docs, methodology, extra = [], metricKeys = []) {
  return {
    ...sourceDetails(
      [FILES.ragUnlicensedReport, FILES.ragComplianceIndex, FILES.ragSessionLog],
      methodology,
      ["Analyst triage only, not final legal advice.", "The answer uses committed RAG compliance handoff outputs; validate final interpretation with local counsel or the relevant authority.", "ChromaDB index files remain local/managed and are not served by the Vercel function."],
      [
        ...complianceEvidenceLines(docs),
        ...extra,
      ],
      metricGuides(metricKeys)
    ),
    citationIds: docs.map((doc) => doc.id),
    sourcePassages: docs.map((doc) => ({
      id: doc.id,
      title: doc.title,
      citation: doc.citation,
      text: complianceEvidenceSummary(doc),
    })),
    ragDocumentCount: rag.index?.n_documents || rag.session?.corpus?.n_docs || (rag.index?.documents || []).length,
  };
}

function complianceTopic(prompt) {
  const p = String(prompt || "").toLowerCase();
  if (/\bloi\s+le\s+meur\b|\bsiret\b|\bprimary residences?\b|\b90[-\s]?night\b|\bparis\b.*\b(?:str|short[-\s]?term|registration|residence)\b/.test(p)) return "loi-le-meur";
  if (/\b(enforcement|remove|removal|deactivate|deactivation|platform audit|platform removal)\b/.test(p)) return "enforcement";
  if (/\b(invest|investment|impact|opportunity|moat|supply|demand|market)\b/.test(p) && /\b(freeze|central athens|ama)\b/.test(p)) return "athens-freeze-investment";
  if (/\b(compare|near[-\s]?zone|near zone|near_1_3km|regulari[sz])\b/.test(p) && /\b(freeze|central athens|dec(?:ember)?\s+2024|ama|unlicensed)\b/.test(p)) return "zone-comparison";
  if (/\b(freeze|frozen|central athens|dec(?:ember)?\s+2024|regulari[sz])\b/.test(p)) return "athens-freeze";
  if (/\b(ama|registration|register|mandatory|license|licence|permit|display)\b/.test(p)) return "ama-registration";
  return "portfolio-triage";
}

function wantsComplianceAnalysis(prompt) {
  return /\b(show|triage|evidence|review|compare|cite|source|passages?|risk|explain|recommend|strategy|decision|investor|portfolio)\b/i.test(String(prompt || ""));
}

function simpleComplianceAnswer({ direct, evidence, implication, caveat = "This is analyst triage from ARIA's committed RAG handoff, not final legal advice; verify the operating decision with local counsel or the relevant authority." }) {
  return [
    direct,
    "",
    `Source evidence:\n${evidence.map((line) => `- ${line}`).join("\n")}`,
    "",
    `Business implication:\n${implication}`,
    "",
    `Caveat:\n${caveat}`,
  ].join("\n");
}

function complianceTemplateAnswer({ direct, evidence, implication, tableRows = [], nextActions = [], visualGuidance = "Use the source evidence above. No market chart is attached because this is a legal/compliance question." }) {
  const comparison = tableRows.length
    ? [
      "Compliance comparison:",
      ...tableRows.map((row) => `- ${row.zone}: ${row.path}. Risk: ${row.risk}. Source: ${row.source}.`),
      "These rows are analyst triage categories, not legal determinations.",
      "",
    ].join("\n")
    : "";
  return [
    `Direct recommendation:\n${direct}`,
    "",
    `Source evidence:\n${evidence.map((line) => `- ${line}`).join("\n")}`,
    "",
    comparison,
    `Visualizations to review:\n${visualGuidance}`,
    "",
    `Business implication:\n${implication}`,
    "",
    "Caveat:\nARIA is using compliance evidence for analyst triage, not giving final legal advice.",
    "",
    `Next actions:\n${nextActions.map((action) => `- ${action}`).join("\n")}`,
  ].filter(Boolean).join("\n");
}

async function complianceAnalysis(prompt) {
  const rag = await loadRagCompliance();
  const topic = complianceTopic(prompt);
  const baseSources = [FILES.ragUnlicensedReport, FILES.ragComplianceIndex, FILES.ragSessionLog];

  if (topic === "ama-registration") {
    const docs = complianceDocs(rag, ["ama_001", "ama_005"]);
    const evidence = complianceEvidenceLines(docs, 220);
    const direct = "Yes. Athens short-term-rental operators must obtain an AMA registration number and display that AMA number on platform listings.";
    const facts = [
      "ama_001 says AMA registration is mandatory for Greek short-term-rental properties under Law 4276/2014.",
      "ama_005 says Greek platform listings must display a valid AMA number and listings without one can be flagged for removal.",
    ];
    return {
      intent: "compliance",
      title: "AMA registration requirement",
      recommendation: direct,
      facts,
      kpis: [
        { label: "AMA status", value: "Mandatory" },
        { label: "Display rule", value: "Required" },
        { label: "Citation IDs", value: "ama_001, ama_005" },
      ],
      visualizations: [],
      complianceAnswer: simpleComplianceAnswer({
        direct,
        evidence,
        implication: "Treat any Athens short-term-rental listing without a verifiable AMA as non-compliant until the owner can prove registration and platform display.",
      }),
      details: {
        ...complianceSourceDetails(
          rag,
          docs,
          "Route AMA and registration prompts to the committed RAG compliance index first, return citation IDs, and suppress investment visuals unless the user asks for market impact.",
          [],
          ["complianceRisk", "regularisable"]
        ),
        complianceMode: "rag-first",
        complianceTopic: topic,
      },
    };
  }

  if (topic === "athens-freeze-investment") {
    const docs = complianceDocs(rag, ["ama_006", "ama_007", "ama_009", "ama_011", "ama_016"]);
    const evidence = complianceEvidenceLines(docs);
    const direct = "For investors, the Athens AMA freeze makes existing compliant central listings more defensible, while unlicensed central listings carry high removal risk.";
    const facts = [
      "ama_006 defines the central Athens AMA freeze date and scope.",
      "ama_007 says unlicensed central-zone listings have no new AMA path after the freeze.",
      "ama_009 and ama_016 frame existing AMA registration as a supply-cap advantage for compliant operators.",
      "ama_011 says removed unlicensed supply can redirect bookings toward compliant nearby listings.",
    ];
    return {
      intent: "compliance",
      title: "Athens AMA freeze investment impact",
      recommendation: direct,
      facts,
      kpis: [
        { label: "Compliant moat", value: "Existing AMA" },
        { label: "Unlicensed path", value: "No new AMA" },
        { label: "Demand effect", value: "Redistribution" },
        { label: "Citation IDs", value: "ama_006, ama_007, ama_009, ama_011, ama_016" },
      ],
      visualizations: [],
      complianceAnswer: complianceTemplateAnswer({
        direct,
        evidence,
        tableRows: [
          { zone: "Existing compliant central listing", path: "Protected by the registration freeze because new competitors cannot easily enter", risk: "Lower", source: "ama_009, ama_016" },
          { zone: "Unlicensed central listing", path: "No new AMA path after the freeze and likely enforcement exposure", risk: "High", source: "ama_007" },
          { zone: "Compliant nearby operator", path: "May receive redistributed bookings if non-compliant supply is removed", risk: "Opportunity", source: "ama_011" },
        ],
        visualGuidance: "Use the compliance comparison above as the first investment screen. Ask for a separate market-impact chart only after confirming the asset is already compliant.",
        implication: "The investable signal is not to buy unlicensed central supply. It is to prioritise already registered central assets or compliant nearby operators that can benefit from a tighter legal supply cap.",
        nextActions: [
          "Verify the target property already has a valid AMA if it is in the central freeze zone.",
          "Treat unlicensed central assets as legal-reject or legal-escalation cases before any valuation work.",
          "After compliance is confirmed, compare demand, pricing, and underpricing outputs for the compliant shortlist.",
        ],
      }),
      details: {
        ...complianceSourceDetails(
          rag,
          docs,
          "Route AMA freeze investment-impact prompts to RAG evidence first, then explain the supply-cap and demand-redistribution implication without attaching unrelated market charts.",
          [],
          ["complianceRisk", "regularisable"]
        ),
        complianceMode: "rag-first",
        complianceTopic: topic,
      },
    };
  }

  if (topic === "athens-freeze" || topic === "zone-comparison") {
    const docs = complianceDocs(rag, ["ama_006", "ama_007", "ama_008", "ama_014"]);
    const evidence = complianceEvidenceLines(docs, 220);
    const direct = topic === "zone-comparison"
      ? "Central Athens unlicensed listings should be treated as no-new-AMA-path/high risk, while near-zone listings remain reviewable if property documents satisfy AMA requirements."
      : "An unlicensed central Athens listing has no clear regularisation path after the 31 December 2024 AMA freeze if it sits inside the central freeze zone.";
    const facts = [
      "ama_006 defines the central Athens AMA registration freeze effective 31 December 2024.",
      "ama_007 says unlicensed central-zone listings cannot obtain new AMA registration after the freeze.",
      "ama_008 defines the central freeze geography and says near/mid zones are outside the freeze.",
      "ama_014 says near_1_3km unlicensed listings have a theoretical AMA regularisation path if building and property documents pass checks.",
    ];
    const detailedFreeze = topic === "zone-comparison" || wantsComplianceAnalysis(prompt);
    const answer = detailedFreeze
      ? complianceTemplateAnswer({
        direct,
        evidence,
        tableRows: [
          { zone: "Central Athens freeze zone", path: "No new AMA path for unlicensed listings under the Dec 2024 freeze", risk: "High", source: "ama_007" },
          { zone: "Near zone outside freeze", path: "Potential AMA path after building-permit and property-document checks", risk: "Medium", source: "ama_014" },
        ],
        implication: "For acquisition screening, central unlicensed assets should move to legal reject/manual-escalation unless they already held AMA before the freeze. Near-zone assets can stay in the diligence queue, but only after document checks.",
        nextActions: [
          "Confirm whether the target address is inside the central freeze zone.",
          "Ask for existing AMA proof dated before 31 December 2024 if the listing is central.",
          "For near-zone listings, verify building permit status before assuming regularisation is possible.",
        ],
      })
      : simpleComplianceAnswer({
        direct,
        evidence,
        implication: "Central unlicensed listings carry high legal/removal risk; near-zone listings are different because the RAG source set still leaves a possible document-led regularisation path.",
      });
    return {
      intent: "compliance",
      title: topic === "zone-comparison" ? "Central Athens freeze versus near-zone regularisation" : "Central Athens AMA freeze",
      recommendation: direct,
      facts,
      kpis: [
        { label: "Central path", value: "No new AMA" },
        { label: "Near-zone path", value: "Possible" },
        { label: "Citation IDs", value: "ama_006, ama_007, ama_008, ama_014" },
      ],
      visualizations: [],
      complianceAnswer: answer,
      details: {
        ...complianceSourceDetails(
          rag,
          docs,
          "Route freeze and regularisation prompts to the RAG compliance index, compare central-zone and near-zone evidence, and suppress market opportunity charts unless the user explicitly asks for investment impact.",
          [],
          ["complianceRisk", "regularisable"]
        ),
        complianceMode: "rag-first",
        complianceTopic: topic,
      },
    };
  }

  if (topic === "enforcement") {
    const docs = complianceDocs(rag, ["ama_010", "ama_011"]);
    const evidence = complianceEvidenceLines(docs, 220);
    const direct = "When enforcement removes unlicensed Athens listings, non-compliant supply falls and guest demand can redistribute to surviving compliant operators.";
    const facts = [
      "ama_010 describes enforcement through platform audits, local inspection, removal orders, and platform removal obligations.",
      "ama_011 says demand served by removed unlicensed listings can redistribute to compliant listings in the same neighbourhood.",
    ];
    return {
      intent: "compliance",
      title: "AMA enforcement and supply redistribution",
      recommendation: direct,
      facts,
      kpis: [
        { label: "Mechanism", value: "Audit/removal" },
        { label: "Demand effect", value: "Redistribution" },
        { label: "Citation IDs", value: "ama_010, ama_011" },
      ],
      visualizations: [],
      complianceAnswer: simpleComplianceAnswer({
        direct,
        evidence,
        implication: "Compliant operators can benefit from enforcement if removed supply previously competed for the same guest demand. Investors should still validate that the target property is already compliant before relying on this upside.",
      }),
      details: {
        ...complianceSourceDetails(
          rag,
          docs,
          "Route enforcement/removal prompts to the RAG compliance index, answer the legal/compliance mechanism first, and avoid attaching unrelated opportunity or risk-score visuals.",
          [],
          ["complianceRisk"]
        ),
        complianceMode: "rag-first",
        complianceTopic: topic,
      },
    };
  }

  if (topic === "loi-le-meur") {
    const docs = complianceDocs(rag, ["loi_001", "loi_002", "loi_004"]);
    const evidence = complianceEvidenceLines(docs, 220);
    const direct = "Loi Le Meur tightens Paris short-term-rental rules by lowering the primary-residence cap to 90 nights, strengthening SIRET/registration obligations, and starting stronger enforcement from 2025.";
    const facts = [
      "loi_001 says the French primary-residence short-term-rental cap is 90 nights per calendar year.",
      "loi_002 says Paris STR operators need SIRET/business registration in the documented income or non-primary-residence cases.",
      "loi_004 says enforcement began in January 2025 and makes dedicated or secondary STR assets structurally different from primary-residence listings.",
    ];
    return {
      intent: "compliance",
      title: "Loi Le Meur Paris compliance",
      recommendation: direct,
      facts,
      kpis: [
        { label: "Primary cap", value: "90 nights" },
        { label: "Registration", value: "SIRET cases" },
        { label: "Citation IDs", value: "loi_001, loi_002, loi_004" },
      ],
      visualizations: [],
      complianceAnswer: simpleComplianceAnswer({
        direct,
        evidence,
        implication: "For investors, Paris primary-residence STR upside is capped and should not be treated like unrestricted hotel-style supply. Secondary or dedicated STR assets need stronger registration, tax, and local-rule due diligence before underwriting revenue.",
      }),
      details: {
        ...complianceSourceDetails(
          rag,
          docs,
          "Route Loi Le Meur, SIRET, 90-night cap, and Paris primary-residence prompts to the RAG compliance index before any Athens risk or market analytics.",
          [],
          ["complianceRisk"]
        ),
        complianceMode: "rag-first",
        complianceTopic: topic,
      },
    };
  }

  const riskRows = ["HIGH", "MEDIUM", "LOW"].map((level) => ({
    label: `${level.charAt(0)}${level.slice(1).toLowerCase()} risk`,
    count: rag.riskCounts.get(level) || 0,
  }));
  const rankedAreas = topN(rag.areas, "high", 6, true);
  const mapMode = wantsRegionMap(prompt);
  const riskMix = makeDonut("Athens unlicensed-listing compliance risk mix", riskRows, "label", "count", "Listings", {
    formatter: fmtInt,
    metricNote: "Donut chart: shows how the committed RAG handoff classifies unlicensed Athens listings by compliance triage risk.",
  });
  const areaRanking = makeViz("Athens high compliance-risk listings by neighbourhood", rankedAreas.map((area) => ({
    label: area.area,
    value: area.high,
    display: fmtInt(area.high),
    totalDisplay: fmtInt(area.count),
  })), "High-risk unlicensed listings", "count", {
    kind: "horizontal-bar",
    metricNote: "Ranking bar: identifies where high-risk unlicensed listings are concentrated for analyst review.",
  });
  const mapChart = mapMode ? makeRegionMap("Athens map: unlicensed compliance risk concentration", "Athens", rag.areas, "highShare", "High-risk share", fmtPct, {
    tone: "risk",
    lowerIsBetter: false,
    legendLow: "lower risk",
    legendHigh: "higher risk",
    metricNote: "Map: shows where the committed RAG handoff finds higher shares of high-risk unlicensed listings.",
  }) : [];
  const topCitation = rag.topCitations[0] || {};
  const nDocs = rag.index?.n_documents || rag.session?.corpus?.n_docs || rag.topCitations.length;
  return {
    intent: "compliance",
    title: "Athens RAG compliance triage",
    recommendation: "Use ARIA's committed RAG compliance handoff to prioritise Athens unlicensed-listing review, then validate final legal interpretation with local counsel.",
    facts: [
      `${fmtInt(rag.total)} Athens listings are flagged as unlicensed in the committed RAG handoff output.`,
      `${fmtInt(rag.highRisk)} listings are classified as high compliance risk, which means they should receive the earliest manual review.`,
      `${fmtInt(rag.regularisable)} listings are marked regularisable, meaning the handoff suggests a possible path to AMA registration that still needs document checks.`,
      topCitation.title ? `The most frequent supporting document is "${topCitation.title}", cited for ${fmtInt(topCitation.count)} listings.` : `The RAG index contains ${fmtInt(nDocs)} compliance documents.`,
    ],
    kpis: [
      { label: "Unlicensed listings", value: fmtInt(rag.total) },
      { label: "High-risk listings", value: fmtInt(rag.highRisk) },
      { label: "Regularisable", value: fmtInt(rag.regularisable) },
      { label: "Revenue at risk", value: fmtEuro(rag.revenueAtRisk) },
    ],
    visualizations: [
      ...mapChart,
      ...riskMix,
      ...areaRanking,
    ],
    complianceAnswer: complianceTemplateAnswer({
      direct: "Prioritise Athens unlicensed-listing review using the RAG handoff, then validate legal interpretation with local counsel.",
      evidence: [
        `${fmtInt(rag.total)} Athens listings are flagged as unlicensed in the committed RAG handoff output.`,
        `${fmtInt(rag.highRisk)} listings are classified as high compliance risk.`,
        `${fmtInt(rag.regularisable)} listings are marked regularisable and need document checks.`,
      ],
      implication: "This portfolio view is useful when the user asks for compliance triage or enforcement exposure. It should not replace source-specific answers for AMA, freeze, enforcement, or Loi Le Meur questions.",
      nextActions: [
        "Open the high-risk listing queue first.",
        "Check each listing's top citation and regularisable flag.",
        "Escalate central-zone non-regularisable cases for legal review.",
      ],
    }),
    details: {
      ...sourceDetails(
        baseSources,
        "Load the committed Phase 5 RAG handoff outputs, aggregate unlicensed Athens listings by compliance-risk level and neighbourhood, and expose the cited compliance document titles used by the notebook retrieval layer. The deployed backend consumes the handoff artifacts; it does not run live ChromaDB retrieval at request time.",
        ["Not legal advice.", "The output is analyst triage from committed RAG handoff files; final acquisition or operating decisions need local legal review.", "ChromaDB index files remain local/managed and are not served by the Vercel function."],
        [
          ...rankedAreas.map((area) => `${shortArea(area.area)}: ${fmtInt(area.high)} high-risk unlicensed listings, ${fmtInt(area.count)} total unlicensed listings`),
          ...rag.topCitations.map((citation) => `${citation.title}: cited for ${fmtInt(citation.count)} listings; ${citation.citation}`),
        ],
        metricGuides(["complianceRisk", "regularisable", "ragSimilarity", "listings"])
      ),
      complianceMode: "portfolio-triage",
      complianceTopic: topic,
    },
  };
}

function visualizationSummary(analysis) {
  return (analysis.visualizations || [])
    .slice(0, 4)
    .map((viz) => viz.title || viz.kind || "untitled visual")
    .join("; ");
}

function detailSignals(analysis, max = 5) {
  return (analysis.details?.extra || [])
    .slice(0, max)
    .filter(Boolean);
}

function extraAreaName(line) {
  return String(line || "").split(":")[0].trim();
}

function isFollowUpComparisonPrompt(analysis) {
  const prompt = `${analysis?.prompt || ""} ${analysis?.resolvedPrompt || ""}`;
  return /(why|better|next two|next 2|runner.?up|validate|acquiring|first property|before buying|before committing)/i.test(prompt)
    && Boolean(analysis?.conversationContext?.priorFocus || analysis?.conversationContext?.priorCity);
}

function focusFollowUpVisualPayload(analysis) {
  if (
    analysis.intent !== "demand"
    || !/prophet/i.test(analysis.title || "")
    || !isFollowUpComparisonPrompt(analysis)
  ) return;

  const ranking = (analysis.visualizations || []).find((viz) =>
    /12-month prophet demand scenario by area/i.test(viz.title || "")
    || viz.kind === "horizontal-bar"
  );
  const rows = (ranking?.data || [])
    .slice(0, 3)
    .map((row) => {
      const value = num(row.forecastAvg ?? row.value, NaN);
      if (!Number.isFinite(value)) return null;
      return {
        label: row.label || "Area",
        value,
        display: row.display || row.forecastAvgDisplay || fmtDays(value),
        forecastAvgDisplay: row.forecastAvgDisplay || row.display || fmtDays(value),
      };
    })
    .filter(Boolean);
  if (!rows.length) return;

  const city = analysis.conversationContext?.currentCity
    || analysis.conversationContext?.priorCity
    || cityFromPrompt(analysis.resolvedPrompt || analysis.prompt || "")
    || "Paris";
  const leader = rows[0]?.label || "recommended area";
  const alternatives = rows.slice(1).map((row) => row.label).filter(Boolean);
  analysis.visualizations = makeViz(
    `${city} follow-up: ${leader} vs ${alternatives.join(" and ") || "next options"}`,
    rows,
    "Forecast occupied nights",
    "forecastAvg",
    {
      kind: "horizontal-bar",
      metricNote: "Follow-up chart: compares only the recommended area and the next two alternatives. Earlier map and seasonality visuals remain available in the previous answer, so they are not repeated here.",
    }
  );
  analysis.kpis = [
    { label: "Recommended screen", value: leader, help: "The area ARIA would review first based on the current forecast comparison." },
    ...rows.slice(1).map((row, index) => ({
      label: index === 0 ? "Runner-up" : "Second alternative",
      value: row.label,
      help: "A close alternative that should stay in the acquisition due-diligence shortlist.",
    })),
    { label: "Visual focus", value: "Top 3 only", help: "Follow-up mode avoids repeating the full map and chart pack from the prior answer." },
  ];
  analysis.details = {
    ...analysis.details,
    methodology: `${analysis.details?.methodology || ""} For follow-up comparison prompts, ARIA returns only the new focused comparison visual and avoids repeating maps or seasonality charts already shown in the conversation.`.trim(),
  };
}

function deterministicDemandAnswer(analysis) {
  const facts = (analysis.facts || []).slice(0, 3);
  const signals = detailSignals(analysis, 6);
  const topSignals = signals.slice(0, 3);
  const leader = analysis.kpis?.find((kpi) => /top|area/i.test(kpi.label))?.value
    || extraAreaName(topSignals[0])
    || "the recommended Paris area";
  const nextAreas = topSignals.slice(1, 3).map(extraAreaName).filter(Boolean);
  const followUp = isFollowUpComparisonPrompt(analysis);
  const direct = followUp && nextAreas.length
    ? `Keep ${leader} as the first Paris acquisition screen, then compare it directly with ${nextAreas.join(" and ")} before selecting a property.`
    : analysis.recommendation;
  const evidenceLines = topSignals.length
    ? topSignals.map((line) => `- ${line}`).join("\n")
    : facts.map((fact) => `- ${fact}`).join("\n");
  const why = followUp
    ? `${leader} stays ahead because it ranks first in the committed Prophet demand scenario (a scenario estimate of occupied nights per month; higher means stronger expected demand). The next two areas are close enough to remain viable alternates, so ARIA treats the result as a priority order for due diligence rather than a guaranteed winner.`
    : `ARIA is using the committed Prophet demand scenario (a scenario estimate of occupied nights per month; higher means stronger expected demand) together with neighbourhood data. The goal is to shortlist the Paris areas most likely to support a small short-term-rental portfolio over the next 12 months.`;
  const limitations = (analysis.details?.limitations || [])
    .filter((line) => !/compliance prompts/i.test(line))
    .slice(0, 2)
    .join(" ");
  const actions = followUp
    ? [
      `Compare acquisition price, renovation cost, and expected nightly-rate strategy for ${leader} versus ${nextAreas.join(" and ") || "the runner-up areas"}.`,
      "Verify Paris short-term-rental registration, building rules, and the 120-day primary-residence limit with local counsel before committing.",
      "Inspect the first property for noise, lift/access, safety, transport, and nearby construction because these asset-level details can overturn a neighbourhood-level signal.",
    ]
    : [
      `Shortlist ${leader} and the next two areas from the ranking chart.`,
      "Use the map to check whether the top areas form a practical acquisition cluster.",
      "Validate property-level economics, licensing constraints, and seasonality before making an offer.",
    ];

  return localizePlaceNames(
    `Direct recommendation:\n${direct}\n\n` +
    `Reasoning done by ARIA:\n${why}\n\n` +
    `Key evidence:\n${evidenceLines}\n\n` +
    `Visualizations to review:\n${followUp
      ? `Use the focused comparison chart below to compare ${leader} with ${nextAreas.join(" and ") || "the next two options"}. The earlier map and seasonality chart remain useful context, so ARIA does not repeat them in this follow-up.`
      : `Use ${visualizationSummary(analysis) || "the returned map and charts"} to compare location, seasonality, and top-area ranking. The map shows where demand is concentrated; the line chart shows seasonality for ${leader}; the ranking chart compares the top Paris areas side by side.`}\n\n` +
    `Possible limitations:\n${limitations || "This is a demand-screening result, not a final acquisition decision. It does not include purchase price, financing, tax, or final licensing checks."}\n\n` +
    `Next actions:\n${actions.map((action) => `- ${action}`).join("\n")}`
  );
}

function stripFinalPunctuation(text) {
  return String(text || "").trim().replace(/[.!?]+$/g, "");
}

function metricGuideLine(guide) {
  const meaning = stripFinalPunctuation(guide.meaning);
  const range = stripFinalPunctuation(guide.range);
  const good = stripFinalPunctuation(guide.good);
  return `- ${guide.label}: ${meaning}. ${range}. ${good}.`;
}

function deterministicPricingAnswer(analysis) {
  const facts = (analysis.facts || []).slice(0, 3);
  const guides = (analysis.details?.metricGuides || []).slice(0, 3).map(metricGuideLine).join("\n");
  const topArea = analysis.kpis?.find((kpi) => /top pricing area/i.test(kpi.label))?.value || "the top pricing area";
  const avgGap = analysis.kpis?.find((kpi) => /avg gap/i.test(kpi.label))?.value || "";
  const negativeGap = String(avgGap).trim().startsWith("-");
  const driver = analysis.kpis?.find((kpi) => /main driver/i.test(kpi.label))?.value || "the SHAP drivers";
  const actions = negativeGap
    ? [
      "Drill into listing-level positive-gap records instead of assuming the whole area is underpriced.",
      "Use the SHAP driver chart to check whether the pricing gap is explained by location, capacity, bedrooms, or review quality.",
      "Validate current nightly prices against comparable live listings before changing price.",
    ]
    : [
      `Review listings in ${topArea} first because the model gap suggests pricing upside.`,
      "Use the SHAP driver chart to understand which features support the price move.",
      "Adjust prices gradually and monitor booking pace after each change.",
    ];

  return localizePlaceNames(
    `Direct recommendation:\n${analysis.recommendation}\n\n` +
    `Reasoning done by ARIA:\n- ARIA compares XGBoost fair-price estimates with current nightly prices.\n- ${facts[0] || "The pricing output identifies listings with positive model gaps."}\n- ${facts[2] || `The most important driver is ${driver}.`}\n\n` +
    `Key evidence:\n${guides}\n\n` +
    `Visualizations to review:\nUse the returned pricing chart${visualizationSummary(analysis) ? ` (${visualizationSummary(analysis)})` : ""} to review the price-gap ranking or SHAP driver importance. For SHAP, longer bars mean the feature moved the model more.\n\n` +
    `Possible limitations:\nSmall euro-per-night gaps are directional, not automatic price moves. A specific listing ID would allow a more precise listing-level recommendation.\n\n` +
    `Next actions:\n${actions.map((action) => `- ${action}`).join("\n")}`
  );
}

function deterministicRiskAnswer(analysis) {
  const facts = (analysis.facts || []).slice(0, 3);
  const guides = (analysis.details?.metricGuides || []).slice(0, 3).map(metricGuideLine).join("\n");
  const priorityArea = analysis.kpis?.find((kpi) => /priority area|highest-risk area/i.test(kpi.label))?.value || "the top Athens area";
  return localizePlaceNames(
    `Direct recommendation:\n${analysis.recommendation}\n\n` +
    `Reasoning done by ARIA:\n- ARIA combines LightGBM risk flags with the Athens underpricing output to form an action queue.\n- ${facts[0] || "The risk output identifies listings above the high-risk threshold."}\n- ${facts[1] || "The overlap with underpricing marks listings that deserve manager review first."}\n\n` +
    `Key evidence:\n${guides}\n\n` +
    `Visualizations to review:\nUse the returned priority chart${visualizationSummary(analysis) ? ` (${visualizationSummary(analysis)})` : ""} to see where the highest count of review targets sits. Longer bars mean more listings need attention.\n\n` +
    `Possible limitations:\nRisk is a prioritisation signal, not a final judgement about a host or property. Review the individual listing, price, reviews, and licensing context before acting.\n\n` +
    `Next actions:\n- Start with ${priorityArea} and open the underlying listing queue.\n- Separate pricing fixes from legal or quality issues before contacting hosts.\n- Recheck the highest-risk listings after any price or listing-quality intervention.`
  );
}

function deterministicAnswer(analysis) {
  if (analysis.intent === "compliance" && analysis.details?.complianceMode === "rag-first" && analysis.complianceAnswer) {
    return localizePlaceNames(analysis.complianceAnswer);
  }
  if (analysis.intent === "demand" && /prophet/i.test(analysis.title || "")) {
    return deterministicDemandAnswer(analysis);
  }
  if (analysis.intent === "pricing") return deterministicPricingAnswer(analysis);
  if (analysis.intent === "risk") return deterministicRiskAnswer(analysis);
  const factLines = analysis.facts
    .slice(0, 3)
    .map((fact) => `- ${fact}`)
    .join("\n");
  const metricLines = (analysis.details?.metricGuides || [])
    .slice(0, 3)
    .map(metricGuideLine)
    .join("\n");
  return localizePlaceNames(
    `Direct recommendation:\n${analysis.recommendation}\n\n` +
    `Reasoning done by ARIA:\n- This recommendation is grounded in the project dataset, not a generic travel ranking.\n${factLines}\n\n` +
    `Key evidence:\n${metricLines}\n\n` +
    `Visualizations to review:\nUse the generated chart or map to compare the strongest areas, risk signals, or pricing gaps visually before making a decision.\n\n` +
    `Possible limitations:\nUse this as a starting shortlist, not as a final purchase decision. A stronger signal means the area deserves earlier due diligence, but each apartment still needs property-level checks.\n\n` +
    `Next actions:\n- Shortlist the strongest areas or listings above and open the chart or map to compare them side by side.\n- Verify actual purchase or listing prices, local licensing limits, and demand before committing.\n- Ask ARIA a follow-up to drill into the specific area, price gap, risk, or forecast that matters most to your decision.`
  );
}

function qualityCheck(answer, analysis) {
  const warnings = [];
  if (!answer || answer.length < 40) warnings.push("Answer is too short.");
  if ((analysis.kpis || []).length > 4) warnings.push("Too many headline KPIs.");
  const visualizationOptional = analysis.intent === "compliance" && analysis.details?.complianceMode === "rag-first";
  if (!(analysis.visualizations || []).length && !visualizationOptional) warnings.push("No visualization returned.");
  if (!analysis.details?.sourceFiles?.length) warnings.push("No source files listed.");
  const score = Math.max(0, 100 - warnings.length * 7);
  return { score, warnings, passed: score >= 97 };
}

export async function buildGroundedAnalysis({ prompt, agentId, messages = [] }) {
  const context = resolvePromptContext(prompt, messages);
  const analysisPrompt = context.analysisPrompt;
  const intent = classifyIntent(analysisPrompt, agentId);
  let analysis;
  if (intent === "pricing") analysis = await pricingAnalysis(analysisPrompt);
  else if (intent === "risk") analysis = await riskAnalysis(analysisPrompt);
  else if (intent === "demand") analysis = await demandAnalysis(analysisPrompt);
  else if (intent === "portfolio-comparison") analysis = await portfolioAnalysis(analysisPrompt);
  else if (intent === "methodology") analysis = await methodologyAnalysis(analysisPrompt);
  else if (intent === "compliance") analysis = await complianceAnalysis(analysisPrompt);
  else analysis = await marketAnalysis(analysisPrompt);

  analysis.prompt = prompt;
  analysis.resolvedPrompt = analysisPrompt;
  analysis.conversationContext = context;
  focusFollowUpVisualPayload(analysis);
  analysis.kpis = attachKpiHelp(uniqueKpis(analysis.kpis || []));
  const fallbackAnswer = deterministicAnswer(analysis);
  const quality = qualityCheck(fallbackAnswer, analysis);
  const conversationText = context.history.length
    ? context.history.map((message) => `${message.role === "user" ? "User" : "ARIA"}: ${message.text}`).join("\n")
    : "No previous conversation supplied.";
  return {
    ...analysis,
    fallbackAnswer,
    quality,
    sources: analysis.details.sourceFiles,
    contextText: [
      `Current user question: ${prompt}`,
      `Resolved analysis question: ${analysisPrompt}`,
      `Conversation resolution: ${context.summary}`,
      `Recent conversation: ${conversationText}`,
      `Intent: ${analysis.intent}`,
      `Recommendation: ${analysis.recommendation}`,
      `Facts: ${analysis.facts.join(" ")}`,
      `KPIs: ${analysis.kpis.map((k) => `${k.label}: ${k.value}`).join("; ")}`,
      `Visualizations: ${(analysis.visualizations || []).map((viz) => viz.title || viz.kind || "untitled").join("; ") || "none"}`,
      `Compliance citation IDs: ${(analysis.details?.citationIds || []).join(", ") || "none"}`,
      `Compliance source passages: ${(analysis.details?.sourcePassages || []).map((doc) => `${doc.id}: ${doc.text}`).join(" ") || "none"}`,
      `Additional signals: ${(analysis.details?.extra || []).slice(0, 12).join(" ") || "none"}`,
      `Visualization data summary: ${(analysis.visualizations || []).slice(0, 4).map((viz) => {
        const sample = (viz.data || []).slice(0, 6).map((row) => {
          const value = row.display || row.forecastAvgDisplay || row.value || "";
          return `${row.label || row.regionName || row.x || "item"}: ${value}`;
        }).join(", ");
        return `${viz.title || viz.kind}: ${sample || "no row data"}`;
      }).join(" | ") || "none"}`,
      `Methodology: ${analysis.details.methodology}`,
      `Metric explanations: ${(analysis.details.metricGuides || []).map((g) => `${g.label} means ${g.meaning} Range: ${g.range} Interpretation: ${g.good} Optimal use: ${g.optimal}`).join(" ")}`,
      `Limitations: ${analysis.details.limitations.join(" ")}`,
      `Sources: ${analysis.details.sourceFiles.join(", ")}`,
    ].join("\n"),
  };
}
