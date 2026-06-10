"""
ARIA — dark-themed Plotly chart builders + SVG-style pseudo-choropleth map.
Recreates the recharts visuals from aria-charts.jsx using the Framer design tokens.
"""
import plotly.graph_objects as go

from aria_content import C, DATA, MAP_NODES, forecast_data


# ---------------------------------------------------------------------------
# Shared dark layout
# ---------------------------------------------------------------------------
def _base_layout(fig, height=260, title=None):
    fig.update_layout(
        height=height,
        margin=dict(l=8, r=12, t=28 if title else 8, b=8),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(color=C["muted"], size=12, family="Inter, system-ui, sans-serif"),
        showlegend=False,
        hoverlabel=dict(bgcolor=C["s2"], bordercolor=C["hair"], font=dict(color=C["ink"], size=12)),
    )
    if title:
        fig.update_layout(title=dict(text=title, font=dict(color=C["muted"], size=13), x=0, xanchor="left"))
    fig.update_xaxes(showgrid=False, zeroline=False, color=C["muted"], tickfont=dict(size=11))
    fig.update_yaxes(showgrid=True, gridcolor=C["s2"], zeroline=False, color=C["muted"], tickfont=dict(size=11))
    return fig


def _risk_color(t):
    """Lerp surface-2 (#1c1c1c) -> coral (#ff5577) by t in [0,1] (eased)."""
    t = max(0.0, min(1.0, t)) ** 0.85
    a, b = (28, 28, 28), (255, 85, 119)
    c = [round(a[i] + (b[i] - a[i]) * t) for i in range(3)]
    return f"rgb({c[0]},{c[1]},{c[2]})"


# ---------------------------------------------------------------------------
# Chart dispatcher
# ---------------------------------------------------------------------------
def build_chart(kind, title=None):
    if kind == "shap":
        d = sorted(DATA["shap"], key=lambda r: r["v"])
        colors = [C["teal"] if r["v"] >= 0 else C["coral"] for r in d]
        fig = go.Figure(go.Bar(
            x=[r["v"] for r in d], y=[r["f"] for r in d], orientation="h",
            marker_color=colors, hovertemplate="%{y}: %{x:+} €<extra></extra>",
        ))
        fig.add_vline(x=0, line_color=C["hair"], line_width=1)
        return _base_layout(fig, 240, title)

    if kind == "revsim":
        d = DATA["revsim"]
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=[r["m"] for r in d], y=[r["cur"] for r in d], name="Current",
                                 mode="lines+markers", line=dict(color=C["muted"], width=2),
                                 marker=dict(size=5), hovertemplate="Current €%{y:,}<extra></extra>"))
        fig.add_trace(go.Scatter(x=[r["m"] for r in d], y=[r["rec"] for r in d], name="Recommended",
                                 mode="lines+markers", line=dict(color=C["violet"], width=2.5),
                                 marker=dict(size=5), hovertemplate="Recommended €%{y:,}<extra></extra>"))
        fig.update_layout(showlegend=True, legend=dict(orientation="h", y=1.12, x=0,
                          font=dict(color=C["muted"], size=11), bgcolor="rgba(0,0,0,0)"))
        return _base_layout(fig, 260, title)

    if kind in ("riskbar", "anomaly", "yield"):
        d = sorted(DATA[kind], key=lambda r: r["v"], reverse=True)  # high → low
        vmax = max(r["v"] for d2 in [DATA[kind]] for r in d2)
        colors = [_risk_color(r["v"] / vmax) for r in d]
        suffix = "%" if kind == "yield" else ""
        fig = go.Figure(go.Bar(
            x=[r["n"] for r in d], y=[r["v"] for r in d], marker_color=colors,
            hovertemplate="%{x}: %{y}" + suffix + "<extra></extra>",
        ))
        return _base_layout(fig, 250, title)

    if kind == "stress":
        d = sorted(DATA["stress"], key=lambda r: r["v"], reverse=True)
        colors = [C["coral"] if r["v"] > 1 else _risk_color(r["v"] / 1.3) for r in d]
        fig = go.Figure(go.Bar(
            x=[r["n"] for r in d], y=[r["v"] for r in d], marker_color=colors,
            hovertemplate="%{x}: %{y}× capacity<extra></extra>",
        ))
        fig.add_hline(y=1.0, line_color=C["coral"], line_dash="dot", line_width=1,
                      annotation_text="capacity", annotation_font_color=C["muted"])
        return _base_layout(fig, 250, title)

    if kind == "trend":
        d = DATA["trend"]
        zones = [("centre", C["coral"]), ("mid", C["orange"]), ("outer", C["violet"]), ("far", C["muted"])]
        fig = go.Figure()
        for z, col in zones:
            fig.add_trace(go.Scatter(x=[r["q"] for r in d], y=[r[z] for r in d], name=z,
                                     mode="lines", line=dict(color=col, width=2.5),
                                     hovertemplate=z + " %{y}<extra></extra>"))
        fig.update_layout(showlegend=True, legend=dict(orientation="h", y=1.12, x=0,
                          font=dict(color=C["muted"], size=11), bgcolor="rgba(0,0,0,0)"))
        return _base_layout(fig, 260, title)

    if kind == "riskdist":
        d = DATA["riskdist"]
        colors = [C["coral"] if r.get("flag") else C["s2"] for r in d]
        line_colors = [C["coral"] if r.get("flag") else C["hair"] for r in d]
        fig = go.Figure(go.Bar(
            x=[r["b"] for r in d], y=[r["v"] for r in d],
            marker=dict(color=colors, line=dict(color=line_colors, width=1)),
            hovertemplate="score %{x}: %{y} listings<extra></extra>",
        ))
        return _base_layout(fig, 240, title)

    if kind == "forecast":
        d = forecast_data()
        xs = [r["m"] for r in d]
        fig = go.Figure()
        # 80% confidence band
        fig.add_trace(go.Scatter(x=xs + xs[::-1],
                                 y=[r["hi"] for r in d] + [r["lo"] for r in d][::-1],
                                 fill="toself", fillcolor="rgba(106,76,245,0.18)",
                                 line=dict(color="rgba(0,0,0,0)"), hoverinfo="skip", name="80% CI"))
        fig.add_trace(go.Scatter(x=xs, y=[r["y"] for r in d], mode="lines+markers",
                                 line=dict(color=C["violet"], width=2.5), marker=dict(size=5),
                                 name="Forecast", hovertemplate="%{x}: %{y}k nights<extra></extra>"))
        return _base_layout(fig, 260, title)

    if kind == "supplygap":
        d = sorted(DATA["supplygap"], key=lambda r: r["v"], reverse=True)
        colors = [C["teal"] if r["v"] >= 0 else C["coral"] for r in d]
        fig = go.Figure(go.Bar(
            x=[r["n"] for r in d], y=[r["v"] for r in d], marker_color=colors,
            hovertemplate="%{x}: %{y:+}<extra></extra>",
        ))
        fig.add_hline(y=0, line_color=C["hair"], line_width=1)
        return _base_layout(fig, 250, title)

    # unknown kind → empty
    return _base_layout(go.Figure(), 200, title)


