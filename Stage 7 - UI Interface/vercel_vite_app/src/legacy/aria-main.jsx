/* ARIA — app root: orchestration, streaming engine, hybrid Gemini call */

const CA = ARIA.c;
const { useState, useRef, useEffect, useCallback } = React;

const elapsedFor = (steps) => (steps.length * 0.74 + 0.4).toFixed(1);
const CONVERSATION_STORAGE_KEY = "aria.conversations.v1";
const FULLSCREEN_ZOOM_STORAGE_KEY = "aria.fullscreenZoom.v1";
const FULLSCREEN_ZOOM_MIN = 0.8;
const FULLSCREEN_ZOOM_MAX = 1.6;
const FULLSCREEN_ZOOM_STEP = 0.1;

function clampFullscreenZoom(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(FULLSCREEN_ZOOM_MAX, Math.max(FULLSCREEN_ZOOM_MIN, Math.round(parsed * 100) / 100));
}

function loadFullscreenZoom() {
  try {
    return clampFullscreenZoom(window.localStorage.getItem(FULLSCREEN_ZOOM_STORAGE_KEY) || 1);
  } catch {
    return 1;
  }
}

function seedConversations() {
  return SEED_CONVERSATIONS.map((c) => ({ ...c, messages: null }));
}

function nowIso() {
  return new Date().toISOString();
}

function touchConversation(conv, patch = {}) {
  return { ...conv, ...patch, updatedAt: nowIso() };
}

function normaliseConversationStore(raw) {
  if (!raw || !Array.isArray(raw.conversations)) return null;
  const conversations = raw.conversations
    .filter((c) => c && c.id && c.agentId)
    .map((c) => ({
      id: String(c.id),
      agentId: AGENT_BY_ID[c.agentId] ? c.agentId : "host-revenue",
      title: String(c.title || "Untitled chat"),
      group: c.group || "Today",
      prompt: c.prompt || "",
      messages: Array.isArray(c.messages) ? c.messages : null,
      updatedAt: c.updatedAt || null,
    }));
  const activeConvId = conversations.some((c) => c.id === raw.activeConvId) ? raw.activeConvId : null;
  const agentId = AGENT_BY_ID[raw.agentId] ? raw.agentId : "host-revenue";
  return { conversations, activeConvId, agentId };
}

function loadConversationStore() {
  try {
    const rawText = window.localStorage.getItem(CONVERSATION_STORAGE_KEY);
    if (!rawText) return { conversations: seedConversations(), activeConvId: null, agentId: "host-revenue" };
    return normaliseConversationStore(JSON.parse(rawText)) || { conversations: seedConversations(), activeConvId: null, agentId: "host-revenue" };
  } catch {
    return { conversations: seedConversations(), activeConvId: null, agentId: "host-revenue" };
  }
}

function saveConversationStore(payload) {
  try {
    window.localStorage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify({
      version: 1,
      savedAt: new Date().toISOString(),
      ...payload,
    }));
  } catch {
    // Storage can fail in private browsing or if quota is full. The chat still works in memory.
  }
}

