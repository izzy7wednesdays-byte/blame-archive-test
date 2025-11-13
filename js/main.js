/* ========= MAIN INITIALIZATION ========= */
/* ==================================================== */
/* --------- V7.6 - Fixing Overlay Code  ----------- */
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
    document.querySelectorAll("dotlottie-wc[data-lottie-src]").forEach(el => io.observe(el));
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
    document.querySelectorAll("iframe[data-lazy-src]").forEach(el => io.observe(el));

    // OPTIONAL: only images you mark with data-lazy-src will be handled
    document.querySelectorAll("img[data-lazy-src]").forEach(el => io.observe(el));
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
  document.querySelectorAll(".slot--audio").forEach(slot => {
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
    if (typeof Vimeo === "undefined" || !Vimeo.Player) {
      console.warn("Vimeo API not ready — retrying...");
      setTimeout(initVimeoPlayers, 300);
      return;
    }

    // Keep a list of all Vimeo players so we can pause others
    window.__vimeoPlayers = [];

    // IMPORTANT: match your actual HTML structure:
    // <figure class="slot slot--video">
    //   <div class="video-box"><iframe ...></iframe></div>
    // </figure>
    document.querySelectorAll(".slot--video iframe").forEach(iframe => {
      const player = new Vimeo.Player(iframe);
      window.__vimeoPlayers.push(player);

      player.on("play", () => {
        // 1) Pause all *other* Vimeo players
        window.__vimeoPlayers.forEach(other => {
          if (other !== player) {
            try { other.pause(); } catch (err) {}
          }
        });

        // 2) Pause the single shared SoundCloud widget (Option B)
        if (window.__scSingleWidget) {
          try { window.__scSingleWidget.pause(); } catch (err) {}
        }

        // 3) Backwards compat: pause any legacy array of SC widgets if present
        if (window.__scWidgets) {
          window.__scWidgets.forEach(w => {
            try { w.pause(); } catch (err) {}
          });
        }

        // 4) Pause any HTML <audio> elements (voice memos, etc.)
        pauseAllHtmlAudio();
      });
    });
  })();

  /* ===== 4. Local loop video init (custom <video>) ===== */
  (function initLoopVideos() {
    document.querySelectorAll(".slot--loopvideo").forEach(slot => {
      const vid = slot.querySelector(".loopvideo-el");
      if (!vid) return;

      const style = getComputedStyle(slot);

      const rateStr = style.getPropertyValue("--playback").trim();
      if (rateStr) {
        const rateNum = parseFloat(rateStr);
        if (!Number.isNaN(rateNum) && rateNum > 0) {
          vid.playbackRate = rateNum;
        }
      }

      const loopFlag = style.getPropertyValue("--do-loop").trim();
      vid.loop = (loopFlag === "1" || loopFlag === "true");

      const playAttempt = vid.play();
      if (playAttempt && typeof playAttempt.catch === "function") {
        playAttempt.catch(err => {
          console.warn("[LoopVideo] autoplay blocked", err);
        });
      }
    });
  })();

  /* ===== 5. Overlay click-to-open ===== */
  const overlay = document.getElementById("overlay");
  const ovCard  = overlay ? overlay.querySelector(".ov-card") : null;
  const ovImg   = overlay ? overlay.querySelector("#overlay-img") : null;
  const ovClose = overlay ? overlay.querySelector(".overlay-close") : null;

  if (overlay && ovCard && ovImg) {

    function openOverlay(src, alt, slot) {
      ovImg.src = src;
      ovImg.alt = alt || "";

      // Copy slot-specific overlay position variables if present
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
    }

    function closeOverlay() {
      overlay.classList.remove("is-open");
      // Let fade-out finish before clearing src/vars
      setTimeout(() => {
        ovImg.removeAttribute("src");
        ovImg.removeAttribute("alt");
        ["--ov-x-top", "--ov-x-left", "--ov-x-size"].forEach(name => {
          ovCard.style.removeProperty(name);
        });
      }, 180);
    }

    // Any slot with data-overlay-src becomes a clickable overlay trigger
    document.querySelectorAll(".slot[data-overlay-src]").forEach(slot => {
      const clickable = slot.querySelector("img, dotlottie-wc") || slot;

      clickable.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();

        const src = slot.dataset.overlaySrc;
        const alt =
          slot.dataset.overlayAlt ||
          clickable.getAttribute?.("alt") ||
          "";

        if (!src) {
          console.warn("[Overlay] Missing data-overlay-src on", slot);
          return;
        }

        openOverlay(src, alt, slot);
      });
    });

    // X button closes overlay
    if (ovClose) {
      ovClose.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        closeOverlay();
      });
    }

    // Clicking the dark backdrop closes overlay (but not clicks on the card)
    overlay.addEventListener("click", e => {
      if (e.target === overlay) {
        closeOverlay();
      }
    });

    // ESC key closes overlay
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        closeOverlay();
      }
    });

  } else {
    console.warn("Overlay element not found");
  }
