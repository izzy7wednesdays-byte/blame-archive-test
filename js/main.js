/* ================================ */
    /* --------- V2.0 --------- */
/* ================================ */
  
/* ========= MAIN INITIALIZATION ========= */
document.addEventListener("DOMContentLoaded", () => {

  const hwrap = document.getElementById("hwrap");

  /* Horizontal scroll wheel behavior */
  if (hwrap) {
    hwrap.addEventListener("wheel", e => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        hwrap.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    }, { passive: false });
  }

  /* ===== SOUNDCLOUD IMAGE-CONTROLLED PLAYER ===== */
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

      trigger.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      });
      trigger.addEventListener("pointerup", e => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      });
    });
  }

  initSoundCloud();

  /* ===== IMAGE-CONTROLLED AUDIO ===== */
  document.querySelectorAll(".slot--audio").forEach(slot => {
    const audio = slot.querySelector("audio");
    const trigger = slot.querySelector(".audio-trigger");
    if (!audio || !trigger) return;

    const src = slot.dataset.audioSrc;
    if (src) audio.src = src;

    const toggle = () => {
      if (audio.paused) {
        // pause all others
        document.querySelectorAll(".slot--audio audio").forEach(a => {
          if (a !== audio) a.pause();
        });
        audio.play().catch(err => console.warn("Audio play failed:", err));
      } else audio.pause();
    };

    trigger.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    });
    trigger.addEventListener("pointerup", e => {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    });
  });

  /* ===== OVERLAY CLICK-TO-OPEN ===== */
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
