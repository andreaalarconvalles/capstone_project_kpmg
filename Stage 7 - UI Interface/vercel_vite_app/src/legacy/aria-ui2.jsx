/* ARIA — UI part 2: Composer, ModelPicker, Settings, EmptyState, PDF brief */

const C2 = ARIA.c;

/* ---------- Model picker (opens upward) ---------- */
function ModelPicker({ modelId, onPick }) {
  const [open, setOpen] = React.useState(false);
  const [menuPos, setMenuPos] = React.useState({
    placement: "top",
    left: 12,
    width: 296,
    maxHeight: 360,
    top: 12,
    bottom: 12,
  });
  const ref = React.useRef(null);
  const menuRef = React.useRef(null);
  const listboxId = React.useRef(`model-list-${Math.random().toString(36).slice(2)}`).current;
  const cur = MODEL_BY_ID[modelId];
  const updateMenuPosition = React.useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const margin = 12;
    const gap = 8;
    const preferredWidth = 296;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || preferredWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 640;
    const mobileSheet = viewportWidth < 520;
    const width = mobileSheet
      ? Math.max(220, viewportWidth - margin * 2)
      : Math.min(preferredWidth, Math.max(220, viewportWidth - margin * 2));
    const left = mobileSheet
      ? margin
      : Math.min(Math.max(margin, rect.left), Math.max(margin, viewportWidth - width - margin));
    const availableAbove = Math.max(0, rect.top - margin - gap);
    const availableBelow = Math.max(0, viewportHeight - rect.bottom - margin - gap);
    const placement = mobileSheet ? "sheet" : availableAbove >= 260 || availableAbove >= availableBelow ? "top" : "bottom";
    const available = placement === "top" ? availableAbove : availableBelow;
    setMenuPos({
      placement,
      left,
      width,
      maxHeight: Math.floor(mobileSheet ? Math.min(520, viewportHeight - margin * 2) : Math.max(140, available)),
      top: Math.floor(rect.bottom + gap),
      bottom: Math.floor(mobileSheet ? margin : viewportHeight - rect.top + gap),
    });
  }, []);
  React.useEffect(() => {
    const h = (e) => {
      if (
        ref.current && !ref.current.contains(e.target) &&
        (!menuRef.current || !menuRef.current.contains(e.target))
      ) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  React.useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);
  const menu = open && (
    <div ref={menuRef} id={listboxId} role="listbox" aria-label="AI models" className="aria-scalein" style={{
      position: "fixed",
      top: menuPos.placement === "bottom" ? menuPos.top : "auto",
      bottom: menuPos.placement === "top" || menuPos.placement === "sheet" ? menuPos.bottom : "auto",
      left: menuPos.left,
      width: menuPos.width,
      maxHeight: menuPos.maxHeight,
      overflowY: "auto",
      overscrollBehavior: "contain",
      transformOrigin: `${menuPos.placement === "bottom" ? "top" : "bottom"} left`,
      background: C2.s2, border: `1px solid ${C2.hair}`, borderRadius: 14, padding: 6,
      boxShadow: "0 -1px 0 rgba(255,255,255,0.06) inset, 0 18px 50px rgba(0,0,0,0.6)", zIndex: 1000,
    }}>
      {MODELS.map((g) => (
        <div key={g.group} role="group" aria-label={g.group}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 10px 5px", fontSize: 11.5, color: C2.muted, fontWeight: 500, letterSpacing: -0.1 }}>
            {g.group}
            {g.badge && <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.3, color: C2.teal, border: `1px solid ${C2.teal}55`, borderRadius: 5, padding: "1px 5px" }}>{g.badge}</span>}
          </div>
          {g.items.map((m) => (
            <button key={m.id} className="aria-focus" role="option" aria-selected={modelId === m.id}
              onClick={() => { onPick(m.id); setOpen(false); }}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "9px 10px", borderRadius: 10,
                background: modelId === m.id ? C2.s1 : "transparent", textAlign: "left", color: C2.ink,
              }}
              onMouseEnter={(e) => { if (modelId !== m.id) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
              onMouseLeave={(e) => { if (modelId !== m.id) e.currentTarget.style.background = "transparent"; }}>
              {m.ml ? <Icon name="Cpu" size={16} color={C2.muted} /> : <Icon name="Sparkles" size={16} color={C2.muted} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{m.name}{m.default && <span style={{ color: C2.muted, fontWeight: 400 }}> · default</span>}{m.badge && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, letterSpacing: 0.3, color: C2.muted, border: `1px solid ${C2.hair}`, borderRadius: 5, padding: "1px 5px", verticalAlign: "middle" }}>{m.badge}</span>}</div>
                <div style={{ fontSize: 12, color: C2.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.desc}</div>
              </div>
              {modelId === m.id && <Icon name="Check" size={15} color={C2.blue} sw={2.4} />}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="aria-focus" onClick={() => setOpen((o) => !o)}
        aria-label={`Choose AI model. Current model: ${cur.name}`}
        aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listboxId : undefined}
        style={{
          display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 100,
          background: open ? C2.s2 : "transparent", color: C2.ink, fontSize: 13, fontWeight: 500,
          transition: "background 0.12s",
        }}>
        {cur.ml ? <Icon name="Cpu" size={14.5} color={C2.muted} /> : <Icon name="Sparkles" size={14.5} color={C2.muted} />}
        {cur.name}
        <Icon name="ChevronDown" size={14} color={C2.muted} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.18s" }} />
      </button>
      {window.ReactDOM?.createPortal ? window.ReactDOM.createPortal(menu, document.body) : menu}
    </div>
  );
}

/* ---------- Agent picker (opens upward, mirrors ModelPicker) ---------- */
function AgentPicker({ agentId, agents, onPick }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const listboxId = React.useRef(`agent-list-${Math.random().toString(36).slice(2)}`).current;
  const cur = agents.find((a) => a.id === agentId) || agents[0];
  React.useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="aria-focus" onClick={() => setOpen((o) => !o)}
        aria-label={`Choose agent. Current agent: ${cur.name}`}
        aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listboxId : undefined}
        style={{
          display: "flex", alignItems: "center", gap: 8, padding: "5px 10px 5px 6px", borderRadius: 100,
          background: open ? C2.s2 : "transparent", color: C2.ink, fontSize: 13, fontWeight: 500,
          transition: "background 0.12s",
        }}>
        <AgentTile accent={cur.accent} icon={cur.icon} size={22} radius={7} iconSize={12} />
        {cur.name}
        <Icon name="ChevronDown" size={14} color={C2.muted} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.18s" }} />
      </button>
      {open && (
        <div id={listboxId} className="aria-scalein" role="listbox" aria-label="Agents" style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: 0, width: 322, transformOrigin: "bottom left",
          background: C2.s2, border: `1px solid ${C2.hair}`, borderRadius: 14, padding: 6,
          boxShadow: "0 -1px 0 rgba(255,255,255,0.06) inset, 0 18px 50px rgba(0,0,0,0.6)", zIndex: 40,
        }}>
          <div style={{ padding: "9px 10px 5px", fontSize: 11.5, color: C2.muted, fontWeight: 500, letterSpacing: -0.1 }}>AGENTS</div>
          {agents.map((a) => (
            <button key={a.id} className="aria-focus" role="option" aria-selected={agentId === a.id}
              onClick={() => { onPick(a.id); setOpen(false); }}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "9px 10px", borderRadius: 10,
                background: agentId === a.id ? C2.s1 : "transparent", textAlign: "left", color: C2.ink,
              }}
              onMouseEnter={(e) => { if (agentId !== a.id) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
              onMouseLeave={(e) => { if (agentId !== a.id) e.currentTarget.style.background = "transparent"; }}>
              <AgentTile accent={a.accent} icon={a.icon} size={28} radius={8} iconSize={15} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{a.name}</div>
                <div style={{ fontSize: 12, color: C2.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.tagline}</div>
              </div>
              {agentId === a.id && <Icon name="Check" size={15} color={C2.blue} sw={2.4} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Composer ---------- */
const Composer = React.forwardRef(function Composer({
  agent, agents, onPickAgent, value, setValue, onSend, streaming, onStop, modelId, setModelId,
  onExportConversation, canExportConversation = false,
  onExportPrompt, canExportPrompt = false,
  maxWidth = 768,
}, ref) {
  const taRef = ref || React.useRef(null);
  const fileRef = React.useRef(null);
  const speechRef = React.useRef(null);
  const voiceWantedRef = React.useRef(false);
  const voiceBaseRef = React.useRef("");
  const voiceFinalRef = React.useRef("");
  const [attachments, setAttachments] = React.useState([]);
  const [voiceStatus, setVoiceStatus] = React.useState("idle");
  const [voiceMessage, setVoiceMessage] = React.useState("");
  const attachmentsRef = React.useRef([]);
  const engine = MODEL_BY_ID[modelId];
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const voiceSupported = !!SpeechRecognition;
  const grow = (el) => { if (!el) return; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 200) + "px"; };
  React.useEffect(() => { attachmentsRef.current = attachments; }, [attachments]);
  React.useEffect(() => () => {
    attachmentsRef.current.forEach((item) => URL.revokeObjectURL(item.url));
    if (speechRef.current) {
      voiceWantedRef.current = false;
      try { speechRef.current.abort(); } catch {}
    }
  }, []);
  React.useEffect(() => {
    if (!voiceMessage || voiceStatus === "listening") return undefined;
    const timer = setTimeout(() => setVoiceMessage(""), 2600);
    return () => clearTimeout(timer);
  }, [voiceMessage, voiceStatus]);
  const addPhotos = (e) => {
    const files = Array.from(e.target.files || []).filter((file) => file.type.startsWith("image/"));
    if (!files.length) return;
    const next = files.map((file) => ({
      id: `${file.name}-${file.lastModified}-${file.size}-${Math.random().toString(36).slice(2)}`,
      name: file.name,
      url: URL.createObjectURL(file),
    }));
    setAttachments((items) => [...items, ...next]);
    if (!value.trim()) setValue("Analyze the uploaded listing photo");
    e.target.value = "";
  };
  const removePhoto = (id) => {
    setAttachments((items) => {
      const target = items.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return items.filter((item) => item.id !== id);
    });
  };
  const clearPhotos = () => {
    attachmentsRef.current.forEach((item) => URL.revokeObjectURL(item.url));
    setAttachments([]);
  };
  const setPromptFromVoice = (spoken) => {
    const base = voiceBaseRef.current.trim();
    const next = [base, spoken.trim()].filter(Boolean).join(base && spoken.trim() ? " " : "");
    setValue(next);
    setTimeout(() => grow(taRef.current), 0);
  };
  const stopVoice = () => {
    voiceWantedRef.current = false;
    if (speechRef.current) {
      try { speechRef.current.stop(); } catch {}
    }
    setVoiceStatus("idle");
    setVoiceMessage("");
  };
  React.useEffect(() => {
    if (streaming && voiceStatus === "listening") stopVoice();
  }, [streaming, voiceStatus]);
  const startVoice = () => {
    if (!voiceSupported) {
      setVoiceMessage("Voice input is not supported in this browser.");
      return;
    }
    if (streaming) return;
    if (voiceStatus === "listening") {
      stopVoice();
      return;
    }

    const recognition = new SpeechRecognition();
    speechRef.current = recognition;
    voiceWantedRef.current = true;
    voiceBaseRef.current = value;
    voiceFinalRef.current = "";
    setVoiceStatus("listening");
    setVoiceMessage("Listening...");

    recognition.lang = navigator.language || "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      let interim = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const text = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) finalText += text;
        else interim += text;
      }
      if (finalText.trim()) {
        voiceFinalRef.current = `${voiceFinalRef.current} ${finalText}`.trim();
      }
      setPromptFromVoice(`${voiceFinalRef.current} ${interim}`.trim());
    };
    recognition.onerror = (event) => {
      voiceWantedRef.current = false;
      const blocked = event.error === "not-allowed" || event.error === "service-not-allowed";
      setVoiceStatus("idle");
      setVoiceMessage(blocked ? "Microphone access was blocked." : "Voice input stopped. Try again.");
    };
    recognition.onend = () => {
      if (voiceWantedRef.current) {
        voiceWantedRef.current = false;
        setVoiceStatus("idle");
        setVoiceMessage(voiceFinalRef.current ? "Voice added to prompt." : "");
      }
    };
    try {
      recognition.start();
    } catch {
      voiceWantedRef.current = false;
      setVoiceStatus("idle");
      setVoiceMessage("Voice input could not start. Try again.");
    }
  };
  const submit = () => {
    if (!value.trim()) return;
    if (voiceStatus === "listening") stopVoice();
    onSend();
    clearPhotos();
  };

  return (
    <div style={{ width: "100%", maxWidth, margin: "0 auto" }}>
      <div className="aria-elev" style={{
        background: C2.s1, border: `1px solid ${C2.hair}`, borderRadius: 24, padding: "10px 10px 8px",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", width: "100%", padding: "0 6px 6px" }}>
          <textarea ref={taRef} value={value} rows={1}
            aria-label={`Ask ${agent.name}`} name="aria-prompt" autoComplete="off"
            onChange={(e) => { setValue(e.target.value); grow(e.target); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
            }}
            placeholder={`Ask ${agent.name}…`}
            style={{
              width: "100%", background: "transparent", border: "none", outline: "none", color: C2.ink,
              fontSize: 15.5, lineHeight: 1.45, padding: "8px 0", maxHeight: 200, minHeight: 32,
              resize: "none",
            }} />
        </div>
        {attachments.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "0 6px 8px" }}>
            {attachments.map((item) => (
              <div key={item.id} style={{
                display: "flex", alignItems: "center", gap: 8, maxWidth: 210, padding: "5px 7px 5px 5px",
                borderRadius: 12, background: C2.s2, border: `1px solid ${C2.hair}`, color: C2.ink,
              }}>
                <img src={item.url} alt="" style={{ width: 34, height: 34, borderRadius: 9, objectFit: "cover", flexShrink: 0 }} />
                <span title={item.name} style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12.5, color: C2.inkSoft }}>
                  {item.name}
                </span>
                <button className="aria-focus" onClick={() => removePhoto(item.id)} title="Remove photo" aria-label={`Remove ${item.name}`}
                  style={{ width: 22, height: 22, borderRadius: 100, display: "grid", placeItems: "center", color: C2.muted, flexShrink: 0 }}>
                  <Icon name="X" size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
        {/* bottom controls row */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8, rowGap: 6, flexWrap: "wrap",
          padding: "7px 0 0", borderTop: `1px solid ${C2.hairSoft}`,
        }}>
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={addPhotos} aria-label="Upload listing photos" style={{ display: "none" }} />
          <button className="aria-focus" title="Upload photos" aria-label="Upload photos" onClick={() => fileRef.current && fileRef.current.click()}
            style={{ width: 34, height: 34, borderRadius: 100, display: "grid", placeItems: "center", color: C2.muted, flexShrink: 0 }}>
            <Icon name="Plus" size={19} />
          </button>
          <button className="aria-focus"
            title={voiceSupported ? (voiceStatus === "listening" ? "Stop voice input" : "Dictate prompt") : "Voice input is not supported in this browser"}
            aria-label={voiceStatus === "listening" ? "Stop voice input" : "Dictate prompt"}
            aria-pressed={voiceStatus === "listening"}
            disabled={!voiceSupported || streaming}
            onClick={startVoice}
            style={{
              width: 34, height: 34, borderRadius: 100, display: "grid", placeItems: "center", flexShrink: 0,
              background: voiceStatus === "listening" ? C2.cta : "transparent",
              color: voiceStatus === "listening" ? C2.ctaText : C2.muted,
              opacity: voiceSupported && !streaming ? 1 : 0.45,
              cursor: voiceSupported && !streaming ? "pointer" : "default",
              position: "relative",
            }}>
            <Icon name={voiceStatus === "listening" ? "MicOff" : "Mic"} size={17.5} />
            {voiceStatus === "listening" && (
              <span style={{
                position: "absolute", right: 5, top: 5, width: 6, height: 6, borderRadius: 100,
                background: C2.ctaText, boxShadow: `0 0 0 3px ${C2.ctaText}33`,
              }} />
            )}
          </button>
          {voiceMessage && (
            <span title={voiceMessage} style={{
              maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              fontSize: 12, color: voiceStatus === "listening" ? C2.cta : C2.muted,
              fontWeight: voiceStatus === "listening" ? 650 : 500,
            }}>
              {voiceMessage}
            </span>
          )}
          <AgentPicker agentId={agent.id} agents={agents} onPick={onPickAgent} />
          <span style={{ width: 1, height: 18, background: C2.hair }} />
          <ModelPicker modelId={modelId} onPick={setModelId} />
          <button className="aria-focus" onClick={onExportConversation} disabled={!canExportConversation}
            title={canExportConversation ? "Export full conversation brief" : "Run at least one analysis to export a conversation brief"}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 100,
              background: canExportConversation ? C2.s2 : "transparent",
              border: canExportConversation ? `1px solid ${C2.hair}` : `1px solid transparent`,
              color: canExportConversation ? C2.ink : C2.muted,
              fontSize: 12.5, fontWeight: 500, cursor: canExportConversation ? "pointer" : "default",
              opacity: canExportConversation ? 1 : 0.48, transition: "background 0.12s, opacity 0.12s",
            }}
            onMouseEnter={(e) => { if (canExportConversation) e.currentTarget.style.background = C2.s1; }}
            onMouseLeave={(e) => { if (canExportConversation) e.currentTarget.style.background = C2.s2; }}>
            <Icon name="Download" size={14.5} color="currentColor" />
            Chat Brief
          </button>
          <button className="aria-focus" onClick={onExportPrompt} disabled={!canExportPrompt}
            title={canExportPrompt ? "Download a reusable project brief from this conversation" : "Run at least one analysis to generate a project brief"}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 100,
              background: canExportPrompt ? C2.s2 : "transparent",
              border: canExportPrompt ? `1px solid ${C2.hair}` : `1px solid transparent`,
              color: canExportPrompt ? C2.ink : C2.muted,
              fontSize: 12.5, fontWeight: 500, cursor: canExportPrompt ? "pointer" : "default",
              opacity: canExportPrompt ? 1 : 0.48, transition: "background 0.12s, opacity 0.12s",
            }}
            onMouseEnter={(e) => { if (canExportPrompt) e.currentTarget.style.background = C2.s1; }}
            onMouseLeave={(e) => { if (canExportPrompt) e.currentTarget.style.background = C2.s2; }}>
            <Icon name="FileText" size={14.5} color="currentColor" />
            Project Brief
          </button>
          {engine.ml && (
            <div className="aria-scalein" style={{
              display: "flex", alignItems: "center", gap: 6, padding: "4px 9px", borderRadius: 100,
              background: C2.s2, border: `1px solid ${C2.hair}`, fontSize: 12, color: C2.ink,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: 4, background: C2.teal }} />
              Engine: {engine.chip}
              <button onClick={() => setModelId("gemini-2.5-pro")} title="Remove engine" aria-label="Remove analysis engine"
                style={{ display: "grid", placeItems: "center", color: C2.muted, marginLeft: 1 }}>
                <Icon name="X" size={13} />
              </button>
            </div>
          )}
          <div style={{ flex: "1 1 auto", minWidth: 8 }} />
          {streaming ? (
            <button className="aria-focus" onClick={onStop} title="Stop generating" aria-label="Stop generating"
              style={{ width: 36, height: 36, borderRadius: 100, display: "grid", placeItems: "center", background: C2.ink, color: C2.canvas, flexShrink: 0 }}>
              <span style={{ width: 11, height: 11, borderRadius: 3, background: C2.canvas }} />
            </button>
          ) : (
            <button className="aria-focus" onClick={submit} disabled={!value.trim()} title="Send" aria-label="Send message"
              style={{
                width: 36, height: 36, borderRadius: 100, display: "grid", placeItems: "center", flexShrink: 0,
                background: value.trim() ? C2.cta : C2.s2, color: value.trim() ? C2.ctaText : C2.muted,
                transition: "background 0.15s", cursor: value.trim() ? "pointer" : "default",
              }}>
              <Icon name="ArrowUp" size={18} sw={2.4} />
            </button>
          )}
        </div>
      </div>
      <div style={{ textAlign: "center", fontSize: 11.5, color: C2.muted, marginTop: 9, letterSpacing: -0.1 }}>
        ARIA can make mistakes. Verify critical pricing decisions. — IE × KPMG Capstone 2026
      </div>
    </div>
  );
});

function StatusMetric({ icon, accent, label, value, meta }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, height: "100%", padding: "10px 0", borderTop: `1px solid ${C2.hairSoft}` }}>
      <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: "grid", placeItems: "center", background: `${accent}1f` }}>
        <Icon name={icon} size={15.5} color={accent} sw={2.1} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11.5, color: C2.muted, fontWeight: 500 }}>{label}</div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, minWidth: 0, marginTop: 2 }}>
          <span style={{ fontSize: 13.5, color: C2.ink, fontWeight: 600, lineHeight: 1.2 }}>{value}</span>
          <span style={{ fontSize: 11.5, color: C2.muted, lineHeight: 1.25 }}>{meta}</span>
        </div>
      </div>
    </div>
  );
}

