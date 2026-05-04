/**
 * Minimal Supabase REST client (no npm package).
 * Expects window.PORTFOLIO_SUPABASE = { url, anonKey, storageBucket? }.
 */
(function (global) {
  "use strict";

  var DEFAULT_STORAGE_BUCKET = "portfolio-images";

  function trimCfg(cfg) {
    if (!cfg || typeof cfg !== "object") {
      return { url: "", anonKey: "", storageBucket: DEFAULT_STORAGE_BUCKET };
    }
    var sb = String(cfg.storageBucket != null ? cfg.storageBucket : "").trim();
    return {
      url: String(cfg.url != null ? cfg.url : "").trim(),
      anonKey: String(cfg.anonKey != null ? cfg.anonKey : "").trim(),
      storageBucket: sb || DEFAULT_STORAGE_BUCKET,
    };
  }

  /** ref المشروع من payload الـ JWT (أدق من parsing الـ URL مع RTL). */
  function parseSupabaseProjectRefFromJwt(anonKey) {
    var key = String(anonKey || "").trim();
    if (!key || key.indexOf(".") < 0) return "";
    try {
      var body = key.split(".")[1];
      var b64 = body.replace(/-/g, "+").replace(/_/g, "/");
      var pad = b64.length % 4;
      if (pad) b64 += "====".slice(0, 4 - pad);
      var json = JSON.parse(atob(b64));
      var ref = json && json.ref != null ? String(json.ref).trim() : "";
      if (/^[a-z0-9-]{8,}$/i.test(ref)) return ref;
    } catch (e) {}
    return "";
  }

  /**
   * رابط لوحة Storage. يفضّل تمرير { url, anonKey } لاستخراج ref من JWT.
   * يقبل أيضاً سلسلة url فقط للتوافق مع الاستدعاءات القديمة.
   */
  function storageBucketsDashboardUrl(cfgOrUrl) {
    var url = "";
    var anonKey = "";
    if (typeof cfgOrUrl === "object" && cfgOrUrl !== null) {
      var c = trimCfg(cfgOrUrl);
      url = c.url;
      anonKey = c.anonKey;
    } else {
      url = String(cfgOrUrl || "");
    }
    var ref = parseSupabaseProjectRefFromJwt(anonKey);
    if (!ref) {
      var m = String(url).match(/https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
      ref = m ? m[1] : "";
    }
    if (!ref) return "";
    return "https://supabase.com/dashboard/project/" + ref + "/storage/buckets";
  }

  /** Real Supabase anon JWT is long and starts with eyJ (base64 header). */
  function looksLikeAnonJwt(key) {
    return key.length >= 80 && key.indexOf("eyJ") === 0;
  }

  function isConfigured(cfg) {
    var c = trimCfg(cfg);
    if (c.url.length <= 12) return false;
    if (!looksLikeAnonJwt(c.anonKey)) return false;
    return true;
  }

  /** Why cloud is off — for UI messages. */
  function setupIssue(cfg) {
    if (!cfg) return "no_config";
    var c = trimCfg(cfg);
    var hasUrl = c.url.length > 12;
    var hasKey = c.anonKey.length > 0;
    if (hasUrl && hasKey && !looksLikeAnonJwt(c.anonKey)) {
      return "wrong_anon_not_jwt";
    }
    if (hasUrl && !hasKey) return "missing_anon_key";
    if (!hasUrl && hasKey) return "missing_url";
    if (!hasUrl && !hasKey) return "missing_both";
    return null;
  }

  function restHeaders(anonKey) {
    return {
      apikey: anonKey,
      Authorization: "Bearer " + anonKey,
      "Content-Type": "application/json",
    };
  }

  function baseUrl(cfg) {
    return String(cfg.url).replace(/\/+$/, "");
  }

  /**
   * @returns {Promise<object|null>}
   */
  async function readPortfolio(cfg) {
    cfg = trimCfg(cfg);
    if (!isConfigured(cfg)) return null;
    var url =
      baseUrl(cfg) +
      "/rest/v1/portfolio?select=data&id=eq.1";
    var res = await fetch(url, {
      method: "GET",
      headers: restHeaders(cfg.anonKey),
    });
    if (!res.ok) {
      throw new Error("Supabase read failed: " + res.status);
    }
    var rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rows[0].data != null ? rows[0].data : null;
  }

  /**
   * @param {object} data — portfolio JSON
   * @param {string} saveSecret — must match value inside save_portfolio() in SQL
   */
  function sanitizeStorageFileName(name) {
    var n = String(name != null ? name : "").trim();
    if (!n) return "image.png";
    var base = n.replace(/[^a-zA-Z0-9._-]/g, "_");
    if (base.length > 100) base = base.slice(0, 100);
    return base;
  }

  function encodeStoragePath(path) {
    return String(path || "")
      .split("/")
      .map(function (p) {
        return encodeURIComponent(p);
      })
      .join("/");
  }

  /**
   * Uploads a file to Supabase Storage (public bucket) and returns the public object URL.
   * @param {File|Blob} file
   * @returns {Promise<string>}
   */
  async function uploadPortfolioImage(cfg, file) {
    cfg = trimCfg(cfg);
    if (!isConfigured(cfg)) {
      throw new Error("Supabase غير مُعدّ (url / anonKey).");
    }
    if (!file || typeof file.arrayBuffer !== "function") {
      throw new Error("ملف غير صالح.");
    }
    var bucket = cfg.storageBucket || DEFAULT_STORAGE_BUCKET;
    var safe = sanitizeStorageFileName(file.name);
    var objectPath = "site/" + Date.now() + "_" + safe;
    var encodedPath = encodeStoragePath(objectPath);
    var uploadUrl =
      baseUrl(cfg) + "/storage/v1/object/" + encodeURIComponent(bucket) + "/" + encodedPath;
    var body = await file.arrayBuffer();
    var ct =
      file.type && String(file.type).indexOf("image/") === 0
        ? file.type
        : "application/octet-stream";
    var res = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        apikey: cfg.anonKey,
        Authorization: "Bearer " + cfg.anonKey,
        "Content-Type": ct,
      },
      body: body,
    });
    if (!res.ok) {
      var raw = await res.text();
      var msg = raw;
      try {
        var j = JSON.parse(raw);
        if (j && (j.message || j.error || j.error_description)) {
          msg = j.message || j.error || j.error_description;
        }
      } catch (e) {
        /* keep raw */
      }
      if (
        res.status === 404 ||
        /bucket not found/i.test(String(msg)) ||
        /^not found$/i.test(String(msg).trim())
      ) {
        var dash = storageBucketsDashboardUrl(cfg);
        msg =
          "PORTFOLIO_STORAGE_BUCKET_MISSING | Bucket غير موجود باسم \"" +
          bucket +
          "\". أنشئه من لوحة Supabase: Storage → New bucket → نفس الاسم بالضبط → فعّل Public → Create. ثم نفّذ سياسات القسم (3) في SUPABASE_SETUP.sql." +
          (dash ? " الرابط: " + dash : "");
      }
      throw new Error(msg || "Upload failed: " + res.status);
    }
    return (
      baseUrl(cfg) +
      "/storage/v1/object/public/" +
      encodeURIComponent(bucket) +
      "/" +
      encodedPath
    );
  }

  async function savePortfolio(cfg, data, saveSecret) {
    cfg = trimCfg(cfg);
    if (!isConfigured(cfg)) {
      throw new Error("Supabase is not configured (url / anonKey).");
    }
    var url = baseUrl(cfg) + "/rest/v1/rpc/save_portfolio";
    var res = await fetch(url, {
      method: "POST",
      headers: Object.assign({}, restHeaders(cfg.anonKey), {
        Prefer: "return=minimal",
      }),
      body: JSON.stringify({
        new_data: data,
        p_secret: saveSecret,
      }),
    });
    if (!res.ok) {
      var raw = await res.text();
      var msg = raw;
      try {
        var j = JSON.parse(raw);
        if (j && j.message) msg = j.message;
      } catch (e) {
        /* keep raw */
      }
      throw new Error(msg || "Supabase save failed: " + res.status);
    }
    return true;
  }

  global.PortfolioSupabase = {
    isConfigured: isConfigured,
    setupIssue: setupIssue,
    readPortfolio: readPortfolio,
    savePortfolio: savePortfolio,
    uploadPortfolioImage: uploadPortfolioImage,
    defaultStorageBucket: DEFAULT_STORAGE_BUCKET,
    storageBucketsDashboardUrl: storageBucketsDashboardUrl,
  };
})(typeof window !== "undefined" ? window : this);
