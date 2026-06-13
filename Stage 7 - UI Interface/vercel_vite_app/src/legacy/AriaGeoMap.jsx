import React from "react";
import L from "leaflet";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const DEFAULT_COLORS = {
  canvas: "#ffffff",
  surface: "#f7f7f7",
  surface2: "#f2f2f2",
  hairline: "#dddddd",
  ink: "#222222",
  muted: "#6a6a6a",
  accent: "#ff385c",
  teal: "#1fd1c7",
};

const DEFAULT_REGION_ID_PROPERTY = "regionId";
const DEFAULT_REGION_NAME_PROPERTY = "regionName";

function themeColor(name, fallback) {
  if (typeof window === "undefined") return fallback;
  const direct = window.ARIA && window.ARIA.c && window.ARIA.c[name];
  if (direct) return direct;
  const cssName = {
    canvas: "--canvas",
    surface: "--surface-1",
    surface2: "--surface-2",
    hairline: "--hairline",
    ink: "--ink",
    muted: "--ink-muted",
    accent: "--accent-blue",
    teal: "--grad-teal",
  }[name];
  if (!cssName) return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(cssName).trim();
  return value || fallback;
}

function getTheme() {
  return {
    canvas: themeColor("canvas", DEFAULT_COLORS.canvas),
    surface: themeColor("surface", DEFAULT_COLORS.surface),
    surface2: themeColor("surface2", DEFAULT_COLORS.surface2),
    hairline: themeColor("hairline", DEFAULT_COLORS.hairline),
    ink: themeColor("ink", DEFAULT_COLORS.ink),
    muted: themeColor("muted", DEFAULT_COLORS.muted),
    accent: themeColor("accent", DEFAULT_COLORS.accent),
    teal: themeColor("teal", DEFAULT_COLORS.teal),
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function humanizeLabel(value, fallback = "Metric") {
  const text = String(value || fallback)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return fallback;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function normalizeId(value) {
  if (value == null) return "";
  return String(value).trim();
}

function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function colorToRgb(color, fallback) {
  const value = String(color || fallback).trim();
  if (/^#[0-9a-f]{3}$/i.test(value)) {
    const r = value[1] + value[1];
    const g = value[2] + value[2];
    const b = value[3] + value[3];
    return [parseInt(r, 16), parseInt(g, 16), parseInt(b, 16)];
  }
  if (/^#[0-9a-f]{6}$/i.test(value)) {
    return [
      parseInt(value.slice(1, 3), 16),
      parseInt(value.slice(3, 5), 16),
      parseInt(value.slice(5, 7), 16),
    ];
  }
  const rgb = value.match(/rgba?\(([^)]+)\)/i);
  if (rgb) {
    const parts = rgb[1].split(",").map((p) => Number.parseFloat(p.trim()));
    if (parts.length >= 3 && parts.every((p, index) => index > 2 || Number.isFinite(p))) {
      return parts.slice(0, 3).map((p) => Math.max(0, Math.min(255, Math.round(p))));
    }
  }
  return colorToRgb(fallback, "#ff385c");
}

function mixColors(a, b, amount) {
  const from = colorToRgb(a, DEFAULT_COLORS.surface2);
  const to = colorToRgb(b, DEFAULT_COLORS.accent);
  const t = clamp01(amount);
  const mixed = from.map((value, index) => Math.round(value + (to[index] - value) * t));
  return `rgb(${mixed[0]}, ${mixed[1]}, ${mixed[2]})`;
}

function formatMetricValue(value, metricName) {
  if (value == null || value === "") return "Not available";
  if (typeof value !== "number") return String(value);
  const metric = String(metricName || "").toLowerCase();
  if (metric.includes("price") || metric.includes("rent") || metric.includes("revenue") || metric.includes("eur")) {
    return new Intl.NumberFormat("en", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
  }
  if ((metric.includes("rate") || metric.includes("share") || metric.includes("risk") || metric.includes("saturation") || metric.includes("occupancy")) && Math.abs(value) <= 1.5) {
    return `${(value * 100).toFixed(value < 0.1 ? 1 : 0)}%`;
  }
  return new Intl.NumberFormat("en", { maximumFractionDigits: value < 10 ? 2 : 0 }).format(value);
}

function isPolygonFeature(feature) {
  const type = feature && feature.geometry && feature.geometry.type;
  return type === "Polygon" || type === "MultiPolygon";
}

function isValidFeatureCollection(geoJson) {
  return Boolean(geoJson && geoJson.type === "FeatureCollection" && Array.isArray(geoJson.features));
}

function getFeatureRegionId(feature, idProperty) {
  const props = feature.properties || {};
  return normalizeId(props[idProperty] ?? props.region_id ?? props.id ?? feature.id);
}

function getFeatureRegionName(feature, nameProperty, idProperty) {
  const props = feature.properties || {};
  return String(
    props[nameProperty] ??
    props.name ??
    props.region_name ??
    props[idProperty] ??
    feature.id ??
    "Unnamed region"
  );
}

function buildMetricMap(metrics) {
  const map = new Map();
  (metrics || []).forEach((metric) => {
    const id = normalizeId(metric && metric.regionId);
    if (id) map.set(id, metric);
  });
  return map;
}

function collectMetadataRows(metadata) {
  if (!metadata || typeof metadata !== "object") return [];
  return Object.entries(metadata)
    .filter(([, value]) => value != null && typeof value !== "object")
    .slice(0, 5)
    .map(([key, value]) => [humanizeLabel(key), value]);
}

function selectionIncludes(selectionSet, id, name) {
  return selectionSet.has(normalizeId(id)) || selectionSet.has(normalizeId(name));
}

function enrichGeoJson({ geoJson, metrics, chatbotSelection, regionIdProperty, regionNameProperty }) {
  const metricMap = buildMetricMap(metrics);
  const highlighted = new Set((chatbotSelection?.highlightedRegions || []).map(normalizeId).filter(Boolean));
  const features = geoJson.features.filter(isPolygonFeature).map((feature) => {
    const regionId = getFeatureRegionId(feature, regionIdProperty);
    const regionName = getFeatureRegionName(feature, regionNameProperty, regionIdProperty);
    const metric = metricMap.get(regionId) || metricMap.get(regionName);
    const value = asNumber(metric && metric.value);
    const metadata = metric && metric.metadata && typeof metric.metadata === "object" ? metric.metadata : {};
    const isHighlighted = selectionIncludes(highlighted, regionId, regionName);

    return {
      ...feature,
      properties: {
        ...(feature.properties || {}),
        __ariaRegionId: regionId,
        __ariaRegionName: regionName,
        __ariaMetricValue: value,
        __ariaMetricDisplay: formatMetricValue(value, chatbotSelection?.metric),
        __ariaMetricMetadata: metadata,
        __ariaHighlighted: isHighlighted,
      },
    };
  });

  return { type: "FeatureCollection", features };
}

function getMetricRange(features) {
  const values = features
    .map((feature) => feature.properties && feature.properties.__ariaMetricValue)
    .filter((value) => Number.isFinite(value));
  if (!values.length) return null;
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function valueTone(value, range) {
  if (!range || !Number.isFinite(value)) return undefined;
  if (range.max === range.min) return 0.72;
  return 0.18 + clamp01((value - range.min) / (range.max - range.min)) * 0.82;
}

function featureStyle(feature, range, theme, activeId) {
  const props = feature.properties || {};
  const value = props.__ariaMetricValue;
  const highlighted = Boolean(props.__ariaHighlighted);
  const active = activeId && activeId === props.__ariaRegionId;
  const tone = valueTone(value, range);
  const fillColor = tone == null ? mixColors(theme.surface2, theme.muted, 0.16) : mixColors(theme.surface2, theme.accent, tone);

  return {
    color: highlighted || active ? theme.ink : theme.hairline,
    weight: highlighted || active ? 2.4 : 1,
    opacity: highlighted || active ? 0.9 : 0.72,
    fillColor,
    fillOpacity: highlighted || active ? 0.74 : tone == null ? 0.26 : 0.56,
    dashArray: highlighted || active ? "" : "1",
  };
}

function createTooltipContent(feature, metricLabel, selection) {
  const props = feature.properties || {};
  const metadata = props.__ariaMetricMetadata || {};
  const explanation = metadata.explanation || metadata.description || metadata.context || metadata.note;
  const rows = collectMetadataRows(metadata)
    .filter(([label]) => !["Explanation", "Description", "Context", "Note"].includes(label));
  const aggregation = selection?.aggregation ? `<div class="aria-map-popup-row"><span>Aggregation</span><strong>${escapeHtml(humanizeLabel(selection.aggregation))}</strong></div>` : "";
  const metadataRows = rows.map(([label, value]) => (
    `<div class="aria-map-popup-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
  )).join("");

  return `
    <div class="aria-map-popup">
      <div class="aria-map-popup-title">${escapeHtml(props.__ariaRegionName)}</div>
      <div class="aria-map-popup-row"><span>${escapeHtml(metricLabel)}</span><strong>${escapeHtml(props.__ariaMetricDisplay)}</strong></div>
      ${aggregation}
      ${explanation ? `<div class="aria-map-popup-note">${escapeHtml(explanation)}</div>` : ""}
      ${metadataRows}
    </div>
  `;
}

function FitGeoJsonBounds({ geoJson }) {
  const map = useMap();

  React.useEffect(() => {
    if (!geoJson || !geoJson.features || !geoJson.features.length) return;
    const layer = L.geoJSON(geoJson);
    const bounds = layer.getBounds();
    layer.remove();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [26, 26], maxZoom: 12 });
    }
  }, [geoJson, map]);

  return null;
}

function MapStateCard({ title, message, height, className }) {
  const theme = getTheme();
  return (
    <div
      className={`aria-fadein ${className || ""}`}
      style={{
        minHeight: height,
        border: `1px solid ${theme.hairline}`,
        borderRadius: 16,
        background: theme.surface,
        color: theme.ink,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 18,
        textAlign: "center",
      }}
    >
      <div>
        {title && <div style={{ fontWeight: 650, fontSize: 13.5, marginBottom: 5 }}>{title}</div>}
        <div style={{ color: theme.muted, fontSize: 12.5, lineHeight: 1.45 }}>{message}</div>
      </div>
    </div>
  );
}

function Legend({ range, metricLabel, theme }) {
  if (!range) return null;
  return (
    <div
      style={{
        position: "absolute",
        right: 12,
        top: 12,
        zIndex: 500,
        background: theme.surface,
        border: `1px solid ${theme.hairline}`,
        borderRadius: 12,
        padding: "8px 10px",
        boxShadow: "0 8px 22px rgba(0,0,0,0.16)",
        color: theme.ink,
        minWidth: 166,
      }}
    >
      <div style={{ fontSize: 11.5, color: theme.muted, marginBottom: 6 }}>{metricLabel}</div>
      <div style={{ height: 8, borderRadius: 999, background: `linear-gradient(90deg, ${mixColors(theme.surface2, theme.accent, 0.18)}, ${mixColors(theme.surface2, theme.accent, 1)})` }} />
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 5, fontSize: 11 }}>
        <span>{formatMetricValue(range.min, metricLabel)}</span>
        <span>{formatMetricValue(range.max, metricLabel)}</span>
      </div>
    </div>
  );
}

function AttributionNote({ theme }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 12,
        bottom: 12,
        zIndex: 500,
        background: theme.surface,
        border: `1px solid ${theme.hairline}`,
        borderRadius: 999,
        padding: "5px 9px",
        color: theme.muted,
        fontSize: 11,
        boxShadow: "0 8px 22px rgba(0,0,0,0.14)",
      }}
    >
      Map data (c) OpenStreetMap - ARIA GeoJSON overlays
    </div>
  );
}

function LayerEventsCleanup({ layerRef, layerKey }) {
  React.useEffect(() => {
    const layer = layerRef.current;
    return () => {
      if (!layer) return;
      layer.eachLayer((childLayer) => {
        childLayer.off();
        childLayer.unbindTooltip();
        childLayer.unbindPopup();
      });
    };
  }, [layerRef, layerKey]);

  return null;
}

function AriaGeoMap({
  geoJson,
  metrics = [],
  chatbotSelection = {},
  regionIdProperty = DEFAULT_REGION_ID_PROPERTY,
  regionNameProperty = DEFAULT_REGION_NAME_PROPERTY,
  title,
  height = 380,
  showLegend = true,
  showControls = true,
  className = "",
  style,
  onRegionHover,
  onRegionClick,
}) {
  const [activeRegionId, setActiveRegionId] = React.useState(null);
  const layerRef = React.useRef(null);
  const theme = getTheme();
  const metricLabel = humanizeLabel(chatbotSelection?.metric, "Selected metric");
  const mapHeight = typeof height === "number" ? `${height}px` : height;

  const validGeoJson = isValidFeatureCollection(geoJson);
  const enrichedGeoJson = React.useMemo(() => {
    if (!validGeoJson) return null;
    return enrichGeoJson({ geoJson, metrics, chatbotSelection, regionIdProperty, regionNameProperty });
  }, [validGeoJson, geoJson, metrics, chatbotSelection, regionIdProperty, regionNameProperty]);

  const polygonCount = enrichedGeoJson?.features?.length || 0;
  const range = React.useMemo(() => enrichedGeoJson ? getMetricRange(enrichedGeoJson.features) : null, [enrichedGeoJson]);
  const layerKey = React.useMemo(() => {
    const highlighted = (chatbotSelection?.highlightedRegions || []).join("|");
    const metricSignature = (metrics || []).map((metric) => `${metric.regionId}:${metric.value}`).join("|");
    return `${polygonCount}:${regionIdProperty}:${regionNameProperty}:${highlighted}:${metricSignature}`;
  }, [chatbotSelection, metrics, polygonCount, regionIdProperty, regionNameProperty]);

  if (!validGeoJson) {
    return (
      <MapStateCard
        title={title || "Geographic map"}
        message="No valid GeoJSON FeatureCollection was provided."
        height={mapHeight}
        className={className}
      />
    );
  }

  if (!polygonCount) {
    return (
      <MapStateCard
        title={title || "Geographic map"}
        message="The GeoJSON file does not contain polygon boundaries to draw."
        height={mapHeight}
        className={className}
      />
    );
  }

  const handleEachFeature = (feature, layer) => {
    const props = feature.properties || {};
    const regionMetric = {
      regionId: props.__ariaRegionId,
      regionName: props.__ariaRegionName,
      value: props.__ariaMetricValue,
      metadata: props.__ariaMetricMetadata,
    };
    const popupHtml = createTooltipContent(feature, metricLabel, chatbotSelection);

    layer.bindTooltip(popupHtml, {
      sticky: true,
      direction: "top",
      opacity: 1,
      className: "aria-geo-map-tooltip",
    });

    layer.bindPopup(popupHtml, {
      closeButton: true,
      className: "aria-geo-map-popup",
      maxWidth: 280,
    });

    layer.on({
      mouseover: () => {
        setActiveRegionId(props.__ariaRegionId);
        layer.setStyle(featureStyle(feature, range, theme, props.__ariaRegionId));
        if (typeof onRegionHover === "function") onRegionHover(regionMetric);
      },
      mouseout: () => {
        setActiveRegionId(null);
        layer.setStyle(featureStyle(feature, range, theme, null));
        if (typeof onRegionHover === "function") onRegionHover(null);
      },
      click: () => {
        if (typeof onRegionClick === "function") onRegionClick(regionMetric);
      },
    });
  };

  return (
    <div
      className={`aria-fadein ${className || ""}`}
      style={{
        background: theme.surface,
        border: `1px solid ${theme.hairline}`,
        borderRadius: 16,
        padding: 14,
        color: theme.ink,
        ...style,
      }}
    >
      {title && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 650, color: theme.ink }}>{title}</div>
          <div style={{ fontSize: 11.5, color: theme.muted }}>{polygonCount.toLocaleString()} regions</div>
        </div>
      )}
      <div
        style={{
          position: "relative",
          height: mapHeight,
          minHeight: 260,
          borderRadius: 14,
          overflow: "hidden",
          border: `1px solid ${theme.hairline}`,
          background: theme.surface2,
        }}
      >
        <MapContainer
          center={[20, 0]}
          zoom={2}
          minZoom={1}
          zoomControl={showControls}
          scrollWheelZoom={Boolean(showControls)}
          style={{ height: "100%", width: "100%", background: theme.surface2 }}
          attributionControl
        >
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <GeoJSON
            key={layerKey}
            ref={layerRef}
            data={enrichedGeoJson}
            style={(feature) => featureStyle(feature, range, theme, activeRegionId)}
            onEachFeature={handleEachFeature}
          />
          <FitGeoJsonBounds geoJson={enrichedGeoJson} />
          <LayerEventsCleanup layerRef={layerRef} layerKey={layerKey} />
        </MapContainer>
        {showLegend && <Legend range={range} metricLabel={metricLabel} theme={theme} />}
        <AttributionNote theme={theme} />
      </div>
      <style>{`
        .aria-geo-map-tooltip,
        .aria-geo-map-popup .leaflet-popup-content-wrapper {
          background: ${theme.surface};
          border: 1px solid ${theme.hairline};
          border-radius: 12px;
          color: ${theme.ink};
          box-shadow: 0 12px 30px rgba(0,0,0,0.22);
        }
        .aria-geo-map-tooltip {
          padding: 0;
        }
        .aria-geo-map-tooltip::before,
        .aria-geo-map-popup .leaflet-popup-tip {
          background: ${theme.surface};
        }
        .aria-geo-map-popup .leaflet-popup-content {
          margin: 0;
        }
        .aria-map-popup {
          min-width: 210px;
          padding: 10px 12px;
          font-family: Inter, system-ui, -apple-system, sans-serif;
          letter-spacing: 0;
        }
        .aria-map-popup-title {
          font-size: 13.5px;
          font-weight: 700;
          color: ${theme.ink};
          margin-bottom: 7px;
        }
        .aria-map-popup-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          align-items: baseline;
          font-size: 12px;
          line-height: 1.35;
          margin-top: 4px;
        }
        .aria-map-popup-row span,
        .aria-map-popup-note {
          color: ${theme.muted};
        }
        .aria-map-popup-row strong {
          color: ${theme.ink};
          font-weight: 650;
          text-align: right;
        }
        .aria-map-popup-note {
          margin-top: 8px;
          font-size: 11.5px;
          line-height: 1.4;
          max-width: 240px;
        }
        .leaflet-container {
          font-family: Inter, system-ui, -apple-system, sans-serif;
        }
      `}</style>
    </div>
  );
}

Object.assign(window, { AriaGeoMap });

export default AriaGeoMap;
