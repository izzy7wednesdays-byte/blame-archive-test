/* ========= MAIN INITIALIZATION ========= */
/* ==================================================== */
/* --------- V3.4 - FINAL VOICE MEMO FIX -------------- */
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
  function initSoundCloud() {
    if (typeof SC === "undefined" || !SC.Widget) {
      console.warn("SoundCloud API not ready yet — retrying...");
      setTimeout(initSoundCloud, 300);
      return;
    }

    window.__scWidgets = [];

    document.querySelectorAll(".slot--sc").forEach(slot => {
      const url     = slot.dataset.scUrl;
      const iframe  = slot.querySelector(".sc-iframe");
      const trigger = slot.querySelector(".sc-trigger");
      if (!url || !iframe || !trigger) return;

      iframe.src =
        "https://w.soundcloud.com/player/?url=" +
        encodeURIComponent(url) +
        "&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false&visual=false";

      const widget = SC.Widget(iframe);
      window.__scWidgets.push(widget);

      widget.bind(SC.Widget.Events.READY, () => {
        console.log("SoundCloud widget ready:", url);
      });

      const toggleSC = () => {
        widget.isPaused(paused => paused ? widget.play() : widget.pause());
      };

      ["click", "pointerup"].forEach(evt =>
        trigger.addEventListener(evt, e => {
          e.preventDefault();
          e.stopPropagation();
          toggleSC();
        }, { passive: false })
      );
    });
  }
  initSoundCloud();

  /* ===== 3. Voice Memo (image-controlled audio) ===== */
  document.querySelectorAll(".slot--audio").forEach(slot => {
    const audio   = slot.querySelector("audio");
    const trigger = slot.querySelector(".audio-trigger");
    if (!audio || !trigger) return;

    // ALWAYS force the src from data-audio-src (no matter what)
    const srcAttr = (slot.dataset.audioSrc || "").trim();
    if (srcAttr) {
      audio.src = srcAttr; // important: overwrite anything browser cached
    }

    // Prep audio element
    audio.preload = "auto";
    audio.setAttribute("playsinline", "");

    // helper: reflect UI state
    const updateUI = () => {
      const playing = !audio.paused && !audio.ended;
      slot.classList.toggle("is-playing", playing);
      trigger.setAttribute("aria-pressed", playing ? "true" : "false");
    };

    // pause all OTHER audio + SoundCloud before playing this one
    const stopOthers = () => {
      document.querySelectorAll(".slot--audio audio").forEach(a => {
        if (a !== audio) {
          a.pause();
        }
      });
      if (window.__scWidgets) {
        window.__scWidgets.forEach(w => {
          try { w.pause(); } catch(e) {}
        });
      }
    };

    // click handler logic
    const handleToggle = () => {
      // make sure metadata is loaded before we try to play
      if (audio.readyState < 2) {
        audio.load();
      }

      if (audio.paused || audio.ended) {
        // we are about to PLAY
        stopOthers();

        const attempt = audio.play();
        if (attempt && typeof attempt.catch === "function") {
          attempt.catch(err => {
            console.warn("[VoiceMemo] play() blocked, retrying next click:", err);
            // if autoplay policy blocks on first click, arm a one-time retry
            trigger.addEventListener("click", retryPlay, { once: true });
          });
        }
      } else {
        // we are currently playing -> PAUSE
        audio.pause();
      }

      updateUI();
    };

    // if autoplay policy blocked first play attempt, try again immediately on next click
    const retryPlay = () => {
      const attempt = audio.play();
      if (attempt && typeof attempt.catch === "function") {
        attempt.catch(err => {
          console.warn("[VoiceMemo] retryPlay() failed:", err);
        });
      }
      updateUI();
    };

    // bind both pointer and click (covers desktop and mobile)
    ["click", "pointerup"].forEach(evt => {
      trigger.addEventListener(evt, e => {
        e.preventDefault();
        e.stopPropagation();
        handleToggle();
      }, { passive: false });
    });

    // keep UI in sync with real playback state
    ["play", "pause", "ended"].forEach(ev => {
      audio.addEventListener(ev, updateUI);
    });

    audio.addEventListener("error", () => {
      console.warn("[VoiceMemo] audio error", {
        src: audio.currentSrc,
        error: audio.error
      });
    });

    updateUI();
  });

  /* ===== 4. Overlay click-to-open ===== */
  const overlay = document.getElementById("overlay");
  const ovCard  = overlay?.querySelector(".ov-card");
  const ovImg   = overlay?.querySelector("img");

  if (overlay && ovCard && ovImg) {
    function openOverlay(src, alt) {
      ovImg.src = src;
      ovImg.alt = alt || "";
      overlay.classList.add("is-open");
      console.log("Overlay opened:", src);
    }

    function closeOverlay() {
      overlay.classList.remove("is-open");
      // shorter timeout for snappier close
      setTimeout(() => ovImg.removeAttribute("src"), 180);
    }

    document.querySelectorAll(".slot[data-overlay-src]").forEach(s => {
      const img = s.querySelector("img");
      if (!img) return;
      img.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        openOverlay(
          s.dataset.overlaySrc,
          s.dataset.overlayAlt || img.alt
        );
      });
    });

    overlay.addEventListener("click", e => {
      if (e.target === overlay) closeOverlay();
    });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") closeOverlay();
    });
  } else {
    console.warn("Overlay element not found");
  }

});
