/* ========= MAIN INITIALIZATION ========= */
/* ==================================================== */
/* --------- V11.0 GIF/WebP animation offscreen swap  ----------- */
/* ==================================================== */

document.addEventListener("DOMContentLoaded", () => {

  /* ===== Shared helpers (SC + HTML audio + Vimeo) ===== */

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

/* ===== 1.4 Lottie offscreen pause/resume =====
  (function initLottieVisibility() {
    if (!("IntersectionObserver" in window)) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const el = entry.target;
      
        // Skip auto-play/pause for Lotties that opt out
        if (el.hasAttribute("data-no-pause")) return;
      
        const isVisible = entry.isIntersecting && entry.intersectionRatio > 0.01;

        try {
          // dotlottie-wc exposes play()/pause() in most builds
          if (isVisible) {
            if (typeof el.play === "function") {
              el.play();
            }
          } else {
            if (typeof el.pause === "function") {
              el.pause();
            }
          }
        } catch (err) {
          console.warn("[Lottie] play/pause failed for", el, err);
        }
      });
    }, {
      root: null,
      threshold: 0.01
    });

    // Observe ALL Lotties, lazy or not
    document.querySelectorAll("dotlottie-wc").forEach(el => io.observe(el));
  })();  */

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

  /* ===== 2. SoundCloud image-controlled player (Option B: single hidden iframe) ===== */
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
    let initialized = false;    // iframe has been pointed at SC at least once
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

    // Click behavior on any .sc-trigger inside .slot--sc
    document.addEventListener('click', async (e) => {
      const trigger = e.target.closest('.sc-trigger');
      if (!trigger) return;

      const slot = trigger.closest('.slot--sc');
      // NEW: if this click is NOT inside a SoundCloud slot, ignore it completely
      if (!slot) return;

      const trackUrl = (slot.dataset.scUrl || '').trim();
      if (!trackUrl || busy) return;

      e.preventDefault();
      e.stopPropagation();

      busy = true;
      try {
        const w = await ensureWidget(trackUrl);

        if (currentUrl && trackUrl === currentUrl) {
          // === Same track: *toggle* the current state ===
          try {
            w.isPaused((paused) => {
              if (paused) {
                // Was paused → about to play: pause other audio + videos
                pauseAllHtmlAudio();
                pauseAllSc();
                if (Array.isArray(window.__vimeoPlayers)) {
                  window.__vimeoPlayers.forEach(p => { try { p.pause(); } catch (e) {} });
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
            window.__vimeoPlayers.forEach(p => { try { p.pause(); } catch (e) {} });
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

    document.querySelectorAll(".slot--video iframe").forEach(iframe => {
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
  
/* ===== LOTTIE PLACEHOLDERS: London TV + Play Light Sleeper ===== */
(function initHeavyLottiePlaceholders() {
  if (!("IntersectionObserver" in window)) return;

  const ids = ["london-tv", "play-lightsleeper"];
  const slots = ids
    .map(id => document.getElementById(id))
    .filter(Boolean);

  if (!slots.length) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const slot = entry.target;
      const visible = entry.isIntersecting && entry.intersectionRatio > 0.1;
      slot.classList.toggle("is-lottie-active", visible);
    });
  }, {
    root: null,
    rootMargin: "0px 0px 0px 0px",
    threshold: 0.1
  });

  slots.forEach(slot => io.observe(slot));
})();

/* ===== 4.2 GIF/WebP animation offscreen swap ===== */
  (function initGifVisibility() {
    if (!("IntersectionObserver" in window)) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const img = entry.target;
        const fullSrc = img.getAttribute("data-gif-src");
        const placeholder = img.getAttribute("data-gif-placeholder") || "";

        if (!fullSrc) return;

        const isVisible = entry.isIntersecting && entry.intersectionRatio > 0.01;

        if (isVisible) {
          // Swap to animated version if not already set
          if (img.getAttribute("src") !== fullSrc) {
            img.setAttribute("src", fullSrc);
          }
        } else {
          // Swap to placeholder (static) when offscreen, if provided
          if (placeholder && img.getAttribute("src") !== placeholder) {
            img.setAttribute("src", placeholder);
          }
        }
      });
    }, {
      root: null,
      threshold: 0.01
    });

    // Observe all GIF/WebP images that declare data-gif-src
    document.querySelectorAll("img[data-gif-src]").forEach(img => io.observe(img));
  })();

/* ===== 5. Overlay click-to-open ===== */

(function initOverlay() {
  // Grab core overlay elements
  const overlay = document.getElementById("overlay");
  if (!overlay) {
    console.warn("[Overlay] #overlay element not found in DOM");
    return;
  }

  const ovCard  = overlay.querySelector(".ov-card");
  const ovImg   = overlay.querySelector("#overlay-img");
  const ovClose = overlay.querySelector(".overlay-close");

  if (!ovCard || !ovImg) {
    console.warn("[Overlay] Missing .ov-card or #overlay-img inside #overlay");
    return;
  }

  console.log("[Overlay] Init OK: overlay elements wired");

  // Open overlay with given image + alt, optionally using slot CSS vars
  function openOverlay(src, alt, slot) {
    if (!src) {
      console.warn("[Overlay] openOverlay called without src");
      return;
    }

    ovImg.src = src;
    ovImg.alt = alt || "";

    // Copy any overlay positioning vars from the slot to the card
    if (slot) {
      const vars = ["--ov-x-top", "--ov-x-left", "--ov-x-size"];
      const slotStyles = getComputedStyle(slot);
      vars.forEach(name => {
        const value = slotStyles.getPropertyValue(name).trim();
        if (value) {
          ovCard.style.setProperty(name, value);
        } else {
          ovCard.style.removeProperty(name);
        }
      });
    }

    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    // Optional: lock body scroll if you want
    // document.body.classList.add("overlay-open");
  }

  // Close overlay and clean up
  function closeOverlay() {
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    // document.body.classList.remove("overlay-open");

    // Let any fade-out animation run before clearing
    setTimeout(() => {
      ovImg.removeAttribute("src");
      ovImg.removeAttribute("alt");
      ["--ov-x-top", "--ov-x-left", "--ov-x-size"].forEach(name => {
        ovCard.style.removeProperty(name);
      });
    }, 180);
  }

  // Attach click handlers to every overlay-enabled slot
  const overlaySlots = document.querySelectorAll(".slot[data-overlay-src]");
  if (!overlaySlots.length) {
    console.warn("[Overlay] No .slot[data-overlay-src] elements found");
  }

  overlaySlots.forEach(slot => {
    // Make sure the whole slot feels clickable
    slot.style.cursor = "pointer";

    slot.addEventListener("click", (e) => {
      // Don't let inner elements (if any) hijack the event
      e.preventDefault();
      e.stopPropagation();

      const src = slot.getAttribute("data-overlay-src");
      if (!src) {
        console.warn("[Overlay] Slot missing data-overlay-src:", slot);
        return;
      }

      // Prefer explicit overlay alt, then inner img alt, then empty string
      const innerImg = slot.querySelector("img");
      const alt =
        slot.getAttribute("data-overlay-alt") ||
        (innerImg ? innerImg.getAttribute("alt") || "" : "");

      openOverlay(src, alt, slot);
    });
  });

  // X button closes overlay
  if (ovClose) {
    ovClose.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeOverlay();
    });
  } else {
    console.warn("[Overlay] .overlay-close not found inside #overlay");
  }

  // Clicking the dark backdrop closes overlay
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      closeOverlay();
    }
  });

  // ESC key closes overlay
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" || e.key === "Esc" || e.keyCode === 27) {
      closeOverlay();
    }
  });

})();

});
