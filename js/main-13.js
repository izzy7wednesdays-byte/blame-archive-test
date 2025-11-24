/* ========= MAIN INITIALIZATION ========= */
/* ==================================================== */
/* --------- V10.0 GIF/WebP animation offscreen swap  ----------- */
/* ==================================================== */

document.addEventListener("DOMContentLoaded", () => {

  // Pause all <audio> elements in .slot--audio, except optional one
  function pauseAllHtmlAudio(exceptAudio) {
    document.querySelectorAll(".slot--audio audio").forEach(a => {
      if (a !== exceptAudio) {
        try { a.pause(); } catch (e) {}
      }
    });
  }
  
  // Pause the single shared SC widget + any legacy widgets
  function pauseAllSc() {
    if (window.__scSingleWidget) {
      try { window.__scSingleWidget.pause(); } catch (e) {}
    }
    if (Array.isArray(window.__scWidgets)) {
      window.__scWidgets.forEach(w => {
        try { w.pause(); } catch (e) {}
      });
    }
  }

  /* ===== 1. Horizontal scroll wheel behavior ===== */
  const hwrap = document.getElementById("hwrap");
  if (hwrap) {
    hwrap.addEventListener("wheel", e => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        hwrap.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    }, { passive: false });
  }

   /* ===== 1.2 Lazy-load Lotties (opt-in only) ===== */
  (function initLazyLotties() {
    // If the browser is too old, just let Lotties load normally.
    if (!("IntersectionObserver" in window)) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;

        const el = entry.target;
        const src = el.getAttribute("data-lottie-src");
        if (src) {
          // When near the viewport, actually load the Lottie file.
          el.setAttribute("src", src);
          el.removeAttribute("data-lottie-src");
        }

        io.unobserve(el);
      });
    }, {
      root: null,
      rootMargin: "100% 0px 100% 0px", // start ~1 viewport away
      threshold: 0.01
    });

    // Only Lotties that *explicitly* opt in via data-lottie-src are observed.
    // Query once and cache
    const lottieElements = document.querySelectorAll("dotlottie-wc[data-lottie-src]");
    lottieElements.forEach(el => io.observe(el));
  })();

    /* ===== 1.3 Lazy-load external frames (opt-in only) ===== */
  (function initLazyFrames() {
    // If the browser is too old, let everything load normally.
    if (!("IntersectionObserver" in window)) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;

        // Handle iframes (YouTube / Vimeo)
        if (el.tagName === "IFRAME") {
          const src = el.getAttribute("data-lazy-src");
          if (src) {
            el.setAttribute("src", src);
            el.removeAttribute("data-lazy-src");
          }
        }

        // OPTIONAL: handle images/GIFs if you opt them in later
        if (el.tagName === "IMG") {
          const src = el.getAttribute("data-lazy-src");
          if (src) {
            el.setAttribute("src", src);
            el.removeAttribute("data-lazy-src");
          }
        }

        io.unobserve(el);
      });
    }, {
      root: null,
      rootMargin: "100% 0px 100% 0px", // start loading ~1 viewport away
      threshold: 0.01
    });

    // Only iframes you explicitly mark with data-lazy-src are observed
    const lazyIframes = document.querySelectorAll("iframe[data-lazy-src]");
    lazyIframes.forEach(el => io.observe(el));

    // OPTIONAL: only images you mark with data-lazy-src will be handled
    const lazyImages = document.querySelectorAll("img[data-lazy-src]");
    lazyImages.forEach(el => io.observe(el));
  })();

  /* ===== 2. SoundCloud image-controlled player ===== */
  (function initSCController() {
    const SC_SCRIPT_SRC = 'https://w.soundcloud.com/player/api.js';
    const iframe = document.getElementById('sc-player-iframe');
    if (!iframe) {
      console.warn('[SC] Missing hidden #sc-player-iframe (index.html step not applied?)');
      return;
    }

    // Lazy-load SC script once
    function loadSC() {
      if (window.__scWidgetScriptLoaded) return Promise.resolve();
      return new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = SC_SCRIPT_SRC;
        s.async = true;
        s.onload = () => { window.__scWidgetScriptLoaded = true; res(); };
        s.onerror = rej;
        document.head.appendChild(s);
      });
    }

    // Shared widget state
    let widget = null;          // SC.Widget instance (created once)
    let initialized = false;    // iframe  pointed at SC at least once
    let currentUrl = null;      // currently loaded track
    let busy = false;           // debounce fast double taps

    async function ensureWidget(firstUrl) {
      await loadSC();
      if (!initialized) {
        // First point to the player shell (no autoplay on init)
        iframe.src =
          `https://w.soundcloud.com/player/?url=${encodeURIComponent(firstUrl)}&auto_play=false&show_teaser=false`;
        widget = window.SC.Widget(iframe);

        // Expose a tiny handle so Vimeo can pause it
        window.__scSingleWidget = widget;

        // Optional: basic diagnostics
        widget.bind(window.SC.Widget.Events.ERROR, e => console.warn('[SC] widget error:', e));
        initialized = true;
      }
      return widget;
    }

  // Click behavior on any SoundCloud trigger
  document.addEventListener('click', async (e) => {
    // Accept both new and legacy trigger classes
    const trigger = e.target.closest('.sc-trigger, .lottie-sc-trigger');
    if (!trigger) return;
  
    // 1) New architecture: data-sc-url on the trigger itself
    let trackUrl = (trigger.dataset.scUrl || '').trim();
  
    // 2) Legacy fallback: inside a .slot--sc wrapper with data-sc-url
    if (!trackUrl) {
      const slot = trigger.closest('.slot--sc');
      if (!slot) return;
      trackUrl = (slot.dataset.scUrl || '').trim();
    }
  
    if (!trackUrl || busy) return;
  
    e.preventDefault();
    e.stopPropagation();
  
    busy = true;
    try {
      const w = await ensureWidget(trackUrl);
  
      if (currentUrl && trackUrl === currentUrl) {
        // === Same track: toggle play/pause ===
        try {
          w.isPaused((paused) => {
            if (paused) {
              // Was paused → about to play: pause other audio + videos
              pauseAllHtmlAudio();
              pauseAllSc();
              if (Array.isArray(window.__vimeoPlayers)) {
                window.__vimeoPlayers.forEach(p => {
                  try { p.pause(); } catch (e) {}
                });
              }
              w.play();
            } else {
              // Was playing → pause on second click
              w.pause();
            }
          });
        } catch (err) {
          console.warn("[SC] isPaused() failed, falling back to play()", err);
          w.play();
        }
      } else {
        // === New track: switch + play, while stopping other audio ===
        pauseAllHtmlAudio();
        pauseAllSc();
        if (Array.isArray(window.__vimeoPlayers)) {
          window.__vimeoPlayers.forEach(p => {
            try { p.pause(); } catch (e) {}
          });
        }
  
        currentUrl = trackUrl;
        w.load(trackUrl, { auto_play: true, show_teaser: false });
      }
    } finally {
      setTimeout(() => { busy = false; }, 200);
    }
  }, { passive: false });

  })();

  /* ===== 3. Voice Memo (image-controlled audio) ===== */
  // Cache audio slots query
  const audioSlots = document.querySelectorAll(".slot--audio");
  audioSlots.forEach(slot => {
    const audio   = slot.querySelector("audio");
    const trigger = slot.querySelector(".audio-trigger");
    if (!audio || !trigger) return;

    const fileFromDataAttr = (slot.dataset.audioSrc || "").trim();
    if (fileFromDataAttr) {
      audio.src = fileFromDataAttr;
    }

    audio.preload = "auto";
    audio.setAttribute("playsinline", "");

    function syncUI() {
      const isPlaying = !audio.paused && !audio.ended;
      slot.classList.toggle("is-playing", isPlaying);
      trigger.setAttribute("aria-pressed", isPlaying ? "true" : "false");
    }

    trigger.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();

      // If this one is currently playing → pause on click #2
      if (!audio.paused && !audio.ended) {
        audio.pause();
        syncUI();
        return;
      }

      // Otherwise pause all other audio + SC and play this one
      pauseAllHtmlAudio(audio);
      pauseAllSc();

      const playAttempt = audio.play();

      if (playAttempt && typeof playAttempt.catch === "function") {
        playAttempt.catch(err => {
          console.warn("[VoiceMemo] play() was blocked:", err);
        });
      }

      syncUI();
    });

    audio.addEventListener("play",  syncUI);
    audio.addEventListener("pause", syncUI);
    audio.addEventListener("ended", syncUI);

    audio.addEventListener("error", () => {
      console.warn("[VoiceMemo] audio error", {
        src: audio.currentSrc,
        error: audio.error
      });
    });

    syncUI();
  });

