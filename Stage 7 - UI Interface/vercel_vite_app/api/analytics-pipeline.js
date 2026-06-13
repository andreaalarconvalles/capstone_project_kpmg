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

function topN(items, scoreKey, n = 6, desc = true) {
  return [...items]
    .filter((d) => Number.isFinite(num(d[scoreKey], NaN)))
    .sort((a, b) => desc ? num(b[scoreKey]) - num(a[scoreKey]) : num(a[scoreKey]) - num(b[scoreKey]))
    .slice(0, n);
}

function weightedAverage(sum, weight) {
  return weight ? sum / weight : 0;
}

function classifyIntent(prompt, agentId) {
  const p = `${prompt} ${agentId}`.toLowerCase();
  if (/(portfolio|paris.*athens|athens.*paris|50-unit|fifty-unit)/.test(p)) return "portfolio-comparison";
  if (/(risk|high-risk|declin|vulnerab|priority|churn|warning)/.test(p)) return "risk";
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
  const p = prompt.toLowerCase();
  if (p.includes("paris")) return "Paris";
  if (p.includes("athens")) return "Athens";
  return "";
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
    return { total, high, highIds, avgRisk: weightedAverage(riskSum, total), areas };
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
      .map(([feature, sum]) => ({ feature, impact: weightedAverage(sum, rows) }))
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 6);
  });
}

function sourceDetails(sourceFiles, methodology, limitations, extra = []) {
  return {
    methodology,
    sourceFiles,
    limitations,
    extra,
  };
}

function makeViz(title, data, yLabel = "Score", yKey = "value") {
  return [{
    kind: "bar",
    title,
    xKey: "label",
    yKey,
    yLabel,
    data: data.map((d) => ({
      label: shortArea(d.label),
      [yKey]: Number(num(d.value).toFixed(2)),
      display: d.display || String(d.value),
    })),
  }];
}

