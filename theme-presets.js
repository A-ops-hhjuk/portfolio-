/**
 * 10 ألوان ثابتة للموقع — تُطبَّق عبر متغيرات CSS على :root.
 */
(function (global) {
  "use strict";

  var DEFAULT_ID = "lime";

  var PRESETS = {
    lime: {
      label: "لايم",
      main: "#c9f31d",
      button: "#a4c520",
      accentHover: "#e9ff8f",
      accentMid: "#b9dd26",
      accentSoft: "#e6ff80",
      photoRing: "#b2df00",
    },
    cyan: {
      label: "سماوي",
      main: "#22d3ee",
      button: "#0891b2",
      accentHover: "#a5f3fc",
      accentMid: "#06b6d4",
      accentSoft: "#cffafe",
      photoRing: "#2dd4bf",
    },
    violet: {
      label: "بنفسجي",
      main: "#a78bfa",
      button: "#7c3aed",
      accentHover: "#ddd6fe",
      accentMid: "#8b5cf6",
      accentSoft: "#ede9fe",
      photoRing: "#c4b5fd",
    },
    rose: {
      label: "وردي",
      main: "#fb7185",
      button: "#e11d48",
      accentHover: "#fecdd3",
      accentMid: "#f43f5e",
      accentSoft: "#ffe4e6",
      photoRing: "#fda4af",
    },
    amber: {
      label: "كهرماني",
      main: "#fbbf24",
      button: "#d97706",
      accentHover: "#fde68a",
      accentMid: "#f59e0b",
      accentSoft: "#fef3c7",
      photoRing: "#fcd34d",
    },
    emerald: {
      label: "زمردي",
      main: "#34d399",
      button: "#059669",
      accentHover: "#a7f3d0",
      accentMid: "#10b981",
      accentSoft: "#d1fae5",
      photoRing: "#6ee7b7",
    },
    sky: {
      label: "أزرق سماوي",
      main: "#38bdf8",
      button: "#0284c7",
      accentHover: "#bae6fd",
      accentMid: "#0ea5e9",
      accentSoft: "#e0f2fe",
      photoRing: "#7dd3fc",
    },
    fuchsia: {
      label: "فوشيا",
      main: "#e879f9",
      button: "#c026d3",
      accentHover: "#f5d0fe",
      accentMid: "#d946ef",
      accentSoft: "#fae8ff",
      photoRing: "#e879f9",
    },
    orange: {
      label: "برتقالي",
      main: "#fb923c",
      button: "#ea580c",
      accentHover: "#fed7aa",
      accentMid: "#f97316",
      accentSoft: "#ffedd5",
      photoRing: "#fdba74",
    },
    mint: {
      label: "نعناع",
      main: "#5eead4",
      button: "#0d9488",
      accentHover: "#ccfbf1",
      accentMid: "#14b8a6",
      accentSoft: "#ecfdf5",
      photoRing: "#2dd4bf",
    },
  };

  var ORDER = [
    "lime",
    "cyan",
    "violet",
    "rose",
    "amber",
    "emerald",
    "sky",
    "fuchsia",
    "orange",
    "mint",
  ];

  function resolve(id) {
    var k = String(id || "").trim();
    if (PRESETS[k]) return PRESETS[k];
    return PRESETS[DEFAULT_ID];
  }

  function isValidId(id) {
    return !!PRESETS[String(id || "").trim()];
  }

  /**
   * @param {HTMLElement} root — عادة document.documentElement
   * @param {string} themeId
   */
  function applyTheme(root, themeId) {
    if (!root || !root.style) return;
    var t = resolve(themeId);
    root.style.setProperty("--main_color", t.main);
    root.style.setProperty("--button-color", t.button);
    root.style.setProperty("--accent_hover", t.accentHover);
    root.style.setProperty("--accent_mid", t.accentMid);
    root.style.setProperty("--accent_soft", t.accentSoft);
    root.style.setProperty("--photo_ring", t.photoRing);
  }

  global.PORTFOLIO_THEME_IDS = ORDER.slice();

  global.PortfolioThemes = {
    DEFAULT_ID: DEFAULT_ID,
    ORDER: ORDER,
    PRESETS: PRESETS,
    resolve: resolve,
    isValidId: isValidId,
    applyTheme: applyTheme,
  };
})(typeof window !== "undefined" ? window : this);
