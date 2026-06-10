/* ARIA — app root: orchestration, streaming engine, hybrid Gemini call */

const CA = ARIA.c;
const { useState, useRef, useEffect, useCallback } = React;

const elapsedFor = (steps) => (steps.length * 0.74 + 0.4).toFixed(1);

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
      blocks.push(<ChartBlock key={bi} chart={block.chart} />);
    } else if (block.type === "map") {
      blocks.push(<NeighbourhoodMap key={bi} {...block.map} />);
    }
  }
  return (
    <div>
      <ReasoningTrace steps={m.trace} doneCount={m.traceDone} running={m.traceRunning} elapsed={m.elapsed} />
      {blocks}
      {m.done && (
        <div className="aria-fadein no-print" style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 12 }}>
          <ActionBtn icon="Copy" label="Copy" onClick={onCopy} />
          <ActionBtn icon="RefreshCw" label="Regenerate" onClick={onRegen} />
          <button onClick={onExport} className="aria-focus"
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
function ActionBtn({ icon, label, onClick }) {
  const [done, setDone] = useState(false);
  return (
    <button title={label} className="aria-focus"
      onClick={() => { onClick && onClick(); if (icon === "Copy") { setDone(true); setTimeout(() => setDone(false), 1200); } }}
      style={{ width: 34, height: 34, borderRadius: 8, display: "grid", placeItems: "center", color: CA.muted }}
      onMouseEnter={(e) => { e.currentTarget.style.background = CA.s1; e.currentTarget.style.color = CA.ink; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = CA.muted; }}>
      <Icon name={done ? "Check" : icon} size={15.5} color={done ? CA.success : undefined} />
    </button>
  );
}

/* ---------- message thread ---------- */
function Thread({ agent, messages, live, scrollRef, onCopy, onRegen, onExport }) {
  const dens = (ARIA.ui && ARIA.ui.density) || "regular";
  const gap = dens === "compact" ? 16 : dens === "comfy" ? 38 : 26;
  const fs = (ARIA.ui && ARIA.ui.fontSize) || 15;
  return (
    <div ref={scrollRef} style={{ flex: 1, overflowY: "auto" }}>
      <div style={{ maxWidth: 768, margin: "0 auto", padding: "26px 24px 30px" }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: gap }}>
            {m.role === "user" ? (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{ background: CA.s1, border: `1px solid ${CA.hair}`, borderRadius: 20, borderBottomRightRadius: 6, padding: "11px 16px", fontSize: fs, maxWidth: "82%", lineHeight: 1.45, textWrap: "pretty" }}>{m.text}</div>
              </div>
            ) : (
              <AnswerView m={m} live={false}
                onCopy={() => onCopy(m)} onRegen={() => onRegen(m)} onExport={() => onExport(m)} />
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

/* ---------- App ---------- */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#0099ff",
  "fontSize": 15,
  "density": "regular",
  "streamSpeed": "normal",
  "traceCollapse": true
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  // push tweak values into the live globals read by render + the stream engine
  ARIA.c.blue = t.accent;
  ARIA.ui = { fontSize: t.fontSize, density: t.density, streamSpeed: t.streamSpeed, traceCollapse: t.traceCollapse };

  const [collapsed, setCollapsed] = useState(false);
  const [agentId, setAgentId] = useState("host-revenue");
  const [conversations, setConversations] = useState(
    SEED_CONVERSATIONS.map((c) => ({ ...c, messages: null })) // lazy
  );
  const [activeConvId, setActiveConvId] = useState(null);
  const [search, setSearch] = useState("");
  const [input, setInput] = useState("");
  const [modelId, setModelId] = useState("gemini-2.5-pro");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({
    apiKey: "", project: "", region: "europe-west1", defaultModel: "gemini-2.5-pro", demoMode: true,
  });
  const [live, setLive] = useState(null); // { convId, msg }
  const cancelRef = useRef(false);
  const scrollRef = useRef(null);
  const taRef = useRef(null);

  const agent = AGENT_BY_ID[agentId];
  const activeConv = conversations.find((c) => c.id === activeConvId) || null;

  /* lazily materialize a seeded conversation's thread */
  const ensureThread = useCallback((conv) => {
    if (conv.messages) return conv;
    const built = {
      ...conv,
      messages: [{ role: "user", text: conv.prompt }, builtMessage(conv.agentId, conv.prompt)],
    };
    setConversations((cs) => cs.map((c) => (c.id === conv.id ? built : c)));
    return built;
  }, []);

  const stopStream = useCallback(() => {
    cancelRef.current = true;
    setLive((l) => {
      if (!l) return null;
      const finalMsg = { ...l.msg, done: true, traceRunning: false, traceDone: l.msg.trace.length };
      setConversations((cs) => cs.map((c) => c.id === l.convId ? { ...c, messages: [...(c.messages || []), finalMsg] } : c));
      return null;
    });
  }, []);

  /* core streaming runner */
  const runStream = useCallback((convId, aId, prompt, staticMsg) => {
    cancelRef.current = false;
    const SP = ({ slow: { trace: 760, word: 44, block: 680 }, fast: { trace: 320, word: 6, block: 320 } }[(ARIA.ui && ARIA.ui.streamSpeed)] || { trace: 540, word: 22, block: 540 });
    const steps = staticMsg.trace, blocks = staticMsg.blocks;
    const base = { ...staticMsg, traceDone: 0, traceRunning: true, progress: { block: -1, text: "" }, done: false };
    setLive({ convId, msg: base });
    const upd = (patch) => setLive((l) => l ? { ...l, msg: { ...l.msg, ...(typeof patch === "function" ? patch(l.msg) : patch) } } : l);

    const finish = () => {
      setLive((l) => {
        if (!l) return null;
        const fin = { ...l.msg, done: true, traceRunning: false, traceDone: steps.length, progress: { block: blocks.length, text: "" } };
        setConversations((cs) => cs.map((c) => c.id === convId ? { ...c, messages: [...(c.messages || []), fin] } : c));
        return null;
      });
    };

    const revealBlock = (bi) => {
      if (cancelRef.current) return;
      if (bi >= blocks.length) { setTimeout(finish, 150); return; }
      const block = blocks[bi];
      if (block.type === "text") {
        const words = block.text.split(" ");
        let w = 0;
        upd({ progress: { block: bi, text: "" } });
        const step = () => {
          if (cancelRef.current) return;
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
      if (cancelRef.current) return;
      si++;
      upd({ traceDone: si });
      if (si < steps.length) setTimeout(tickTrace, SP.trace + Math.random() * 160);
      else { upd({ traceRunning: false }); setTimeout(() => revealBlock(0), 280); }
    };
    setTimeout(tickTrace, SP.trace);
  }, []);

  /* live Gemini path */
  const runLive = useCallback(async (convId, aId, prompt) => {
    cancelRef.current = false;
    const ag = AGENT_BY_ID[aId];
    let model = modelId;
    if (MODEL_BY_ID[model].ml) model = settings.defaultModel;
    const steps = [
      { node: "Orchestrator", detail: `routing to ${ag.name}` },
      { node: "Retrieval Agent", detail: "retrieving project context" },
      { node: "Gemini", detail: `generating with ${model}` },
    ];
    const base = {
      role: "assistant", agentId: aId, prompt, trace: steps, blocks: [],
      brief: genericScript(ag, prompt).brief, traceDone: 0, traceRunning: true,
      progress: { block: -1, text: "" }, done: false, elapsed: elapsedFor(steps),
    };
    setLive({ convId, msg: base });
    const upd = (patch) => setLive((l) => l ? { ...l, msg: { ...l.msg, ...patch } } : l);

    upd({ traceDone: 1 });
    let text = "";
    try {
      const sys = `You are ${ag.name}, ${ag.tagline}. Project context: Airbnb data for Paris (120,809 listings) and Athens (14,242 listings), 135,051-listing master dataset, XGBoost pricing, LightGBM risk, SHAP explainability. Answer in 150-220 words, grounded in this data.`;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${settings.apiKey}`;
      upd({ traceDone: 2 });
      const res = await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: sys }] }, contents: [{ role: "user", parts: [{ text: prompt }] }] }),
      });
      const j = await res.json();
      text = j?.candidates?.[0]?.content?.parts?.[0]?.text
        || (j?.error?.message ? `**API error:** ${j.error.message}\n\nCheck your key in Settings, or switch Demo mode back on.` : "No response returned.");
    } catch (e) {
      text = `**Network error:** ${e.message}. Switch Demo mode on in Settings to use scripted responses.`;
    }
    if (cancelRef.current) return;
    upd({ traceDone: 3, traceRunning: false, blocks: [{ type: "text", text }] });

    // stream the text
    const words = text.split(" ");
    let w = 0;
    const step = () => {
      if (cancelRef.current) return;
      w++;
      setLive((l) => l ? { ...l, msg: { ...l.msg, progress: { block: 0, text: words.slice(0, w).join(" ") } } } : l);
      if (w < words.length) setTimeout(step, 14 + Math.random() * 20);
      else setLive((l) => {
        if (!l) return null;
        const fin = { ...l.msg, done: true, progress: { block: 1, text: "" } };
        setConversations((cs) => cs.map((c) => c.id === convId ? { ...c, messages: [...(c.messages || []), fin] } : c));
        return null;
      });
    };
    setTimeout(step, 200);
  }, [modelId, settings]);

  /* send a prompt */
  const send = useCallback((rawPrompt) => {
    const prompt = (rawPrompt != null ? rawPrompt : input).trim();
    if (!prompt || live) return;
    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";

    let convId = activeConvId;
    const useLive = !settings.demoMode && settings.apiKey.trim().length > 8;

    setConversations((cs) => {
      let next = cs;
      if (!convId) {
        convId = "c" + Date.now();
        const title = prompt.length > 38 ? prompt.slice(0, 36) + "…" : prompt;
        next = [{ id: convId, agentId, title, group: "Today", messages: [{ role: "user", text: prompt }] }, ...cs];
      } else {
        next = cs.map((c) => c.id === convId
          ? { ...c, messages: [...(c.messages || []), { role: "user", text: prompt }] }
          : c);
      }
      return next;
    });
    setActiveConvId(convId);

    setTimeout(() => {
      if (useLive) runLive(convId, agentId, prompt);
      else {
        const s = getScript(agentId, prompt) || genericScript(agent, prompt);
        const staticMsg = {
          role: "assistant", agentId, prompt, trace: s.trace, blocks: s.blocks, brief: s.brief, elapsed: elapsedFor(s.trace),
        };
        runStream(convId, agentId, prompt, staticMsg);
      }
    }, 30);
  }, [input, activeConvId, agentId, agent, live, settings, runStream, runLive]);

  /* handlers */
  const newChat = useCallback(() => { stopStream(); setActiveConvId(null); }, [stopStream]);
  const pickAgent = useCallback((id) => { stopStream(); setAgentId(id); setActiveConvId(null); }, [stopStream]);
  const pickConv = useCallback((id) => {
    stopStream();
    const conv = conversations.find((c) => c.id === id);
    if (conv) { ensureThread(conv); setAgentId(conv.agentId); setActiveConvId(id); }
  }, [conversations, ensureThread, stopStream]);
  const renameConv = useCallback((id, t) => setConversations((cs) => cs.map((c) => c.id === id ? { ...c, title: t } : c)), []);
  const deleteConv = useCallback((id) => {
    setConversations((cs) => cs.filter((c) => c.id !== id));
    setActiveConvId((a) => a === id ? null : a);
  }, []);

  const copyMsg = useCallback((m) => {
    const txt = m.blocks.filter((b) => b.type === "text").map((b) => b.text.replace(/\*\*/g, "").replace(/`/g, "")).join("\n\n");
    navigator.clipboard && navigator.clipboard.writeText(txt);
  }, []);
  const regenMsg = useCallback((m) => {
    if (live) return;
    setConversations((cs) => cs.map((c) => {
      if (c.id !== activeConvId) return c;
      const idx = c.messages.lastIndexOf(m);
      return { ...c, messages: c.messages.slice(0, idx) };
    }));
    setTimeout(() => {
      const s = getScript(m.agentId, m.prompt) || genericScript(AGENT_BY_ID[m.agentId], m.prompt);
      runStream(activeConvId, m.agentId, m.prompt, { role: "assistant", agentId: m.agentId, prompt: m.prompt, trace: s.trace, blocks: s.blocks, brief: s.brief, elapsed: elapsedFor(s.trace) });
    }, 40);
  }, [live, activeConvId, runStream]);
  const exportMsg = useCallback((m) => exportBrief(AGENT_BY_ID[m.agentId], m.prompt, m.brief), []);

  /* autoscroll while streaming */
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [live, activeConv && activeConv.messages && activeConv.messages.length]);

  /* keyboard: "/" focuses composer */
  useEffect(() => {
    const h = (e) => {
      if (e.key === "/" && document.activeElement && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName) && !settingsOpen) {
        e.preventDefault(); taRef.current && taRef.current.focus();
      }
      if (e.key === "Escape") { if (settingsOpen) setSettingsOpen(false); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [settingsOpen]);

  const composerEl = (
    <Composer ref={taRef} agent={agent} agents={AGENTS} onPickAgent={pickAgent} value={input} setValue={setInput}
      onSend={() => send()} streaming={!!live} onStop={stopStream}
      modelId={modelId} setModelId={setModelId} />
  );

  const showThread = activeConv && (activeConv.messages || (live && live.convId === activeConvId));

  return (
    <div style={{ display: "flex", height: "100vh", background: CA.canvas }}>
      <Sidebar
        collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)}
        agents={AGENTS} activeAgentId={agentId} onPickAgent={pickAgent} onNewChat={newChat}
        apiKey={settings.apiKey}
        onApiKey={(v) => setSettings((s) => ({ ...s, apiKey: v, demoMode: v.trim().length === 0 }))}
        conversations={conversations} activeConvId={activeConvId} onPickConv={pickConv}
        onRenameConv={renameConv} onDeleteConv={deleteConv}
        search={search} setSearch={setSearch} onOpenSettings={() => setSettingsOpen(true)} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* top bar */}
        <div className="no-print" style={{ height: 52, flexShrink: 0, display: "flex", alignItems: "center", gap: 10, padding: "0 18px", borderBottom: `1px solid ${CA.hairSoft}` }}>
          <AgentTile accent={agent.accent} icon={agent.icon} size={26} radius={8} iconSize={14} />
          <span style={{ fontSize: 14.5, fontWeight: 500 }}>{agent.name}</span>
          <span style={{ fontSize: 12.5, color: CA.muted }}>· {agent.tagline}</span>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: CA.muted, border: `1px solid ${CA.hair}`, borderRadius: 100, padding: "5px 11px" }}>
            <span style={{ width: 6, height: 6, borderRadius: 4, background: settings.demoMode ? CA.orange : CA.success }} />
            {settings.demoMode ? "Demo mode" : "Live · Gemini"}
          </div>
        </div>

        {showThread ? (
          <>
            <Thread agent={agent}
              messages={(activeConv && activeConv.messages) || []}
              live={live && live.convId === activeConvId ? live : null}
              scrollRef={scrollRef} onCopy={copyMsg} onRegen={regenMsg} onExport={exportMsg} />
            <div className="no-print" style={{ flexShrink: 0, padding: "8px 24px 16px", background: CA.canvas }}>
              {composerEl}
            </div>
          </>
        ) : (
          <EmptyState agent={agent} onChip={(c) => send(c)} composer={composerEl} />
        )}
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} setSettings={setSettings} />

      <TweaksPanel title="Tweaks">
        <TweakSection label="Interface" />
        <TweakColor label="Accent" value={t.accent}
          options={["#0099ff", "#6a4cf5", "#1fd1c7", "#d44df0"]}
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