function clampContextText(text, max = 900) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trim()}…` : clean;
}

function assistantTextForContext(message) {
  const blocks = Array.isArray(message?.blocks) ? message.blocks : [];
  const answerText = blocks
    .filter((block) => block.type === "text" && block.text)
    .map((block) => block.text)
    .join(" ");
  const kpiText = blocks
    .find((block) => block.type === "kpis")
    ?.kpis?.slice(0, 4)
    .map((kpi) => `${kpi.label}: ${kpi.value}`)
    .join("; ");
  const visualText = blocks
    .filter((block) => block.type === "chart" && block.chart)
    .slice(0, 4)
    .map((block) => {
      const chart = block.chart;
      const rows = Array.isArray(chart.data)
        ? chart.data.slice(0, 6).map((row) => {
          const label = row.label || row.regionName || row.x || "item";
          const value = row.display || row.forecastAvgDisplay || row.value || "";
          return `${label}: ${value}`;
        }).join(", ")
        : "";
      return `${chart.title || chart.kind}: ${rows}`;
    })
    .filter(Boolean)
    .join(" ");
  const detailText = blocks
    .find((block) => block.type === "details")
    ?.details?.extra?.slice(0, 8)
    .join("; ");
  return clampContextText([
    answerText,
    kpiText && `KPIs: ${kpiText}`,
    visualText && `Visuals: ${visualText}`,
    detailText && `Additional signals: ${detailText}`,
  ].filter(Boolean).join(" "));
}

function conversationContextMessages(conv, limit = 8) {
  const messages = Array.isArray(conv?.messages)
    ? conv.messages
    : conv?.prompt
      ? [{ role: "user", text: conv.prompt }]
      : [];
  return messages
    .filter((message) => message && (message.role === "user" || message.role === "assistant"))
    .slice(-limit)
    .map((message) => ({
      role: message.role,
      text: message.role === "user"
        ? clampContextText(message.text)
        : assistantTextForContext(message),
    }))
    .filter((message) => message.text);
}

/* build a fully-rendered (done) assistant message from a script */
function builtMessage(agentId, prompt) {
  const s = getScript(agentId, prompt) || genericScript(AGENT_BY_ID[agentId], prompt);
  return {
    role: "assistant", agentId, prompt, trace: s.trace, blocks: s.blocks, brief: s.brief,
    traceDone: s.trace.length, traceRunning: false, progress: { block: s.blocks.length, text: "" },
    done: true, elapsed: elapsedFor(s.trace),
  };
}

/* ---------- answer renderer ---------- */
function chartBlockKey(chart, index) {
  const first = chart?.data?.[0] || {};
  return [
    index,
    chart?.kind,
    chart?.city,
    chart?.title,
    chart?.metricLabel || chart?.yLabel,
    chart?.geoJsonUrl || "point-map",
    first.regionId || first.label,
  ].filter(Boolean).join("::");
}

function AnswerView({ m, live, onCopy, onRegen, onExport }) {
  const prog = m.progress || { block: m.blocks.length, text: "" };
  const blocks = [];
  for (let bi = 0; bi < m.blocks.length; bi++) {
    const block = m.blocks[bi];
    if (bi > prog.block) break;
    if (block.type === "text") {
      const full = bi < prog.block || m.done;
      const text = full ? block.text : prog.text;
      if (!text) continue;
      blocks.push(<RichText key={bi} text={text} cursor={!full && live} />);
    } else if (block.type === "chart") {
      blocks.push(<div key={chartBlockKey(block.chart, bi)} className="aria-export-visual"><ChartBlock chart={block.chart} /></div>);
    } else if (block.type === "map") {
      blocks.push(<div key={bi} className="aria-export-visual"><NeighbourhoodMap {...block.map} /></div>);
    } else if (block.type === "kpis") {
      blocks.push(<LiveKpiGrid key={bi} kpis={block.kpis} />);
    } else if (block.type === "details") {
      blocks.push(<AnalysisDetails key={bi} details={block.details} />);
    }
  }
  return (
    <div data-aria-answer="true" aria-live={live ? "polite" : undefined} aria-busy={live && !m.done ? "true" : undefined}>
      <ReasoningTrace steps={m.trace} doneCount={m.traceDone} running={m.traceRunning} elapsed={m.elapsed} />
      {blocks}
      {m.done && (
        <div className="aria-fadein no-print" style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 12 }}>
          <ActionBtn icon="Copy" label="Copy" onClick={onCopy} />
          <ActionBtn icon="RefreshCw" label="Regenerate" onClick={onRegen} />
          <button onClick={(event) => onExport && onExport(event)} className="aria-focus"
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 100, background: CA.s1, border: `1px solid ${CA.hair}`, color: CA.ink, fontSize: 13, fontWeight: 500, marginLeft: 4 }}
            onMouseEnter={(e) => e.currentTarget.style.background = CA.s2}
            onMouseLeave={(e) => e.currentTarget.style.background = CA.s1}>
            <Icon name="Download" size={15} /> Export PDF Brief
          </button>
        </div>
      )}
    </div>
  );
}
function LiveKpiGrid({ kpis = [] }) {
  if (!kpis.length) return null;
  const cleanKpiText = (value) => String(value ?? "")
    .replace(/\b[a-z]+(?:_[a-z0-9]+)+\b/g, (match) => {
      const label = match
        .replace(/_/g, " ")
        .replace(/\beur\b/gi, "")
        .replace(/\bkm\b/gi, "km")
        .replace(/\s+/g, " ")
        .trim();
      return label.charAt(0).toUpperCase() + label.slice(1);
    });
  return (
    <div className="aria-fadein" style={{
      display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
      gap: 10, margin: "6px 0 12px", alignItems: "stretch",
    }}>
      {kpis.slice(0, 4).map((kpi, i) => (
        <div key={`${kpi.label}-${i}`} style={{
          background: CA.s1, border: `1px solid ${CA.hair}`, borderRadius: 12,
          padding: "12px 13px", minHeight: 116, height: "100%", boxSizing: "border-box",
          display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
          textAlign: "center", overflow: "hidden",
        }}>
          <div style={{ fontSize: 11.5, color: CA.muted, fontWeight: 500, lineHeight: 1.25, marginBottom: 6, maxWidth: "100%" }}>{cleanKpiText(kpi.label)}</div>
          <div style={{ fontSize: 19, color: CA.ink, fontWeight: 650, lineHeight: 1.12, letterSpacing: -0.35, overflowWrap: "anywhere", maxWidth: "100%" }}>{cleanKpiText(kpi.value)}</div>
          {kpi.help && (
            <div style={{
              marginTop: 7, color: CA.muted, fontSize: 10.8, lineHeight: 1.25,
              maxWidth: "100%", display: "-webkit-box", WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical", overflow: "hidden",
            }}>
              {cleanKpiText(kpi.help)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
function AnalysisDetails({ details = {} }) {
  const [open, setOpen] = useState(false);
  const panelId = useRef(`analysis-details-${Math.random().toString(36).slice(2)}`).current;
  const sources = details.sourceFiles || [];
  const limits = details.limitations || [];
  const extra = details.extra || [];
  const metricGuides = details.metricGuides || [];
  return (
    <div className="aria-fadein" style={{ marginTop: 10, border: `1px solid ${CA.hair}`, borderRadius: 12, background: CA.s1, overflow: "hidden" }}>
      <button onClick={() => setOpen((v) => !v)} className="aria-focus"
        aria-expanded={open} aria-controls={panelId}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 13px", color: CA.ink }}>
        <Icon name="ChevronDown" size={16} color={CA.muted}
          style={{ transform: open ? "none" : "rotate(-90deg)", transition: "transform 0.18s" }} />
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>View details</span>
      </button>
      {open && (
        <div id={panelId} style={{ borderTop: `1px solid ${CA.hairSoft}`, padding: "12px 14px 14px", fontSize: 13, lineHeight: 1.55, color: CA.inkSoft }}>
          {details.methodology && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11.5, color: CA.muted, fontWeight: 600, marginBottom: 4 }}>Methodology</div>
              <div>{details.methodology}</div>
            </div>
          )}
          {!!sources.length && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11.5, color: CA.muted, fontWeight: 600, marginBottom: 4 }}>Sources</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {sources.map((s) => (
                  <span key={s} style={{ border: `1px solid ${CA.hair}`, borderRadius: 999, padding: "4px 8px", background: CA.canvas, color: CA.muted, fontSize: 12 }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {!!limits.length && (
            <div style={{ marginBottom: metricGuides.length || extra.length ? 10 : 0 }}>
              <div style={{ fontSize: 11.5, color: CA.muted, fontWeight: 600, marginBottom: 4 }}>Limitations</div>
              {limits.map((l) => <div key={l}>- {l}</div>)}
            </div>
          )}
          {!!metricGuides.length && (
            <div style={{ marginBottom: extra.length ? 10 : 0 }}>
              <div style={{ fontSize: 11.5, color: CA.muted, fontWeight: 600, marginBottom: 6 }}>Metric guide</div>
              <div style={{ display: "grid", gap: 8 }}>
                {metricGuides.map((guide) => (
                  <div key={guide.label} style={{
                    border: `1px solid ${CA.hair}`, borderRadius: 10, background: CA.canvas,
                    padding: "9px 10px",
                  }}>
                    <div style={{ color: CA.ink, fontWeight: 650, marginBottom: 3 }}>{guide.label}</div>
                    <div>{guide.meaning}</div>
                    <div style={{ color: CA.muted, marginTop: 4 }}>{guide.range}</div>
                    <div style={{ marginTop: 4 }}>{guide.good}</div>
                    <div style={{ color: CA.muted, marginTop: 4 }}>{guide.optimal}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!!extra.length && (
            <div>
              <div style={{ fontSize: 11.5, color: CA.muted, fontWeight: 600, marginBottom: 4 }}>Additional signals</div>
              {extra.slice(0, 8).map((item) => <div key={item}>- {item}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
function ActionBtn({ icon, label, onClick }) {
  const [done, setDone] = useState(false);
  return (
    <button title={label} aria-label={label} className="aria-focus"
      onClick={(event) => { onClick && onClick(event); if (icon === "Copy") { setDone(true); setTimeout(() => setDone(false), 1200); } }}
      style={{ width: 34, height: 34, borderRadius: 8, display: "grid", placeItems: "center", color: CA.muted }}
      onMouseEnter={(e) => { e.currentTarget.style.background = CA.s1; e.currentTarget.style.color = CA.ink; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = CA.muted; }}>
      <Icon name={done ? "Check" : icon} size={15.5} color={done ? CA.success : undefined} />
    </button>
  );
}

/* ---------- message thread ---------- */
function Thread({ agent, messages, live, scrollRef, onCopy, onRegen, onExport, contentZoom = 1 }) {
  const dens = (ARIA.ui && ARIA.ui.density) || "regular";
  const gap = dens === "compact" ? 16 : dens === "comfy" ? 38 : 26;
  const fs = (ARIA.ui && ARIA.ui.fontSize) || 15;
  return (
    <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", overflowX: contentZoom > 1 ? "auto" : "hidden" }}>
      <div style={{
        maxWidth: 768,
        margin: "0 auto",
        padding: "26px 24px 30px",
        zoom: contentZoom,
        transformOrigin: "top center",
      }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: gap }}>
            {m.role === "user" ? (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{ background: CA.s1, border: `1px solid ${CA.hair}`, borderRadius: 20, borderBottomRightRadius: 6, padding: "11px 16px", fontSize: fs, maxWidth: "82%", lineHeight: 1.45, textWrap: "pretty" }}>{m.text}</div>
              </div>
            ) : (
              <AnswerView m={m} live={false}
                onCopy={() => onCopy(m)} onRegen={() => onRegen(m)} onExport={(event) => onExport(m, event)} />
            )}
          </div>
        ))}
        {live && (
          <div style={{ marginBottom: gap }}>
            <AnswerView m={live.msg} live={true} />
          </div>
        )}
      </div>
    </div>
  );
}

function FullscreenZoomControls({ zoom, onZoomIn, onZoomOut, onZoomReset }) {
  const percent = Math.round(zoom * 100);
  const canZoomOut = zoom > FULLSCREEN_ZOOM_MIN;
  const canZoomIn = zoom < FULLSCREEN_ZOOM_MAX;
  return (
    <div aria-label="Fullscreen zoom controls" style={{
      display: "flex", alignItems: "center", gap: 4, height: 34, padding: 3,
      borderRadius: 100, background: CA.s1, border: `1px solid ${CA.hair}`, color: CA.ink,
    }}>
      <button className="aria-focus" onClick={onZoomOut} disabled={!canZoomOut}
        title="Zoom out" aria-label="Zoom out"
        style={{
          width: 28, height: 28, borderRadius: 100, display: "grid", placeItems: "center",
          color: canZoomOut ? CA.muted : `${CA.muted}66`,
        }}>
        <Icon name="Minus" size={14} />
      </button>
      <button className="aria-focus" onClick={onZoomReset}
        title="Reset zoom to 100%" aria-label="Reset zoom to 100 percent"
        style={{
          minWidth: 48, height: 28, borderRadius: 100, padding: "0 9px",
          display: "grid", placeItems: "center", color: CA.ink,
          background: percent === 100 ? "transparent" : CA.s2,
          fontSize: 12, fontWeight: 650,
        }}>
        {percent}%
      </button>
      <button className="aria-focus" onClick={onZoomIn} disabled={!canZoomIn}
        title="Zoom in" aria-label="Zoom in"
        style={{
          width: 28, height: 28, borderRadius: 100, display: "grid", placeItems: "center",
          color: canZoomIn ? CA.muted : `${CA.muted}66`,
        }}>
        <Icon name="Plus" size={14} />
      </button>
    </div>
  );
}

function DeleteConversationDialog({ conversation, onCancel, onConfirm }) {
  const cancelRef = useRef(null);
  useEffect(() => {
    if (conversation) setTimeout(() => cancelRef.current && cancelRef.current.focus(), 0);
  }, [conversation]);

  if (!conversation) return null;
  return (
    <div className="aria-fadein" role="presentation" onMouseDown={onCancel} style={{
      position: "fixed", inset: 0, zIndex: 1000, display: "grid", placeItems: "center",
      padding: 22, background: "rgba(0,0,0,0.28)", backdropFilter: "blur(2px)",
    }}>
      <div role="dialog" aria-modal="true" aria-labelledby="delete-chat-title"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "min(420px, 100%)", background: CA.s1, color: CA.ink,
          border: `1px solid ${CA.hair}`, borderRadius: 16,
          boxShadow: "0 24px 70px rgba(0,0,0,0.24)", padding: 18,
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center",
            background: `${CA.cta}18`, color: CA.cta, flexShrink: 0,
          }}>
            <Icon name="Trash2" size={17} />
          </div>
          <div>
            <div id="delete-chat-title" style={{ fontSize: 15.5, fontWeight: 700 }}>Delete Chat?</div>
            <div style={{ fontSize: 12.5, color: CA.muted, marginTop: 2 }}>Review before removing this conversation.</div>
          </div>
        </div>
        <p style={{ margin: "8px 0 16px", color: CA.muted, fontSize: 13.5, lineHeight: 1.5 }}>
          Are you sure you want to delete "{conversation.title}"? This cannot be undone.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button ref={cancelRef} className="aria-focus" onClick={onCancel}
            style={{
              height: 36, padding: "0 14px", borderRadius: 10, border: `1px solid ${CA.hair}`,
              background: CA.canvas, color: CA.ink, fontSize: 13.5, fontWeight: 600,
            }}>
            Cancel
          </button>
          <button className="aria-focus" onClick={onConfirm}
            style={{
              height: 36, padding: "0 14px", borderRadius: 10,
              background: CA.cta, color: CA.ctaText, fontSize: 13.5, fontWeight: 700,
            }}>
            Delete Chat
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- App ---------- */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "brand",
  "fontSize": 15,
  "density": "regular",
  "streamSpeed": "normal",
  "traceCollapse": true
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const initialConversationStore = useRef(null);
  if (!initialConversationStore.current) initialConversationStore.current = loadConversationStore();
  const [theme, setTheme] = useState("airbnb");
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  // apply theme palette (airbnb = default) + push tweak values into the live globals
  applyTheme(theme);
  // accent Tweak: "brand" follows the theme's brand accent; any hex value overrides it
  if (t.accent && t.accent !== "brand") ARIA.c.blue = t.accent;
  ARIA.ui = { fontSize: t.fontSize, density: t.density, streamSpeed: t.streamSpeed, traceCollapse: t.traceCollapse };

  const [collapsed, setCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenZoom, setFullscreenZoom] = useState(loadFullscreenZoom);
  const fullscreenZoomRef = useRef(fullscreenZoom);
  const gestureStartZoomRef = useRef(fullscreenZoom);
  const zoomEventRef = useRef(null);
  const [agentId, setAgentId] = useState(initialConversationStore.current.agentId);
  const [conversations, setConversations] = useState(() => initialConversationStore.current.conversations);
  const [activeConvId, setActiveConvId] = useState(initialConversationStore.current.activeConvId);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [search, setSearch] = useState("");
  const [input, setInput] = useState("");
  const [modelId, setModelId] = useState("gemini-2.5-pro");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({
    apiKey: "", project: "capstoneprojectkpmg", projectNumber: "52102703097", region: "europe-west1", defaultModel: "gemini-2.5-pro", demoMode: true,
  });
  const [live, setLive] = useState(null); // { convId, msg }
  const cancelRef = useRef(false);
  const runIdRef = useRef(0);
  const scrollRef = useRef(null);
  const taRef = useRef(null);
  const themeMenuRef = useRef(null);

  const agent = AGENT_BY_ID[agentId];
  const activeConv = conversations.find((c) => c.id === activeConvId) || null;
  const deleteTarget = conversations.find((c) => c.id === deleteTargetId) || null;
  const activeTheme = PALETTES[theme] || PALETTES.airbnb;
  const themeModes = ["airbnb", "kpmgLight", "dark"];

  useEffect(() => {
    saveConversationStore({ conversations, activeConvId, agentId });
  }, [conversations, activeConvId, agentId]);

  /* lazily materialize a seeded conversation's thread */
  const ensureThread = useCallback((conv) => {
    if (conv.messages) return conv;
    const built = {
      ...conv,
      messages: [{ role: "user", text: conv.prompt }, builtMessage(conv.agentId, conv.prompt)],
      updatedAt: nowIso(),
    };
    setConversations((cs) => cs.map((c) => (c.id === conv.id ? built : c)));
    return built;
  }, []);

  const stopStream = useCallback(() => {
    cancelRef.current = true;
    runIdRef.current += 1;
    setLive((l) => {
      if (!l) return null;
      const finalMsg = { ...l.msg, done: true, traceRunning: false, traceDone: l.msg.trace.length };
      setConversations((cs) => cs.map((c) => c.id === l.convId
        ? touchConversation(c, { messages: [...(c.messages || []), finalMsg] })
        : c));
      return null;
    });
  }, []);

  /* core streaming runner */
  const runStream = useCallback((convId, aId, prompt, staticMsg) => {
    const runId = ++runIdRef.current;
    cancelRef.current = false;
    const SP = ({ slow: { trace: 760, word: 44, block: 680 }, fast: { trace: 320, word: 6, block: 320 } }[(ARIA.ui && ARIA.ui.streamSpeed)] || { trace: 540, word: 22, block: 540 });
    const steps = staticMsg.trace, blocks = staticMsg.blocks;
    const base = { ...staticMsg, traceDone: 0, traceRunning: true, progress: { block: -1, text: "" }, done: false };
    setLive({ convId, runId, msg: base });
    const isCurrentRun = () => runIdRef.current === runId;
    const upd = (patch) => setLive((l) => (l && l.runId === runId) ? { ...l, msg: { ...l.msg, ...(typeof patch === "function" ? patch(l.msg) : patch) } } : l);

    const finish = () => {
      setLive((l) => {
        if (!l || l.runId !== runId) return l;
        const fin = { ...l.msg, done: true, traceRunning: false, traceDone: steps.length, progress: { block: blocks.length, text: "" } };
        setConversations((cs) => cs.map((c) => c.id === convId
          ? touchConversation(c, { messages: [...(c.messages || []), fin] })
          : c));
        return null;
      });
    };

    const revealBlock = (bi) => {
      if (cancelRef.current || !isCurrentRun()) return;
      if (bi >= blocks.length) { setTimeout(finish, 150); return; }
      const block = blocks[bi];
      if (block.type === "text") {
        const words = block.text.split(" ");
        let w = 0;
        upd({ progress: { block: bi, text: "" } });
        const step = () => {
          if (cancelRef.current || !isCurrentRun()) return;
          w++;
          upd({ progress: { block: bi, text: words.slice(0, w).join(" ") } });
          if (w < words.length) setTimeout(step, SP.word + Math.random() * (SP.word * 0.9));
          else setTimeout(() => revealBlock(bi + 1), 140);
        };
        step();
      } else {
        upd({ progress: { block: bi, text: "" } });
        setTimeout(() => revealBlock(bi + 1), SP.block);
      }
    };

    let si = 0;
    const tickTrace = () => {
      if (cancelRef.current || !isCurrentRun()) return;
      si++;
      upd({ traceDone: si });
      if (si < steps.length) setTimeout(tickTrace, SP.trace + Math.random() * 160);
      else { upd({ traceRunning: false }); setTimeout(() => revealBlock(0), 280); }
    };
    setTimeout(tickTrace, SP.trace);
  }, []);

  /* live Vertex AI path for custom prompts */
  const runLive = useCallback(async (convId, aId, prompt, contextMessages = []) => {
    const runId = ++runIdRef.current;
    cancelRef.current = false;
    const ag = AGENT_BY_ID[aId];
    let model = modelId;
    if (MODEL_BY_ID[model].ml) model = settings.defaultModel;
    const steps = [
      { node: "Orchestrator", detail: `routing to ${ag.name}` },
      { node: "GitHub Data Agent", detail: "fetching live ARIA CSV outputs" },
      { node: "Analytics Agent", detail: "computing verified metrics" },
      { node: "Visualization Agent", detail: "preparing chart payload" },
      { node: "Vertex AI", detail: `generating with ${model}` },
      { node: "Quality Agent", detail: "checking sources and answer shape" },
    ];
    const base = {
      role: "assistant", agentId: aId, prompt, trace: steps, blocks: [],
      brief: genericScript(ag, prompt).brief, traceDone: 0, traceRunning: true,
      progress: { block: -1, text: "" }, done: false, elapsed: elapsedFor(steps),
    };
    setLive({ convId, runId, msg: base });
    const isCurrentRun = () => runIdRef.current === runId;
    const upd = (patch) => setLive((l) => (l && l.runId === runId) ? { ...l, msg: { ...l.msg, ...patch } } : l);

    upd({ traceDone: 1 });
    let text = "";
    let blocks = [];
    let brief = genericScript(ag, prompt).brief;
    try {
      upd({ traceDone: 2 });
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          messages: contextMessages,
          agentId: aId,
          agentName: ag.name,
          agentTagline: ag.tagline,
          projectId: settings.project,
          projectNumber: settings.projectNumber,
          location: settings.region,
          model,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Vertex AI request failed.");
      text = j.answer || "No response returned.";
      blocks = [{ type: "text", text }];
      if (Array.isArray(j.kpis) && j.kpis.length) blocks.push({ type: "kpis", kpis: j.kpis.slice(0, 4) });
      if (Array.isArray(j.visualizations) && j.visualizations.length) {
        j.visualizations.forEach((chart) => blocks.push({ type: "chart", chart }));
      }
      if (j.details) blocks.push({ type: "details", details: j.details });
      brief = {
        title: `${ag.name} — Vertex Analysis`,
        kpis: Array.isArray(j.kpis) && j.kpis.length ? j.kpis.slice(0, 4) : brief.kpis,
      };
    } catch (e) {
      text = `Live analysis needs attention: ${e.message}\n\nThe UI is correctly routing custom prompts to the backend. Check Vercel Vertex authentication and GitHub data access, and keep using the suggested prompts for scripted demo responses while the live path is being configured.`;
      blocks = [{ type: "text", text }];
    }
    if (cancelRef.current || !isCurrentRun()) return;
    upd({ traceDone: steps.length, traceRunning: false, blocks, brief });

    // stream the text
    const words = text.split(" ");
    let w = 0;
    const step = () => {
      if (cancelRef.current || !isCurrentRun()) return;
      w++;
      setLive((l) => (l && l.runId === runId) ? { ...l, msg: { ...l.msg, progress: { block: 0, text: words.slice(0, w).join(" ") } } } : l);
      if (w < words.length) setTimeout(step, 14 + Math.random() * 20);
      else setLive((l) => {
        if (!l || l.runId !== runId) return l;
        const fin = { ...l.msg, brief, done: true, progress: { block: blocks.length, text: "" } };
        setConversations((cs) => cs.map((c) => c.id === convId
          ? touchConversation(c, { messages: [...(c.messages || []), fin] })
          : c));
        return null;
      });
    };
    setTimeout(step, 200);
  }, [modelId, settings]);

  /* send a prompt */
  const send = useCallback((rawPrompt, forceAgentId) => {
    const prompt = (rawPrompt != null ? rawPrompt : input).trim();
    if (!prompt || live) return;
    const aid = forceAgentId || agentId;
    const ag = AGENT_BY_ID[aid];
    if (forceAgentId && forceAgentId !== agentId) setAgentId(forceAgentId);
    const existingConv = conversations.find((c) => c.id === activeConvId);
    const contextMessages = conversationContextMessages(existingConv);
    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";

    let convId = activeConvId;
    const isNew = !convId;
    if (isNew) convId = "c" + Date.now();
    const scripted = getScript(aid, prompt);
    const useLive = !scripted;

    setConversations((cs) => {
      if (isNew) {
        const title = prompt.length > 38 ? prompt.slice(0, 36) + "…" : prompt;
        return [touchConversation({ id: convId, agentId: aid, title, group: "Today", messages: [{ role: "user", text: prompt }] }), ...cs];
      }
      return cs.map((c) => c.id === convId
        ? touchConversation(c, { messages: [...(c.messages || []), { role: "user", text: prompt }] })
        : c);
    });
    setActiveConvId(convId);

    setTimeout(() => {
      if (useLive) runLive(convId, aid, prompt, contextMessages);
      else {
        const s = scripted;
        const staticMsg = {
          role: "assistant", agentId: aid, prompt, trace: s.trace, blocks: s.blocks, brief: s.brief, elapsed: elapsedFor(s.trace),
        };
        runStream(convId, aid, prompt, staticMsg);
      }
    }, 30);
  }, [input, activeConvId, agentId, agent, live, settings, conversations, runStream, runLive]);

  /* handlers */
  const newChat = useCallback(() => { stopStream(); setActiveConvId(null); }, [stopStream]);
  const pickAgent = useCallback((id) => { stopStream(); setAgentId(id); setActiveConvId(null); }, [stopStream]);
  const pickConv = useCallback((id) => {
    stopStream();
    const conv = conversations.find((c) => c.id === id);
    if (conv) { ensureThread(conv); setAgentId(conv.agentId); setActiveConvId(id); }
  }, [conversations, ensureThread, stopStream]);
  const renameConv = useCallback((id, t) => setConversations((cs) => cs.map((c) => c.id === id ? touchConversation(c, { title: t || "Untitled chat" }) : c)), []);
  const deleteConv = useCallback((id) => {
    const target = conversations.find((c) => c.id === id);
    if (target) setDeleteTargetId(id);
  }, [conversations]);
  const cancelDeleteConv = useCallback(() => setDeleteTargetId(null), []);
  const confirmDeleteConv = useCallback(() => {
    if (!deleteTargetId) return;
    cancelRef.current = true;
    runIdRef.current += 1;
    setLive((l) => (l && l.convId === deleteTargetId ? null : l));
    setConversations((cs) => cs.filter((c) => c.id !== deleteTargetId));
    setActiveConvId((a) => a === deleteTargetId ? null : a);
    setDeleteTargetId(null);
  }, [deleteTargetId]);
  const toggleFullscreen = useCallback(() => {
    const doc = document;
    if (doc.fullscreenElement) {
      doc.exitFullscreen && doc.exitFullscreen().catch(() => {});
      return;
    }
    const root = doc.documentElement;
    root.requestFullscreen && root.requestFullscreen().catch(() => {});
  }, []);
  const setZoom = useCallback((next) => {
    setFullscreenZoom((current) => clampFullscreenZoom(typeof next === "function" ? next(current) : next));
  }, []);
  const zoomIn = useCallback(() => setZoom((z) => z + FULLSCREEN_ZOOM_STEP), [setZoom]);
  const zoomOut = useCallback(() => setZoom((z) => z - FULLSCREEN_ZOOM_STEP), [setZoom]);
  const resetZoom = useCallback(() => setZoom(1), [setZoom]);

  const copyMsg = useCallback((m) => {
    const txt = m.blocks.filter((b) => b.type === "text").map((b) => b.text.replace(/\*\*/g, "").replace(/`/g, "")).join("\n\n");
    navigator.clipboard && navigator.clipboard.writeText(txt);
  }, []);
  const regenMsg = useCallback((m) => {
    if (live) return;
    const conv = conversations.find((c) => c.id === activeConvId);
    const idx = conv?.messages?.lastIndexOf(m) ?? -1;
    const contextMessages = idx > 0
      ? conversationContextMessages({ messages: conv.messages.slice(0, idx) })
      : [];
    setConversations((cs) => cs.map((c) => {
      if (c.id !== activeConvId) return c;
      const idx = c.messages.lastIndexOf(m);
      return touchConversation(c, { messages: c.messages.slice(0, idx) });
    }));
    setTimeout(() => {
      const s = getScript(m.agentId, m.prompt);
      if (s) {
        runStream(activeConvId, m.agentId, m.prompt, { role: "assistant", agentId: m.agentId, prompt: m.prompt, trace: s.trace, blocks: s.blocks, brief: s.brief, elapsed: elapsedFor(s.trace) });
      } else {
        runLive(activeConvId, m.agentId, m.prompt, contextMessages);
      }
    }, 40);
  }, [live, activeConvId, conversations, runStream, runLive]);
  const exportMsg = useCallback((m, event) => exportBrief(AGENT_BY_ID[m.agentId], m.prompt, m, event), []);
  const canExportConversation = !!activeConv?.messages?.some((m) => m.role === "assistant" && m.done !== false);
  const canExportPrompt = canExportConversation;
  const exportConversation = useCallback(() => {
    if (!activeConv || !canExportConversation) return;
    exportConversationBrief(activeConv);
  }, [activeConv, canExportConversation]);
  const exportPrompt = useCallback(() => {
    if (!activeConv || !canExportPrompt) return;
    exportConversationPrompt(activeConv, { agent, modelId });
  }, [activeConv, canExportPrompt, agent, modelId]);

  /* autoscroll while streaming */
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [live, activeConv && activeConv.messages && activeConv.messages.length]);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(!!document.fullscreenElement);
    syncFullscreen();
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(FULLSCREEN_ZOOM_STORAGE_KEY, String(fullscreenZoom));
    } catch {
      // Zoom still works for this session if local storage is unavailable.
    }
    fullscreenZoomRef.current = fullscreenZoom;
  }, [fullscreenZoom]);

  useEffect(() => {
    if (!isFullscreen) return undefined;
    const shouldSkipZoomTarget = (target) => {
      const tag = target?.tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return true;
      return !!target?.closest?.("[data-aria-no-pinch-zoom='true']");
    };
    const normalizeWheelDelta = (event) => {
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      return Number(event.deltaY || 0) * unit;
    };
    const handleWheel = (e) => {
      if (zoomEventRef.current === e) return;
      zoomEventRef.current = e;
      if (!(e.ctrlKey || e.metaKey)) return;
      if (shouldSkipZoomTarget(e.target)) return;
      if (e.cancelable) e.preventDefault();
      const deltaY = normalizeWheelDelta(e);
      if (!Number.isFinite(deltaY) || deltaY === 0) return;
      setZoom((z) => z * Math.exp(-deltaY * 0.0025));
    };
    const handleGestureStart = (e) => {
      if (shouldSkipZoomTarget(e.target)) return;
      if (e.cancelable) e.preventDefault();
      gestureStartZoomRef.current = fullscreenZoomRef.current;
    };
    const handleGestureChange = (e) => {
      if (shouldSkipZoomTarget(e.target)) return;
      const scale = Number(e.scale);
      if (!Number.isFinite(scale) || scale <= 0) return;
      if (e.cancelable) e.preventDefault();
      setZoom(gestureStartZoomRef.current * scale);
    };
    const options = { passive: false, capture: true };
    window.addEventListener("wheel", handleWheel, options);
    document.addEventListener("wheel", handleWheel, options);
    document.addEventListener("gesturestart", handleGestureStart, options);
    document.addEventListener("gesturechange", handleGestureChange, options);
    document.addEventListener("gestureend", handleGestureChange, options);
    return () => {
      window.removeEventListener("wheel", handleWheel, options);
      document.removeEventListener("wheel", handleWheel, options);
      document.removeEventListener("gesturestart", handleGestureStart, options);
      document.removeEventListener("gesturechange", handleGestureChange, options);
      document.removeEventListener("gestureend", handleGestureChange, options);
    };
  }, [isFullscreen, setZoom]);

  useEffect(() => {
    const closeThemeMenu = (e) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target)) {
        setThemeMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", closeThemeMenu);
    return () => document.removeEventListener("mousedown", closeThemeMenu);
  }, []);

  /* keyboard: "/" focuses composer */
  useEffect(() => {
    const h = (e) => {
      if (deleteTargetId && e.key === "Escape") {
        e.preventDefault();
        setDeleteTargetId(null);
        return;
      }
      if (isFullscreen && (e.ctrlKey || e.metaKey)) {
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          zoomIn();
          return;
        }
        if (e.key === "-" || e.key === "_") {
          e.preventDefault();
          zoomOut();
          return;
        }
        if (e.key === "0") {
          e.preventDefault();
          resetZoom();
          return;
        }
      }
      if (e.key === "/" && document.activeElement && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName) && !settingsOpen) {
        e.preventDefault(); taRef.current && taRef.current.focus();
      }
      if (e.key === "Escape" && themeMenuOpen) setThemeMenuOpen(false);
      if (e.key === "Escape") { if (settingsOpen) setSettingsOpen(false); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [settingsOpen, themeMenuOpen, deleteTargetId, isFullscreen, zoomIn, zoomOut, resetZoom]);

  const composerEl = (
    <Composer ref={taRef} agent={agent} agents={AGENTS} onPickAgent={pickAgent} value={input} setValue={setInput}
      onSend={() => send()} streaming={!!live} onStop={stopStream}
      modelId={modelId} setModelId={setModelId}
      onExportConversation={exportConversation} canExportConversation={canExportConversation && !live}
      onExportPrompt={exportPrompt} canExportPrompt={canExportPrompt && !live} />
  );
  const landingComposerEl = (
    <Composer ref={taRef} agent={agent} agents={AGENTS} onPickAgent={pickAgent} value={input} setValue={setInput}
      onSend={() => send()} streaming={!!live} onStop={stopStream}
      modelId={modelId} setModelId={setModelId}
      onExportConversation={exportConversation} canExportConversation={canExportConversation && !live}
      onExportPrompt={exportPrompt} canExportPrompt={canExportPrompt && !live}
      maxWidth={1022} />
  );

  const showThread = activeConv && (activeConv.messages || (live && live.convId === activeConvId));

  return (
    <div style={{ display: "flex", height: "100vh", background: CA.canvas }}>
      <Sidebar
        collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)}
        onToggleFullscreen={toggleFullscreen} isFullscreen={isFullscreen}
        agents={AGENTS} activeAgentId={agentId} onPickAgent={pickAgent} onNewChat={newChat}
        apiKey={settings.apiKey}
        project={settings.project}
        projectNumber={settings.projectNumber}
        conversations={conversations} activeConvId={activeConvId} onPickConv={pickConv}
        onRenameConv={renameConv} onDeleteConv={deleteConv}
        search={search} setSearch={setSearch} onOpenSettings={() => setSettingsOpen(true)} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* top bar */}
        <div className="no-print" style={{ height: 52, flexShrink: 0, display: "flex", alignItems: "center", gap: 10, padding: "0 18px", borderBottom: `1px solid ${CA.hairSoft}` }}>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            {isFullscreen && (
              <FullscreenZoomControls
                zoom={fullscreenZoom}
                onZoomIn={zoomIn}
                onZoomOut={zoomOut}
                onZoomReset={resetZoom}
              />
            )}
            <div ref={themeMenuRef} style={{ flexShrink: 0, position: "relative" }}>
              <button className="aria-focus" onClick={() => setThemeMenuOpen((v) => !v)}
                title="Change theme"
                aria-label={`Change theme. Current theme: ${activeTheme.label}`}
                aria-haspopup="menu" aria-expanded={themeMenuOpen}
                style={{
                  display: "flex", alignItems: "center", gap: 7, height: 34, padding: "0 12px", borderRadius: 100,
                  background: CA.s1, color: CA.ink, border: `1px solid ${CA.hair}`,
                  fontSize: 12.5, fontWeight: 500, transition: "background 0.14s, color 0.14s",
                }}>
                <Icon name={activeTheme.icon} size={14.5} color={activeTheme.accent} />
                <span style={{ whiteSpace: "nowrap" }}>{activeTheme.label}</span>
                <Icon name="ChevronDown" size={14} color={CA.muted}
                  style={{ transform: themeMenuOpen ? "rotate(180deg)" : "none", transition: "transform 0.16s" }} />
              </button>
              {themeMenuOpen && (
                <div className="aria-scalein" role="menu" style={{
                  position: "absolute", top: "calc(100% + 8px)", right: 0, width: 172, padding: 6,
                  background: CA.s1, border: `1px solid ${CA.hair}`, borderRadius: 14,
                  boxShadow: "0 18px 44px rgba(0,0,0,0.18)", zIndex: 50,
                }}>
                  {themeModes.map((mode) => {
                    const p = PALETTES[mode];
                    const on = theme === mode;
                    return (
                      <button key={mode} className="aria-focus" role="menuitemradio" aria-checked={on}
                        onClick={() => { setTheme(mode); setThemeMenuOpen(false); }}
                        style={{
                          width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 10px",
                          borderRadius: 10, background: on ? CA.s2 : "transparent", color: on ? CA.ink : CA.muted,
                          fontSize: 13, fontWeight: 500, textAlign: "left",
                        }}>
                        <Icon name={p.icon} size={15} color={on ? p.accent : CA.muted} />
                        <span style={{ flex: 1 }}>{p.label}</span>
                        {on && <Icon name="Check" size={15} color={p.accent} sw={2.4} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {showThread ? (
          <>
            <Thread agent={agent}
              messages={(activeConv && activeConv.messages) || []}
              live={live && live.convId === activeConvId ? live : null}
              scrollRef={scrollRef} onCopy={copyMsg} onRegen={regenMsg} onExport={exportMsg}
              contentZoom={isFullscreen ? fullscreenZoom : 1} />
            <div className="no-print" style={{ flexShrink: 0, padding: "8px 24px 16px", background: CA.canvas }}>
              {composerEl}
            </div>
          </>
        ) : (
          <EmptyState agent={agent} onChip={(c) => send(c)} composer={landingComposerEl}
            onSignal={(aid, prompt) => send(prompt, aid)}
            contentZoom={isFullscreen ? fullscreenZoom : 1} />
        )}
      </div>

      <DeleteConversationDialog
        conversation={deleteTarget}
        onCancel={cancelDeleteConv}
        onConfirm={confirmDeleteConv}
      />

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} setSettings={setSettings} />

      <TweaksPanel title="Tweaks">
        <TweakSection label="Interface" />
        <TweakRadio label="Accent" value={t.accent}
          options={[{ value: "brand", label: "Brand" }, { value: "#6a4cf5", label: "Violet" }, { value: "#1fd1c7", label: "Teal" }]}
          onChange={(v) => setTweak("accent", v)} />
        <TweakRadio label="Density" value={t.density}
          options={["compact", "regular", "comfy"]}
          onChange={(v) => setTweak("density", v)} />
        <TweakSlider label="Chat text" value={t.fontSize} min={14} max={18} step={1} unit="px"
          onChange={(v) => setTweak("fontSize", v)} />
        <TweakSection label="Conversation" />
        <TweakRadio label="Streaming" value={t.streamSpeed}
          options={[{ value: "slow", label: "Slow" }, { value: "normal", label: "Normal" }, { value: "fast", label: "Fast" }]}
          onChange={(v) => setTweak("streamSpeed", v)} />
        <TweakToggle label="Auto-collapse reasoning" value={t.traceCollapse}
          onChange={(v) => setTweak("traceCollapse", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
