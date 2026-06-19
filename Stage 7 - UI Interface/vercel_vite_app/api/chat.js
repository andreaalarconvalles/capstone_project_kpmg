import { GoogleAuth } from "google-auth-library";
import { buildGroundedAnalysis, localizePlaceNames } from "./analytics-pipeline.js";
import { ARIA_RESPONSE_POLICY } from "./aria-response-policy.js";

const CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const DEFAULT_LOCATION = "europe-west1";
const DEFAULT_MODEL = "gemini-2.5-pro";
const PARIS_ARRONDISSEMENTS_GEOJSON_URL = "https://geo.api.gouv.fr/communes?codeDepartement=75&type=arrondissement-municipal&format=geojson&geometry=contour";
const ANTHROPIC_VERTEX_VERSION = "vertex-2023-10-16";

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

function compactText(text, max = 900) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trim()}…` : clean;
}

function normaliseConversationMessages(messages = []) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((message) => message && (message.role === "user" || message.role === "assistant"))
    .map((message) => ({
      role: message.role,
      text: compactText(message.text || message.content || ""),
    }))
    .filter((message) => message.text)
    .slice(-8);
}

function formatConversationForPrompt(messages = []) {
  if (!messages.length) return "No previous conversation supplied.";
  return messages
    .map((message) => `${message.role === "user" ? "User" : "ARIA"}: ${message.text}`)
    .join("\n");
}

function friendlySourceNames(files = []) {
  const labels = new Set();
  for (const file of files || []) {
    const source = String(file || "").toLowerCase();
    if (source.includes("risk_scores")) labels.add("ARIA risk scores");
    if (source.includes("neighbourhood_stats")) labels.add("neighbourhood stats");
    if (source.includes("prediction")) labels.add("XGBoost predictions");
    if (source.includes("underpricing")) labels.add("Athens underpricing outputs");
    if (source.includes("shap")) labels.add("SHAP model explanations");
    if (source.includes("prophet")) labels.add("Prophet forecast outputs");
    if (source.includes("rag_unlicensed") || source.includes("rag_compliance") || source.includes("aria_rag")) labels.add("RAG compliance handoff outputs");
    if (source.includes("aria_routing") || source.includes("aria_session")) labels.add("LangGraph orchestration evidence");
    if (source.includes("model_card")) labels.add("ARIA model card");
    if (source.endsWith("readme.md") || source === "readme.md") labels.add("project README");
  }
  return [...labels].join(", ") || "ARIA project data";
}

function ensureSourcesLine(answer, analysis) {
  const clean = String(answer || "")
    .replace(/\n{1,3}Sources:\s*[^\n]+(?:\n*)$/i, "")
    .trim();
  const sources = friendlySourceNames(analysis.sources || analysis.details?.sourceFiles || []);
  return `${clean}\n\nSources: ${sources}`;
}

function buildModelPrompt({ prompt, analysis, messages }) {
  return [
    "Recent conversation context, oldest to newest:",
    formatConversationForPrompt(messages),
    "",
    `Current user question: ${prompt}`,
    `Resolved analysis question: ${analysis.resolvedPrompt || prompt}`,
    `Conversation resolution note: ${analysis.conversationContext?.summary || "No prior context needed."}`,
    "",
    "Answer the current user question only. Use the recent conversation to resolve pronouns, city references, and follow-up phrases such as there, those areas, same city, or what about. If the current question asks for a new metric, use that new metric while keeping the previous city/topic context unless the user explicitly changes it.",
    "For follow-up questions, do not repeat the previous answer. Build on it: explain the difference, compare the named or implied options, and give the next decision step using the analytics pack below. If earlier visuals already showed the map or trend, reference them as prior context instead of implying they are repeated in this answer.",
  ].join("\n");
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
        maxOutputTokens: 2600,
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
      max_tokens: 2600,
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

function personaGuidance({ agentId, agentName, analysis }) {
  const hay = `${agentId || ""} ${agentName || ""} ${analysis?.resolvedPrompt || ""} ${analysis?.prompt || ""}`.toLowerCase();
  const isHost = /(host|manager|my listing|my price|am i priced|i own|i host|underpric)/.test(hay) || agentId === "host-revenue";
  const isDeveloper = /(developer|pe fund|private equity|portfolio|supply shock|build|acquire|acquisition|entry price|scale|fund)/.test(hay);
  if (isHost) {
    return "Reader persona: host or property manager. Lead with the underpricing gap and listing-health/risk signals, and give specific, doable actions such as a price move or a feature to improve. Keep the tone practical and operational.";
  }
  if (isDeveloper) {
    return "Reader persona: developer or PE fund. Lead with saturation, supply-demand imbalance, and the scale of the opportunity, and frame the answer around entry price and the number of targets. Keep the tone deal- and scale-focused.";
  }
  return "Reader persona: investor (default). Lead with opportunity score, yield or revenue, and risk, and frame the answer around entry timing and downside. Keep the answer useful for hosts and developers too. If the question wording clearly signals a host or developer instead, adapt to that persona.";
}

function buildSystemPrompt({ agentId, agentName, agentTagline, analysis }) {
  const sourcesLine = `Sources: ${friendlySourceNames(analysis.sources || analysis.details?.sourceFiles || [])}`;
  return `
