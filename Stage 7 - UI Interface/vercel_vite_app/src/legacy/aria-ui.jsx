/* ARIA — UI components: Icon, Sidebar, Composer, ModelPicker, Settings, ReasoningTrace, Message */

const C = ARIA.c;

/* ---------- Icon (lucide-react via Vite globals) ---------- */
function Icon({ name, size = 18, sw = 1.9, className, style, color }) {
  const icons = window.__ARIA_ICON_COMPONENTS || {};
  const LucideIcon = icons[name];
  if (!LucideIcon) return <span style={{ display: "inline-block", width: size, height: size }} />;
  return (
    <LucideIcon
      size={size}
      color={color || "currentColor"}
      strokeWidth={sw}
      className={className}
      style={{ flexShrink: 0, ...style }}
    />);

}

/* radial gradient tile for an agent identity */
function AgentTile({ accent, icon, size = 34, radius = 11, iconSize }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: radius, flexShrink: 0,
      display: "grid", placeItems: "center",
      background: `radial-gradient(120% 120% at 30% 20%, ${accent} 0%, ${accent}cc 38%, ${accent}33 100%)`,
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.25)`
    }}>
      <Icon name={icon} size={iconSize || Math.round(size * 0.5)} color="#fff" sw={2} />
    </div>);

}

function AriaLogo({ width = 148, compact = false, style }) {
  return (
    <img
      src="/aria-wordmark.svg"
      alt="ARIA"
      style={{
        display: "block",
        width: compact ? 88 : width,
        height: "auto",
        objectFit: "contain",
        ...style,
      }}
    />
  );
}

/* ---------- Sidebar ---------- */
function SidebarRow({ active, children, onClick, onMouseEnter, onMouseLeave, style }) {
  return (
    <div onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
    className="aria-focus" tabIndex={0}
    style={{
      display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10,
      cursor: "pointer", background: active ? C.s2 : "transparent",
      transition: "background 0.12s", userSelect: "none", ...style
    }}
    onKeyDown={(e) => {if (e.key === "Enter") onClick && onClick();}}>
      {children}
    </div>);

}

function Sidebar({
  collapsed, onToggle, onToggleFullscreen, isFullscreen, agents, activeAgentId, onPickAgent, onNewChat,
  conversations, activeConvId, onPickConv, onRenameConv, onDeleteConv,
  search, setSearch, onOpenSettings, apiKey, onApiKey
}) {
  const [hoverConv, setHoverConv] = React.useState(null);
  const [editing, setEditing] = React.useState(null);
  const [editVal, setEditVal] = React.useState("");

  const groups = ["Today", "Yesterday", "Previous 7 days"];
  const filtered = conversations.filter((c) =>
  !search || c.title.toLowerCase().includes(search.toLowerCase()));

  if (collapsed) {
    return (
      <div style={{
        width: 60, flexShrink: 0, background: C.s1, borderRight: `1px solid ${C.hairSoft}`,
        display: "flex", flexDirection: "column", alignItems: "center", padding: "14px 0", gap: 8
      }}>
        <button className="aria-focus" onClick={onToggle} title="Expand"
        style={{ width: 36, height: 36, borderRadius: 9, display: "grid", placeItems: "center", color: C.muted }}>
          <Icon name="PanelLeft" size={19} />
        </button>
        <button className="aria-focus" onClick={onToggleFullscreen} title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        style={{ width: 36, height: 36, borderRadius: 9, display: "grid", placeItems: "center", color: C.muted }}>
          <Icon name={isFullscreen ? "Minimize2" : "Maximize2"} size={18} />
        </button>
        <button className="aria-focus" onClick={onNewChat} title="New chat"
        style={{ width: 36, height: 36, borderRadius: 100, display: "grid", placeItems: "center", background: C.cta, color: C.ctaText, marginTop: 4 }}>
          <Icon name="Plus" size={19} sw={2.2} />
        </button>
        <div style={{ height: 10 }} />
        <button className="aria-focus" onClick={onOpenSettings} title={apiKey ? "Access key set · Live" : "Add access key"}
        style={{ width: 36, height: 36, borderRadius: 9, display: "grid", placeItems: "center", color: apiKey ? C.success : C.muted, border: `1px solid ${C.hair}` }}>
          <Icon name="KeyRound" size={17} />
        </button>
        <div style={{ marginTop: "auto" }}>
          <button className="aria-focus" onClick={onOpenSettings} title="Settings"
          style={{ width: 36, height: 36, borderRadius: 9, display: "grid", placeItems: "center", color: C.muted }}>
            <Icon name="Settings" size={19} />
          </button>
        </div>
      </div>);

  }

  return (
    <div style={{
      width: 268, flexShrink: 0, background: C.s1, borderRight: `1px solid ${C.hairSoft}`,
      display: "flex", flexDirection: "column", height: "100%"
    }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 16px 8px" }}>
        <button className="aria-focus" onClick={onNewChat} title="New chat"
        style={{ display: "flex", alignItems: "center", gap: 9, padding: 0, borderRadius: 8 }}>
          <AriaLogo compact />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <button className="aria-focus" onClick={onToggleFullscreen} title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          style={{ width: 32, height: 32, borderRadius: 8, display: "grid", placeItems: "center", color: C.muted }}>
            <Icon name={isFullscreen ? "Minimize2" : "Maximize2"} size={17.5} />
          </button>
          <button className="aria-focus" onClick={onToggle} title="Collapse sidebar"
          style={{ width: 32, height: 32, borderRadius: 8, display: "grid", placeItems: "center", color: C.muted }}>
            <Icon name="PanelLeftClose" size={19} />
          </button>
        </div>
      </div>

      {/* new chat */}
      <div style={{ padding: "4px 12px 8px" }}>
        <button className="aria-focus" onClick={onNewChat}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 9, justifyContent: "center",
          background: C.cta, color: C.ctaText, borderRadius: 100, padding: "9px 14px",
          fontSize: 14, fontWeight: 600, letterSpacing: -0.2
        }}>
          <Icon name="Plus" size={17} sw={2.4} /> New chat
        </button>
      </div>

      {/* search */}
      <div style={{ padding: "2px 12px 10px" }}>
        <div style={{ position: "relative" }}>
          <Icon name="Search" size={15} color={C.muted}
          style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
          <input className="aria-focus" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search chats"
          style={{
            width: "100%", background: C.canvas, border: `1px solid ${C.hair}`, color: C.ink,
            borderRadius: 10, padding: "8px 10px 8px 32px", fontSize: 13.5, outline: "none"
          }} />
        </div>
      </div>

      <div style={{ overflowY: "auto", flex: 1, padding: "0 8px 10px" }}>
        {/* access key */}
        <div style={{ fontSize: 12, color: C.muted, fontWeight: 500, letterSpacing: -0.13, padding: "8px 8px 6px" }}>ACCESS KEY</div>
        <div style={{ padding: "0 8px 4px" }}>
          <div style={{ position: "relative" }}>
            <Icon name="KeyRound" size={14.5} color={apiKey ? C.success : C.muted}
            style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
            <input className="aria-focus" type="password" value={apiKey || ""}
            onChange={(e) => onApiKey(e.target.value)}
            placeholder="Paste Vertex / Google key"
            autoComplete="off" spellCheck={false}
            style={{ width: "100%", background: C.canvas, border: `1px solid ${apiKey ? C.success + "55" : C.hair}`, color: C.ink, borderRadius: 10, padding: "9px 10px 9px 32px", fontSize: 13, outline: "none", letterSpacing: apiKey ? "2px" : "normal" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 4px 2px", fontSize: 11.5, color: C.muted }}>
            <span style={{ width: 6, height: 6, borderRadius: 4, background: apiKey ? C.success : C.orange, flexShrink: 0 }} />
            {apiKey ? "Live · ARIA Agent" : "Demo mode — scripted responses"}
          </div>
        </div>

        {/* conversations */}
        <div style={{ fontSize: 12, color: C.muted, fontWeight: 500, letterSpacing: -0.13, padding: "16px 8px 6px" }}>CONVERSATIONS</div>
        {groups.map((g) => {
          const rows = filtered.filter((c) => c.group === g);
          if (!rows.length) return null;
          return (
            <div key={g}>
              <div style={{ fontSize: 11.5, color: C.muted, padding: "8px 8px 3px", letterSpacing: -0.1 }}>{g}</div>
              {rows.map((c) => {
                const a = AGENT_BY_ID[c.agentId];
                const isEdit = editing === c.id;
                return (
                  <SidebarRow key={c.id} active={activeConvId === c.id}
                  onClick={() => !isEdit && onPickConv(c.id)}
                  onMouseEnter={() => setHoverConv(c.id)} onMouseLeave={() => setHoverConv(null)}
                  style={{ paddingRight: 6 }}>
                    <AgentTile accent={a.accent} icon={a.icon} size={22} radius={6} iconSize={12} />
                    {isEdit ?
                    <input autoFocus value={editVal} onChange={(e) => setEditVal(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {onRenameConv(c.id, editVal.trim() || c.title);setEditing(null);}
                      if (e.key === "Escape") setEditing(null);
                    }}
                    onBlur={() => {onRenameConv(c.id, editVal.trim() || c.title);setEditing(null);}}
                    style={{ flex: 1, minWidth: 0, background: C.canvas, border: `1px solid ${C.blue}`, color: C.ink, borderRadius: 6, padding: "3px 6px", fontSize: 13, outline: "none" }} /> :

                    <span style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1, color: activeConvId === c.id ? C.ink : C.muted }}>{c.title}</span>
                    }
                    {!isEdit && hoverConv === c.id &&
                    <div style={{ display: "flex", gap: 2, marginLeft: "auto" }}>
                        <button className="aria-focus" title="Rename"
                      onClick={(e) => {e.stopPropagation();setEditing(c.id);setEditVal(c.title);}}
                      style={{ width: 24, height: 24, borderRadius: 6, display: "grid", placeItems: "center", color: C.muted }}>
                          <Icon name="Pencil" size={13.5} />
                        </button>
                        <button className="aria-focus" title="Delete"
                      onClick={(e) => {e.stopPropagation();onDeleteConv(c.id);}}
                      style={{ width: 24, height: 24, borderRadius: 6, display: "grid", placeItems: "center", color: C.muted }}>
                          <Icon name="Trash2" size={13.5} />
                        </button>
                      </div>
                    }
                  </SidebarRow>);

              })}
            </div>);

        })}
        {!filtered.length &&
        <div style={{ fontSize: 12.5, color: C.muted, padding: "10px 8px" }}>No chats match "{search}"</div>
        }
      </div>

      {/* user card */}
      <div style={{ borderTop: `1px solid ${C.hairSoft}`, padding: 10, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 100, background: `linear-gradient(135deg, ${C.violet}, ${C.magenta})`, display: "grid", placeItems: "center", fontSize: 14, fontWeight: 600, color: "#fff", flexShrink: 0 }}>L</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Luka Tcheishvili</div>
          <div style={{ fontSize: 11.5, color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>IE × KPMG Capstone</div>
        </div>
        <button className="aria-focus" onClick={onOpenSettings} title="Settings"
        style={{ width: 32, height: 32, borderRadius: 8, display: "grid", placeItems: "center", color: C.muted }}>
          <Icon name="Settings" size={18} />
        </button>
      </div>
    </div>);

}

/* ---------- rich text (markdown-ish, streaming-safe) ---------- */
function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
  return parts.map((p, i) => {
    if (!p) return null;
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`")) return <em key={i}>{p.slice(1, -1)}</em>;
    if (p.startsWith("*") && p.endsWith("*") && p.length > 2) return <span key={i} style={{ color: C.muted }}>{p.slice(1, -1)}</span>;
    return <React.Fragment key={i}>{p}</React.Fragment>;
  });
}
function RichText({ text, cursor }) {
  const paras = text.split("\n\n");
  return (
    <div className="aria-prose" style={{ fontSize: ARIA.ui && ARIA.ui.fontSize || 15, lineHeight: 1.62, letterSpacing: -0.15, color: C.inkSoft }}>
      {paras.map((p, i) =>
      <p key={i} style={{ margin: i ? "0 0 12px" : "0 0 12px", textWrap: "pretty" }}>
          {renderInline(p)}
          {cursor && i === paras.length - 1 && <span className="aria-cursor" />}
        </p>
      )}
    </div>);

}

