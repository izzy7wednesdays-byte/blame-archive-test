/* ========= MAIN INITIALIZATION ========= */
/* ==================================================== */
/* --------- V5.2 - VIMEO CONTROLLER ----------- */
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

    // store all widgets so we can pause them from elsewhere
    window.__scWidgets = [];

    document.querySelectorAll(".slot--sc").forEach(slot => {
      const url     = slot.dataset.scUrl;
      const iframe  = slot.querySelector(".sc-iframe");
      const trigger = slot.querySelector(".sc-trigger");
      if (!url || !iframe || !trigger) return;

      // build SoundCloud iframe URL
      iframe.src =
        "https://w.soundcloud.com/player/?url=" +
        encodeURIComponent(url) +
        "&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false&visual=false";

      // create widget
      const widget = SC.Widget(iframe);
      window.__scWidgets.push(widget);

      // toggle play/pause on click
      trigger.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        widget.isPaused(paused => {
          if (paused) {
            // pause all other SC widgets and any HTML audio before playing this one
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

  // helper: pause all SC widgets except one
  function pauseAllScExcept(activeWidget) {
    if (!window.__scWidgets) return;
    window.__scWidgets.forEach(w => {
      if (w !== activeWidget) {
        try { w.pause(); } catch(e) {}
      }
    });
  }

  // helper: pause ALL SC widgets
  function pauseAllSc() {
    if (!window.__scWidgets) return;
    window.__scWidgets.forEach(w => {
      try { w.pause(); } catch(e) {}
    });
  }

  // helper: pause ALL <audio> voice memos
  function pauseAllHtmlAudio(exceptAudio) {
    document.querySelectorAll(".slot--audio audio").forEach(a => {
      if (a !== exceptAudio) {
        a.pause();
      }
    });
  }

  /* ===== 3. Voice Memo (image-controlled audio) ===== 
     This matches the exact HTML you have:
     <figure class="slot slot--audio" ... data-audio-src="assets/audio/...">
       <img class="audio-trigger" ...>
       <audio preload="auto" playsinline></audio>
     </figure>

     Goal:
       - First click: play THAT memo, pausing all others (and pausing all SoundCloud widgets).
       - Second click: pause THAT memo.
  */
  document.querySelectorAll(".slot--audio").forEach(slot => {
    const audio   = slot.querySelector("audio");
    const trigger = slot.querySelector(".audio-trigger");
    if (!audio || !trigger) return;

    // Force src from data-audio-src in index-13.html
    // Example from your file:
    //   data-audio-src="assets/audio/exit-wounds-voicememo.m4a"
    //   data-audio-src="assets/audio/landmines-session.mp3"
    const fileFromDataAttr = (slot.dataset.audioSrc || "").trim();
    if (fileFromDataAttr) {
      audio.src = fileFromDataAttr;
    }

    // Make sure the browser treats this as lightweight, inline media
    audio.preload = "auto";
    audio.setAttribute("playsinline", "");

    // reflect playing / paused visual state
    function syncUI() {
      const isPlaying = !audio.paused && !audio.ended;
      slot.classList.toggle("is-playing", isPlaying);
      trigger.setAttribute("aria-pressed", isPlaying ? "true" : "false");
    }

    // click handler = the ONLY gesture we rely on
    trigger.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();

      // If currently playing -> pause this memo only.
      if (!audio.paused && !audio.ended) {
        audio.pause();
        syncUI();
        return;
      }

      // Otherwise: we are about to play THIS memo.
      // First pause all other voice memos and all SoundCloud widgets.
      pauseAllHtmlAudio(audio);
      pauseAllSc();

      // Now actually play THIS audio in the SAME user gesture.
      // This satisfies Chrome/Safari's user-interaction policy.
      const playAttempt = audio.play();

      // nothing async/extra here that would cause policy confusion
      if (playAttempt && typeof playAttempt.catch === "function") {
        playAttempt.catch(err => {
          console.warn("[VoiceMemo] play() was blocked:", err);
          // If this ever logs, it means the browser still refused.
          // But we don't schedule weird retries that fire in a different event.
        });
      }

      syncUI();
    });

    // keep UI updated if audio ends or pauses from outside
    audio.addEventListener("play",  syncUI);
    audio.addEventListener("pause", syncUI);
    audio.addEventListener("ended", syncUI);

    audio.addEventListener("error", () => {
      console.warn("[VoiceMemo] audio error", {
        src: audio.currentSrc,
        error: audio.error
      });
    });

    // initialize UI state
    syncUI();
  });

  /* ===== 3.5 Vimeo single-play controller ===== */
  (function initVimeoPlayers() {
    // Make sure Vimeo API is available
    if (typeof Vimeo === "undefined" || !Vimeo.Player) {
      console.warn("Vimeo API not ready — retrying...");
      setTimeout(initVimeoPlayers, 300);
      return;
    }
  
    // Keep a list of all Vimeo players
    window.__vimeoPlayers = [];
  
    // Create a player object for every Vimeo iframe on the page
    document.querySelectorAll(".slot--vimeo iframe.vimeo-iframe").forEach(iframe => {
      const player = new Vimeo.Player(iframe);
      window.__vimeoPlayers.push(player);
  
      // Whenever this player starts playing:
      player.on("play", () => {
        // 1. Pause all other Vimeo players
        window.__vimeoPlayers.forEach(other => {
          if (other !== player) {
            try { other.pause(); } catch (err) {}
          }
        });
  
        // 2. Pause all SoundCloud widgets
        if (window.__scWidgets) {
          window.__scWidgets.forEach(w => {
            try { w.pause(); } catch (err) {}
          });
        }
  
        // 3. Pause all voice memo <audio>
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

      // read per-slot custom controls from inline style vars
      // default playback rate = 1, default loop = true
      const style = getComputedStyle(slot);

      // playback speed from --playback (string -> number)
      const rateStr = style.getPropertyValue("--playback").trim();
      if (rateStr) {
        const rateNum = parseFloat(rateStr);
        if (!Number.isNaN(rateNum) && rateNum > 0) {
          vid.playbackRate = rateNum;
        }
      }

      // loop flag from --do-loop (1 means loop)
      const loopFlag = style.getPropertyValue("--do-loop").trim();
      vid.loop = (loopFlag === "1" || loopFlag === "true");

      // try to autoplay silently
      // browsers allow autoplay if video is muted and playsinline
      const playAttempt = vid.play();
      if (playAttempt && typeof playAttempt.catch === "function") {
        playAttempt.catch(err => {
          // If autoplay is blocked, it will just sit paused
          // We will not schedule async retries (per your browser policy constraints).
          console.warn("[LoopVideo] autoplay blocked", err);
        });
      }
    });
  })();

  /* ===== 5. Overlay click-to-open ===== */
  const overlay = document.getElementById("overlay");
  const ovCard  = overlay ? overlay.querySelector(".ov-card") : null;
  const ovImg   = overlay && ovCard ? ovCard.querySelector("img") : null;

  if (overlay && ovCard && ovImg) {

    function openOverlay(src, alt) {
      ovImg.src = src;
      ovImg.alt = alt || "";
      overlay.classList.add("is-open");
    }

    function closeOverlay() {
      overlay.classList.remove("is-open");
      setTimeout(() => {
        ovImg.removeAttribute("src");
        ovImg.removeAttribute("alt");
      }, 180);
    }

    // Every .slot with data-overlay-src in index-13.html
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

    // click outside card to close
    overlay.addEventListener("click", e => {
      if (e.target === overlay) {
        closeOverlay();
      }
    });

    // ESC key closes
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        closeOverlay();
      }
    });
  } else {
    console.warn("Overlay element not found");
  }

});
