/* ========= MAIN INITIALIZATION ========= */
/* ==================================================== */
/* --------- V1.0 - Fix overlay vs. SC clicks  -------- */
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
    if (!("IntersectionObserver" in window)) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;

        const el  = entry.target;
        const src = el.getAttribute("data-lottie-src");
        if (src) {
          el.setAttribute("src", src);
          el.removeAttribute("data-lottie-src");
        }

        io.unobserve(el);
      });
    }, {
      root: null,
      rootMargin: "100% 0px 100% 0px",
      threshold: 0.01
    });

    document.querySelectorAll("dotlottie-wc[data-lottie-src]").forEach(el => io.observe(el));
  })();

  /* ===== 1.3 Lazy-load external frames (opt-in only) ===== */
  (function initLazyFrames() {
    if (!("IntersectionObserver" in window)) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;

        if (el.tagName === "IFRAME") {
          const src = el.getAttribute("data-lazy-src");
          if (src) {
            el.setAttribute("src", src);
            el.removeAttribute("data-lazy-src");
          }
        }

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
      rootMargin: "100% 0px 100% 0px",
      threshold: 0.01
    });

    document.querySelectorAll("iframe[data-lazy-src]").forEach(el => io.observe(el));
    document.querySelectorAll("img[data-lazy-src]").forEach(el => io.observe(el));
  })();

  /* ===== 2. SoundCloud image-controlled player (Option B: single hidden iframe) ===== */
  (function initSCController() {
    const SC_SCRIPT_SRC = "https://w.soundcloud.com/player/api.js";
    const iframe = document.getElementById("sc-player-iframe");
    if (!iframe) {
      console.warn("[SC] Missing hidden #sc-player-iframe (index.html step not applied?)");
      return;
    }

    // Lazy-load SC script once
    function loadSC() {
      if (window.__scWidgetScriptLoaded) return Promise.resolve();
      return new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = SC_SCRIPT_SRC;
        s.async = true;
        s.onload = () => { window.__scWidgetScriptLoaded = true; res(); };
        s.onerror = rej;
        document.head.appendChild(s);
      });
    }

    // Shared widget state
    let widget      = null;   // SC.Widget instance
    let initialized = false;  // iframe has been pointed at SC at least once
    let currentUrl  = null;   // currently loaded track
    let busy        = false;  // debounce fast double taps

    async function ensureWidget(firstUrl) {
      await loadSC();
      if (!initialized) {
        iframe.src =
          `https://w.soundcloud.com/player/?url=${encodeURIComponent(firstUrl)}&auto_play=false&show_teaser=false`;
        widget = window.SC.Widget(iframe);

        // Expose a tiny handle so Vimeo can pause it
        window.__scSingleWidget = widget;

        widget.bind(window.SC.Widget.Events.ERROR, e => {
          console.warn("[SC] widget error:", e);
        });

        initialized = true;
      }
      return widget;
    }

    // 🔁 Per-trigger click handlers instead of a global document listener
    document.querySelectorAll(".slot--sc .sc-trigger").forEach(trigger => {
      const slot = trigger.closest(".slot--sc");
      if (!slot) return;

      trigger.style.cursor = "pointer";

      trigger.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (busy) return;

        const trackUrl = (slot.dataset.scUrl || "").trim();
        if (!trackUrl) return;

        busy = true;
        try {
          const w = await ensureWidget(trackUrl);

          if (currentUrl && trackUrl === currentUrl) {
            // Same track: toggle
            try {
              w.isPaused((paused) => {
                if (paused) {
                  // about to play → pause others
                  pauseAllHtmlAudio();
                  if (Array.isArray(window.__vimeoPlayers)) {
                    window.__vimeoPlayers.forEach(p => {
                      try { p.pause(); } catch (err) {}
                    });
                  }
                  w.play();
                } else {
                  w.pause();
                }
              });
            } catch (err) {
              console.warn("[SC] isPaused() failed, falling back to play()", err);
              w.play();
            }
          } else {
            // New track: switch + play, while stopping other audio
            pauseAllHtmlAudio();
            if (Array.isArray(window.__vimeoPlayers)) {
              window.__vimeoPlayers.forEach(p => {
                try { p.pause(); } catch (err) {}
              });
            }

            currentUrl = trackUrl;
            w.load(trackUrl, { auto_play: true, show_teaser: false });
          }
        } finally {
          setTimeout(() => { busy = false; }, 200);
        }
      });
    });

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

    window.__vimeoPlayers = [];

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
      setTimeout(() => {
        ovImg.removeAttribute("src");
        ovImg.removeAttribute("alt");
        ["--ov-x-top", "--ov-x-left", "--ov-x-size"].forEach(name => {
          ovCard.style.removeProperty(name);
        });
      }, 180);
    }

    // Direct click handlers for EACH overlay slot
    document.querySelectorAll(".slot[data-overlay-src]").forEach(slot => {
      slot.style.cursor = "pointer";

      slot.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();

        const src = slot.dataset.overlaySrc;
        if (!src) {
          console.warn("[Overlay] Missing data-overlay-src on", slot);
          return;
        }

        const innerImg = slot.querySelector("img");
        const alt =
          slot.dataset.overlayAlt ||
          (innerImg ? innerImg.alt : "") ||
          "";

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

    // Clicking the dark backdrop closes overlay
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

});
