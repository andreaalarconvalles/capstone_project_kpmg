import { GoogleAuth } from "google-auth-library";
import { buildGroundedAnalysis, localizePlaceNames } from "./analytics-pipeline.js";

const CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const DEFAULT_LOCATION = "europe-west1";
const DEFAULT_MODEL = "gemini-2.5-pro";
const PARIS_ARRONDISSEMENTS_GEOJSON_URL = "https://geo.api.gouv.fr/communes?codeDepartement=75&type=arrondissement-municipal&format=geojson&geometry=contour";
const ANTHROPIC_VERTEX_VERSION = "vertex-2023-10-16";
const AGENT_PROFILES = {
  "host-revenue": { name: "Host Revenue Intelligence", tagline: "your personal revenue manager" },
  gentrification: { name: "Gentrification Early Warning", tagline: "displacement risk 12-24 months ahead" },
  crime: { name: "STR Financial Crime Detection", tagline: "AML anomaly and SAR intelligence" },
  demand: { name: "Tourism Demand Forecast", tagline: "infrastructure load intelligence" },
  market: { name: "Market Entry Advisor", tagline: "site selection and ROI intelligence" },
};
const AGENT_ROUTER_RULES = [
  {
    id: "host-revenue",
    supporting: ["demand", "market"],
    patterns: [
      "price", "pricing", "priced", "underpriced", "overpriced", "revenue", "nightly", "rate",
      "rent out", "host", "listing", "occupancy", "income", "profit", "yield", "description",
    ],
  },
  {
    id: "gentrification",
    supporting: ["market", "crime"],
    patterns: [
      "gentrification", "displacement", "family", "live", "safe", "safest", "neighbourhood pressure",
      "neighborhood pressure", "resident", "community", "risk highest", "host risk", "attention first",
    ],
  },
  {
    id: "crime",
    supporting: ["gentrification", "host-revenue"],
    patterns: [
      "aml", "money laundering", "financial crime", "sar", "suspicious", "anomaly", "compliance",
      "flagged", "fraud", "regulator", "risk score", "high-risk",
    ],
  },
  {
    id: "demand",
    supporting: ["host-revenue", "market"],
    patterns: [
      "forecast", "tourism", "demand", "season", "seasonality", "infrastructure", "metro", "airport",
      "event", "peak", "30 days", "90 days", "occupancy forecast",
    ],
  },
  {
    id: "market",
    supporting: ["host-revenue", "demand", "gentrification"],
    patterns: [
      "invest", "investment", "buy", "purchase", "best area", "best place", "where should",
      "compare", "portfolio", "paris vs athens", "athens vs paris", "market entry", "opportunity",
      "region", "map", "short-term rental", "airbnb", "arrondissement", "neighbourhood", "neighborhood",
    ],
  },
];

function json(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function routeAgentForPrompt({ requestedAgentId, prompt }) {
  if (requestedAgentId && requestedAgentId !== "auto" && AGENT_PROFILES[requestedAgentId]) {
    return { agentId: requestedAgentId, requestedAgentId, supportingAgentIds: [], auto: false };
  }

  const p = String(prompt || "").toLowerCase();
  const scored = AGENT_ROUTER_RULES.map((rule, index) => {
    const score = rule.patterns.reduce((sum, pattern) => (
      p.includes(pattern) ? sum + (pattern.length > 8 ? 2 : 1) : sum
    ), 0);
    return { ...rule, score, index };
  }).sort((a, b) => (b.score - a.score) || (a.index - b.index));

  const selected = scored[0]?.score > 0 ? scored[0] : AGENT_ROUTER_RULES.find((rule) => rule.id === "market");
  const supportingAgentIds = [
    ...(selected.supporting || []),
    ...scored.filter((rule) => rule.id !== selected.id && rule.score > 0).map((rule) => rule.id),
  ].filter((id, index, arr) => id !== selected.id && arr.indexOf(id) === index).slice(0, 3);

  return { agentId: selected.id, requestedAgentId: "auto", supportingAgentIds, auto: true };
}

function readCredentials() {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
    || process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    || process.env.VERTEX_SERVICE_ACCOUNT_JSON;

  if (!raw) return null;

  const decoded = raw.trim().startsWith("{")
    ? raw
    : Buffer.from(raw, "base64").toString("utf8");

  const credentials = JSON.parse(decoded);
  if (credentials.private_key) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
  }
  return credentials;
}

