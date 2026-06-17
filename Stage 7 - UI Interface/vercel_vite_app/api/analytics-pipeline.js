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
  return `€${Math.round(num(value)).toLocaleString("en-US")}`;
}

function fmtPct(value, digits = 1) {
  return `${num(value).toFixed(digits)}%`;
}

function fmtScore(value, digits = 2) {
  return num(value).toFixed(digits);
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
    label: "Model driver impact",
    meaning: "A SHAP-based explanation of which variables moved the pricing model most.",
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
    range: "Lowest is 0.00, highest is 1.00; the current high-risk cutoff is 0.70.",
    good: "Lower is better for safety; above 0.70 should be treated as a review flag.",
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
    range: "In this project, 0.70 means a listing is flagged high risk.",
    good: "Higher probabilities above the threshold need more attention.",
    optimal: "The threshold is a triage setting: strict enough to focus review, but not a final decision by itself.",
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
  if (l.includes("opportunity")) return "0-1 score. Higher is better; above 0.70 is a strong shortlist signal.";
  if (l.includes("saturation")) return "0-1 crowding score. Lower is calmer; above 0.60 means a more crowded market.";
  if (l.includes("median nightly") || l.includes("price")) return "Euro nightly rental price, not purchase price. Lower helps affordability; higher needs strong demand.";
  if (l.includes("revenue")) return "Rental revenue signal. Higher is better only if demand, risk, and saturation are acceptable.";
  if (l.includes("occupancy") || l.includes("demand")) return "Booked-night share. Higher usually means stronger demand; around 60-80% is a healthy screen.";
  if (l.includes("listing")) return "Number of listings behind the calculation. More data improves confidence but can also mean more competition.";
  if (l.includes("gap") || l.includes("underpricing")) return "Euro-per-night pricing upside. Positive means the model thinks the current price may be low.";
  if (l.includes("risk")) return "Risk signal. Lower is safer; above 0.70 probability is treated as high-risk.";
  if (l.includes("priority overlap")) return "Listings that are both high-risk and underpriced. Higher means more urgent review.";
  if (l.includes("threshold")) return "Model cutoff. In this project, 0.70 or above is flagged for high-risk review.";
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

function classifyIntent(prompt, agentId) {
  const p = `${prompt} ${agentId}`.toLowerCase();
  const cityMentions = cityMentionsFromPrompt(prompt);
  if (/(portfolio|50-unit|fifty-unit)/.test(p) || cityMentions.has("Paris") && cityMentions.has("Athens")) return "portfolio-comparison";
  if (/(underprice|underpriced|fair price|predicted price|pricing gap|price gap|shap|model driver)/.test(p)) return "pricing";
  if (/(family|safe|safest|live|living|cheap|cheapest|affordable|budget|expensive|costliest|premium|luxury|rent|rental)/.test(p)) return "market-entry";
  if (/(risk|high-risk|declin|vulnerab|priority|churn|warning)/.test(p)) return "risk";
  if (/(opportunity|saturat|distance zone|segment|heat.?map|short-term rental|market|investment|nightly prices?|median nightly|median price|highest price|highest priced|most expensive|revenue.*saturation|saturation.*revenue)/.test(p)) return "market-entry";
  if (/(map|region|regions|area comparison|compare areas|compare regions|neighbourhoods|neighborhoods|arrondissements|districts|where in|which areas|which regions)/.test(p)) return "market-entry";
  if (/(underprice|price|pricing|revenue|nightly|gap|earning|income|adr)/.test(p)) return "pricing";
  if (/(forecast|occupancy|tourist|demand|season|90 day|future|summer|peak)/.test(p)) return "demand";
  if (/(license|licence|legal|law|regulation|compliance|permit)/.test(p)) return "compliance";
  if (/(saturat|avoid|invest|entry|arrondissement|neighbourhood|neighborhood|yield|region|where|area)/.test(p)) return "market-entry";
  if (agentId === "host-revenue") return "pricing";
  if (agentId === "demand") return "demand";
  if (agentId === "gentrification" || agentId === "crime") return "risk";
  return "market-entry";
}

function cityFromPrompt(prompt) {
  const mentions = cityMentionsFromPrompt(prompt);
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
    const mentions = cityMentionsFromPrompt(messages[i].text);
    if (mentions.size === 1) return [...mentions][0];
  }
  return "";
}