function LiveDataStatus() {
  const items = [
    { icon: "RefreshCw", accent: C2.success, label: "Dataset refresh", value: "Synced 09:42", meta: "current build" },
    { icon: "Table2", accent: C2.blue, label: "Portfolio load", value: "135,051 rows", meta: "96 columns" },
    { icon: "BrainCircuit", accent: C2.violet, label: "Model stack", value: "3 engines ready", meta: "XGB · LGBM · Prophet" },
    { icon: "CalendarClock", accent: C2.orange, label: "Forecast window", value: "90 days", meta: "Paris + Athens" },
  ];

  return (
    <div className="aria-elev" style={{
      background: C2.s1, border: `1px solid ${C2.hair}`, borderRadius: 16, padding: "14px 16px 15px",
      display: "flex", flexDirection: "column", gap: 8, flex: "1 1 auto", minHeight: 228,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, display: "grid", placeItems: "center", background: `${C2.success}1f`, flexShrink: 0 }}>
            <Icon name="Activity" size={14.5} color={C2.success} sw={2.2} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: C2.ink }}>Live data status</div>
            <div style={{ fontSize: 11.5, color: C2.muted, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              Demo dataset and model readiness
            </div>
          </div>
        </div>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: C2.muted,
          border: `1px solid ${C2.hair}`, borderRadius: 100, padding: "3px 8px", whiteSpace: "nowrap", flexShrink: 0,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: 4, background: C2.success }} /> Operational
        </span>
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gridAutoRows: "1fr",
        columnGap: 20, rowGap: 2, flex: 1, alignContent: "stretch",
      }}>
        {items.map((item) => <StatusMetric key={item.label} {...item} />)}
      </div>
    </div>
  );
}

