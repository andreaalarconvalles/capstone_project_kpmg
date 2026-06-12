import { GoogleAuth } from "google-auth-library";
import { buildGroundingContext } from "./project-context.js";

const CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const DEFAULT_LOCATION = "europe-west1";
const DEFAULT_MODEL = "gemini-2.5-flash";

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

function buildSystemPrompt({ agentName, agentTagline, grounding }) {
  return `
You are ${agentName}, ${agentTagline}, inside the ARIA capstone demo.

Answer as a concise consulting analyst. Use only the project context below for numeric claims.
If the user's wording asks for residential real-estate advice, clarify that ARIA's evidence is short-term-rental market intelligence, not a complete home-buying transaction dataset.
Do not invent row counts, model scores, neighbourhood rankings, or monetary values.
Give a direct recommendation first, then the evidence, then the limitation.
Keep the answer between 170 and 260 words.

Grounded project context:
${grounding.contextText}
`;
}

export default async function handler(req, res) {
  if (req.method === "GET") {
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

  const grounding = buildGroundingContext({ prompt, agentId });

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
          parts: [{ text: buildSystemPrompt({ agentName, agentTagline, grounding }) }],
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
        projectNumber,
        location,
        model,
      });
    }

    const answer = data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();

    return json(res, 200, {
      answer: answer || "Vertex AI returned no text response.",
      intent: grounding.intent,
      sources: grounding.sources,
      kpis: grounding.kpis,
      projectId,
      projectNumber,
      location,
      model,
    });
  } catch (error) {
    return json(res, 500, {
      error: error.message || "Unexpected Vertex AI backend error.",
      projectId,
      projectNumber,
      location,
      model,
    });
  }
}
