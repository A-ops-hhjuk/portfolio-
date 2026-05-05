(function () {
  "use strict";

  var PM = window.PortfolioModel;

  function escapeHtml(t) {
    return String(t == null ? "" : t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(t) {
    return escapeHtml(t).replace(/'/g, "&#39;");
  }

  function nl2brEscaped(t) {
    return escapeHtml(t).replace(/\n/g, "<br>");
  }

  function setLink(el, url) {
    var u = String(url || "").trim();
    el.href = u || "#";
    if (!u) {
      el.setAttribute("aria-disabled", "true");
    } else {
      el.removeAttribute("aria-disabled");
    }
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
    if (!img || !wrap || !src) return;
    wrap.classList.add("is-loading");
    img.src = src;
    if (img.complete) {
      wrap.classList.remove("is-loading");
    }
  }

  async function loadPortfolioData() {
    var raw = PM ? PM.readLocal() : null;
    var useLocal =
      PM &&
      (typeof PM.isValidLocalSnapshot === "function"
        ? PM.isValidLocalSnapshot(raw)
        : raw != null && typeof raw === "object" && !Array.isArray(raw));
    var cfg = window.PORTFOLIO_SUPABASE;
    var supabaseOn =
      window.PortfolioSupabase && PortfolioSupabase.isConfigured(cfg);

    /**
     * مع Supabase: نقرأ السحابة أولاً (آخر حفظ يظهر على كل الأجهزة).
     * بدون Supabase: النسخة المحلية أولاً.
     */
    if (supabaseOn && PM) {
      try {
        var cloud = await PortfolioSupabase.readPortfolio(cfg);
        if (cloud && typeof cloud === "object") {
          var normCloud = PM.normalize(cloud);
          if (PM.hasMeaningfulContent(normCloud)) {
            PM.persistLocal(normCloud);
            return normCloud;
          }
        }
      } catch (e) {
        console.warn("Supabase read failed:", e);
      }
    }

    if (useLocal) {
      return PM.normalize(raw);
    }
    return PM.normalize({});
  }

  function applyPortfolio(data) {
    var d = PM ? PM.normalize(data) : data || {};
    var themeId =
      (d.theme && String(d.theme).trim()) ||
      (window.PortfolioThemes && PortfolioThemes.DEFAULT_ID) ||
      "lime";
    if (window.PortfolioThemes && typeof PortfolioThemes.applyTheme === "function") {
      PortfolioThemes.applyTheme(document.documentElement, themeId);
    }
    var name = String(d.name != null ? d.name : "").trim() || "Your Name";
    var title = String(d.title != null ? d.title : "").trim() || "Developer";
    var about = String(d.about != null ? d.about : "");

    var nameEl = document.querySelector(".js-hero-name");
    if (nameEl) nameEl.textContent = name;

    var titleEl = document.querySelector(".js-hero-title");
    if (titleEl) titleEl.textContent = title;

    var roleEl = document.querySelector(".js-about-role");
    if (roleEl) roleEl.textContent = title;

    document.title = name + " | " + title;

    var meta = document.querySelector('meta[name="description"]');
    if (meta && about) {
      var flat = about.replace(/\s+/g, " ").trim();
      if (flat) {
        var snippet = flat.slice(0, 155);
        meta.setAttribute(
          "content",
          snippet + (flat.length > 155 ? "…" : "")
        );
      }
    }

    var hi = String(d.heroIntro != null ? d.heroIntro : "").trim();
    var hs = String(d.heroStack != null ? d.heroStack : "").trim();
    var introEl = document.querySelector(".js-hero-intro");
    var stackEl = document.querySelector(".js-hero-stack");
    if (introEl) {
      introEl.innerHTML = hi
        ? nl2brEscaped(hi)
        : about.trim()
          ? nl2brEscaped(about.split(/\n\n+/)[0] || "")
          : "";
    }
    if (stackEl) {
      stackEl.innerHTML = hs
        ? nl2brEscaped(hs)
        : about.trim()
          ? nl2brEscaped(
              about.split(/\n\n+/).slice(1).join("\n\n").trim() || ""
            )
          : "";
    }

    var parts = about
      .split(/\n\n+/)
      .map(function (p) {
        return p.trim();
      })
      .filter(Boolean);
    var aboutBody = document.querySelector(".js-about-body");
    if (aboutBody) {
      aboutBody.innerHTML = parts.length
        ? parts
            .map(function (p) {
              return "<p>" + nl2brEscaped(p) + "</p>";
            })
            .join("")
        : about.trim()
          ? "<p>" + nl2brEscaped(about) + "</p>"
          : "";
    }

    var himg = document.querySelector(".js-hero-photo");
     var heroWrap = document.querySelector(".hero-right");
    if (himg && d.heroImage) setImageWithLoader(himg, heroWrap, d.heroImage);
    var abimg = document.querySelector(".js-about-photo");
    var aboutWrap = document.querySelector(".about-photo-wrap");
    if (abimg && d.aboutImage) setImageWithLoader(abimg, aboutWrap, d.aboutImage);
    var cvEl = document.querySelector(".js-cv-download");
    if (cvEl) {
      var cvPath = String(d.cvUrl != null ? d.cvUrl : "").trim();
      if (cvPath) {
        cvEl.href = cvPath;
        cvEl.style.display = "inline-flex";
        if (/^https?:\/\//i.test(cvPath)) {
          cvEl.removeAttribute("download");
        } else {
          cvEl.setAttribute("download", "");
        }
      } else {
        cvEl.style.display = "none";
        cvEl.href = "#";
        cvEl.removeAttribute("download");
      }
    }

    var skills = Array.isArray(d.skills) ? d.skills : [];
    var skillsRoot = document.getElementById("skills-root");
    if (skillsRoot) {
      var ICONS = [
        "fa-pen-nib",
        "fa-rocket",
        "fa-code",
        "fa-sitemap",
        "fa-database",
        "fa-arrow-right-to-bracket",
      ];
      skillsRoot.innerHTML = skills
        .map(function (sk, i) {
          var s =
            typeof sk === "string"
              ? { title: sk, description: "" }
              : sk && typeof sk === "object"
                ? sk
                : {};
          var icon = ICONS[i % ICONS.length];
          return (
            '<article class="card fade-on"><i class="fa-solid ' +
            icon +
            '" aria-hidden="true"></i><h3>' +
            escapeHtml(s.title || "") +
            "</h3><p>" +
            nl2brEscaped(s.description || "") +
            '</p><a href="#projects" class="read-more">See more</a></article>'
          );
        })
        .join("");
    }

    var projects = Array.isArray(d.projects) ? d.projects : [];
    var projectsRoot = document.getElementById("projects-root");
    if (projectsRoot) {
      projectsRoot.innerHTML = projects
        .map(function (p, i) {
          var proj = p && typeof p === "object" ? p : {};
          var badge = escapeHtml(proj.badge || "Project");
          var pt = escapeHtml(proj.title || "");
          var desc = nl2brEscaped(proj.description || "");
          var link = String(proj.link != null ? proj.link : "").trim();
          var imgPath = String(proj.image != null ? proj.image : "").trim();
          var imgTag = imgPath
            ? '<img class="project-img" src="' +
              escapeAttr(imgPath) +
              '" alt="" width="640" height="350" loading="lazy" decoding="async">'
            : '<div class="project-img project-img-placeholder" role="presentation"></div>';
          var cta = link
            ? '<a href="' +
              escapeAttr(link) +
              '" class="project-link" target="_blank" rel="noopener noreferrer" aria-label="Open project"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>'
            : '<span class="project-link project-link-disabled" aria-label="Demo link coming soon"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span>';
          var info =
            '<div class="project-info"><h3>' +
            badge +
            '</h3><h4 class="project-name">' +
            pt +
            "</h4><p>" +
            desc +
            "</p>" +
            cta +
            "</div>";
          if (i % 2 === 0) {
            return (
              '<article class="card fade-on reverse">' + info + imgTag + "</article>"
            );
          }
          return '<article class="card fade-on">' + imgTag + info + "</article>";
        })
        .join("");
    }

    var logoMain = document.querySelector(".js-logo-main");
    var logoAcc = document.querySelector(".js-logo-accent");
    var hyph = document.querySelector(".logo-hyphen");
    var lm = String(d.logoMain != null ? d.logoMain : "").trim();
    var la = String(d.logoAccent != null ? d.logoAccent : "").trim();
    if (logoMain && logoAcc) {
      if (lm || la) {
        logoMain.textContent = lm || name.split(/\s+/).filter(Boolean)[0] || name;
        logoAcc.textContent = la;
        if (hyph) hyph.style.display = la ? "" : "none";
      } else {
        var tp = name.trim().split(/\s+/).filter(Boolean);
        if (tp.length >= 2) {
          logoMain.textContent = tp[0];
          logoAcc.textContent = tp[tp.length - 1].slice(0, 2);
          if (hyph) hyph.style.display = "";
        } else {
          logoMain.textContent = name;
          logoAcc.textContent = "";
          if (hyph) hyph.style.display = "none";
        }
      }
    }

    document.querySelectorAll(".js-footer-name").forEach(function (el) {
      el.textContent = name;
    });

    var h = d.header || {};
    document.querySelectorAll(".js-social-header").forEach(function (a) {
      var k = a.getAttribute("data-social");
      if (k === "facebook") setLink(a, h.facebook);
      else if (k === "instagram") setLink(a, h.instagram);
      else if (k === "messenger") setLink(a, h.messenger);
    });

    var f = d.footer || {};
    var tag = document.querySelector(".js-footer-tagline");
    if (tag && f.tagline != null) tag.textContent = f.tagline;
    var em = document.querySelector(".js-footer-email");
    if (em && f.email != null) {
      em.textContent = f.email;
      em.href = "mailto:" + String(f.email).trim();
    }
    var ph = document.querySelector(".js-footer-phone");
    if (ph && f.phone != null) {
      ph.textContent = f.phone;
      ph.href = "tel:" + String(f.phone).replace(/\s/g, "");
    }
    var loc = document.querySelector(".js-footer-location");
    if (loc && f.location != null) loc.textContent = f.location;

    var fsRoot = document.getElementById("footer-services-root");
    if (fsRoot && Array.isArray(f.services)) {
      fsRoot.innerHTML = f.services
        .map(function (s) {
          return "<li>" + escapeHtml(s) + "</li>";
        })
        .join("");
    }

    var soc = f.social || {};
    document.querySelectorAll(".js-social-footer").forEach(function (a) {
      var k = a.getAttribute("data-social");
      if (soc[k] != null) setLink(a, soc[k]);
    });

    var yr = document.querySelector(".js-footer-copy-year");
    if (yr && f.copyrightYear != null) {
      yr.textContent = "© " + String(f.copyrightYear).trim();
    }
  }

  function initFaders() {
    var faders = document.querySelectorAll(".fade-on");
    var appearOnScroll = new IntersectionObserver(
      function (entries, observer) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("show");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -5% 0px" }
    );
    faders.forEach(function (fader) {
      appearOnScroll.observe(fader);
    });
  }

  async function boot() {
    bindImageLoading(document.querySelector(".js-hero-photo"), document.querySelector(".hero-right"));
    bindImageLoading(document.querySelector(".js-about-photo"), document.querySelector(".about-photo-wrap"));
    try {
      var data = await loadPortfolioData();
      applyPortfolio(data);
    } catch (e) {
      console.warn("Portfolio:", e);
    }

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

    initFaders();

    var newsletterForm = document.querySelector(".newsletter-form");
    if (newsletterForm) {
      newsletterForm.addEventListener("submit", function (e) {
        e.preventDefault();
      });
    }
  }

  boot();
})();