/* ===== 3.5 Vimeo single-play controller ===== */
(function initVimeoPlayers() {
  try {
    if (typeof Vimeo === "undefined" || !Vimeo.Player) {
      console.warn("[Vimeo] API not ready — retrying...");
      setTimeout(initVimeoPlayers, 300);
      return;
    }

    // Keep a list of all Vimeo players so we can pause others
    window.__vimeoPlayers = [];

    document.querySelectorAll("iframe.video-iframe").forEach(iframe => {
      // Only touch real Vimeo embeds
      const src =
        iframe.getAttribute("src") ||
        iframe.getAttribute("data-lazy-src") ||
        "";

      if (!src.includes("player.vimeo.com")) {
        // Not a Vimeo embed → skip it
        return;
      }

      let player;
      try {
        player = new Vimeo.Player(iframe);
      } catch (err) {
        console.warn("[Vimeo] Skipping non-Vimeo iframe", iframe, err);
        return;
      }

      window.__vimeoPlayers.push(player);

      player.on("play", () => {
        // Consolidated: pause all other audio sources efficiently
        // 1) Pause all other Vimeo players
        window.__vimeoPlayers.forEach(other => {
          if (other !== player) {
            try { other.pause(); } catch (err) {}
          }
        });

        // 2 & 3) Pause SoundCloud
        pauseAllSc();

        // 4) Pause any HTML <audio> elements (voice memos, etc.)
        pauseAllHtmlAudio();
      });
    });
  } catch (err) {
    console.error("[Vimeo] initVimeoPlayers crashed:", err);
  }
})();

