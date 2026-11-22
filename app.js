(function () {
  var root = document.documentElement;
  var I = window.I18N;
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  /* ---------- Rolling words (slot roll) ---------- */
  var Roll = (function () {
    var box = document.querySelector(".roll");
    if (!box) return { set: function () {}, spin: function () {} };
    var win = box.querySelector(".roll-win"), list = box.querySelector(".roll-list"),
        sr = document.getElementById("roll-sr");
    var words = [], n = 0, pos = 0, timer = null, HOLD = 2800, items = [];
    function lh() { return items[0] ? items[0].getBoundingClientRect().height : 0; }
    function move(p, dur, ease) {
      pos = p;
      list.style.transition = dur ? "transform " + dur + "ms " + ease : "none";
      list.style.transform = "translateY(" + (-p * lh()) + "px)";
      var w = items[p] ? items[p].firstChild.getBoundingClientRect().width : 0;
      win.style.transition = dur ? "width " + Math.min(dur, 600) + "ms cubic-bezier(.2,.7,.2,1)" + (dur > 700 ? " " + (dur - 600) + "ms" : "") : "none";
      win.style.width = Math.ceil(w) + "px";
    }
    function next() {
      clearTimeout(timer);
      timer = setTimeout(function () {
        move(pos + 1, 650, "cubic-bezier(.7,0,.2,1)");
        timer = setTimeout(function () {
          if (pos >= 3 * n) move(pos - n, 0);
          next();
        }, 680);
      }, HOLD);
    }
    function set(ws) {
      words = ws; n = ws.length; list.innerHTML = ""; items = [];
      for (var k = 0; k < 4; k++) ws.forEach(function (w) {
        var li = document.createElement("span"); li.className = "roll-item";
        var t = document.createElement("span"); t.textContent = w; li.appendChild(t);
        list.appendChild(li); items.push(li);
      });
      if (sr) sr.textContent = ws.join(", ");
      fit();
    }
    // Если самое длинное слово не влезает в строку рядом с «Делаю ролики, которые» —
    // всегда переносим слово на отдельную строку, чтобы высота блока не менялась и страница не дёргалась
    var pre = box.querySelector(".roll-pre");
    function fit() {
      if (!items.length) return;
      box.classList.remove("stack");
      var max = 0;
      for (var i = 0; i < n; i++) max = Math.max(max, items[i].firstChild.getBoundingClientRect().width);
      var gap = parseFloat(getComputedStyle(box).columnGap) || 0;
      if (pre.getBoundingClientRect().width + gap + max + 2 > box.clientWidth) box.classList.add("stack");
    }
    var rt; addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(fit, 120); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    function spin() {
      clearTimeout(timer);
      if (reduce) { move(2 * n, 0); return; }
      move(0, 0); void list.offsetWidth;
      box.classList.add("spinning");
      requestAnimationFrame(function () {
        move(2 * n, 1800, "cubic-bezier(.12,.62,.08,1)");
        timer = setTimeout(function () { box.classList.remove("spinning"); next(); }, 1800);
      });
    }
    return { set: set, spin: spin };
  })();

  /* ---------- Timeline (hero) ---------- */
  var TL = (function () {
    var tl = document.querySelector(".tl");
    if (!tl) return { replay: function () {}, start: function () {} };
    var grid = tl.querySelector(".tl-grid"), tc = tl.querySelector(".tl-tc");
    var clips = [].slice.call(tl.querySelectorAll(".clip")).map(function (c) {
      return { el: c, x: parseFloat(c.style.getPropertyValue("--x")) / 100, w: parseFloat(c.style.getPropertyValue("--w")) / 100 };
    });
    // waveform
    var wave = tl.querySelector(".wave"), d = "", seed = 7;
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    for (var i = 0; i < 200; i++) {
      var env = 0.35 + 0.65 * Math.abs(Math.sin(i / 9) * Math.cos(i / 23));
      var h = Math.max(1.2, env * (4 + rnd() * 14)); d += "M" + (i * 2 + 1) + " " + (10 - h / 2) + "v" + h;
    }
    if (wave) wave.innerHTML = '<path d="' + d + '"/>';
    var p = 0, last = null, scrub = false, on = false, visible = true, LOOP = 10000, FR = 30 * 24;
    function render() {
      grid.style.setProperty("--p", p.toFixed(4));
      var f = Math.floor(p * FR);
      tc.textContent = "00:00:" + pad(Math.floor(f / 24)) + ":" + pad(f % 24);
      clips.forEach(function (c) { c.el.classList.toggle("hot", p >= c.x && p <= c.x + c.w); });
    }
    function tick(t) {
      if (last == null) last = t;
      var dt = Math.min(64, t - last); last = t;
      if (on && !scrub && visible && !document.hidden) { p = (p + dt / LOOP) % 1; render(); }
      requestAnimationFrame(tick);
    }
    grid.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse") return;
      var r = grid.getBoundingClientRect(), g = 30;
      scrub = true; p = Math.max(0, Math.min(0.999, (e.clientX - r.left - g) / (r.width - g))); render();
    });
    grid.addEventListener("pointerleave", function () { scrub = false; });
    if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(tl);
    function replay() {
      tl.classList.remove("in"); void tl.offsetWidth; tl.classList.add("in");
      p = 0; render();
    }
    function start() { replay(); if (!reduce) { on = true; requestAnimationFrame(tick); } }
    render();
    return { replay: replay, start: start };
  })();

  /* ---------- Language ---------- */
  function getLang() {
    var q = new URLSearchParams(location.search).get("lang");
    if (q === "en" || q === "ru") return q;
    try { var s = localStorage.getItem("ksh-lang"); if (s) return s; } catch (e) {}
    return "ru";
  }
  // неразрывный пробел после коротких слов, чтобы «с», «и», «в» не висели в конце строки
  var SHORT = /(^|[\s(«])(в|во|с|со|и|а|к|ко|о|об|у|на|по|за|до|не|из|от|для|без|но|я|a|I|to|of|in|and|the|with)\s+/gi;
  function typo(t) { return t.replace(SHORT, "$1$2\u00A0").replace(SHORT, "$1$2\u00A0"); }
  function apply(lang) {
    var dict = I[lang] || I.ru;
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var k = el.getAttribute("data-i18n"); if (typeof dict[k] === "string") el.textContent = typo(dict[k]);
    });
    document.querySelectorAll(".lang button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
    });
    document.querySelector(".lang").dataset.active = lang;
    root.lang = lang;
    document.querySelectorAll(".thumb").forEach(function (t) { t.setAttribute("aria-label", dict["video.play"]); });
    document.querySelectorAll(".thumb .watch span").forEach(function (t) { t.textContent = dict["video.play"]; });
    document.querySelectorAll(".ph b").forEach(function (p) { p.textContent = dict["video.soon"]; });
    document.querySelector(".lb-close").setAttribute("aria-label", dict["video.close"]);
    Roll.set(dict["roll.words"]);
  }
  var lang = getLang();
  document.querySelectorAll(".lang button").forEach(function (b) {
    b.addEventListener("click", function () {
      if (b.dataset.lang === lang) return;
      lang = b.dataset.lang;
      try { localStorage.setItem("ksh-lang", lang); } catch (e) {}
      document.body.classList.add("swapping");
      setTimeout(function () {
        apply(lang); document.body.classList.remove("swapping");
        Roll.spin(); TL.replay();
      }, 180);
    });
  });

  /* ---------- Work thumbnails + lightbox ---------- */
  var PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5Z"/></svg>';
  function fmt(s) { s = Math.round(s); return Math.floor(s / 60) + ":" + pad(s % 60); }
  var canHover = window.matchMedia && matchMedia("(hover:hover)").matches;
  document.querySelectorAll(".thumb").forEach(function (t) {
    var src = t.dataset.src, poster = t.dataset.poster;
    var v = document.createElement("video");
    v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute("playsinline", ""); v.preload = "metadata";
    var s = document.createElement("source"); s.src = src + "#t=0.1"; s.type = "video/mp4";
    s.addEventListener("error", function () { t.classList.add("missing"); t.disabled = true; });
    v.appendChild(s);
    // Обложка: показываем своей картинкой поверх видео (атрибут poster браузер прячет, как только загрузит кадр)
    var pimg = document.createElement("img"); pimg.className = "poster"; pimg.alt = ""; pimg.decoding = "async";
    var cv = null;
    if (t.classList.contains("v")) {
      cv = document.createElement("canvas"); cv.className = "bg"; cv.width = 36; cv.height = 64; t.appendChild(cv);
      v.addEventListener("loadeddata", function () {
        if (t.classList.contains("has-poster")) return;
        try { cv.getContext("2d").drawImage(v, 0, 0, 36, 64); t.classList.add("has-bg"); } catch (e) {}
      }, { once: true });
    }
    if (poster) {
      var base = poster.replace(/\.[a-z0-9]+$/i, "");
      var alt = base.replace(/^videos\//, "images/"), tries = [];
      [base, alt].forEach(function (b) { [".jpg", ".jpeg", ".png", ".webp", ".JPG", ".JPEG", ".PNG"].forEach(function (e) { tries.push(b + e); }); });
      (function next() {
        if (!tries.length) return;
        var u = tries.shift(), im = new Image();
        im.onload = function () {
          pimg.src = u; t.dataset.posterOk = u; t.classList.add("has-poster");
          if (cv) { try { var c = cv.getContext("2d"); c.drawImage(im, 0, 0, 36, 64); t.classList.add("has-bg"); } catch (e) {} }
        };
        im.onerror = next; im.src = u;
      })();
    }
    var dur = document.createElement("span"); dur.className = "dur";
    v.addEventListener("loadedmetadata", function () { if (isFinite(v.duration)) { dur.textContent = fmt(v.duration); t.classList.add("has-dur"); } });
    var w = document.createElement("span"); w.className = "watch"; w.innerHTML = PLAY + "<span></span>";
    var ph = document.createElement("span"); ph.className = "ph"; ph.innerHTML = "<b></b>";
    t.appendChild(v); t.appendChild(pimg); t.appendChild(w); t.appendChild(dur); t.appendChild(ph);
    if (canHover) {
      v.addEventListener("playing", function () { if (t.matches(":hover")) t.classList.add("previewing"); });
      t.addEventListener("pointerenter", function () { if (!t.classList.contains("missing")) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); } });
      t.addEventListener("pointerleave", function () { t.classList.remove("previewing"); v.pause(); setTimeout(function () { try { v.currentTime = 0.1; } catch (e) {} }, 350); });
    }
    t.addEventListener("click", function () { if (!t.classList.contains("missing")) { v.pause(); t.classList.remove("previewing"); openLB(src, t.dataset.format, t.dataset.posterOk); } });
  });

  var lb = document.getElementById("lb"), lbv = lb.querySelector("video"), lastFocus = null;
  function openLB(src, format, poster) {
    lastFocus = document.activeElement;
    lb.classList.remove("h", "v"); lb.classList.add(format === "v" ? "v" : "h");
    if (poster) lbv.poster = poster; else lbv.removeAttribute("poster");
    lbv.preload = "auto"; lbv.src = src; lbv.currentTime = 0;
    var pr = lbv.play(); if (pr && pr.catch) pr.catch(function () {});
    lb.classList.add("open"); lb.setAttribute("aria-hidden", "false");
    document.body.classList.add("lb-lock");
    lb.querySelector(".lb-close").focus({ preventScroll: true });
  }
  function closeLB() {
    if (!lb.classList.contains("open")) return;
    lb.classList.remove("open"); lb.setAttribute("aria-hidden", "true");
    document.body.classList.remove("lb-lock");
    lbv.pause();
    setTimeout(function () { if (!lb.classList.contains("open")) { lbv.removeAttribute("src"); lbv.load(); } }, 320);
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }
  lb.querySelector(".lb-back").addEventListener("click", closeLB);
  lb.querySelector(".lb-close").addEventListener("click", closeLB);
  addEventListener("keydown", function (e) { if (e.key === "Escape") closeLB(); });

  apply(lang);

  /* ---------- Card spotlight ---------- */
  document.querySelectorAll(".card").forEach(function (c) {
    c.addEventListener("pointermove", function (e) {
      var r = c.getBoundingClientRect();
      c.style.setProperty("--mx", (e.clientX - r.left) + "px");
      c.style.setProperty("--my", (e.clientY - r.top) + "px");
    });
  });

  /* ---------- Nav state ---------- */
  var nav = document.querySelector(".nav");
  function onScroll() { nav.classList.toggle("scrolled", scrollY > 8); }
  addEventListener("scroll", onScroll, { passive: true }); onScroll();
  var links = {};
  document.querySelectorAll(".links a").forEach(function (a) { links[a.getAttribute("href").slice(1)] = a; });
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) Object.keys(links).forEach(function (k) { links[k].classList.toggle("active", k === e.target.id); });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(links).forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
    new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) Object.keys(links).forEach(function (k) { links[k].classList.remove("active"); });
    }, { rootMargin: "-45% 0px -50% 0px" }).observe(document.querySelector(".hero"));
  }

  /* ---------- Opening: calm focus-pull reveal ---------- */
  function ready() {
    root.classList.add("ready");
    setTimeout(function () { TL.start(); }, reduce ? 0 : 700);
    setTimeout(function () { Roll.spin(); }, reduce ? 0 : 900);
  }
  requestAnimationFrame(function () { requestAnimationFrame(ready); });
})();
