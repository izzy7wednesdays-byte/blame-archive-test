/* ========= MAIN INITIALIZATION ========= */
/* ==================================================== */
/* --------- V7.1 - OPTIMIZING SC PT. 2 ----------- */
/* ==================================================== */

document.addEventListener("DOMContentLoaded", () => {

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

  /* ===== 2. SoundCloud image-controlled player ===== */
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
      iframe.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(firstUrl)}&auto_play=false&show_teaser=false`;
      widget = window.SC.Widget(iframe);

      // Expose a tiny handle so Vimeo can pause it
      window.__scSingleWidget = widget;

      // Optional: basic diagnostics
      widget.bind(window.SC.Widget.Events.ERROR, e => console.warn('[SC] widget error:', e));
      initialized = true;
    }
    return widget;
  }

  function pauseAllHtmlAudio(exceptAudio) {
    document.querySelectorAll(".slot--audio audio").forEach(a => {
      if (a !== exceptAudio) { try { a.pause(); } catch(e){} }
    });
  }

  // Our global SC pause used elsewhere
  function pauseAllSc() {
    try { if (widget) widget.pause(); } catch(e) {}
    // Keep compatibility with old code that loops __scWidgets
    if (Array.isArray(window.__scWidgets)) {
      window.__scWidgets.forEach(w => { try { w.pause(); } catch(e){} });
    }
  }
  window.pauseAllSc = pauseAllSc;   // expose so other modules can call if needed

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
      // Single-source audio UX: pause HTML <audio> and any other SC/Vimeo players
      pauseAllHtmlAudio();
      pauseAllSc();
      if (Array.isArray(window.__vimeoPlayers)) {
        window.__vimeoPlayers.forEach(p => { try { p.pause(); } catch(e){} });
      }

      const w = await ensureWidget(trackUrl);

      if (currentUrl && trackUrl === currentUrl) {
        // Toggle state for same track
        try {
          w.isPaused((paused) => {
            if (paused) { w.play(); } else { w.pause(); }
          });
        } catch {
          w.play();
        }
      } else {
        // Switch to new track and play
        currentUrl = trackUrl;
        w.load(trackUrl, { auto_play: true, show_teaser: false });
      }
    } finally {
      setTimeout(() => { busy = false; }, 200);
    }
  }, { passive: false });

})();

  // UPDATED: SC pause helpers that work with the single shared widget
  function pauseAllScExcept(activeWidget) {
    // If we’re using the new single shared widget
    if (window.__scSingleWidget && window.__scSingleWidget !== activeWidget) {
      try { window.__scSingleWidget.pause(); } catch(e){}
    }

    // Backwards compatibility if __scWidgets is still used anywhere
    if (Array.isArray(window.__scWidgets)) {
      window.__scWidgets.forEach(w => {
        if (w !== activeWidget) {
          try { w.pause(); } catch(e) {}
        }
      });
    }
  }

  function pauseAllSc() {
    // Pause the single shared widget if present
    if (window.__scSingleWidget) {
      try { window.__scSingleWidget.pause(); } catch(e){}
    }

    // Backwards compatibility with any old code that still uses __scWidgets
    if (Array.isArray(window.__scWidgets)) {
      window.__scWidgets.forEach(w => {
        try { w.pause(); } catch(e) {}
      });
    }
  }

  function pauseAllHtmlAudio(exceptAudio) {
    document.querySelectorAll(".slot--audio audio").forEach(a => {
      if (a !== exceptAudio) {
        a.pause();
      }
    });
  }
  
  function pauseAllHtmlAudio(exceptAudio) {
    document.querySelectorAll(".slot--audio audio").forEach(a => {
      if (a !== exceptAudio) {
        a.pause();
      }
    });
  }

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

  document.querySelectorAll(".slot--vimeo iframe.vimeo-iframe").forEach(iframe => {
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
      document.querySelectorAll(".slot--audio audio").forEach(a => {
        try { a.pause(); } catch (err) {}
      });
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

    document.querySelectorAll(".slot[data-overlay-src]").forEach(s => {
      const clickable = s.querySelector("img, dotlottie-wc") || s;

      clickable.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();

        const src = s.dataset.overlaySrc;
        const alt =
          s.dataset.overlayAlt ||
          clickable.getAttribute?.("alt") ||
          "";

        if (!src) {
          console.warn("[Overlay] Missing data-overlay-src on", s);
          return;
        }

        openOverlay(src, alt, s);
      });
    });

    if (ovClose) {
      ovClose.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        closeOverlay();
      });
    }

    overlay.addEventListener("click", e => {
      if (e.target === overlay) {
        closeOverlay();
      }
    });

    document.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        closeOverlay();
      }
    });
  } else {
    console.warn("Overlay element not found");
  }

});
