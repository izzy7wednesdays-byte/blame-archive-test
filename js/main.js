/* ========= MAIN INITIALIZATION ========= */
/* ==================================================== */
/* --------- V3.3 - FIX VOICE MEMO TOGGLE ----------- */
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
      const url = slot.dataset.scUrl;
      const iframe = slot.querySelector(".sc-iframe");
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

      const toggle = () => {
        widget.isPaused(paused => paused ? widget.play() : widget.pause());
      };

      ["click", "pointerup"].forEach(evt =>
        trigger.addEventListener(evt, e => {
          e.preventDefault();
          e.stopPropagation();
          toggle();
        }, { passive: false })
      );
    });
  }
  initSoundCloud();

/* ===== 3. Voice Memo (image-controlled audio) — FINAL FIX ===== */
document.querySelectorAll(".slot--audio").forEach(slot => {
  const audio   = slot.querySelector("audio");
  const trigger = slot.querySelector(".audio-trigger");
  if (!audio || !trigger) return;

  // Assign src from data attribute if present
  const srcAttr = slot.dataset.audioSrc?.trim();
  if (srcAttr && !audio.src.includes(srcAttr)) {
    audio.src = srcAttr;
  }

  audio.preload = "auto";
  audio.setAttribute("playsinline", "");

  // UI helper
  const updateUI = () => {
    const isPlaying = !audio.paused && !audio.ended;
    slot.classList.toggle("is-playing", isPlaying);
    trigger.setAttribute("aria-pressed", isPlaying ? "true" : "false");
  };

  // Pause everything else
  const stopOthers = () => {
    document.querySelectorAll(".slot--audio audio").forEach(a => {
      if (a !== audio) a.pause();
    });
    if (window.__scWidgets) {
      window.__scWidgets.forEach(w => {
        try { w.pause(); } catch (e) {}
      });
    }
  };

  // Core toggle logic (guaranteed to count as a user gesture)
  const toggle = () => {
    // Force-load metadata once
    if (audio.readyState < 2) audio.load();

    if (audio.paused || audio.ended) {
      stopOthers();
      // try immediate play first
      const p = audio.play();
      if (p && typeof p.catch === "function") {
        p.catch(err => {
          console.warn("[VoiceMemo] play() blocked, retrying with user gesture:", err);
          // fallback: re-trigger play inside another click gesture
          trigger.addEventListener("click", secondTry, { once: true });
        });
      }
    } else {
      audio.pause();
    }
  };

  // If the browser blocked the first play, this always succeeds on next click
  function secondTry() {
    const p = audio.play();
    if (p && typeof p.catch === "function") {
      p.catch(err => console.warn("[VoiceMemo] second play() failed:", err));
    }
  }

  // Attach events
  ["click", "pointerup"].forEach(evt =>
    trigger.addEventListener(evt, e => {
      e.preventDefault();
      e.stopPropagation();
      toggle();
      updateUI();
    }, { passive: false })
  );

  ["play", "pause", "ended"].forEach(ev =>
    audio.addEventListener(ev, updateUI)
  );

  audio.addEventListener("error", e => {
    console.warn("[VoiceMemo] error:", audio.error, audio.currentSrc);
  });

  updateUI();
});


/* ===== 4. OVERLAY CLICK-TO-OPEN ===== */
  const overlay = document.getElementById("overlay");
  const ovCard = overlay?.querySelector(".ov-card");
  const ovImg = overlay?.querySelector("img");

  if (overlay && ovCard && ovImg) {
    function openOverlay(src, alt) {
      ovImg.src = src;
      ovImg.alt = alt || "";
      overlay.classList.add("is-open");
      console.log("Overlay opened:", src);
    }

    function closeOverlay() {
      overlay.classList.remove("is-open");
      setTimeout(() => ovImg.removeAttribute("src"), 350);
    }

    document.querySelectorAll(".slot[data-overlay-src]").forEach(slot => {
      const img = slot.querySelector("img");
      if (!img) return;
      img.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        openOverlay(slot.dataset.overlaySrc, slot.dataset.overlayAlt || img.alt);
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
