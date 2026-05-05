(function () {
  "use strict";

  var ADMIN_PASSWORD = "qwer56";
  var SESSION_SECRET_KEY = "portfolioSaveSecret";
  var PM = window.PortfolioModel;

  var state = PM.normalize({});

  function getPath(obj, path) {
    var parts = path.split(".");
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function setPath(obj, path, val) {
    var parts = path.split(".");
    var cur = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      var k = parts[i];
      if (!cur[k] || typeof cur[k] !== "object") cur[k] = {};
      cur = cur[k];
    }
    cur[parts[parts.length - 1]] = val;
  }

  function bindImageLoading(img, wrap) {
    if (!img || !wrap) return;
    wrap.classList.add("image-loading-wrap");
    if (!img.complete) {
      wrap.classList.add("is-loading");
    }
    img.addEventListener("load", function () {
      wrap.classList.remove("is-loading");
    });
    img.addEventListener("error", function () {
      wrap.classList.remove("is-loading");
    });
  }

  function setImageWithLoader(img, wrap, src) {
    if (!img || !src) return;
    if (wrap) {
      wrap.classList.add("image-loading-wrap");
      wrap.classList.add("is-loading");
    }
    img.src = src;
    if (wrap && img.complete) {
      wrap.classList.remove("is-loading");
    }
  }

  function escAttr(s) {
    return String(s != null ? s : "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;");
  }

  function sanitizeImageFileName(name) {
    var n = String(name || "").trim();
    if (!n) return "image.png";
    return n.replace(/[^a-zA-Z0-9._-]/g, "_");
  }

  function revokeImgBlob(img) {
    if (!img || !img._blobRevoke) return;
    try {
      URL.revokeObjectURL(img._blobRevoke);
    } catch (e) {}
    img._blobRevoke = null;
  }

  function relativePathFromFile(file) {
    return "upload/" + sanitizeImageFileName(file && file.name);
  }

  function localUploadBaseUrl() {
    var u = typeof window.PORTFOLIO_LOCAL_UPLOAD === "string" ? window.PORTFOLIO_LOCAL_UPLOAD.trim() : "";
    if (u) return u.replace(/\/+$/, "");
    try {
      if (window.location && window.location.origin && window.location.protocol !== "file:") {
        return window.location.origin.replace(/\/+$/, "");
      }
    } catch (e) {}
    return "http://127.0.0.1:3847";
  }

  /** معاينة في الأدمن: مسارات upload/ أو imges/ تُحمّل من خادم الرفع المحلي وليس من بورت Live Server. */
  function resolveDashboardAssetUrl(rel) {
    var s = String(rel || "").trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s) || s.indexOf("data:") === 0 || s.indexOf("blob:") === 0) return s;
    if (/^upload\//i.test(s) || /^imges\//i.test(s)) {
      var base = localUploadBaseUrl().replace(/\/+$/, "");
      return base + "/" + s.replace(/^\/+/, "");
    }
    return s;
  }

  /** رفع للخادم المحلي (dev-server.js) → ملف حقيقي داخل مجلد upload/ */
  async function tryUploadViaLocalServer(file) {
    if (!file) return null;
    var base = localUploadBaseUrl();
    var url = base + "/api/upload";
    var fd = new FormData();
    fd.append("file", file, file.name);
    try {
      var res = await fetch(url, { method: "POST", body: fd });
      if (!res.ok) return null;
      var j = await res.json();
      if (j && j.path) return String(j.path).replace(/\\/g, "/");
      if (j && j.url) return String(j.url).replace(/\\/g, "/");
    } catch (e) {
      console.warn("local upload:", e);
    }
    return null;
  }

  /**
   * أولاً خادم محلي upload/ (npm run dev)، ثم Supabase Storage، ثم مسار نسبي.
   * @param {File} file
   * @param {HTMLInputElement} pathInput
   * @param {HTMLImageElement|null} previewEl
   * @param {string|undefined} statePath — مثل heroImage؛ للمشاريع اتركه undefined ثم readProjectsFromDom
   * @returns {Promise<boolean>}
   */
  function isBucketMissingUploadError(msg) {
    var s = String(msg || "").toLowerCase();
    if (s.indexOf("portfolio_storage_bucket_missing") >= 0) return true;
    return (
      /bucket not found/.test(s) ||
      /bucket غير موجود/.test(s) ||
      /غير موجود باسم/.test(s) ||
      (/not found/.test(s) && /bucket/.test(s)) ||
      (s.indexOf("404") >= 0 && /bucket/.test(s))
    );
  }

  function getDashUploadWrap(previewEl, pathInput) {
    if (previewEl && previewEl.closest) {
      var w = previewEl.closest(".dash-img-row");
      if (w) return w;
    }
    if (pathInput && pathInput.closest) {
      return pathInput.closest(".dash-img-row");
    }
    return null;
  }

  function setDashRowUploadLoading(wrap, on) {
    if (!wrap) return;
    wrap.classList.add("image-loading-wrap");
    wrap.classList.toggle("is-loading", !!on);
    if (on) {
      wrap.setAttribute("aria-busy", "true");
    } else {
      wrap.removeAttribute("aria-busy");
    }
  }

  async function applyChosenImage(file, pathInput, previewEl, statePath) {
    if (!file || !pathInput) return false;
    var uploadWrap = getDashUploadWrap(previewEl, pathInput);
    setDashRowUploadLoading(uploadWrap, true);
    try {
      return await applyChosenImageBody(
        file,
        pathInput,
        previewEl,
        statePath,
        uploadWrap
      );
    } catch (e) {
      console.warn(e);
      showToast("حدث خطأ أثناء رفع الصورة. حاول مرة أخرى.", false);
      setDashRowUploadLoading(uploadWrap, false);
      return false;
    }
  }

  async function applyChosenImageBody(file, pathInput, previewEl, statePath, uploadWrap) {
    var cfg = window.PORTFOLIO_SUPABASE || {};
    var skipUpload = cfg.skipStorageUpload === true;
    var finalUrl = null;
    var usedLocalServer = false;
    var usedCloudUpload = false;
    var cloudErrMsg = "";

    var localPath = await tryUploadViaLocalServer(file);
    if (localPath) {
      finalUrl = localPath;
      usedLocalServer = true;
    } else if (
      !skipUpload &&
      window.PortfolioSupabase &&
      PortfolioSupabase.isConfigured(cfg) &&
      typeof PortfolioSupabase.uploadPortfolioImage === "function"
    ) {
      try {
        finalUrl = await PortfolioSupabase.uploadPortfolioImage(cfg, file);
        usedCloudUpload = true;
      } catch (err) {
        cloudErrMsg = (err && err.message) || "";
        if (!isBucketMissingUploadError(cloudErrMsg)) {
          showToast("فشل الرفع للسحابة: " + cloudErrMsg, false);
          setDashRowUploadLoading(uploadWrap, false);
          return false;
        }
      }
    }

    if (!finalUrl) {
      if (skipUpload) {
        finalUrl = relativePathFromFile(file);
      } else if (cloudErrMsg && isBucketMissingUploadError(cloudErrMsg)) {
        finalUrl = relativePathFromFile(file);
        var dashUrl =
          window.PortfolioSupabase &&
          typeof PortfolioSupabase.storageBucketsDashboardUrl === "function"
            ? PortfolioSupabase.storageBucketsDashboardUrl(cfg || {})
            : "";
        showToast(
          (dashUrl ? dashUrl + "\n\n" : "") +
            "ما وُجد bucket للسحابة — شغّل من الطرفية: npm run dev ثم افتح الأدمن من الرابط اللي يظهر (يحفظ الصور في مجلد upload/).",
          "info"
        );
      } else {
        finalUrl = relativePathFromFile(file);
        showToast(
          "شغّل في مجلد المشروع: npm install ثم npm run dev — ثم افتح http://127.0.0.1:3847/admin.html حتى تُحفظ الصور في upload/ تلقائياً.",
          "info"
        );
      }
    }
    pathInput.value = finalUrl;
    var previewSrc = "";
    if (previewEl) {
      revokeImgBlob(previewEl);
      if (/^https?:\/\//i.test(finalUrl)) {
        previewSrc = finalUrl;
      } else {
        var resolvedPreview = resolveDashboardAssetUrl(finalUrl);
        if (/^https?:\/\//i.test(resolvedPreview)) {
          previewSrc = resolvedPreview;
        } else {
          previewEl._blobRevoke = URL.createObjectURL(file);
          previewSrc = previewEl._blobRevoke;
        }
      }
      setImageWithLoader(previewEl, uploadWrap, previewSrc);
    } else if (uploadWrap) {
      setDashRowUploadLoading(uploadWrap, false);
    }
    if (statePath) {
      setPath(state, statePath, finalUrl);
    }
    readPathInputs({ skipProjects: !!statePath });
    persist();
    var isImageFile = file && file.type && String(file.type).indexOf("image/") === 0;
    if (usedLocalServer) {
      showToast(
        "تم حفظ الملف في مجلد upload/ داخل المشروع. اضغط «حفظ» لحفظ المسار مع باقي البيانات في Supabase.",
        true
      );
    } else if (usedCloudUpload && /^https?:\/\//i.test(finalUrl)) {
      showToast(
        isImageFile
          ? "تم رفع الصورة لـ Supabase — الرابط محفوظ. اضغط «حفظ» لحفظ كل البيانات في Supabase."
          : "تم رفع الملف لـ Supabase — الرابط محفوظ. اضغط «حفظ» لحفظ كل البيانات في Supabase.",
        true
      );
    }
    return true;
  }

  function persist() {
    state = PM.normalize(state);
    PM.persistLocal(state);
  }

  function syncDashCvPreview() {
    var a = document.querySelector(".js-dash-cv-preview");
    var inp = document.querySelector('[data-path="cvUrl"]');
    if (!a || !inp) return;
    var u = String(inp.value || "").trim();
    if (u) {
      a.href = resolveDashboardAssetUrl(u);
      a.style.display = "inline-flex";
      a.style.opacity = "0.9";
      a.style.pointerEvents = "auto";
    } else {
      a.href = "#";
      a.style.display = "none";
      a.style.pointerEvents = "none";
    }
  }

  function syncDashHeaderLinks() {
    var h = state.header || {};
    function href(u) {
      var s = String(u || "").trim();
      return s || "#";
    }
    var fb = document.querySelector(".js-dash-href-fb");
    var ig = document.querySelector(".js-dash-href-ig");
    var me = document.querySelector(".js-dash-href-me");
    if (fb) fb.href = href(h.facebook);
    if (ig) ig.href = href(h.instagram);
    if (me) me.href = href(h.messenger);
  }

  function syncThemeSwatches(activeId) {
    var tid =
      activeId != null && String(activeId).trim() !== ""
        ? String(activeId).trim()
        : String(
            (state && state.theme) ||
              (window.PortfolioThemes && PortfolioThemes.DEFAULT_ID) ||
              "lime"
          );
    document.querySelectorAll(".dash-theme-swatch[data-theme-id]").forEach(function (btn) {
      var on = btn.getAttribute("data-theme-id") === tid;
      btn.classList.toggle("dash-theme-swatch--active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function fillFromState() {
    document.querySelectorAll("[data-path]").forEach(function (el) {
      var p = el.getAttribute("data-path");
      var v = getPath(state, p);
      el.value = v != null ? String(v) : "";
    });
    var heroImg = document.querySelector(".js-dash-hero-photo");
    var heroWrap = heroImg ? heroImg.closest(".dash-img-row") : null;
    revokeImgBlob(heroImg);
    if (heroImg && state.heroImage) setImageWithLoader(heroImg, heroWrap, resolveDashboardAssetUrl(state.heroImage));    var aboutImg = document.querySelector(".js-dash-about-photo");
        var aboutWrap = aboutImg ? aboutImg.closest(".dash-img-row") : null;
    revokeImgBlob(aboutImg);
 if (aboutImg && state.aboutImage)
      setImageWithLoader(aboutImg, aboutWrap, resolveDashboardAssetUrl(state.aboutImage));    var fs = document.getElementById("dash-footer-services-lines");
    if (fs && state.footer && state.footer.services) {
      fs.value = state.footer.services.join("\n");
    }
    renderSkillsEditor();
    renderProjectsEditor();
    syncDashHeaderLinks();
    var th =
      (state.theme && String(state.theme).trim()) ||
      (window.PortfolioThemes && PortfolioThemes.DEFAULT_ID) ||
      "lime";
    if (window.PortfolioThemes && typeof PortfolioThemes.applyTheme === "function") {
      PortfolioThemes.applyTheme(document.documentElement, th);
    }
    syncThemeSwatches(th);
    syncDashCvPreview();
  }

  function readPathInputs(opts) {
    opts = opts || {};
    document.querySelectorAll("[data-path]").forEach(function (el) {
      setPath(state, el.getAttribute("data-path"), el.value);
    });
    var fs = document.getElementById("dash-footer-services-lines");
    if (fs) {
      state.footer.services = fs.value
        .split("\n")
        .map(function (l) {
          return l.trim();
        })
        .filter(Boolean);
    }
    readSkillsFromDom();
    if (!opts.skipProjects) readProjectsFromDom();
  }

  function readSkillsFromDom() {
    var root = document.getElementById("dash-skills-root");
    if (!root) return;
    state.skills = [];
    root.querySelectorAll("[data-skill-index]").forEach(function (row) {
      state.skills.push({
        title: (row.querySelector(".js-skill-title") || {}).value || "",
        description: (row.querySelector(".js-skill-desc") || {}).value || "",
      });
    });
  }

  function readProjectsFromDom() {
    var root = document.getElementById("dash-projects-root");
    if (!root) return;
    state.projects = [];
    root.querySelectorAll("[data-proj-index]").forEach(function (row) {
      state.projects.push({
        badge: (row.querySelector(".js-proj-badge") || {}).value || "",
        title: (row.querySelector(".js-proj-title") || {}).value || "",
        description: (row.querySelector(".js-proj-desc") || {}).value || "",
        link: (row.querySelector(".js-proj-link") || {}).value || "",
        image: (row.querySelector(".js-proj-img") || {}).value || "",
      });
    });
  }

  var SKILL_ICONS = [
    "fa-pen-nib",
    "fa-rocket",
    "fa-code",
    "fa-sitemap",
    "fa-database",
    "fa-arrow-right-to-bracket",
  ];

  function renderSkillsEditor() {
    var root = document.getElementById("dash-skills-root");
    if (!root) return;
    root.innerHTML = (state.skills || [])
      .map(function (sk, i) {
        var ic = SKILL_ICONS[i % SKILL_ICONS.length];
        return (
          '<article class="card fade-on show" data-skill-index="' +
          i +
          '"><i class="fa-solid ' +
          ic +
          '" aria-hidden="true"></i>' +
          '<input type="text" class="dash-field js-skill-title" placeholder="Skill title" value="' +
          escAttr(sk.title) +
          '">' +
          '<textarea class="dash-field js-skill-desc" rows="4" placeholder="Description"></textarea>' +
          '<div class="dash-card-actions"><button type="button" class="dash-remove" data-remove-skill="' +
          i +
          '">Remove</button></div></article>'
        );
      })
      .join("");
    root.querySelectorAll("[data-skill-index]").forEach(function (row) {
      var idx = parseInt(row.getAttribute("data-skill-index"), 10);
      var ta = row.querySelector(".js-skill-desc");
      if (ta && state.skills[idx]) ta.value = state.skills[idx].description;
    });
    root.querySelectorAll(".js-skill-title, .js-skill-desc").forEach(function (el) {
      el.oninput = function () {
        readSkillsFromDom();
        persist();
      };
    });
    root.querySelectorAll("[data-remove-skill]").forEach(function (btn) {
      btn.onclick = function () {
        readSkillsFromDom();
        var idx = parseInt(btn.getAttribute("data-remove-skill"), 10);
        state.skills.splice(idx, 1);
        renderSkillsEditor();
        persist();
      };
    });
  }

  function renderProjectsEditor() {
    var root = document.getElementById("dash-projects-root");
    if (!root) return;
    root.querySelectorAll(".js-proj-preview").forEach(function (im) {
      revokeImgBlob(im);
    });
    root.innerHTML = (state.projects || [])
      .map(function (pr, i) {
        var img = pr.image || "";
        var imgSrc = img ? resolveDashboardAssetUrl(img) : "";
        var imgBlock = img
          ? '<img class="project-img js-proj-preview" src="' +
            escAttr(imgSrc) +
            '" alt="" width="640" height="350" loading="lazy" decoding="async">'
          : '<div class="project-img project-img-placeholder js-proj-preview-ph" role="presentation"></div>';
        var photoCol =
          '<div class="dash-img-row dash-proj-photo-col">' +
          imgBlock +
          '<input type="text" class="dash-field js-proj-img" placeholder="upload/… (مع npm run dev)" value="' +
          escAttr(img) +
          '">' +
          '<input type="file" class="visually-hidden js-proj-file" accept="image/*">' +
          '<button type="button" class="dash-img-btn js-proj-pick-file">اختيار صورة</button></div>';
        var info =
          '<div class="project-info dash-proj-fields">' +
          '<p class="dash-hint" style="margin:0 0 6px">شارة / تصنيف</p>' +
          '<input type="text" class="dash-field js-proj-badge" placeholder="Badge" value="' +
          escAttr(pr.badge) +
          '">' +
          '<p class="dash-hint" style="margin:8px 0 6px">عنوان المشروع</p>' +
          '<input type="text" class="dash-field js-proj-title" placeholder="Project title" value="' +
          escAttr(pr.title) +
          '">' +
          '<p class="dash-hint" style="margin:8px 0 6px">الوصف</p>' +
          '<textarea class="dash-field js-proj-desc" rows="3" placeholder="Description"></textarea>' +
          '<p class="dash-hint" style="margin:8px 0 6px">رابط المشروع</p>' +
          '<input type="text" class="dash-field js-proj-link" placeholder="Link URL" value="' +
          escAttr(pr.link) +
          '">' +
          '<div class="dash-card-actions"><button type="button" class="dash-remove" data-remove-proj="' +
          i +
          '">حذف المشروع</button></div></div>';
        var rev = i % 2 === 0;
        var inner = rev ? info + photoCol : photoCol + info;
        var cls = "card fade-on show" + (rev ? " reverse" : "");
        return '<article class="' + cls + '" data-proj-index="' + i + '">' + inner + "</article>";
      })
      .join("");
    root.querySelectorAll("[data-proj-index]").forEach(function (row) {
      var idx = parseInt(row.getAttribute("data-proj-index"), 10);
      var ta = row.querySelector(".js-proj-desc");
      if (ta && state.projects[idx]) ta.value = state.projects[idx].description;
    });
    root.querySelectorAll(".js-proj-badge, .js-proj-title, .js-proj-desc, .js-proj-link").forEach(
      function (el) {
        el.oninput = function () {
          readProjectsFromDom();
          persist();
        };
      }
    );
    root.querySelectorAll(".js-proj-img").forEach(function (el) {
      el.oninput = function () {
        readProjectsFromDom();
        persist();
        renderProjectsEditor();
      };
    });
    root.onclick = function (e) {
      var pick = e.target.closest(".js-proj-pick-file");
      if (!pick) return;
      var row = pick.closest("[data-proj-index]");
      if (!row) return;
      var fin = row.querySelector(".js-proj-file");
      if (fin) fin.click();
    };
    root.onchange = async function (e) {
      var t = e.target;
      if (!t || !t.classList || !t.classList.contains("js-proj-file")) return;
      var file = t.files && t.files[0];
      if (!file) return;
      var row = t.closest("[data-proj-index]");
      if (!row) return;
      var pathIn = row.querySelector(".js-proj-img");
      var prev = row.querySelector(".js-proj-preview");
      var ph = row.querySelector(".js-proj-preview-ph");
      if (!pathIn) {
        t.value = "";
        return;
      }
      var ok = await applyChosenImage(file, pathIn, prev || null, undefined);
      if (!ok) {
        t.value = "";
        return;
      }
      readProjectsFromDom();
      if (!prev && ph) {
        var im = document.createElement("img");
        im.className = "project-img js-proj-preview";
        im.alt = "";
        im.width = 640;
        im.height = 350;
        im.loading = "lazy";
        im.decoding = "async";
        var u = pathIn.value;
        var projSrc = "";
        if (/^https?:\/\//i.test(u)) {
          projSrc = u;
        } else {
          var rproj = resolveDashboardAssetUrl(u);
          if (/^https?:\/\//i.test(rproj)) {
            projSrc = rproj;
          } else {
            im._blobRevoke = URL.createObjectURL(file);
            projSrc = im._blobRevoke;
          }
        }
        var projWrap = pathIn.closest(".dash-img-row");
        ph.replaceWith(im);
        setImageWithLoader(im, projWrap, projSrc);
        bindImageLoading(im, projWrap);
      }
      persist();
      t.value = "";
    };
    root.querySelectorAll("[data-remove-proj]").forEach(function (btn) {
      btn.onclick = function () {
        readProjectsFromDom();
        var idx = parseInt(btn.getAttribute("data-remove-proj"), 10);
        state.projects.splice(idx, 1);
        renderProjectsEditor();
        persist();
      };
    });
    root.querySelectorAll(".js-proj-preview").forEach(function (im) {
      bindImageLoading(im, im.closest(".dash-img-row"));
    });
  }

  function escapeHtmlToast(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * @param {string} msg
   * @param {boolean|string} okOrKind — true/false أو "ok"|"err"|"info"
   */
  function showToast(msg, okOrKind) {
    var t = document.getElementById("dash-toast");
    if (!t) return;
    var kind = "ok";
    if (okOrKind === false) kind = "err";
    else if (okOrKind === true) kind = "ok";
    else if (typeof okOrKind === "string" && /^(ok|err|info)$/.test(okOrKind)) kind = okOrKind;

    var s = String(msg || "");
    var urlMatch = /https:\/\/[^\s<]+/.exec(s);
    if (urlMatch) {
      var url = urlMatch[0];
      var before = s.slice(0, urlMatch.index).trim();
      var after = s.slice(urlMatch.index + url.length).trim();
      var rtlParts = [before, after].filter(Boolean).join("\n\n");
      t.innerHTML =
        '<a class="dash-toast-link" dir="ltr" translate="no" href="' +
        escAttr(url) +
        '" target="_blank" rel="noopener noreferrer">' +
        escapeHtmlToast(url) +
        "</a>" +
        (rtlParts
          ? '<div class="dash-toast-body" dir="rtl">' +
            escapeHtmlToast(rtlParts).replace(/\r?\n/g, "<br>") +
            "</div>"
          : "");
    } else {
      t.innerHTML = "";
      t.textContent = s;
    }

    t.className = "dash-toast show dash-toast--" + kind;
    clearTimeout(showToast._tm);
    var delay = urlMatch || s.indexOf("http") >= 0 ? 16000 : 4500;
    showToast._tm = setTimeout(function () {
      t.classList.remove("show");
    }, delay);
  }

  async function loadAll() {
    var localRaw = PM.readLocal();
    var usedLocal =
      typeof PM.isValidLocalSnapshot === "function"
        ? PM.isValidLocalSnapshot(localRaw)
        : localRaw != null && typeof localRaw === "object" && !Array.isArray(localRaw);
    if (usedLocal) {
      state = PM.normalize(localRaw);
    } else {
      state = PM.normalize({});
    }
    fillFromState();
    var cfg = window.PORTFOLIO_SUPABASE;
    if (window.PortfolioSupabase && PortfolioSupabase.isConfigured(cfg)) {
      try {
        var cloud = await PortfolioSupabase.readPortfolio(cfg);
        if (cloud && typeof cloud === "object") {
          var normCloud = PM.normalize(cloud);
          if (PM.hasMeaningfulContent(normCloud)) {
            state = normCloud;
            PM.persistLocal(state);
            fillFromState();
          }
        }
      } catch (e) {
        console.warn(e);
      }
    }
    if (!usedLocal && !PM.hasMeaningfulContent(state)) {
      state = PM.normalize({});
      fillFromState();
    }
  }

  async function onSave() {
    readPathInputs();
    state = PM.normalize(state);
    PM.persistLocal(state);
    var sec = document.getElementById("dash-secret");
    var secret = sec ? String(sec.value || "").trim() : "";
    var cfg = window.PORTFOLIO_SUPABASE;
    if (window.PortfolioSupabase && PortfolioSupabase.isConfigured(cfg)) {
      if (!secret) {
        showToast("اكتب سر الحفظ (نفس اللي في SQL) عشان ينرفع لـ Supabase.", false);
        return;
      }
      try {
        await PortfolioSupabase.savePortfolio(cfg, state, secret);
        try {
          sessionStorage.setItem(SESSION_SECRET_KEY, secret);
        } catch (e) {}
        showToast("تم الحفظ: Supabase + نسخة بالمتصفح.", true);
      } catch (e) {
        showToast("فشل Supabase: " + (e.message || ""), false);
      }
    } else {
      showToast("تم حفظ نسخة بالمتصفح فقط (فعّل supabase-config للسحابة).", true);
    }
  }

  function unlock() {
    document.body.classList.remove("locked");
  }

  function boot() {
    document.getElementById("dash-add-skill").onclick = function () {
      readPathInputs();
      state.skills.push({ title: "", description: "" });
      renderSkillsEditor();
      persist();
    };
    document.getElementById("dash-add-project").onclick = function () {
      readPathInputs();
      state.projects.push({
        title: "",
        description: "",
        link: "",
        badge: "Project",
        image: "",
      });
      renderProjectsEditor();
      persist();
    };
    document.getElementById("dash-save").onclick = function () {
      onSave();
    };
    document.querySelectorAll("[data-path]").forEach(function (el) {
      el.addEventListener("input", function () {
        setPath(state, el.getAttribute("data-path"), el.value);
        persist();
        var p = el.getAttribute("data-path");
        if (p === "heroImage") {
          var im = document.querySelector(".js-dash-hero-photo");
          if (im) {
            revokeImgBlob(im);
 setImageWithLoader(im, im.closest(".dash-img-row"), resolveDashboardAssetUrl(el.value || "imges/newA1.PNG"));          }
        }
        if (p === "aboutImage") {
          var im2 = document.querySelector(".js-dash-about-photo");
          if (im2) {
            revokeImgBlob(im2);
 setImageWithLoader(
              im2,
              im2.closest(".dash-img-row"),
              resolveDashboardAssetUrl(el.value || "imges/newA2.PNG")
            );          }
        }
        if (p.indexOf("header.") === 0) syncDashHeaderLinks();
        if (p === "cvUrl") syncDashCvPreview();
      });
    });
    function bindHeroAboutPickers() {
      function hook(fileId, btnId, dataPath) {
        var fin = document.getElementById(fileId);
        var btn = document.getElementById(btnId);
        var pathIn = document.querySelector('[data-path="' + dataPath + '"]');
        var prev =
          dataPath === "heroImage"
            ? document.querySelector(".js-dash-hero-photo")
            : document.querySelector(".js-dash-about-photo");
        if (!fin || !btn || !pathIn) return;
        btn.onclick = function () {
          fin.click();
        };
        fin.onchange = async function () {
          var file = fin.files && fin.files[0];
          if (!file) return;
          await applyChosenImage(file, pathIn, prev, dataPath);
          fin.value = "";
        };
      }
      hook("dash-file-hero", "dash-pick-hero-img", "heroImage");
      hook("dash-file-about", "dash-pick-about-img", "aboutImage");
    }
    bindHeroAboutPickers();
    (function bindCvPicker() {
      var fin = document.getElementById("dash-file-cv");
      var btn = document.getElementById("dash-pick-cv");
      var pathIn = document.querySelector('[data-path="cvUrl"]');
      if (!fin || !btn || !pathIn) return;
      btn.onclick = function () {
        fin.click();
      };
      fin.onchange = async function () {
        var file = fin.files && fin.files[0];
        if (!file) return;
        await applyChosenImage(file, pathIn, null, "cvUrl");
        syncDashCvPreview();
        fin.value = "";
      };
    })();
    var themePicker = document.getElementById("dash-theme-picker");
    if (themePicker) {
      function applyDashThemeFromButton(btn) {
        if (!btn) return;
        var id = btn.getAttribute("data-theme-id");
        if (!id) return;
        var hid = document.getElementById("dash-theme-input");
        if (hid) hid.value = id;
        readPathInputs();
        persist();
        if (window.PortfolioThemes && typeof PortfolioThemes.applyTheme === "function") {
          PortfolioThemes.applyTheme(document.documentElement, id);
        }
        syncThemeSwatches(id);
      }
      themePicker.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-theme-id]");
        if (!btn || !themePicker.contains(btn)) return;
        e.preventDefault();
        applyDashThemeFromButton(btn);
      });
      themePicker.addEventListener(
        "keydown",
        function (e) {
          if (e.key !== "Enter" && e.key !== " ") return;
          var btn = e.target.closest("[data-theme-id]");
          if (!btn || !themePicker.contains(btn)) return;
          e.preventDefault();
          applyDashThemeFromButton(btn);
        },
        true
      );
    }
    var fs = document.getElementById("dash-footer-services-lines");
    if (fs) {
      fs.oninput = function () {
        state.footer.services = fs.value
          .split("\n")
          .map(function (l) {
            return l.trim();
          })
          .filter(Boolean);
        persist();
      };
    }

    var err = document.getElementById("lock-error");
    var pin = document.getElementById("lock-password");
    var btn = document.getElementById("lock-submit");
    function tryUnlock() {
      err.textContent = "";
      if (pin.value === ADMIN_PASSWORD) {
        unlock();
        loadAll();
        var sec = document.getElementById("dash-secret");
        if (sec) {
          try {
            sec.value = sessionStorage.getItem(SESSION_SECRET_KEY) || "";
          } catch (e) {}
        }
        return;
      }
      err.textContent = "كلمة المرور غلط.";
      pin.value = "";
      pin.focus();
    }
    btn.addEventListener("click", tryUnlock);
    pin.addEventListener("keydown", function (e) {
      if (e.key === "Enter") tryUnlock();
    });
    pin.focus();
  }

  function initLayoutChrome() {
    var body = document.body;
    var sidebar = document.getElementById("sidebar");
    var bars = document.getElementById("bars");
    var xmark = document.getElementById("fa-xmark");
    var scrollTicking = false;
    window.addEventListener(
      "scroll",
      function () {
        if (scrollTicking) return;
        scrollTicking = true;
        requestAnimationFrame(function () {
          body.classList.toggle("scroll-head", window.scrollY > 20);
          scrollTicking = false;
        });
      },
      { passive: true }
    );
    function setMenuOpen(open) {
      body.classList.toggle("sidebar-mode", open);
      if (bars) bars.setAttribute("aria-expanded", open ? "true" : "false");
    }
    if (bars) {
      bars.setAttribute("aria-expanded", "false");
      bars.addEventListener("click", function () {
        setMenuOpen(true);
      });
    }
    if (xmark) {
      xmark.addEventListener("click", function () {
        setMenuOpen(false);
      });
    }
    document.addEventListener("click", function (e) {
      if (!sidebar || !bars) return;
      if (!sidebar.contains(e.target) && !bars.contains(e.target)) {
        setMenuOpen(false);
      }
    });
    document.querySelectorAll(".nav_link").forEach(function (n) {
      n.addEventListener("click", function () {
        setMenuOpen(false);
      });
    });
  }
 bindImageLoading(document.querySelector(".js-dash-hero-photo"), document.querySelector(".js-dash-hero-photo") ? document.querySelector(".js-dash-hero-photo").closest(".dash-img-row") : null);
  bindImageLoading(document.querySelector(".js-dash-about-photo"), document.querySelector(".js-dash-about-photo") ? document.querySelector(".js-dash-about-photo").closest(".dash-img-row") : null);
  boot();
  initLayoutChrome();
})();