/* ---------- Empty state ---------- */
function EmptyState({ composer, onSignal, contentZoom = 1 }) {
  const landingWidth = 1022;
  const [showAllPrompts, setShowAllPrompts] = React.useState(false);
  const scriptedPrompts = [
    { agentId: "market", prompt: "Which Paris arrondissement is best for a new short-term rental investment?" },
    { agentId: "market", prompt: "Which Paris areas look saturated and should I avoid?" },
    { agentId: "host-revenue", prompt: "Is my Paris listing underpriced compared with similar listings?" },
    { agentId: "host-revenue", prompt: "What price change could improve my Athens listing revenue?" },
    { agentId: "market", prompt: "Which Athens neighbourhoods offer the strongest short-term rental yield?" },
    { agentId: "gentrification", prompt: "Which Athens listings need attention first because they are high-risk and underpriced?" },
    { agentId: "gentrification", prompt: "Where is host risk highest in Athens?" },
    { agentId: "market", prompt: "Compare Paris vs Athens for a small short-term rental portfolio." },
  ];
  const visiblePrompts = showAllPrompts ? scriptedPrompts : scriptedPrompts.slice(0, 4);
  const hiddenPromptCount = scriptedPrompts.length - 4;
  return (
    <div style={{ flex: 1, overflowY: "auto", overflowX: contentZoom > 1 ? "auto" : "hidden" }}>
      <div style={{
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "26px 24px 36px",
        zoom: contentZoom,
        transformOrigin: "top center",
      }}>
      <div style={{ width: "100%", maxWidth: 1080, margin: "auto 0" }}>
        {/* identity + greeting */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
          <AriaLogo width={220} style={{ marginBottom: 20 }} />
          <h1 style={{ fontSize: 30, fontWeight: 500, letterSpacing: -1, lineHeight: 1.13, margin: "0", textAlign: "center" }}>
            What should we analyze today?
          </h1>
        </div>

        <div style={{ width: "100%", maxWidth: landingWidth, margin: "0 auto 22px" }}>
          {composer}
        </div>

        <div style={{ width: "100%", maxWidth: landingWidth, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C2.ink }}>Scripted analyses</div>
              <div style={{ fontSize: 12, color: C2.muted }}>{showAllPrompts ? "8 prompts" : "4 of 8 prompts"}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10 }}>
              {visiblePrompts.map((item, i) => {
                const a = AGENT_BY_ID[item.agentId];
                const showToggle = hiddenPromptCount > 0 && i === visiblePrompts.length - 1;
                return (
                  <div key={`${item.agentId}-${item.prompt}`} style={{ position: "relative", minHeight: 72 }}>
                    <button className="aria-focus aria-elev"
                      onClick={() => onSignal(item.agentId, item.prompt)}
                      style={{
                        width: "100%", minHeight: 72, height: "100%", display: "flex", alignItems: "flex-start", gap: 10, textAlign: "left",
                        padding: showToggle ? "13px 48px 13px 14px" : "13px 14px",
                        borderRadius: 14, background: C2.s1, border: `1px solid ${C2.hair}`, color: C2.inkSoft,
                        fontSize: 13, lineHeight: 1.32, transition: "background 0.13s, transform 0.13s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = C2.s2; e.currentTarget.style.transform = "translateY(-1px)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = C2.s1; e.currentTarget.style.transform = "none"; }}>
                      <Icon name="ArrowUpRight" size={15} color={a.accent} style={{ marginTop: 1, flexShrink: 0 }} />
                      <span style={{ textWrap: "pretty" }}>{item.prompt}</span>
                    </button>
                    {showToggle && (
                      <button type="button" className="aria-focus"
                        aria-expanded={showAllPrompts}
                        title={showAllPrompts ? "Show fewer scripted prompts" : `Show ${hiddenPromptCount} more scripted prompts`}
                        onClick={(e) => { e.stopPropagation(); setShowAllPrompts((v) => !v); }}
                        style={{
                          position: "absolute", right: 10, bottom: 10, width: 30, height: 30, borderRadius: 100,
                          display: "grid", placeItems: "center", background: C2.canvas, border: `1px solid ${C2.hair}`,
                          color: C2.muted, boxShadow: "0 6px 18px rgba(0,0,0,0.10)",
                        }}>
                        <Icon name={showAllPrompts ? "ChevronUp" : "ChevronDown"} size={16} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <LandingDashboard onSignal={onSignal} />
        </div>
      </div>
      </div>
    </div>
  );
}

/* ---------- Settings modal ---------- */
function SettingsModal({ open, onClose, settings, setSettings }) {
  const [tab, setTab] = React.useState("api");
  const [testState, setTestState] = React.useState("idle"); // idle | testing | ok | fail
  const panelRef = React.useRef(null);
  const titleId = React.useRef(`settings-title-${Math.random().toString(36).slice(2)}`).current;
  const previousFocusRef = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement;
    const focusableSelector = "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])";
    const focusFirst = () => {
      const first = panelRef.current?.querySelector(focusableSelector);
      (first || panelRef.current)?.focus();
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll(focusableSelector))
        .filter((el) => !el.disabled && el.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    setTimeout(focusFirst, 0);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;

  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }));
  const testConn = async () => {
    setTestState("testing");
    try {
      const res = await fetch("/api/chat");
      const status = await res.json();
      const hasProject = settings.project.trim().length > 0 && settings.projectNumber.trim().length > 0;
      setTestState(res.ok && status.authConfigured && hasProject ? "ok" : "fail");
    } catch {
      setTestState("fail");
    }
  };

  const field = { background: C2.canvas, border: `1px solid ${C2.hair}`, color: C2.ink, borderRadius: 10, padding: "10px 12px", fontSize: 14, outline: "none", width: "100%" };
  const labelS = { fontSize: 12.5, color: C2.muted, fontWeight: 500, marginBottom: 7, display: "block", letterSpacing: -0.1 };

  return (
    <div className="aria-fadein no-print" onMouseDown={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(3px)", display: "grid", placeItems: "center", zIndex: 100, padding: 24 }}>
      <div ref={panelRef} className="aria-scalein" onMouseDown={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        style={{
          width: 560, maxWidth: "100%", height: "min(546px, calc(100vh - 48px))", maxHeight: "86vh", overflow: "hidden", display: "flex", flexDirection: "column",
          background: C2.s2, borderRadius: 18, border: `1px solid ${C2.hair}`,
          boxShadow: "0 -1px 0 rgba(255,255,255,0.10) inset, 0 30px 80px rgba(0,0,0,0.7)",
        }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: `1px solid ${C2.hairSoft}` }}>
          <div id={titleId} style={{ fontSize: 16, fontWeight: 600, letterSpacing: -0.3 }}>Settings</div>
          <button className="aria-focus" onClick={onClose} aria-label="Close settings" style={{ width: 32, height: 32, borderRadius: 8, display: "grid", placeItems: "center", color: C2.muted }}>
            <Icon name="X" size={18} />
          </button>
        </div>
        <div style={{ display: "flex", gap: 4, padding: "12px 18px 0" }}>
          {[["api", "API & Models"], ["about", "About"]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className="aria-focus"
              style={{ padding: "7px 13px", borderRadius: 100, fontSize: 13.5, fontWeight: 500,
                background: tab === k ? C2.s1 : "transparent", color: tab === k ? C2.ink : C2.muted }}>{l}</button>
          ))}
        </div>

        <div style={{ padding: 18, overflowY: "auto", flex: 1 }}>
          {tab === "api" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label htmlFor="vertex-project-id" style={labelS}>Vertex project ID</label>
                  <input id="vertex-project-id" name="vertex-project-id" autoComplete="off" spellCheck={false}
                    value={settings.project} onChange={(e) => { set("project", e.target.value); setTestState("idle"); }} placeholder="capstoneprojectkpmg" className="aria-focus" style={field} />
                </div>
                <div>
                  <label htmlFor="vertex-project-number" style={labelS}>Vertex project number</label>
                  <input id="vertex-project-number" name="vertex-project-number" type="password" autoComplete="off" inputMode="numeric" spellCheck={false}
                    value={settings.projectNumber || ""} onChange={(e) => { set("projectNumber", e.target.value); setTestState("idle"); }} placeholder="52102703097" className="aria-focus" style={field} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label htmlFor="vertex-region" style={labelS}>Region</label>
                  <select id="vertex-region" name="vertex-region" autoComplete="off" value={settings.region} onChange={(e) => { set("region", e.target.value); setTestState("idle"); }} className="aria-focus" style={{ ...field, appearance: "none" }}>
                    <option>europe-west1</option><option>europe-west4</option><option>us-central1</option><option>global</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="default-model" style={labelS}>Default model</label>
                  <select id="default-model" name="default-model" autoComplete="off" value={settings.defaultModel} onChange={(e) => { set("defaultModel", e.target.value); setTestState("idle"); }} className="aria-focus" style={{ ...field, appearance: "none" }}>
                    <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                    <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                    <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro</option>
                    <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
                    <option value="claude-opus-4-7">Claude Opus 4.7</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={testConn} className="aria-focus"
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: 100, background: C2.s1, border: `1px solid ${C2.hair}`, color: C2.ink, fontSize: 13.5, fontWeight: 500 }}>
                  {testState === "testing" && <Icon name="Loader" size={15} className="aria-spin" />}
                  Test backend
                </button>
                <span aria-live="polite" role="status" style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 18 }}>
                  {testState === "ok" && <span style={{ display: "flex", alignItems: "center", gap: 6, color: C2.success, fontSize: 13.5 }}><Icon name="CircleCheck" size={16} /> Vertex backend ready</span>}
                  {testState === "fail" && <span style={{ display: "flex", alignItems: "center", gap: 6, color: C2.coral, fontSize: 13.5 }}><Icon name="CircleX" size={16} /> Needs Vercel auth</span>}
                </span>
              </div>
              <div style={{ fontSize: 12, color: C2.muted, lineHeight: 1.5 }}>
                Suggested prompts keep their scripted demo answers. Custom typed prompts call the server-side Vertex AI backend, load live GitHub project data, and return grounded KPIs, charts, and sources. The project fields identify where to run the Vertex request; Vercel still needs a service account environment variable for authentication.
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 14.5, lineHeight: 1.65, color: C2.inkSoft }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: `conic-gradient(from 210deg, ${C2.violet}, ${C2.magenta}, ${C2.coral}, ${C2.orange}, ${C2.violet})` }} />
                <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: -0.4 }}>ARIA</span>
              </div>
              <p style={{ marginTop: 0 }}>
                <strong>ARIA</strong> (Airbnb Revenue Intelligence &amp; Analytics) is a multi-agent platform that unifies five proposed KPMG AI systems — host revenue, gentrification early-warning, STR financial-crime detection, tourism demand forecasting, and market-entry advisory — over one master dataset of <strong>135,051 listings × 96 columns</strong> (Paris 120,809 · Athens 14,242), with XGBoost pricing, LightGBM risk, and SHAP explainability.
              </p>
              <p>
                The website interface was designed with guidance from the project group members and built with support from Codex and Claude Code.
              </p>
              <p style={{ color: C2.muted, marginBottom: 0 }}>IE Business School × KPMG Spain — Capstone 2026.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- PDF brief export ---------- */
function escapeBriefHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function plainBriefText(value) {
  return String(value ?? "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*/g, "")
    .trim();
}

function paragraphsHtml(text) {
  return plainBriefText(text)
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p>${escapeBriefHtml(part).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function listHtml(items = []) {
  if (!items.length) return "";
  return `<ul>${items.map((item) => `<li>${escapeBriefHtml(plainBriefText(item))}</li>`).join("")}</ul>`;
}

function tableHtml(rows = []) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]).filter((key) => !["lat", "lon", "coordinateSource"].includes(key)).slice(0, 6);
  if (!keys.length) return "";
  return `
    <table>
      <thead><tr>${keys.map((key) => `<th>${escapeBriefHtml(key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " "))}</th>`).join("")}</tr></thead>
      <tbody>
        ${rows.slice(0, 10).map((row) => `<tr>${keys.map((key) => `<td>${escapeBriefHtml(row[key])}</td>`).join("")}</tr>`).join("")}
      </tbody>
    </table>`;
}

function collectVisualSnapshots(event) {
  const answerNode = event?.currentTarget?.closest?.("[data-aria-answer='true']");
  if (!answerNode) return [];
  return collectVisualSnapshotsFromNode(answerNode);
}

function collectVisualSnapshotsFromNode(root, label = "Visual") {
  if (!root) return [];
  return Array.from(root.querySelectorAll(".aria-export-visual")).map((node, index) => {
    const clone = node.cloneNode(true);
    clone.querySelectorAll(".no-print, button").forEach((el) => el.remove());
    clone.querySelectorAll("[style]").forEach((el) => {
      el.style.animation = "none";
      el.style.transition = "none";
      el.style.maxWidth = "100%";
    });
    clone.querySelectorAll(".leaflet-control-container").forEach((el) => {
      el.style.display = "none";
    });
    return `
      <section class="visual-snapshot">
        <div class="section-eyebrow">${escapeBriefHtml(label)} ${index + 1}</div>
        ${clone.innerHTML}
      </section>`;
  });
}