async function getAccessToken() {
  const credentials = readCredentials();
  if (!credentials) {
    throw new Error(
      "Vertex AI service account credentials are not configured in Vercel. Add GOOGLE_APPLICATION_CREDENTIALS_JSON as an environment variable."
    );
  }

  const auth = new GoogleAuth({
    credentials,
    scopes: [CLOUD_PLATFORM_SCOPE],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return typeof token === "string" ? token : token?.token;
}

function modelProvider(model) {
  return String(model || "").startsWith("claude-") ? "anthropic" : "google";
}

function endpointFor({ projectId, location, model }) {
  const host = location === "global"
    ? "aiplatform.googleapis.com"
    : `${location}-aiplatform.googleapis.com`;
  const provider = modelProvider(model);
  const method = provider === "anthropic" ? "rawPredict" : "generateContent";
  return `https://${host}/v1/projects/${projectId}/locations/${location}/publishers/${provider}/models/${model}:${method}`;
}

async function callGeminiVertex({ accessToken, projectId, location, model, prompt, systemPrompt }) {
  const vertexRes = await fetch(endpointFor({ projectId, location, model }), {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        { role: "user", parts: [{ text: prompt }] },
      ],
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 900,
      },
    }),
  });

  const data = await vertexRes.json();
  if (!vertexRes.ok) {
    const error = new Error(data?.error?.message || "Vertex AI request failed.");
    error.status = vertexRes.status;
    error.details = data?.error || data;
    throw error;
  }

  const candidate = data?.candidates?.[0];
  const answer = candidate?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();
  return {
    answer,
    finishReason: candidate?.finishReason || "",
  };
}

async function callClaudeVertex({ accessToken, projectId, location, model, prompt, systemPrompt }) {
  const vertexRes = await fetch(endpointFor({ projectId, location, model }), {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      anthropic_version: ANTHROPIC_VERTEX_VERSION,
      system: systemPrompt,
      messages: [
        { role: "user", content: prompt },
      ],
      temperature: 0.35,
      max_tokens: 900,
      stream: false,
    }),
  });

  const data = await vertexRes.json();
  if (!vertexRes.ok) {
    const error = new Error(data?.error?.message || "Vertex AI request failed.");
    error.status = vertexRes.status;
    error.details = data?.error || data;
    throw error;
  }

  const answer = Array.isArray(data?.content)
    ? data.content.map((part) => typeof part === "string" ? part : (part?.text || "")).join("").trim()
    : String(data?.completion || data?.text || "").trim();

  return {
    answer,
    finishReason: data?.stop_reason || "",
  };
}

async function callVertexModel({ accessToken, projectId, location, model, prompt, systemPrompt }) {
  if (modelProvider(model) === "anthropic") {
    return callClaudeVertex({ accessToken, projectId, location, model, prompt, systemPrompt });
  }
  return callGeminiVertex({ accessToken, projectId, location, model, prompt, systemPrompt });
}

function buildSystemPrompt({ agentName, agentTagline, analysis }) {
  return `
You are ${agentName}, ${agentTagline}, inside the ARIA capstone demo.

Answer as a concise consumer-facing consulting analyst. Use only the verified analytics pack below for numeric claims.
If the user's wording asks for residential real-estate advice, clarify that ARIA's evidence is short-term-rental market intelligence, not a complete home-buying transaction dataset.
Do not invent row counts, model scores, neighbourhood rankings, or monetary values.
Structure the answer with short, human-readable sections separated by blank lines.
Put each section label on its own line, then use 1 to 3 short dash lines underneath.
Use these sections in this order:
Recommendation:
Why this makes sense:
How to read the numbers:
What this means for you:
Next step:
Write 190 to 260 words total. Each section should be short, but do not collapse everything into one paragraph.
Do not answer with only one or two short sentences. The user should understand the reasoning without opening the details panel.
Avoid dense tables and avoid listing more than four numbers. The UI will show KPIs, charts, sources, and methodology separately.
When you mention any number, explain it in the same sentence or the next sentence: what the metric means, whether high or low is better, what the lowest/highest possible value is when the metric has a fixed scale, and why this value is good or bad for the user's goal.
Do not assume the user understands technical terms like saturation, opportunity score, occupancy, risk probability, SHAP, or underpricing gap. Define each one in plain language the first time you use it.
Use the "Metric explanations" section in the analytics pack to interpret numbers. Do not output a score without interpretation.
If a place name appears in Greek or any other non-English language, write the English transliteration first and the original name in parentheses, for example: Zappeio (ΖΑΠΠΕΙΟ).
Never output internal quality scores such as "Quality 100/100".
Do not use Markdown bold markers or asterisks around section labels.
Do not write the entire explanation as one dense paragraph.

Verified analytics pack:
${analysis.contextText}
`;
}

