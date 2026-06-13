import { GoogleAuth } from "google-auth-library";
import { buildGroundedAnalysis, localizePlaceNames } from "./analytics-pipeline.js";

const CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const DEFAULT_LOCATION = "europe-west1";
const DEFAULT_MODEL = "gemini-2.5-flash";
const PARIS_ARRONDISSEMENTS_GEOJSON_URL = "https://geo.api.gouv.fr/communes?codeDepartement=75&type=arrondissement-municipal&format=geojson&geometry=contour";

function json(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
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

function endpointFor({ projectId, location, model }) {
  const host = location === "global"
    ? "aiplatform.googleapis.com"
    : `${location}-aiplatform.googleapis.com`;
  return `https://${host}/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;
}

function buildSystemPrompt({ agentName, agentTagline, analysis }) {
  return `
You are ${agentName}, ${agentTagline}, inside the ARIA capstone demo.

Answer as a concise consumer-facing consulting analyst. Use only the verified analytics pack below for numeric claims.
If the user's wording asks for residential real-estate advice, clarify that ARIA's evidence is short-term-rental market intelligence, not a complete home-buying transaction dataset.
Do not invent row counts, model scores, neighbourhood rankings, or monetary values.
Structure the answer with short, human-readable sections separated by blank lines:
Recommendation: one clear recommendation in 1-2 sentences.
Why this makes sense: explain the key evidence in plain language.
What this means for you: translate the result into a practical buyer or small-investor takeaway.
Next step: one caution or due-diligence action.
Write 190 to 260 words total. Each section should be short, but do not collapse everything into one paragraph.
Do not answer with only one or two short sentences. The user should understand the reasoning without opening the details panel.
Avoid dense tables and avoid listing more than four numbers. The UI will show KPIs, charts, sources, and methodology separately.
When you mention any number, explain it in the same sentence or the next sentence: what the metric means, whether high or low is better, what the lowest/highest possible value is when the metric has a fixed scale, and why this value is good or bad for the user's goal.
Do not assume the user understands technical terms like saturation, opportunity score, occupancy, risk probability, SHAP, or underpricing gap. Define each one in plain language the first time you use it.
Use the "Metric explanations" section in the analytics pack to interpret numbers. Do not output a score without interpretation.
If a place name appears in Greek or any other non-English language, write the English transliteration first and the original name in parentheses, for example: Zappeio (ΖΑΠΠΕΙΟ).
Never output internal quality scores such as "Quality 100/100".
Do not use Markdown bold markers or asterisks around section labels.

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

function removeIncompleteSectionEndings(text) {
  const danglingEnd = /\b(among|between|with|for|of|to|from|by|in|on|as|than|into|because|while|where|which|that|and|or|but|the|a|an)$/i;
  const terminal = /[.!?]["')\]]?$/;
  const sentenceBoundary = /[.!?]["')\]]?(?=\s+[A-Z]|\s*$)/g;

  return String(text || "")
    .split(/\n{2,}/)
    .map((section) => {
      const trimmed = section.trim();
      if (!trimmed) return "";
      if (terminal.test(trimmed) && !danglingEnd.test(trimmed)) return trimmed;

      const matches = [...trimmed.matchAll(sentenceBoundary)];
      const lastMatch = matches.at(-1);
      if (lastMatch && lastMatch.index > 24) {
        return trimmed.slice(0, lastMatch.index + lastMatch[0].length).trim();
      }

      return terminal.test(trimmed) ? trimmed : `${trimmed}.`;
    })
    .filter(Boolean)
    .join("\n\n");
}

function addContextIfShort(answer, analysis) {
  if (wordCount(answer) >= 120) return answer;
  const facts = (analysis.facts || []).slice(0, 2).join(" ");
  const metricContext = (analysis.details?.metricGuides || [])
    .slice(0, 3)
    .map((g) => `${g.label} means ${g.meaning} ${g.good}`)
    .join(" ");
  return `${answer}

Why this makes sense: ARIA is comparing short-term-rental opportunity rather than giving a full residential home-buying recommendation. The signal looks at the prepared project data to understand where revenue potential, market saturation, price levels, and listing scale point to a cleaner first move. ${facts} ${metricContext}

What this means for you: Use the result as a starting shortlist, not as a final purchase decision. A stronger opportunity signal means the area deserves earlier research because the rental-market conditions look more favourable in the project data.

Next step: Review actual purchase prices, local licensing limits, building condition, financing costs, and neighbourhood fit before making the final investment decision.`;
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
  const agentId = String(body.agentId || "market");
  const agentName = String(body.agentName || "ARIA Market Entry Advisor");
  const agentTagline = String(body.agentTagline || "short-term rental market intelligence");

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

    const vertexRes = await fetch(endpointFor({ projectId, location, model }), {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: buildSystemPrompt({ agentName, agentTagline, analysis }) }],
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
      return json(res, vertexRes.status, {
        error: data?.error?.message || "Vertex AI request failed.",
        details: data?.error || data,
        projectId,
        location,
        model,
      });
    }

    const candidate = data?.candidates?.[0];
    const answer = candidate?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();
    const rawAnswer = candidate?.finishReason === "MAX_TOKENS" ? analysis.fallbackAnswer : (answer || analysis.fallbackAnswer);
    const polishedAnswer = removeIncompleteSectionEndings(
      sanitizeAnswer(localizePlaceNames(addContextIfShort(rawAnswer, analysis)))
    );

    return json(res, 200, {
      answer: polishedAnswer,
      intent: analysis.intent,
      sources: analysis.sources,
      kpis: analysis.kpis,
      visualizations: analysis.visualizations,
      details: analysis.details,
      projectId,
      location,
      model,
    });
  } catch (error) {
    return json(res, 500, {
      error: error.message || "Unexpected Vertex AI backend error.",
      projectId,
      location,
      model,
    });
  }
}
