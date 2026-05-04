/**
 * Shared portfolio JSON shape + localStorage helpers.
 */
(function (global) {
  "use strict";

  var STORAGE_KEY = "portfolioData";

  function defaultFooter() {
    return {
      tagline: "Let's work together to bring your ideas to life!",
      email: "abdullah@example.com",
      phone: "0796885276",
      location: "Amman, Jordan",
      services: [
        "Responsive Web Design",
        "UI/UX Design",
        "Front-End Development",
        "Performance Optimization",
        "Cross-Browser Compatibility",
      ],
      social: {
        github: "",
        linkedin: "",
        twitter: "",
        instagram: "https://www.instagram.com/abdallahkhlileh",
        codepen: "",
      },
      copyrightYear: "2026",
    };
  }

  function defaultHeader() {
    return {
      facebook: "https://www.facebook.com/share/17mPUXtQaK/",
      instagram:
        "https://www.instagram.com/abdallahkhlileh?igsh=Z3Q3MHU3NXhndW1i",
      messenger: "https://m.me/abdullah.klayla.9",
    };
  }

  function defaults() {
    return {
      name: "",
      title: "",
      about: "",
      heroIntro: "",
      heroStack: "",
      heroImage: "imges/newA1.PNG",
      aboutImage: "imges/newA2.PNG",
      logoMain: "",
      logoAccent: "",
      theme: "lime",
      cvUrl: "",
      skills: [],
      projects: [],
      header: defaultHeader(),
      footer: defaultFooter(),
    };
  }

  function normalizeSkill(s) {
    if (typeof s === "string") return { title: s, description: "" };
    var o = s && typeof s === "object" ? s : {};
    return {
      title: String(o.title != null ? o.title : ""),
      description: String(o.description != null ? o.description : ""),
    };
  }

  function normalizeProject(p) {
    var o = p && typeof p === "object" ? p : {};
    return {
      title: String(o.title != null ? o.title : ""),
      description: String(o.description != null ? o.description : ""),
      link: String(o.link != null ? o.link : ""),
      badge: String(o.badge != null ? o.badge : "Project"),
      image: String(o.image != null ? o.image : ""),
    };
  }

  /** يجب أن يطابق معرفات theme-presets.js — نُبقي نسخة هنا حتى يعمل الحفظ حتى لو لم يُحمَّل theme-presets.js. */
  var THEME_IDS_FALLBACK = [
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

  function isAllowedThemeId(tid) {
    var t = String(tid || "").trim();
    if (!t) return false;
    var fromPresets =
      global.PORTFOLIO_THEME_IDS && Array.isArray(global.PORTFOLIO_THEME_IDS)
        ? global.PORTFOLIO_THEME_IDS
        : null;
    var list = fromPresets && fromPresets.length ? fromPresets : THEME_IDS_FALLBACK;
    return list.indexOf(t) >= 0;
  }

  function normalize(raw) {
    var d = defaults();
    if (!raw || typeof raw !== "object") return d;
    var r = raw;
    [
      "name",
      "title",
      "about",
      "heroIntro",
      "heroStack",
      "heroImage",
      "aboutImage",
      "logoMain",
      "logoAccent",
      "cvUrl",
    ].forEach(function (k) {
      if (r[k] != null) d[k] = String(r[k]);
    });
    if (r.theme != null) {
      var tid = String(r.theme).trim();
      if (isAllowedThemeId(tid)) d.theme = tid;
    }
    if (Array.isArray(r.skills)) d.skills = r.skills.map(normalizeSkill);
    if (Array.isArray(r.projects)) d.projects = r.projects.map(normalizeProject);
    if (r.header && typeof r.header === "object") {
      d.header = Object.assign(defaultHeader(), r.header);
      ["facebook", "instagram", "messenger"].forEach(function (k) {
        if (r.header[k] != null) d.header[k] = String(r.header[k]);
      });
    }
    if (r.footer && typeof r.footer === "object") {
      var f = Object.assign(defaultFooter(), r.footer);
      if (Array.isArray(r.footer.services)) {
        f.services = r.footer.services.length
          ? r.footer.services.map(function (x) {
              return String(x);
            })
          : defaultFooter().services.slice();
      }
      if (r.footer.social && typeof r.footer.social === "object") {
        f.social = Object.assign(defaultFooter().social, r.footer.social);
      }
      d.footer = f;
    }
    return d;
  }

  /** كائن محلي من localStorage يُعتمد عليه فقط إذا كان JSON object حقيقي وفيه محتوى مفيد (ليس {} ولا []). */
  function isValidLocalSnapshot(raw) {
    if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return false;
    return hasMeaningfulContent(normalize(raw));
  }

  function hasMeaningfulContent(d) {
    if (!d || typeof d !== "object") return false;
    if (String(d.name || "").trim()) return true;
    if (String(d.title || "").trim()) return true;
    if (String(d.about || "").trim()) return true;
    if (String(d.heroIntro || "").trim()) return true;
    if (String(d.heroStack || "").trim()) return true;
    if (Array.isArray(d.skills) && d.skills.length) return true;
    if (Array.isArray(d.projects) && d.projects.length) return true;
    var def = defaults();
    if (String(d.heroImage || "") !== String(def.heroImage)) return true;
    if (String(d.aboutImage || "") !== String(def.aboutImage)) return true;
    if (String(d.logoMain || "").trim() || String(d.logoAccent || "").trim()) return true;
    return false;
  }

  function persistLocal(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      /* ignore */
    }
  }

  function readLocal() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  global.PortfolioModel = {
    STORAGE_KEY: STORAGE_KEY,
    defaults: defaults,
    normalize: normalize,
    isAllowedThemeId: isAllowedThemeId,
    hasMeaningfulContent: hasMeaningfulContent,
    isValidLocalSnapshot: isValidLocalSnapshot,
    persistLocal: persistLocal,
    readLocal: readLocal,
  };
})(typeof window !== "undefined" ? window : this);
