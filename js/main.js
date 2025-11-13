/* ========= MAIN INITIALIZATION ========= */
/* ==================================================== */
/* --------- V6.0 - REMOVING NOTES ----------- */
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
      // SC not ready yet. Try again.
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

      trigger.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        widget.isPaused(paused => {
          if (paused) {
            pauseAllHtmlAudio();
            pauseAllScExcept(widget);
            widget.play();
          } else {
            widget.pause();
          }
        });
      });
    });
  }
  initSoundCloud();

  function pauseAllScExcept(activeWidget) {
    if (!window.__scWidgets) return;
    window.__scWidgets.forEach(w => {
      if (w !== activeWidget) {
        try { w.pause(); } catch(e) {}
      }
    });
  }

  function pauseAllSc() {
    if (!window.__scWidgets) return;
    window.__scWidgets.forEach(w => {
      try { w.pause(); } catch(e) {}
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
  
    window.__vimeoPlayers = [];
  
    document.querySelectorAll(".slot--vimeo iframe.vimeo-iframe").forEach(iframe => {
      const player = new Vimeo.Player(iframe);
      window.__vimeoPlayers.push(player);
  
      player.on("play", () => {
        window.__vimeoPlayers.forEach(other => {
          if (other !== player) {
            try { other.pause(); } catch (err) {}
          }
        });
  
        if (window.__scWidgets) {
          window.__scWidgets.forEach(w => {
            try { w.pause(); } catch (err) {}
          });
        }
  
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