/* ---------- Reasoning trace ---------- */
function ReasoningTrace({ steps, doneCount, running, elapsed }) {
  const [open, setOpen] = React.useState(true);
  const finished = !running && doneCount >= steps.length;
  React.useEffect(() => {if (finished && ARIA.ui && ARIA.ui.traceCollapse) {const t = setTimeout(() => setOpen(false), 700);return () => clearTimeout(t);}}, [finished]);

  return (
    <div style={{ border: `1px solid ${C.hair}`, borderRadius: 12, background: C.s1, marginBottom: 14, overflow: "hidden" }}>
      <button onClick={() => setOpen(!open)} className="aria-focus"
      style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "10px 13px", color: C.ink }}>
        {running ?
        <Icon name="Loader" size={15} className="aria-spin" color={C.blue} /> :
        <Icon name="Sparkles" size={15} color={C.success} />}
        <span style={{ fontSize: 13.5, fontWeight: 500 }}>
          {finished ? `Ran ${steps.length} agents · ${elapsed}s` : "Reasoning"}
        </span>
        <Icon name="ChevronDown" size={16} color={C.muted}
        style={{ marginLeft: "auto", transform: open ? "none" : "rotate(-90deg)", transition: "transform 0.2s" }} />
      </button>
      {open &&
      <div style={{ padding: "2px 13px 12px 13px", borderTop: `1px solid ${C.hairSoft}` }}>
          {steps.map((s, i) => {
          const isDone = i < doneCount;
          const isActive = i === doneCount && running;
          const shown = i <= doneCount;
          if (!shown) return null;
          return (
            <div key={i} className="aria-fadeup" style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 0" }}>
                <div style={{ width: 18, marginTop: 1, display: "grid", placeItems: "center" }}>
                  {isDone ? <Icon name="Check" size={14} color={C.success} sw={2.4} /> :
                isActive ? <Icon name="Loader" size={14} className="aria-spin" color={C.blue} /> :
                <span style={{ width: 6, height: 6, borderRadius: 4, background: C.muted, opacity: 0.5 }} />}
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.4 }}>
                  <span style={{ fontWeight: 500, color: isDone || isActive ? C.ink : C.muted }}>{s.node}</span>
                  <span style={{ color: C.muted }}> → {s.detail}</span>
                </div>
              </div>);

        })}
        </div>
      }
    </div>);

}

Object.assign(window, { Icon, AgentTile, AriaLogo, Sidebar, RichText, renderInline, ReasoningTrace });