function metricFocus(prompt) {
  const p = String(prompt || "");
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
      { label: "0.00-0.20", min: 0, max: 0.2, count: 0 },
      { label: "0.20-0.40", min: 0.2, max: 0.4, count: 0 },
      { label: "0.40-0.60", min: 0.4, max: 0.6, count: 0 },
      { label: "0.60-0.70", min: 0.6, max: 0.7, count: 0 },
      { label: "0.70-0.85", min: 0.7, max: 0.85, count: 0 },
      { label: "0.85-1.00", min: 0.85, max: 1.01, count: 0 },
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
    return { label: `${formatter(lo)}–${formatter(hi)}`, value: 0, count: 0, display: "0 regions" };
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

function makeBubbleScatter(title, rows, options = {}) {
  const xKey = options.xKey || "saturation";
  const yKey = options.yKey || "revenue";
  const sizeKey = options.sizeKey || "listings";
  return [{
    kind: "bubble-scatter",
    title,
    xKey,
    yKey,
    sizeKey,
    xLabel: options.xLabel || "Saturation score",
    yLabel: options.yLabel || "Average revenue",
    metricNote: options.metricNote || "Bubble chart: position shows the trade-off between two metrics, while bubble size reflects listing volume.",
    data: rows.map((r) => {
      const sizeValue = Math.max(1, Number(num(r[sizeKey] || r.count || 1).toFixed(0)));
      return {
        label: shortArea(r.area || r.label),
        [xKey]: Number(num(r[xKey]).toFixed(2)),
        [yKey]: Number(num(r[yKey]).toFixed(2)),
        [sizeKey]: sizeValue,
        display: options.display ? options.display(r) : "",
        listingsDisplay: fmtInt(r[sizeKey] || r.count || 0),
      };
    }),
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
  return /(\bmap\b|region|regions|area comparison|compare areas|compare regions|neighbourhoods|neighborhoods|arrondissements|districts|where in|which areas|which regions)/i.test(prompt);
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
    recommendation: `${shortArea(best.area)} shows the clearest pricing upside, with an average model gap of ${fmtEuro(best.avgGap)} per night.`,
    facts: [
      isParis
        ? `${fmtInt(pricing.positive)} of ${fmtInt(pricing.total)} Paris listings have a positive predicted price gap.`
        : `${fmtInt(pricing.total)} Athens listings are flagged as underpriced in the project output.`,
      `The strongest area-level average gap is ${fmtEuro(best.avgGap)} in ${shortArea(best.area)}.`,
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
      { label: "Threshold", value: "0.70" },
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
  const ranked = topN(cityRows, "occupancy", 6, true);
  const best = ranked[0] || cityRows[0] || {};
  const forecastAsked = /(forecast|90 day|future|summer|season|peak)/i.test(prompt);
  const revenueAsked = /(revenue|income|earning|yield)/i.test(prompt);
  const vizRequest = visualizationRequest(prompt);
  const mapMode = wantsRegionMap(prompt);
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
      "The current deployed data supports demand ranking; full Prophet time-series forecasting remains a next-stage model layer.",
    ],
    kpis: [
      { label: "Top demand area", value: shortArea(best.area) },
      { label: "Avg occupancy", value: fmtPct(best.occupancy) },
      { label: "Avg revenue", value: fmtEuro(best.revenue) },
      { label: forecastAsked ? "Forecast status" : "City", value: forecastAsked ? "Proxy only" : city },
    ],
    visualizations: chart,
    details: sourceDetails(
      [FILES.neighbourhoodStats],
      "Use prepared neighbourhood-level occupancy and revenue fields as a demand proxy. If the user asks for a forecast, the chart remains grounded in current prepared data because no committed Prophet forecast output is available in the deployed repository yet.",
      ["This is not yet a live Prophet forecast; it is a grounded demand proxy from the prepared project dataset."],
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
  const vizRequest = visualizationRequest(prompt);
  const chart = vizRequest.composition || scaleAsked
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

async function complianceAnalysis() {
  const rows = await loadNeighbourhoodStats();
  const cities = [...new Set(rows.map((r) => r.city))].join(" + ");
  return {
    intent: "compliance",
    title: "Compliance readiness",
    recommendation: "Use ARIA compliance output as a triage layer, then validate final legal interpretation outside the model.",
    facts: [
      `The current deployed summaries cover ${cities} market and listing signals.`,
      "The compliance/Retrieval-Augmented Generation layer is a planned extension rather than a complete live legal retrieval system.",
    ],
    kpis: [
      { label: "Status", value: "Triage-ready" },
      { label: "Cities", value: cities },
      { label: "Live legal RAG", value: "Planned" },
      { label: "Use case", value: "Analyst review" },
    ],
    visualizations: makeViz("Compliance workflow readiness", [
      { label: "Market data", value: 100, display: "ready" },
      { label: "Risk scoring", value: 85, display: "ready" },
      { label: "Legal retrieval", value: 35, display: "planned" },
    ], "Readiness"),
    details: sourceDetails(
      [FILES.neighbourhoodStats],
      "Frame compliance prompts as data triage using current market/risk features; avoid final legal advice until the regulation retrieval layer is connected.",
      ["Not legal advice.", "Live legal document retrieval is not included in the current deployed backend."],
      [],
      metricGuides(["readiness"])
    ),
  };
}

function deterministicAnswer(analysis) {
  const factLines = analysis.facts
    .slice(0, 3)
    .map((fact) => `- ${fact}`)
    .join("\n");
  const metricLines = (analysis.details?.metricGuides || [])
    .slice(0, 3)
    .map((g) => `- ${g.label}: ${g.meaning} ${g.good}`)
    .join("\n");
  return localizePlaceNames(
    `Direct recommendation:\n${analysis.recommendation}\n\n` +
    `Reasoning done by ARIA:\n- This recommendation is grounded in the project dataset, not a generic travel ranking.\n${factLines}\n\n` +
    `Key evidence:\n${metricLines}\n\n` +
    `Visualizations to review:\nUse the generated chart or map to compare the strongest areas, risk signals, or pricing gaps visually before making a decision.\n\n` +
    `Possible limitations:\nUse this as a starting shortlist, not as a final purchase decision. A stronger signal means the area deserves earlier due diligence, but each apartment still needs property-level checks. For compliance prompts, ARIA provides analyst triage rather than legal advice until the RAG layer is connected.`
  );
}

function qualityCheck(answer, analysis) {
  const warnings = [];
  if (!answer || answer.length < 40) warnings.push("Answer is too short.");
  if ((analysis.kpis || []).length > 4) warnings.push("Too many headline KPIs.");
  if (!(analysis.visualizations || []).length) warnings.push("No visualization returned.");
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
  else if (intent === "compliance") analysis = await complianceAnalysis(analysisPrompt);
  else analysis = await marketAnalysis(analysisPrompt);

  analysis.kpis = attachKpiHelp(uniqueKpis(analysis.kpis || []));
  const fallbackAnswer = deterministicAnswer(analysis);
  const quality = qualityCheck(fallbackAnswer, analysis);
  const conversationText = context.history.length
    ? context.history.map((message) => `${message.role === "user" ? "User" : "ARIA"}: ${message.text}`).join("\n")
    : "No previous conversation supplied.";
  return {
    ...analysis,
    prompt,
    resolvedPrompt: analysisPrompt,
    conversationContext: context,
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
      `Methodology: ${analysis.details.methodology}`,
      `Metric explanations: ${(analysis.details.metricGuides || []).map((g) => `${g.label} means ${g.meaning} Range: ${g.range} Interpretation: ${g.good} Optimal use: ${g.optimal}`).join(" ")}`,
      `Limitations: ${analysis.details.limitations.join(" ")}`,
      `Sources: ${analysis.details.sourceFiles.join(", ")}`,
    ].join("\n"),
  };
}
