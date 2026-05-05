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
      main: "#00e5ff",
      button: "#00b8d4",
      accentHover: "#84ffff",
      accentMid: "#00e5ff",
      accentSoft: "#b2ffff",
      photoRing: "#18ffff",
    },
    violet: {
      label: "بنفسجي",
      main: "#b388ff",
      button: "#7c4dff",
      accentHover: "#e7d7ff",
      accentMid: "#b388ff",
      accentSoft: "#f0e5ff",
      photoRing: "#d1b3ff",
    },
    rose: {
      label: "وردي",
      main: "#ff4d8d",
      button: "#ff2e75",
      accentHover: "#ffb3cc",
      accentMid: "#ff4d8d",
      accentSoft: "#ffd6e5",
      photoRing: "#ff7cab",
    },
    amber: {
      label: "كهرماني",
      main: "#ffca28",
      button: "#ffb300",
      accentHover: "#ffe082",
      accentMid: "#ffc107",
      accentSoft: "#ffecb3",
      photoRing: "#ffd54f",
    },
    emerald: {
      label: "زمردي",
      main: "#00e676",
      button: "#00c853",
      accentHover: "#8cffc1",
      accentMid: "#00e676",
      accentSoft: "#c8ffd8",
      photoRing: "#69f0ae",
    },
    sky: {
      label: "أزرق سماوي",
      main: "#40c4ff",
      button: "#00b0ff",
      accentHover: "#b3e5ff",
      accentMid: "#40c4ff",
      accentSoft: "#d9f3ff",
      photoRing: "#80d8ff",
    },
    fuchsia: {
      label: "فوشيا",
      main: "#ff4df0",
      button: "#f500d8",
      accentHover: "#ffb3f7",
      accentMid: "#ff4df0",
      accentSoft: "#ffd6fb",
      photoRing: "#ff8af6",
    },
    orange: {
      label: "برتقالي",
      main: "#ff9100",
      button: "#ff6d00",
      accentHover: "#ffd180",
      accentMid: "#ff9100",
      accentSoft: "#ffe0b2",
      photoRing: "#ffab40",
    },
    mint: {
      label: "نعناع",
      main: "#00f5d4",
      button: "#00cfae",
      accentHover: "#9dffef",
      accentMid: "#00f5d4",
      accentSoft: "#cffff5",
      photoRing: "#4dffe7",
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