# ---------------------------------------------------------------------------
# Pseudo-choropleth map (grid of neighbourhood tiles colored by risk/stress)
# ---------------------------------------------------------------------------
def build_map(metric="risk", title=None):
    cols, rows = 5, 4
    fig = go.Figure()
    norm = 1.3 if metric == "stress" else 1.0
    for n in MAP_NODES:
        val = n[metric]
        t = val / norm
        px, py = n["x"], (rows - 1 - n["y"])  # flip y so row 0 is top
        over = metric == "stress" and n["stress"] > 1
        fig.add_shape(type="rect", x0=px - 0.46, x1=px + 0.46, y0=py - 0.46, y1=py + 0.46,
                      line=dict(color=C["coral"] if over else C["hair"], width=1.5 if over else 1),
                      fillcolor=_risk_color(t), layer="below")
        label_col = "#ffffff" if t > 0.5 else C["muted"]
        val_txt = f"{n['stress']:.2f}" if metric == "stress" else f"{n['risk']:.2f}"
        fig.add_annotation(x=px, y=py + 0.12, text=n["name"], showarrow=False,
                           font=dict(size=10, color=label_col))
        fig.add_annotation(x=px, y=py - 0.16, text=val_txt, showarrow=False,
                           font=dict(size=13, color="#ffffff" if t > 0.5 else C["ink"]))
        # invisible marker for hover
        fig.add_trace(go.Scatter(
            x=[px], y=[py], mode="markers", marker=dict(size=64, opacity=0, color="rgba(0,0,0,0)"),
            hovertemplate=f"<b>{n['name']}</b><br>" +
                          (f"stress {n['stress']:.2f}× capacity" if metric == "stress"
                           else f"risk score {n['risk']:.2f}") + "<extra></extra>",
            showlegend=False,
        ))
    fig.update_xaxes(visible=False, range=[-0.6, cols - 0.4])
    fig.update_yaxes(visible=False, range=[-0.6, rows - 0.4], scaleanchor="x", scaleratio=1)
    fig.update_layout(
        height=300, margin=dict(l=8, r=8, t=28 if title else 8, b=8),
        paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
        showlegend=False,
        hoverlabel=dict(bgcolor=C["s2"], bordercolor=C["hair"], font=dict(color=C["ink"], size=12)),
        font=dict(family="Inter, system-ui, sans-serif"),
    )
    if title:
        fig.update_layout(title=dict(text=title, font=dict(color=C["muted"], size=13), x=0, xanchor="left"))
    return fig
