/* ========= MAIN INITIALIZATION ========= */
document.addEventListener("DOMContentLoaded", () => {

  /* ===== 1. Slot reveal-on-scroll (Audrey-style fade/slide-in etc.) ===== */
  const hwrap = document.getElementById("hwrap");

  document.querySelectorAll(".slot").forEach(slot => {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          slot.classList.add("visible");
          obs.unobserve(slot);
        }
      });
    }, {
      root: hwrap,
      rootMargin: "50% 50vw"
    });
    io.observe(slot);
  });

  /* ===== 2. Lazy-load any <img> / <iframe> / etc. that has data-src ===== */
  document.querySelectorAll("[data-src]").forEach(el => {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const src = el.getAttribute("data-src");
          if (src && !el.getAttribute("src")) {
            el.setAttribute("src", src);
          }
          obs.unobserve(el);
        }
      });
    }, {
      root: hwrap,
      rootMargin: "300svh 50vw"
    });
    io.observe(el);
  });

  /* ===== 3. Mouse wheel → horizontal scroll ===== */
  const wrap = document.getElementById("hwrap");
  if (wrap) {
    wrap.addEventListener("wheel", (e) => {
      // if user scrolls vertically, convert that to horizontal scroll
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        wrap.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    }, { passive: false });
  }

  /* ===== 4. SoundCloud initializer (image acts like play/pause button) ===== */
  function initSoundCloud() {
    // keep refs so we can pause them later when voice memos play
    window.__scWidgets = [];

    document.querySelectorAll(".slot--sc").forEach(slot => {
      const scUrl   = (slot.dataset.scUrl || "").trim();
      const iframe  = slot.querySelector(".sc-iframe");
      const trigger = slot.querySelector(".sc-trigger");

      if (!scUrl || !iframe || !trigger) return;

      // Build the SoundCloud embed URL
      const embed =
        "https://w.soundcloud.com/player/?url=" +
        encodeURIComponent(scUrl) +
        "&auto_play=false" +
        "&hide_related=true" +
        "&show_comments=false" +
        "&show_user=false" +
        "&show_reposts=false" +
        "&visual=false";

      iframe.src = embed;

      // Create the SC widget controller
      const widget = SC.Widget(iframe);
      window.__scWidgets.push(widget);

      let ready = false;
      widget.bind(SC.Widget.Events.READY, () => {
        ready = true;
      });

      // helper to reflect UI state
      const setPlaying = (isPlaying) => {
        slot.classList.toggle("is-playing", isPlaying);
        trigger.setAttribute("aria-pressed", isPlaying ? "true" : "false");
      };

      // when this SoundCloud starts, pause all voice memo <audio>s
      widget.bind(SC.Widget.Events.PLAY, () => {
        setPlaying(true);
        document.querySelectorAll(".slot--audio audio").forEach(a => {
          a.pause();
        });
      });

      const notPlaying = () => setPlaying(false);
      widget.bind(SC.Widget.Events.PAUSE,  notPlaying);
      widget.bind(SC.Widget.Events.FINISH, notPlaying);

      // toggle play/pause
      const toggle = () => {
        if (!ready) {
          // if widget not ready yet, hook READY then retry once it's ready
          widget.bind(SC.Widget.Events.READY, () => {
            widget.isPaused(paused => {
              if (paused) widget.play();
              else widget.pause();
            });
          });
          return;
        }

        widget.isPaused(paused => {
          if (paused) widget.play();
          else widget.pause();
        });
      };

      // Pointer-friendly controls (desktop+mobile)
      if (window.PointerEvent) {
        trigger.addEventListener("pointerup", (e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle();
        }, { passive: false });
      } else {
        // Fallback for older Safari iOS etc.
        let ignoreNextClick = false;

        trigger.addEventListener("touchend", (e) => {
          e.preventDefault();
          e.stopPropagation();
          ignoreNextClick = true;
          setTimeout(() => { ignoreNextClick = false; }, 400);
          toggle();
        }, { passive: false });

        trigger.addEventListener("click", (e) => {
          if (ignoreNextClick) {
            e.preventDefault();
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          toggle();
        }, { passive: false });
      }
    });
  }

  // load SoundCloud API if needed
  if (typeof SC !== "undefined" && SC.Widget) {
    initSoundCloud();
  } else {
    const scScript = document.createElement("script");
    scScript.src = "https://w.soundcloud.com/player/api.js";
    scScript.onload = initSoundCloud;
    document.body.appendChild(scScript);
  }

  /* ===== 5. Image-controlled <audio> voice memos / sessions ===== */
  function initImageAudio() {
    document.querySelectorAll(".slot--audio").forEach(slot => {
      const audio   = slot.querySelector("audio");
      const trigger = slot.querySelector("img.audio-trigger, .audio-trigger");
      if (!audio || !trigger) return;

      // if slot has data-audio-src on the <figure>, force that into <audio>
      const srcAttr = (slot.dataset.audioSrc || "").trim();
      if (srcAttr) {
        audio.src = srcAttr;
      }

      audio.load();
      audio.loop = (slot.dataset.loop === "true");
      audio.preload = "auto";
      audio.setAttribute("playsinline", "");

      // reflect UI state
      const updateUI = () => {
        const playing = !audio.paused && !audio.ended;
        slot.classList.toggle("is-playing", playing);
        trigger.setAttribute("aria-pressed", playing ? "true" : "false");
      };

      // when this audio starts, pause:
      // - all other <audio>
      // - all SoundCloud widgets
      audio.addEventListener("play", () => {
        document.querySelectorAll(".slot--audio audio").forEach(a => {
          if (a !== audio) a.pause();
        });
        if (window.__scWidgets && Array.isArray(window.__scWidgets)) {
          window.__scWidgets.forEach(w => {
            try { w.pause(); } catch(e) { /* ignore */ }
          });
        }
        updateUI();
      });

      audio.addEventListener("pause", updateUI);
      audio.addEventListener("ended", updateUI);

      const toggle = () => {
        if (audio.paused || audio.ended) {
          const p = audio.play();
          if (p && typeof p.catch === "function") {
            p.catch((err) => {
              console.warn("[VoiceMemo] play() failed", {
                src: audio.currentSrc || srcAttr,
                err
              });
            });
          }
        } else {
          audio.pause();
        }
      };

      // pointer-friendly control for the image
      if (window.PointerEvent) {
        trigger.addEventListener("pointerup", (e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle();
        }, { passive: false });
      } else {
        trigger.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle();
        }, { passive: false });

        trigger.addEventListener("touchend", () => {
          toggle();
        }, { passive: true });
      }

      // basic error logging for debugging bad/missing file types
      audio.addEventListener("error", () => {
        const err = audio.error;
        console.warn("[VoiceMemo] <audio> error", {
          code: err && err.code,
          currentSrc: audio.currentSrc || srcAttr
        });
      });

      // set initial pressed state
      updateUI();
    });
  }
  initImageAudio();

  /* ===== 6. Overlay viewer for any slot with data-overlay-* =====
     This powers things like:
     <figure class="slot" data-overlay-src="big.webp" data-overlay-alt="...">
       <img src="thumb.webp">
     </figure>
     and the global <div id="overlay"><div class="ov-card"><img></div></div>
  ================================================================= */
  (() => {
    const overlay = document.getElementById("overlay");
    const ovCard  = overlay.querySelector(".ov-card");
    const ovImg   = overlay.querySelector("img");

    // open overlay and optionally override sizing vars
    const openOverlay = (src, alt, w, h, p) => {
      ovImg.src = src;
      ovImg.alt = alt || "";

      if (w) { ovCard.style.setProperty("--ov-max-w", w); }
      else   { ovCard.style.removeProperty("--ov-max-w"); }

      if (h) { ovCard.style.setProperty("--ov-max-h", h); }
      else   { ovCard.style.removeProperty("--ov-max-h"); }

      if (p) { ovCard.style.setProperty("--ov-pad", p); }
      else   { ovCard.style.removeProperty("--ov-pad"); }

      overlay.classList.add("is-open");
    };

    const closeOverlay = () => {
      overlay.classList.remove("is-open");
      // after fade-out, clear image src so mobile Safari frees memory
      setTimeout(() => {
        ovImg.src = "";
      }, 350);
    };

    // attach click listeners to every slot that advertises data-overlay-src
    document.querySelectorAll(".rail .slot[data-overlay-src]").forEach(slot => {
      const img = slot.querySelector("img");
      if (!img) return;

      img.style.cursor = "pointer";
      img.addEventListener("click", (e) => {
        e.stopPropagation();
        openOverlay(
          slot.dataset.overlaySrc,
          slot.dataset.overlayAlt || img.alt,
          slot.dataset.ovW,
          slot.dataset.ovH,
          slot.dataset.ovPad
        );
      });
    });

    // clicking outside the card closes
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeOverlay();
      }
    });

    // ESC closes
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeOverlay();
      }
    });
  })();

  /* ===== 7. Clickable Lottie slots ===== 
     <figure class="slot slot--lottie" data-link="https://...">
       <dotlottie-wc ...></dotlottie-wc>
     </figure>
     OR data-overlay-src (supports same overlay viewer)
  ================================================================= */
  document.querySelectorAll(".slot--lottie[data-link]").forEach(slot => {
    slot.style.cursor = "pointer";
    slot.addEventListener("click", () => {
      const url = slot.getAttribute("data-link");
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    });
  });

  // Lottie → open in overlay if data-overlay-src is present
  (() => {
    const overlay = document.getElementById("overlay");
    const ovImg   = overlay.querySelector("img");

    document.querySelectorAll(".slot--lottie[data-overlay-src]").forEach(slot => {
      const lottie = slot.querySelector("dotlottie-wc");
      if (!lottie) return;
      lottie.style.cursor = "pointer";

      lottie.addEventListener("click", () => {
        const src = slot.getAttribute("data-overlay-src");
        const alt = slot.getAttribute("data-overlay-alt") || "";
        ovImg.src = src;
        ovImg.alt = alt;
        overlay.classList.add("is-open");
      });
    });

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.classList.remove("is-open");
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        overlay.classList.remove("is-open");
      }
    });
  })();

  /* ===== 8. Lottie visibility optimization (pause when off screen) ===== */
  const players = document.querySelectorAll("dotlottie-wc");
  const ioLottie = new IntersectionObserver((entries) => {
    entries.forEach(({ isIntersecting, target }) => {
      if (isIntersecting) {
        if (typeof target.play === "function") target.play();
      } else {
        if (typeof target.pause === "function") target.pause();
      }
    });
  }, { threshold: 0.01 });
  players.forEach(p => ioLottie.observe(p));

});