You are ${agentName}, ${agentTagline}, inside the ARIA capstone demo.

Answer as a consumer-facing consulting analyst. Use only the verified analytics pack below for numeric claims.
${personaGuidance({ agentId, agentName, analysis })}
Open every analytical answer with a one-sentence direct recommendation the reader can act on, before any reasoning. Do not bury the takeaway. Close every analytical answer with 2 to 3 concrete next actions.
Use the recent conversation context to resolve follow-up questions. If the user says "there", "those areas", "same city", or asks a short follow-up without naming a city, keep the previous city unless the current question explicitly changes it.
When the current question asks for a different metric than the previous one, answer the new metric while preserving the contextual city. For example, after a Paris saturation-map question, "which are the most expensive areas to live there?" means expensive Paris areas in the ARIA dataset, not a new generic city answer.
If the current question names exactly one city or district, keep the recommendation, evidence, KPIs, visual guidance, next actions, and final answer inside that requested geography. Do not pivot from Paris to Athens or from Athens to Paris unless the user explicitly asks for a cross-city comparison or alternative market recommendation.
If the user's wording asks for residential real-estate advice or a city outside Paris and Athens, state the data boundary plainly, give cautious general guidance clearly labelled as general rather than ARIA data, and offer the closest in-scope question ARIA can answer well.
Do not invent row counts, model scores, neighbourhood rankings, or monetary values.
Match the answer length to the prompt: simple factual prompts get a short direct answer of about 80 to 180 words with no forced sections; standard analytical prompts about 250 to 450 words; investment, manager, comparison, or decision-support prompts about 400 to 800 words. Do not pad short answers.
Structure analytical answers with human-readable sections separated by blank lines. Simple prompts can receive a shorter direct answer with fewer sections.
Avoid dense tables and avoid listing more than four numbers. The UI will show KPIs, charts, sources, and methodology separately.
When you mention any number, explain it in the same sentence or the next sentence: what the metric means, whether high or low is better, what the lowest/highest possible value is when the metric has a fixed scale, and why this value is good or bad for the user's goal.
Do not assume the user understands technical terms like saturation, opportunity score, occupancy, risk probability, SHAP, or underpricing gap. Define each one in plain language the first time you use it.
Use the "Metric explanations" section in the analytics pack to interpret numbers. Do not output a score without interpretation.
If a place name appears in Greek or any other non-English language, write the English transliteration first and the original name in parentheses, for example: Zappeio (ΖΑΠΠΕΙΟ).
Never output internal quality scores such as "Quality 100/100".
You may use Markdown bold sparingly to highlight the recommendation and section labels, but never bold whole sentences or paragraphs.
Do not write the entire explanation as one dense paragraph.
End with this exact final source line:
${sourcesLine}