function collectConversationVisualSnapshots() {
  return Array.from(document.querySelectorAll("[data-aria-answer='true']"))
    .map((node, index) => collectVisualSnapshotsFromNode(node, `Answer ${index + 1} visual`));
}

function buildConversationTurns(messages = []) {
  const turns = [];
  let pendingPrompt = "";
  messages.forEach((message) => {
    if (message.role === "user") {
      pendingPrompt = message.text || "";
      return;
    }
    if (message.role === "assistant" && message.done !== false) {
      turns.push({ prompt: message.prompt || pendingPrompt || "User question", answer: message });
      pendingPrompt = "";
    }
  });
  return turns;
}

function promptMarkdownText(value) {
  return plainBriefText(value)
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function promptMarkdownFence(value) {
  const text = String(value ?? "").replace(/```/g, "'''").trim();
  return `\`\`\`text\n${text || "Not provided."}\n\`\`\``;
}

function promptMarkdownList(items = []) {
  const clean = items.map(promptMarkdownText).filter(Boolean);
  return clean.length ? clean.map((item) => `- ${item}`).join("\n") : "- Not provided.";
}

function compactPromptNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? Number(value.toFixed(3)) : "";
  return value ?? "";
}

function chartPromptSummary(chart) {
  if (!chart) return "";
  const rows = Array.isArray(chart.data) ? chart.data : [];
  const sampleRows = rows.slice(0, 6).map((row) => {
    if (!row || typeof row !== "object") return String(row ?? "");
    return Object.entries(row)
      .filter(([key]) => !["lat", "lon", "coordinateSource"].includes(key))
      .slice(0, 6)
      .map(([key, value]) => `${key}: ${compactPromptNumber(value)}`)
      .join(", ");
  }).filter(Boolean);
  return [
    `Chart: ${chart.title || "Untitled visual"}`,
    chart.metricNote ? `Interpretation note: ${promptMarkdownText(chart.metricNote)}` : "",
    chart.type ? `Type: ${chart.type}` : "",
    chart.xKey && chart.yKey ? `Variables: ${chart.xKey} vs ${chart.yKey}` : "",
    sampleRows.length ? `Sample data: ${sampleRows.join(" | ")}` : "",
  ].filter(Boolean).join("\n");
}

function answerPromptEvidence(answer = {}) {
  const blocks = Array.isArray(answer.blocks) ? answer.blocks : [];
  const lines = [];
  const textBlocks = blocks.filter((block) => block.type === "text").map((block) => promptMarkdownText(block.text)).filter(Boolean);
  const kpis = blocks.find((block) => block.type === "kpis")?.kpis || answer.brief?.kpis || [];
  const chartBlocks = blocks.filter((block) => block.type === "chart" && block.chart);
  const details = blocks.find((block) => block.type === "details")?.details || {};
  if (textBlocks.length) lines.push(`Answer narrative:\n${textBlocks.join("\n\n")}`);
  if (kpis.length) lines.push(`KPI cards:\n${kpis.slice(0, 8).map((kpi) => `- ${promptMarkdownText(kpi.label)}: ${promptMarkdownText(kpi.value)}${kpi.help ? ` (${promptMarkdownText(kpi.help)})` : ""}`).join("\n")}`);
  if (chartBlocks.length) lines.push(`Generated visualizations:\n${chartBlocks.map((block) => chartPromptSummary(block.chart)).filter(Boolean).join("\n\n")}`);
  if (details.sourceFiles?.length) lines.push(`Source files:\n${promptMarkdownList(details.sourceFiles)}`);
  if (details.limitations?.length) lines.push(`Limitations noted:\n${promptMarkdownList(details.limitations)}`);
  return lines.join("\n\n") || "No completed ARIA answer content was available.";
}

function safePromptFilePart(value) {
  return String(value || "aria-conversation")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "aria-conversation";
}

function downloadMarkdown(filename, markdown) {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function buildConversationPromptMarkdown(conversation, options = {}) {
  const turns = buildConversationTurns(conversation?.messages || []);
  if (!turns.length) return "";
  const activeAgent = options.agent || AGENT_BY_ID[conversation?.agentId] || AGENTS[0];
  const model = MODEL_BY_ID[options.modelId] || MODEL_BY_ID["gemini-2.5-pro"] || { name: options.modelId || "Selected model" };
  const generated = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  const latestTurn = turns[turns.length - 1];
  const context = turns.map((turn, index) => {
    const answer = turn.answer || {};
    const agent = AGENT_BY_ID[answer.agentId] || activeAgent;
    return `## Conversation Turn ${index + 1}\n\n### User request\n${promptMarkdownFence(turn.prompt)}\n\n### ARIA answer context (${agent.name})\n${answerPromptEvidence(answer)}`;
  }).join("\n\n");

  return `# ARIA Project Brief\n\nGenerated: ${generated}\nConversation: ${conversation?.title || "Current ARIA chat"}\nActive agent: ${activeAgent.name}\nSelected model: ${model.name || options.modelId || "Selected model"}\n\n## Reusable Analyst Instruction\n\nUse the instruction below in ARIA or another analyst LLM when you want to reproduce and refine this conversation's output style.\n\n${promptMarkdownFence(`You are ARIA, KPMG's short-term-rental intelligence analyst for the IE Business School capstone project. Use the conversation context below as the grounding record. Produce a professional, client-ready answer for a non-technical investor, manager, or business stakeholder.\n\nPrimary task: Respond to the latest user request while preserving the project evidence, model outputs, source discipline, and visualization logic already used in this conversation.\n\nLatest user request:\n${latestTurn.prompt}\n\nResponse structure:\n1. Direct recommendation first.\n2. Reasoning done by ARIA, in plain language.\n3. Key evidence from the available ARIA model outputs and project data.\n4. Visualizations to review, including maps for geographic prompts and only charts whose variables make analytical sense.\n5. Possible limitations and decision risks.\n6. Concrete next actions.\n7. End with a Sources line.\n\nHard rules:\n- Stay within the requested city, asset, or decision scope unless the user explicitly asks for a cross-city comparison.\n- Ground claims in ARIA project evidence: XGBoost pricing outputs, SHAP explanations, LightGBM risk scores, Prophet forecast outputs, RAG compliance notes, and neighbourhood/listing statistics when available.\n- Do not invent exact figures, model scores, legal advice, or property-level facts that are not present in the context.\n- Explain technical terms briefly in brackets the first time they matter.\n- Prefer 400-800 words for complex business prompts and shorter direct answers for simple prompts.\n- Use a formal, professional tone suitable for KPMG stakeholders.\n- If data is missing, say what is missing and give a cautious general recommendation.\n\nVisualization QA rules:\n- Include a map whenever the request is geographic and coordinates or neighbourhood data are available.\n- Use the chart type that best matches the question: ranking bars for top areas, line charts for forecasts, scatter/bubble charts only when both axes have enough spread and do not overlap, and KPI cards only for the most important numbers.\n- Do not duplicate the same chart in follow-up answers unless the user asks to revisit it; reference the previous visual instead.\n- Before presenting a chart, check whether the variables create a readable and meaningful comparison. If values overlap tightly, switch to a ranking bar, table, or KPI comparison.\n- Every visual should have a clear title, metric explanation, and decision purpose.\n\nSources format:\nSources: ARIA risk scores, neighbourhood stats, XGBoost predictions, SHAP model explanations, Prophet forecast outputs, RAG compliance notes - include only the sources actually used.`)}\n\n## Conversation Context\n\n${context}\n\n## Final Instruction\n\nUse the latest request and the conversation context above to generate the most refined ARIA response possible. Keep the answer scoped, grounded, visual-first where appropriate, and useful for decision-making.\n`;
}

function exportConversationPrompt(conversation, options = {}) {
  const markdown = buildConversationPromptMarkdown(conversation, options);
  if (!markdown) return;
  const date = new Date().toISOString().slice(0, 10);
  const filePart = safePromptFilePart(conversation?.title || "aria-conversation");
  downloadMarkdown(`aria-project-brief-${filePart}-${date}.md`, markdown);
}
function exportBrief(agent, prompt, message, event) {
  const win = window.open("", "_blank", "width=980,height=1100");
  if (!win) return;

  const brief = message?.brief || message || { title: "ARIA analysis brief", kpis: [] };
  const blocks = Array.isArray(message?.blocks) ? message.blocks : [];
  const textBlocks = blocks.filter((b) => b.type === "text").map((b) => b.text).filter(Boolean);
  const kpis = (blocks.find((b) => b.type === "kpis")?.kpis || brief.kpis || []).slice(0, 8);
  const chartBlocks = blocks.filter((b) => b.type === "chart" && b.chart);
  const details = blocks.find((b) => b.type === "details")?.details || {};
  const visualSnapshots = collectVisualSnapshots(event);

  const kpiHtml = kpis.map((k) => `
    <div class="kpi">
      <div class="kpi-label">${escapeBriefHtml(k.label)}</div>
      <div class="kpi-value">${escapeBriefHtml(k.value)}</div>
      ${k.help ? `<div class="kpi-help">${escapeBriefHtml(plainBriefText(k.help))}</div>` : ""}
    </div>`).join("");

  const chartDataHtml = chartBlocks.map((block, index) => `
    <section class="section">
      <div class="section-eyebrow">Chart data ${index + 1}</div>
      <h2>${escapeBriefHtml(block.chart.title || "Analysis visual")}</h2>
      ${block.chart.metricNote ? `<p class="muted">${escapeBriefHtml(block.chart.metricNote)}</p>` : ""}
      ${tableHtml(block.chart.data || [])}
    </section>`).join("");

  const metricGuideHtml = (details.metricGuides || []).map((guide) => `
    <div class="guide">
      <h3>${escapeBriefHtml(guide.label)}</h3>
      <p>${escapeBriefHtml(guide.meaning || "")}</p>
      ${guide.range ? `<p class="muted">${escapeBriefHtml(guide.range)}</p>` : ""}
      ${guide.good ? `<p>${escapeBriefHtml(guide.good)}</p>` : ""}
      ${guide.optimal ? `<p class="muted">${escapeBriefHtml(guide.optimal)}</p>` : ""}
    </div>`).join("");

  const title = brief.title || `${agent.name} brief`;
  const generated = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeBriefHtml(title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <style>
    *{box-sizing:border-box}
    body{font-family:Inter,system-ui,sans-serif;color:#141414;background:#fff;margin:0;padding:46px 54px;letter-spacing:0}
    .tag{display:inline-flex;align-items:center;gap:8px;font-size:12px;color:#555;border:1px solid #e2e2e2;border-radius:100px;padding:6px 12px}
    h1{font-size:30px;font-weight:700;margin:18px 0 7px;line-height:1.15;letter-spacing:0}
    h2{font-size:17px;font-weight:650;margin:0 0 8px;letter-spacing:0}
    h3{font-size:13px;margin:0 0 5px}
    p{font-size:13.5px;line-height:1.6;color:#333;margin:0 0 10px}
    ul{margin:0;padding-left:18px;color:#333;font-size:13px;line-height:1.55}
    li{margin:3px 0}
    table{width:100%;border-collapse:collapse;font-size:11.5px;margin-top:10px}
    th,td{border-bottom:1px solid #e8e8e8;text-align:left;padding:7px 8px;vertical-align:top}
    th{color:#666;font-weight:650;background:#f8f8f8;text-transform:capitalize}
    .meta{color:#777;font-size:13px;margin-bottom:24px}
    .query{font-size:14px;color:#333;background:#f6f6f6;border:1px solid #e6e6e6;border-radius:12px;padding:14px 16px;margin-bottom:18px;line-height:1.5}
    .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:18px 0 24px}
    .kpi{border:1px solid #e2e2e2;border-radius:12px;padding:13px 14px;min-height:92px;page-break-inside:avoid}
    .kpi-label{font-size:11px;color:#777;margin-bottom:6px}
    .kpi-value{font-size:20px;font-weight:700;line-height:1.15}
    .kpi-help{font-size:10.5px;line-height:1.3;color:#777;margin-top:7px}
    .section{margin-top:24px;page-break-inside:avoid}
    .section-eyebrow{font-size:10.5px;color:#777;text-transform:uppercase;letter-spacing:.05em;font-weight:650;margin-bottom:8px}
    .answer{border-top:1px solid #e6e6e6;border-bottom:1px solid #e6e6e6;padding:18px 0;margin-bottom:22px}
    .visual-snapshot{margin:18px 0 24px;page-break-inside:avoid}
    .visual-snapshot>.aria-fadein,.visual-snapshot .aria-fadein{max-width:100%!important;margin:0!important;box-shadow:none!important}
    .visual-snapshot svg{max-width:100%;height:auto}
    .visual-snapshot img{max-width:100%}
    .visual-snapshot .leaflet-container{font-family:Inter,system-ui,sans-serif}
    .muted{color:#747474}
    .guide{border:1px solid #e4e4e4;border-radius:12px;padding:12px 13px;margin:8px 0;page-break-inside:avoid}
    .checklist{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
    .check{border:1px solid #e5e5e5;border-radius:10px;padding:10px 12px;font-size:12.5px;line-height:1.45;color:#333;background:#fafafa}
    .foot{margin-top:38px;padding-top:16px;border-top:1px solid #e3e3e3;color:#888;font-size:11.5px;display:flex;justify-content:space-between;gap:16px}
    @media print{
      body{padding:28px 34px}
      .grid{grid-template-columns:repeat(2,1fr)}
      .visual-snapshot{break-inside:avoid}
      a{color:inherit;text-decoration:none}
    }
  </style></head><body>
    <span class="tag">ARIA · ${escapeBriefHtml(agent.name)}</span>
    <h1>${escapeBriefHtml(title)}</h1>
    <div class="meta">Generated ${generated} · Decision brief</div>
    <div class="query"><strong>Query:</strong> ${escapeBriefHtml(prompt)}</div>
    ${kpiHtml ? `<div class="grid">${kpiHtml}</div>` : ""}
    ${textBlocks.length ? `<section class="answer"><div class="section-eyebrow">Recommendation and context</div>${textBlocks.map(paragraphsHtml).join("")}</section>` : ""}
    ${visualSnapshots.length ? `<section class="section"><div class="section-eyebrow">Exported visual evidence</div>${visualSnapshots.join("")}</section>` : ""}
    ${chartDataHtml}
    ${details.methodology ? `<section class="section"><div class="section-eyebrow">Methodology</div><p>${escapeBriefHtml(details.methodology)}</p></section>` : ""}
    ${(details.sourceFiles || []).length ? `<section class="section"><div class="section-eyebrow">Source files</div>${listHtml(details.sourceFiles)}</section>` : ""}
    ${(details.limitations || []).length ? `<section class="section"><div class="section-eyebrow">Limitations</div>${listHtml(details.limitations)}</section>` : ""}
    ${metricGuideHtml ? `<section class="section"><div class="section-eyebrow">Metric guide</div>${metricGuideHtml}</section>` : ""}
    ${(details.extra || []).length ? `<section class="section"><div class="section-eyebrow">Additional signals</div>${listHtml((details.extra || []).slice(0, 12))}</section>` : ""}
    <section class="section">
      <div class="section-eyebrow">Decision checklist</div>
      <div class="checklist">
        <div class="check">Compare the recommended area with actual purchase prices and transaction costs.</div>
        <div class="check">Check local licensing, building rules, and short-term-rental restrictions before committing.</div>
        <div class="check">Use the KPI cards as screening signals, not as a final investment decision.</div>
        <div class="check">Review the visual evidence and source files together; do not rely on one metric alone.</div>
      </div>
    </section>
    <div class="foot"><span>IE Business School x KPMG Spain - Capstone 2026</span><span>ARIA Platform · Confidential demo</span></div>
    <script>
      const finish = () => setTimeout(() => window.print(), 500);
      const imgs = Array.from(document.images || []);
      if (!imgs.length) finish();
      else Promise.allSettled(imgs.map((img) => img.complete ? Promise.resolve() : new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
        setTimeout(resolve, 1500);
      }))).then(finish);
    <\/script>
  </body></html>`);
  win.document.close();
}

function exportConversationBrief(conversation) {
  const turns = buildConversationTurns(conversation?.messages || []);
  if (!turns.length) return;

  const win = window.open("", "_blank", "width=980,height=1100");
  if (!win) return;

  const visualGroups = collectConversationVisualSnapshots();
  const title = `ARIA conversation brief - ${conversation?.title || "Current chat"}`;
  const generated = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const sourceFiles = new Set();
  const limitations = new Set();

  const turnHtml = turns.map((turn, index) => {
    const answer = turn.answer || {};
    const agent = AGENT_BY_ID[answer.agentId] || AGENTS[0];
    const blocks = Array.isArray(answer.blocks) ? answer.blocks : [];
    const textBlocks = blocks.filter((b) => b.type === "text").map((b) => b.text).filter(Boolean);
    const kpis = (blocks.find((b) => b.type === "kpis")?.kpis || answer.brief?.kpis || []).slice(0, 4);
    const chartBlocks = blocks.filter((b) => b.type === "chart" && b.chart);
    const details = blocks.find((b) => b.type === "details")?.details || {};
    (details.sourceFiles || []).forEach((item) => sourceFiles.add(item));
    (details.limitations || []).forEach((item) => limitations.add(item));

    const kpiHtml = kpis.map((k) => `
      <div class="kpi">
        <div class="kpi-label">${escapeBriefHtml(k.label)}</div>
        <div class="kpi-value">${escapeBriefHtml(k.value)}</div>
        ${k.help ? `<div class="kpi-help">${escapeBriefHtml(plainBriefText(k.help))}</div>` : ""}
      </div>`).join("");
    const chartDataHtml = chartBlocks.map((block, chartIndex) => `
      <section class="section compact">
        <div class="section-eyebrow">Chart data ${chartIndex + 1}</div>
        <h3>${escapeBriefHtml(block.chart.title || "Analysis visual")}</h3>
        ${block.chart.metricNote ? `<p class="muted">${escapeBriefHtml(block.chart.metricNote)}</p>` : ""}
        ${tableHtml(block.chart.data || [])}
      </section>`).join("");
    const visualsHtml = (visualGroups[index] || []).join("");
    return `
      <section class="turn">
        <div class="turn-head">
          <span class="tag">${escapeBriefHtml(agent.name)}</span>
          <span class="muted">Question ${index + 1}</span>
        </div>
        <div class="query"><strong>Query:</strong> ${escapeBriefHtml(turn.prompt)}</div>
        ${kpiHtml ? `<div class="grid">${kpiHtml}</div>` : ""}
        ${textBlocks.length ? `<div class="answer">${textBlocks.map(paragraphsHtml).join("")}</div>` : ""}
        ${visualsHtml ? `<section class="section"><div class="section-eyebrow">Visual evidence</div>${visualsHtml}</section>` : ""}
        ${chartDataHtml}
      </section>`;
  }).join("");

  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeBriefHtml(title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <style>
    *{box-sizing:border-box}
    body{font-family:Inter,system-ui,sans-serif;color:#141414;background:#fff;margin:0;padding:46px 54px;letter-spacing:0}
    .tag{display:inline-flex;align-items:center;gap:8px;font-size:12px;color:#555;border:1px solid #e2e2e2;border-radius:100px;padding:6px 12px}
    h1{font-size:30px;font-weight:700;margin:18px 0 7px;line-height:1.15;letter-spacing:0}
    h2{font-size:17px;font-weight:650;margin:0 0 8px;letter-spacing:0}
    h3{font-size:13px;margin:0 0 5px}
    p{font-size:13.5px;line-height:1.6;color:#333;margin:0 0 10px}
    ul{margin:0;padding-left:18px;color:#333;font-size:13px;line-height:1.55}
    li{margin:3px 0}
    table{width:100%;border-collapse:collapse;font-size:11.5px;margin-top:10px}
    th,td{border-bottom:1px solid #e8e8e8;text-align:left;padding:7px 8px;vertical-align:top}
    th{color:#666;font-weight:650;background:#f8f8f8;text-transform:capitalize}
    .meta{color:#777;font-size:13px;margin-bottom:24px}
    .query{font-size:14px;color:#333;background:#f6f6f6;border:1px solid #e6e6e6;border-radius:12px;padding:14px 16px;margin:14px 0 16px;line-height:1.5}
    .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0 18px}
    .kpi{border:1px solid #e2e2e2;border-radius:12px;padding:13px 14px;min-height:92px;page-break-inside:avoid}
    .kpi-label{font-size:11px;color:#777;margin-bottom:6px}
    .kpi-value{font-size:20px;font-weight:700;line-height:1.15}
    .kpi-help{font-size:10.5px;line-height:1.3;color:#777;margin-top:7px}
    .section{margin-top:20px;page-break-inside:avoid}
    .compact{margin-top:14px}
    .section-eyebrow{font-size:10.5px;color:#777;text-transform:uppercase;letter-spacing:.05em;font-weight:650;margin-bottom:8px}
    .answer{border-top:1px solid #e6e6e6;border-bottom:1px solid #e6e6e6;padding:16px 0;margin-bottom:18px}
    .turn{margin-top:30px;padding-top:26px;border-top:1px solid #e5e5e5;page-break-inside:avoid}
    .turn-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:4px}
    .visual-snapshot{margin:14px 0 22px;page-break-inside:avoid}
    .visual-snapshot>.aria-fadein,.visual-snapshot .aria-fadein{max-width:100%!important;margin:0!important;box-shadow:none!important}
    .visual-snapshot svg{max-width:100%;height:auto}
    .visual-snapshot img{max-width:100%}
    .visual-snapshot .leaflet-container{font-family:Inter,system-ui,sans-serif}
    .muted{color:#747474}
    .checklist{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
    .check{border:1px solid #e5e5e5;border-radius:10px;padding:10px 12px;font-size:12.5px;line-height:1.45;color:#333;background:#fafafa}
    .foot{margin-top:38px;padding-top:16px;border-top:1px solid #e3e3e3;color:#888;font-size:11.5px;display:flex;justify-content:space-between;gap:16px}
    @media print{
      body{padding:28px 34px}
      .grid{grid-template-columns:repeat(2,1fr)}
      .turn,.visual-snapshot{break-inside:avoid}
      a{color:inherit;text-decoration:none}
    }
  </style></head><body>
    <span class="tag">ARIA Agent · Full conversation</span>
    <h1>${escapeBriefHtml(title)}</h1>
    <div class="meta">Generated ${generated} · ${turns.length} answered ${turns.length === 1 ? "question" : "questions"}</div>
    ${turnHtml}
    ${(sourceFiles.size || limitations.size) ? `<section class="section">
      <div class="section-eyebrow">Conversation-level sources and caveats</div>
      ${sourceFiles.size ? `<h3>Source files</h3>${listHtml(Array.from(sourceFiles))}` : ""}
      ${limitations.size ? `<h3 style="margin-top:12px">Limitations</h3>${listHtml(Array.from(limitations))}` : ""}
    </section>` : ""}
    <section class="section">
      <div class="section-eyebrow">Decision checklist</div>
      <div class="checklist">
        <div class="check">Use this conversation as a shortlist of signals, not as a final investment decision.</div>
        <div class="check">Check purchase prices, licensing, taxes, financing, and building rules before committing.</div>
        <div class="check">Review each chart/map together with its KPI cards and source files.</div>
        <div class="check">Ask ARIA follow-up questions when one metric needs deeper explanation.</div>
      </div>
    </section>
    <div class="foot"><span>IE Business School x KPMG Spain - Capstone 2026</span><span>ARIA Platform · Conversation brief</span></div>
    <script>
      const finish = () => setTimeout(() => window.print(), 500);
      const imgs = Array.from(document.images || []);
      if (!imgs.length) finish();
      else Promise.allSettled(imgs.map((img) => img.complete ? Promise.resolve() : new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
        setTimeout(resolve, 1500);
      }))).then(finish);
    <\/script>
  </body></html>`);
  win.document.close();
}

Object.assign(window, { ModelPicker, AgentPicker, Composer, EmptyState, SettingsModal, exportBrief, exportConversationBrief, exportConversationPrompt, buildConversationPromptMarkdown });