async function marketAnalysis(prompt) {
  const rows = await loadNeighbourhoodStats();
  const city = cityFromPrompt(prompt) || "Paris";
  const cityRows = rows.filter((r) => r.city === city);
  const saturated = /(saturat|avoid|too high|risk)/i.test(prompt);
  const ranked = topN(cityRows, saturated ? "saturation" : "opportunity", 6, true);
  const best = ranked[0] || cityRows[0] || {};
  const totalListings = cityRows.reduce((s, r) => s + r.listings, 0);
  const chartMetric = saturated ? "saturation" : "opportunity";
  const chartTitle = saturated ? `${city} areas with highest saturation pressure` : `${city} opportunity ranking`;
  return {
    intent: "market-entry",
    title: `${city} market-entry recommendation`,
    recommendation: saturated
      ? `Avoid starting with ${shortArea(best.area)}; it has the strongest saturation signal among the ${city} areas in the project data.`
      : `Start with ${shortArea(best.area)}; it has the strongest opportunity signal among the ${city} areas in the project data.`,
    facts: [
      `${city} has ${fmtInt(totalListings)} listings represented in neighbourhood summary data.`,
      `${shortArea(best.area)} has an opportunity score of ${fmtScore(best.opportunity)} and saturation score of ${fmtScore(best.saturation)}.`,
      `Median nightly price in ${shortArea(best.area)} is ${fmtEuro(best.medianPrice)} with average annual revenue around ${fmtEuro(best.revenue)}.`,
    ],
    kpis: [
      { label: saturated ? "Highest saturation" : "Best opportunity", value: shortArea(best.area) },
      { label: "Opportunity score", value: fmtScore(best.opportunity) },
      { label: "Median nightly price", value: fmtEuro(best.medianPrice) },
      { label: "Listings reviewed", value: fmtInt(totalListings) },
    ],
    visualizations: makeViz(chartTitle, ranked.map((r) => ({
      label: r.area,
      value: r[chartMetric],
      display: fmtScore(r[chartMetric]),
    })), saturated ? "Saturation" : "Opportunity"),
    details: sourceDetails(
      [FILES.neighbourhoodStats],
      "Rank neighbourhoods using the prepared neighbourhood summary table, prioritising opportunity score unless the user asks about saturation or areas to avoid.",
      ["This is short-term-rental market intelligence, not a complete home-purchase or mortgage dataset."],
      ranked.map((r) => `${shortArea(r.area)}: opportunity ${fmtScore(r.opportunity)}, saturation ${fmtScore(r.saturation)}, median price ${fmtEuro(r.medianPrice)}`)
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
  const sourceFiles = isParis
    ? [FILES.parisPredictions, FILES.shapParis]
    : [FILES.athensUnderpricing, FILES.shapAthens];
  return {
    intent: "pricing",
    title: `${isParis ? "Paris" : "Athens"} pricing opportunity`,
    recommendation: `${shortArea(best.area)} shows the clearest pricing upside, with an average model gap of ${fmtEuro(best.avgGap)} per night.`,
    facts: [
      isParis
        ? `${fmtInt(pricing.positive)} of ${fmtInt(pricing.total)} Paris listings have a positive predicted price gap.`
        : `${fmtInt(pricing.total)} Athens listings are flagged as underpriced in the project output.`,
      `The strongest area-level average gap is ${fmtEuro(best.avgGap)} in ${shortArea(best.area)}.`,
      `The most important model drivers include ${shap.slice(0, 3).map((s) => s.feature).join(", ")}.`,
    ],
    kpis: [
      { label: "Top pricing area", value: shortArea(best.area) },
      { label: "Avg gap", value: fmtEuro(best.avgGap) },
      { label: isParis ? "Positive-gap listings" : "Underpriced listings", value: fmtInt(isParis ? pricing.positive : pricing.total) },
      { label: "Main driver", value: shap[0]?.feature || "Model features" },
    ],
    visualizations: makeViz(`${isParis ? "Paris" : "Athens"} average underpricing gap by area`, ranked.map((r) => ({
      label: r.area,
      value: r.avgGap,
      display: fmtEuro(r.avgGap),
    })), "Avg gap", "gap"),
    details: sourceDetails(
      sourceFiles,
      "Use XGBoost prediction outputs to compare model-predicted fair nightly price with observed nightly price, then aggregate the gap by area.",
      ["Small nightly gaps should be interpreted cautiously because pricing models have forecast error.", "If the user has a specific listing ID, it should be supplied for listing-level analysis."],
      shap.map((s) => `${s.feature}: average absolute SHAP impact ${fmtScore(s.impact, 3)}`)
    ),
  };
}

async function riskAnalysis(prompt) {
  const risk = await loadAthensRisk();
  const underpricing = await loadAthensUnderpricing();
  const priorityOverlap = [...underpricing.listingIds].filter((id) => risk.highIds.has(id)).length;
  const ranked = topN(risk.areas, "highShare", 6, true);
  const best = ranked[0] || risk.areas[0] || {};
  return {
    intent: "risk",
    title: "Athens host-risk prioritisation",
    recommendation: `${shortArea(best.area)} should be watched first because it has the highest share of high-risk listings in the Athens risk output.`,
    facts: [
      `${fmtInt(risk.high)} of ${fmtInt(risk.total)} Athens listings are above the high-risk threshold.`,
      `${fmtInt(priorityOverlap)} listings are both underpriced and high risk, making them strong coaching or intervention candidates.`,
      `${shortArea(best.area)} has ${fmtPct(best.highShare)} high-risk share in the grouped risk output.`,
    ],
    kpis: [
      { label: "High-risk listings", value: fmtInt(risk.high) },
      { label: "Priority overlap", value: fmtInt(priorityOverlap) },
      { label: "Highest-risk area", value: shortArea(best.area) },
      { label: "Threshold", value: "0.70" },
    ],
    visualizations: makeViz("Athens high-risk share by neighbourhood", ranked.map((r) => ({
      label: r.area,
      value: r.highShare,
      display: fmtPct(r.highShare),
    })), "High-risk share", "share"),
    details: sourceDetails(
      [FILES.athensRisk, FILES.athensUnderpricing],
      "Aggregate LightGBM risk probabilities by neighbourhood and combine them with the underpricing output to identify high-risk listings with revenue upside.",
      ["Risk is a prioritisation signal for analyst review, not a final decision about a host."],
      ranked.map((r) => `${shortArea(r.area)}: ${fmtPct(r.highShare)} high-risk share, ${fmtInt(r.high)} high-risk listings`)
    ),
  };
}

async function demandAnalysis(prompt) {
  const rows = await loadNeighbourhoodStats();
  const city = cityFromPrompt(prompt) || "Athens";
  const cityRows = rows.filter((r) => r.city === city);
  const ranked = topN(cityRows, "occupancy", 6, true);
  const best = ranked[0] || cityRows[0] || {};
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
      { label: "City", value: city },
    ],
    visualizations: makeViz(`${city} occupancy by neighbourhood`, ranked.map((r) => ({
      label: r.area,
      value: r.occupancy,
      display: fmtPct(r.occupancy),
    })), "Occupancy", "occupancy"),
    details: sourceDetails(
      [FILES.neighbourhoodStats],
      "Use prepared neighbourhood-level occupancy and revenue fields as a demand proxy for direct consumer-facing ranking.",
      ["This is not yet a live Prophet forecast; it is a grounded demand proxy from the prepared project dataset."],
      ranked.map((r) => `${shortArea(r.area)}: occupancy ${fmtPct(r.occupancy)}, average revenue ${fmtEuro(r.revenue)}`)
    ),
  };
}

