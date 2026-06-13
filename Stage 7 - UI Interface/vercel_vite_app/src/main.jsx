import React from "react";
import { createRoot } from "react-dom/client";
import * as Recharts from "recharts";
import * as LucideIcons from "lucide-react";
import "./styles.css";

window.React = React;
window.ReactDOM = { createRoot };
window.Recharts = Recharts;
window.__ARIA_ICON_COMPONENTS = LucideIcons;

function enableEntranceAnimations() {
  function onVisible() {
    document.body && document.body.classList.add("anim-on");
  }

  if (document.visibilityState === "visible") {
    onVisible();
    return;
  }

  document.addEventListener("visibilitychange", function handleVisibility() {
    if (document.visibilityState === "visible") {
      onVisible();
      document.removeEventListener("visibilitychange", handleVisibility);
    }
  });
}

async function bootstrap() {
  enableEntranceAnimations();
  await import("./legacy/tweaks-panel.jsx");
  await import("./legacy/aria-data.jsx");
  await import("./legacy/AriaGeoMap.jsx");
  await import("./legacy/aria-charts.jsx");
  await import("./legacy/aria-dashboard.jsx");
  await import("./legacy/aria-ui.jsx");
  await import("./legacy/aria-ui2.jsx");
  await import("./legacy/aria-main.jsx");
}

bootstrap().catch((error) => {
  console.error("Unable to start ARIA demo", error);
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML =
      '<div style="font-family:Inter,system-ui,sans-serif;padding:32px;color:#0b0b0c">Unable to start ARIA demo. Check the browser console for details.</div>';
  }
});