function wordCount(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

function sanitizeAnswer(text) {
  return String(text || "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/\b[a-z]+(?:_[a-z0-9]+)+\b/g, (match) => {
      const label = match
        .replace(/_/g, " ")
        .replace(/\beur\b/gi, "")
        .replace(/\bkm\b/gi, "km")
        .replace(/\s+/g, " ")
        .trim();
      return label.charAt(0).toUpperCase() + label.slice(1);
    });
}

function endsWithDanglingPhrase(text) {
  const stripped = String(text || "")
    .trim()
    .replace(/[.!?]["')\]]?$/g, "")
    .trim();
  return /\b(among|between|with|for|of|to|from|by|in|on|as|than|into|because|while|where|which|that|and|or|but|the|a|an)$/i.test(stripped);
}

function hasTerminalPunctuation(text) {
  return /[.!?]["')\]]?$/.test(String(text || "").trim());
}

function sectionLabel(section) {
  const match = String(section || "").trim().match(/^([A-Za-z][A-Za-z\s]{2,48}):/);
  return match?.[1]?.toLowerCase() || "";
}

function sectionLookup(text) {
  return new Map(
    String(text || "")
      .split(/\n{2,}/)
      .map((section) => [sectionLabel(section), section.trim()])
      .filter(([label, section]) => label && section)
  );
}

function trimToLastCompleteSentence(section) {
  const terminal = /[.!?]["')\]]?$/;
  const sentenceBoundary = /[.!?]["')\]]?(?=\s+[A-Z]|\s*$)/g;
  const trimmed = String(section || "").trim();
  const matches = [...trimmed.matchAll(sentenceBoundary)];
  const lastMatch = matches.at(-1);
  if (lastMatch && lastMatch.index > 24) {
    const candidate = trimmed.slice(0, lastMatch.index + lastMatch[0].length).trim();
    if (terminal.test(candidate) && !endsWithDanglingPhrase(candidate)) return candidate;
  }
  return "";
}

function completeAnswerSections(text, fallbackText) {
  const fallbackSections = sectionLookup(fallbackText);
  return String(text || "")
    .split(/\n{2,}/)
    .map((section) => {
      const trimmed = section.trim();
      if (!trimmed) return "";
      if (hasTerminalPunctuation(trimmed) && !endsWithDanglingPhrase(trimmed)) return trimmed;

      const fallbackSection = fallbackSections.get(sectionLabel(trimmed));
      if (fallbackSection && hasTerminalPunctuation(fallbackSection) && !endsWithDanglingPhrase(fallbackSection)) {
        return fallbackSection;
      }

      return trimToLastCompleteSentence(trimmed);
    })
    .filter(Boolean)
    .join("\n\n");
}

function addContextIfShort(answer, analysis) {
  if (wordCount(answer) >= 120) return answer;
  const facts = (analysis.facts || [])
    .slice(0, 2)
    .map((fact) => `- ${fact}`)
    .join("\n");
  const metricContext = (analysis.details?.metricGuides || [])
    .slice(0, 3)
    .map((g) => `- ${g.label}: ${g.meaning} ${g.good}`)
    .join("\n");
  const sections = [String(answer || "").trim()];

  if (!/\bWhy this makes sense:/i.test(answer)) {
    sections.push(`Why this makes sense:\n- ARIA is comparing short-term-rental opportunity rather than giving a full residential home-buying recommendation.\n- The signal looks at prepared project data: revenue potential, market saturation, price levels, and listing scale.\n${facts}`);
  }

  if (!/\bHow to read the numbers:/i.test(answer)) {
    sections.push(`How to read the numbers:\n${metricContext}`);
  }

  if (!/\bWhat this means for you:/i.test(answer)) {
    sections.push("What this means for you:\nUse the result as a starting shortlist, not as a final purchase decision. A stronger signal means the area deserves earlier research because the rental-market conditions look more favourable in the project data.");
  }

  if (!/\bNext step:/i.test(answer)) {
    sections.push("Next step:\nReview actual purchase prices, local licensing limits, building condition, financing costs, and neighbourhood fit before making the final investment decision.");
  }

  return sections.filter(Boolean).join("\n\n");
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const url = new URL(req.url || "/", "http://localhost");
    if (url.searchParams.get("geo") === "paris-arrondissements") {
      try {
        const geoRes = await fetch(PARIS_ARRONDISSEMENTS_GEOJSON_URL, {
          headers: { Accept: "application/geo+json, application/json" },
        });
        const text = await geoRes.text();
        if (!geoRes.ok) {
          return json(res, geoRes.status, { error: `Could not load Paris boundaries (${geoRes.status}).` });
        }
        res.status(200);
        res.setHeader("Content-Type", "application/geo+json; charset=utf-8");
        res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
        return res.end(text);
      } catch (error) {
        return json(res, 502, { error: error.message || "Could not load Paris boundaries." });
      }
    }

    return json(res, 200, {
      ok: true,
      authConfigured: Boolean(
        process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
        || process.env.GOOGLE_SERVICE_ACCOUNT_JSON
        || process.env.VERTEX_SERVICE_ACCOUNT_JSON
      ),
      defaultProjectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.VERTEX_PROJECT_ID || "",
      defaultLocation: process.env.GOOGLE_CLOUD_LOCATION || process.env.VERTEX_LOCATION || DEFAULT_LOCATION,
      defaultModel: process.env.VERTEX_MODEL || DEFAULT_MODEL,
    });
  }

  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  let body = req.body || {};
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return json(res, 400, { error: "Request body must be valid JSON." });
    }
  }
  const prompt = String(body.prompt || "").trim();
  const projectId = String(body.projectId || process.env.GOOGLE_CLOUD_PROJECT || process.env.VERTEX_PROJECT_ID || "").trim();
  const projectNumber = String(body.projectNumber || process.env.GOOGLE_CLOUD_PROJECT_NUMBER || process.env.VERTEX_PROJECT_NUMBER || "").trim();
  const location = String(body.location || process.env.GOOGLE_CLOUD_LOCATION || process.env.VERTEX_LOCATION || DEFAULT_LOCATION).trim();
  const model = String(body.model || process.env.VERTEX_MODEL || DEFAULT_MODEL).trim();
  const requestedAgentId = String(body.requestedAgentId || body.agentId || "auto");
  const route = routeAgentForPrompt({ requestedAgentId, prompt });
  const agentId = route.agentId;
  const profile = AGENT_PROFILES[agentId] || AGENT_PROFILES.market;
  const agentName = String(body.agentName || profile.name);
  const agentTagline = String(body.agentTagline || profile.tagline);

  if (!prompt) return json(res, 400, { error: "Prompt is required." });
  if (!projectId) return json(res, 400, { error: "Vertex project ID is required." });
  if (!projectNumber) return json(res, 400, { error: "Vertex project number is required." });

  let analysis;
  try {
    analysis = await buildGroundedAnalysis({ prompt, agentId });
  } catch (error) {
    return json(res, 502, {
      error: error.message || "Could not load live GitHub data for the ARIA analysis.",
      stage: "github-data-agent",
    });
  }

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) throw new Error("Could not create a Google Cloud access token.");

    const systemPrompt = buildSystemPrompt({ agentName, agentTagline, analysis });
    const vertex = await callVertexModel({ accessToken, projectId, location, model, prompt, systemPrompt });
    const rawAnswer = vertex.finishReason === "MAX_TOKENS" ? analysis.fallbackAnswer : (vertex.answer || analysis.fallbackAnswer);
    const fallbackAnswer = sanitizeAnswer(localizePlaceNames(addContextIfShort(analysis.fallbackAnswer, analysis)));
    const primaryAnswer = sanitizeAnswer(localizePlaceNames(addContextIfShort(rawAnswer, analysis)));
    const polishedAnswer = completeAnswerSections(primaryAnswer, fallbackAnswer) || fallbackAnswer;

    return json(res, 200, {
      answer: polishedAnswer,
      intent: analysis.intent,
      sources: analysis.sources,
      kpis: analysis.kpis,
      visualizations: analysis.visualizations,
      details: analysis.details,
      agentId,
      requestedAgentId: route.requestedAgentId,
      supportingAgentIds: route.supportingAgentIds,
      autoRouted: route.auto,
      projectId,
      location,
      model,
    });
  } catch (error) {
    return json(res, error.status || 500, {
      error: error.message || "Unexpected Vertex AI backend error.",
      details: error.details,
      projectId,
      location,
      model,
    });
  }
}