async function portfolioAnalysis() {
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
    visualizations: makeViz("Average portfolio opportunity by city", cities.map((c) => ({
      label: c.city,
      value: c.opportunity,
      display: fmtScore(c.opportunity),
    })), "Opportunity"),
    details: sourceDetails(
      [FILES.neighbourhoodStats],
      "Compare city-level weighted averages from neighbourhood summaries, using listing counts as weights and opportunity score as the main portfolio entry signal.",
      ["The comparison is strategic market intelligence; final investment decisions still require property cost, financing, and regulation checks."],
      cities.map((c) => `${c.city}: saturation ${fmtScore(c.saturation)}, average revenue ${fmtEuro(c.revenue)}, best area ${shortArea(c.bestArea)}`)
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
      []
    ),
  };
}

function deterministicAnswer(analysis) {
  const facts = analysis.facts.slice(0, 3).join(" ");
  return localizePlaceNames(
    `Recommendation: Based on our short-term rental market analysis, ${analysis.recommendation}\n\n` +
    `Why this makes sense: This recommendation is grounded in the project dataset rather than a generic travel ranking, so it is focused on market-entry potential, pricing conditions, demand signals, and saturation risk. ${facts}\n\n` +
    `What this means for you: This gives you a starting point for where to search first and what to compare next. A stronger opportunity signal does not automatically mean every apartment in that area is a good deal; it means the area deserves earlier due diligence because the market conditions look more favourable in the data.\n\n` +
    `Next step: For a first investment, use this as a shortlist direction: compare actual purchase prices, local licensing rules, building quality, financing costs, and property condition before committing.`
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

export async function buildGroundedAnalysis({ prompt, agentId }) {
  const intent = classifyIntent(prompt, agentId);
  let analysis;
  if (intent === "pricing") analysis = await pricingAnalysis(prompt);
  else if (intent === "risk") analysis = await riskAnalysis(prompt);
  else if (intent === "demand") analysis = await demandAnalysis(prompt);
  else if (intent === "portfolio-comparison") analysis = await portfolioAnalysis(prompt);
  else if (intent === "compliance") analysis = await complianceAnalysis(prompt);
  else analysis = await marketAnalysis(prompt);

  const fallbackAnswer = deterministicAnswer(analysis);
  const quality = qualityCheck(fallbackAnswer, analysis);
  return {
    ...analysis,
    fallbackAnswer,
    quality,
    sources: analysis.details.sourceFiles,
    contextText: [
      `Intent: ${analysis.intent}`,
      `Recommendation: ${analysis.recommendation}`,
      `Facts: ${analysis.facts.join(" ")}`,
      `KPIs: ${analysis.kpis.map((k) => `${k.label}: ${k.value}`).join("; ")}`,
      `Chart: ${analysis.visualizations?.[0]?.title || "none"}`,
      `Methodology: ${analysis.details.methodology}`,
      `Limitations: ${analysis.details.limitations.join(" ")}`,
      `Sources: ${analysis.details.sourceFiles.join(", ")}`,
    ].join("\n"),
  };
}