${ARIA_RESPONSE_POLICY}

Verified analytics pack:
${analysis.contextText}
`;
}

function wordCount(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

function humanizeSnakeCase(text) {
  return String(text || "").replace(/\b[a-z]+(?:_[a-z0-9]+)+\b/g, (match) => {
    const label = match
      .replace(/_/g, " ")
      .replace(/\beur\b/gi, "")
      .replace(/\bkm\b/gi, "km")
      .replace(/\s+/g, " ")
      .trim();
    return label.charAt(0).toUpperCase() + label.slice(1);
  });
}

function sanitizeAnswer(text) {
  const raw = String(text || "");
  // Preserve matched **bold** so the UI can render <strong> on the recommendation and labels.
  // Only strip markers if they are unbalanced (a stray ** would otherwise show as literal text).
  const balanced = ((raw.match(/\*\*/g) || []).length % 2 === 0) ? raw : raw.replace(/\*\*/g, "");
  // Humanize leftover snake_case metric keys, but never rewrite the final Sources line.
  const sourcesMatch = balanced.match(/\n\nSources:[\s\S]*$/i);
  const sourcesTail = sourcesMatch ? sourcesMatch[0] : "";
  const body = sourcesTail ? balanced.slice(0, balanced.length - sourcesTail.length) : balanced;
  return humanizeSnakeCase(body) + sourcesTail;
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

function isSimplePrompt(analysis) {
  const p = String(analysis?.resolvedPrompt || analysis?.prompt || "").trim();
  if (!p) return false;
  const words = p.split(/\s+/).filter(Boolean).length;
  const analyticalCue = /(compare|which|where|invest|risk|underpric|forecast|opportunit|saturat|yield|revenue|recommend|should i|best|worst|portfolio|strateg|enter|entry|price|pricing|demand|occupanc|neighbourhood|neighborhood|area|arrondissement)/i.test(p);
  return words <= 12 && !analyticalCue;
}

function requestedCityForAnalysis(analysis) {
  return analysis?.conversationContext?.currentCity
    || analysis?.conversationContext?.priorCity
    || "";
}

function answerRecommendsOtherCity(answer, requestedCity) {
  const city = String(requestedCity || "");
  const other = city === "Paris" ? "Athens" : city === "Athens" ? "Paris" : "";
  if (!other) return false;
  const text = String(answer || "");
  return new RegExp(`\\b(recommend|enter|choose|prioriti[sz]e|start with|focus on|target)\\b[^\\n.]{0,140}\\b${other}\\b`, "i").test(text)
    || new RegExp(`\\b${other}\\b[^\\n.]{0,140}\\b(recommend|better|stronger|first|lead|prioriti[sz]e)\\b`, "i").test(text);
}

function needsStructuredFallback(answer, analysis) {
  if (isSimplePrompt(analysis)) return false;
  const text = String(answer || "").trim();
  if (!text) return true;
  if (answerRecommendsOtherCity(text, requestedCityForAnalysis(analysis))) return true;
  const firstLine = text.split("\n").find((line) => line.trim()) || "";
  const hasDirectRecommendation = /^(\*\*)?\s*direct recommendation\s*:/i.test(firstLine.trim())
    || /\b(enter|keep|choose|prioriti[sz]e|start with|focus on|shortlist|target|avoid|raise|validate)\b/i.test(firstLine);
  const sections = text.split(/\n{2,}/).filter((section) => section.trim());
  const hasUsefulStructure = sections.length >= 2
    || /\b(reasoning done by aria|key evidence|visualizations? to review|possible limitations|next actions?)\b/i.test(text);
  return wordCount(text) < 60 || !hasDirectRecommendation || !hasUsefulStructure;
}

function addContextIfShort(answer, analysis) {
  // Do not pad simple, factual prompts with analytical boilerplate sections.
  if (wordCount(answer) >= 120 || isSimplePrompt(analysis)) return answer;
  const facts = (analysis.facts || [])
    .slice(0, 2)
    .map((fact) => `- ${fact}`)
    .join("\n");
  const metricContext = (analysis.details?.metricGuides || [])
    .slice(0, 3)
    .map((g) => `- ${g.label}: ${g.meaning} ${g.good}`)
    .join("\n");
  const sections = [String(answer || "").trim()];

  if (!/\bReasoning done by ARIA:/i.test(answer)) {
    sections.push(`Reasoning done by ARIA:\n- ARIA is comparing short-term-rental opportunity rather than giving a full residential home-buying recommendation.\n- The signal looks at prepared project data: revenue potential, market saturation, price levels, and listing scale.\n${facts}`);
  }

  if (!/\bKey evidence:/i.test(answer)) {
    sections.push(`Key evidence:\n${metricContext}`);
  }

  if (!/\bVisualizations to review:/i.test(answer)) {
    sections.push("Visualizations to review:\nUse the generated chart or map to compare the relevant areas, risk signals, pricing gaps, or demand signals before making the decision.");
  }

  if (!/\bPossible limitations:/i.test(answer)) {
    sections.push("Possible limitations:\nUse the result as a starting shortlist, not as a final decision. Review actual purchase prices, local licensing limits, building condition, financing costs, and neighbourhood fit before committing.");
  }

  if (!/\bNext actions:/i.test(answer)) {
    sections.push("Next actions:\n- Compare the shortlisted areas or listings using the generated chart or map.\n- Verify actual prices, local licensing limits, and demand before committing.\n- Ask a follow-up to drill into the area, price gap, risk, or forecast that matters most.");
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
  const agentId = String(body.agentId || "market");
  const agentName = String(body.agentName || "ARIA Market Entry Advisor");
  const agentTagline = String(body.agentTagline || "short-term rental market intelligence");
  const messages = normaliseConversationMessages(body.messages || body.history || body.conversation || []);

  if (!prompt) return json(res, 400, { error: "Prompt is required." });
  if (!projectId) return json(res, 400, { error: "Vertex project ID is required." });
  if (!projectNumber) return json(res, 400, { error: "Vertex project number is required." });

  let analysis;
  try {
    analysis = await buildGroundedAnalysis({ prompt, agentId, messages });
  } catch (error) {
    return json(res, 502, {
      error: error.message || "Could not load live GitHub data for the ARIA analysis.",
      stage: "github-data-agent",
    });
  }

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) throw new Error("Could not create a Google Cloud access token.");

    const systemPrompt = buildSystemPrompt({ agentId, agentName, agentTagline, analysis });
    const contextualPrompt = buildModelPrompt({ prompt, analysis, messages });
    const vertex = await callVertexModel({ accessToken, projectId, location, model, prompt: contextualPrompt, systemPrompt });
    // Keep a usable model answer even if generation was cut off (finishReason MAX_TOKENS / max_tokens).
    // completeAnswerSections() trims any truncated trailing section to its last complete sentence,
    // so we only fall back to the deterministic answer when the model returned nothing at all.
    const rawAnswer = vertex.answer || analysis.fallbackAnswer;
    const fallbackAnswer = sanitizeAnswer(localizePlaceNames(addContextIfShort(analysis.fallbackAnswer, analysis)));
    const primaryAnswer = sanitizeAnswer(localizePlaceNames(addContextIfShort(rawAnswer, analysis)));
    const shapedAnswer = needsStructuredFallback(primaryAnswer, analysis) ? fallbackAnswer : primaryAnswer;
    const completedAnswer = completeAnswerSections(shapedAnswer, fallbackAnswer) || fallbackAnswer;
    const polishedAnswer = ensureSourcesLine(completedAnswer, analysis);

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
      resolvedPrompt: analysis.resolvedPrompt,
      contextResolution: analysis.conversationContext?.summary,
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