/* ===== GIF placeholders → GIF Play ===== */
(function initGifPlaceholders() {
  const gifImgs = Array.from(
    document.querySelectorAll("img[data-gif-src]")
  );
  if (!gifImgs.length) return;

  if (!("IntersectionObserver" in window)) {
    gifImgs.forEach(img => {
      const gifSrc = img.getAttribute("data-gif-src");
      if (gifSrc) img.src = gifSrc;
    });
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const img = entry.target;
      const gifSrc = img.dataset.gifSrc;
      const staticSrc = img.dataset.staticSrc;

      if (entry.isIntersecting) {
        if (img.src !== gifSrc) img.src = gifSrc;
      } else {
        if (staticSrc && img.src !== staticSrc) img.src = staticSrc;
      }
    });
  }, {
    threshold: 0.15
  });

  gifImgs.forEach(img => observer.observe(img));
})();

/* ===== Modal Overlay System ===== */
(function () {

  const body = document.body;

  function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;

    modal.classList.remove("hidden");
    body.classList.add("modal-open");
  }

  function closeModal(modal) {
    if (!modal) return;

    modal.classList.add("hidden");
    body.classList.remove("modal-open");
  }

  // OPEN
  document.addEventListener("click", (e) => {
    const trigger = e.target.closest(".open-modal[data-modal]");
    if (!trigger) return;

    e.preventDefault();
    const modalId = trigger.dataset.modal;
    openModal(modalId);
  });

  // CLOSE
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".close-modal");
    if (!btn) return;

    const modal = btn.closest(".modal");
    closeModal(modal);
  });

  // CLICK BACKDROP
  document.addEventListener("click", (e) => {
    const modal = e.target.classList.contains("modal")
      ? e.target
      : null;

    // only close if clicking the backdrop, not inside modal-content
    if (modal && !e.target.closest(".modal-content")) {
      closeModal(modal);
    }
  });

  // ESC KEY
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal:not(.hidden)").forEach((m) => {
        closeModal(m);
      });
    }
  });

})();

});
