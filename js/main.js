/* ========= MAIN INITIALIZATION ========= */
document.addEventListener("DOMContentLoaded", () => {

  /* ===== 1. Overlay image/audio trigger setup ===== */
  const overlay = document.getElementById("overlay");
  const ovCard  = overlay?.querySelector(".ov-card");
  const ovImg   = ovCard?.querySelector("img");
  const closeOverlay = () => overlay?.classList.remove("active");

  document.querySelectorAll(".overlay-trigger").forEach(trigger => {
    trigger.addEventListener("click", e => {
      e.preventDefault();
      const targetImg = trigger.getAttribute("data-overlay-img");
      if (ovImg && targetImg) ovImg.src = targetImg;
      overlay.classList.add("active");
    });
  });

  overlay?.addEventListener("click", e => {
    if (e.target === overlay) closeOverlay();
  });

  /* ===== 2. Audio controls ===== */
  document.querySelectorAll(".slot--audio").forEach(slot => {
    const audio = slot.querySelector("audio");
    const trigger = slot.querySelector(".audio-trigger");
    if (trigger && audio) {
      trigger.addEventListener("click", () => {
        if (audio.paused) {
          document.querySelectorAll("audio").forEach(a => a.pause());
          audio.play();
        } else {
          audio.pause();
        }
      });
    }
  });

  /* ===== 3. Slot reveals (Audrey-style) ===== */
  const hwrap = document.getElementById("hwrap");
  document.querySelectorAll(".slot").forEach(slot => {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          slot.classList.add("visible");
          obs.unobserve(slot);
        }
      });
    }, { root: hwrap, rootMargin: "200svh 50vw 200svh 50vw" });
    io.observe(slot);
  });

  /* ===== 4. Vimeo / YouTube / Lottie lazy activation ===== */
  document.querySelectorAll("iframe[data-src], dotlottie-wc[data-src]").forEach(el => {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const src = el.getAttribute("data-src");
          if (src && !el.getAttribute("src")) el.setAttribute("src", src);
          obs.unobserve(el);
        }
      });
    }, { root: hwrap, rootMargin: "300svh 50vw" });
    io.observe(el);
  });

  /* ===== 5. Mouse wheel → horizontal scroll ===== */
  const wrap = document.getElementById('hwrap');
  wrap?.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      wrap.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  }, { passive: false });

  /* ===== 6. SoundCloud initializer ===== */
  function initSoundCloud() {
    window.__scWidgets = [];
    document.querySelectorAll('.slot--sc').forEach((slot) => {
      const scUrl   = (slot.dataset.scUrl || '').trim();
      const iframe  = slot.querySelector('.sc-iframe');
      const trigger = slot.querySelector('.sc-trigger');
      if (!scUrl || !iframe || !trigger) return;

      const embed = 'https://w.soundcloud.com/player/?url=' +
        encodeURIComponent(scUrl) +
        '&auto_play=false&hide_related=true&show_comments=false&show_user=false' +
        '&show_reposts=false&visual=false';
      iframe.src = embed;

      const widget = SC.Widget(iframe);
      window.__scWidgets.push(widget);

      let ready = false;
      widget.bind(SC.Widget.Events.READY, () => { ready = true; });

      const setPlaying = (on) => slot.classList.toggle('is-playing', !!on);
      widget.bind(SC.Widget.Events.PLAY, () => {
        setPlaying(true);
        document.querySelectorAll('.slot--audio audio').forEach(a => a.pause());
      });
      const notPlaying = () => setPlaying(false);
      widget.bind(SC.Widget.Events.PAUSE,  notPlaying);
      widget.bind(SC.Widget.Events.FINISH, notPlaying);

      const toggle = () => {
        if (!ready) {
          widget.bind(SC.Widget.Events.READY, () =>
            widget.isPaused(p => p ? widget.play() : widget.pause()));
          return;
        }
        widget.isPaused(p => p ? widget.play() : widget.pause());
      };

      if (window.PointerEvent) {
        trigger.addEventListener('pointerup', (e) => {
          e.preventDefault(); e.stopPropagation(); toggle();
        }, { passive: false });
      } else {
        let ignoreNextClick = false;
        trigger.addEventListener('touchend', (e) => {
          e.preventDefault(); e.stopPropagation();
          ignoreNextClick = true; setTimeout(() => ignoreNextClick = false, 400);
          toggle();
        }, { passive: false });
        trigger.addEventListener('click', (e) => {
          if (ignoreNextClick) { e.preventDefault(); return; }
          e.preventDefault(); e.stopPropagation(); toggle();
        }, { passive: false });
      }
    });
  }

  if (typeof SC !== "undefined") {
    initSoundCloud();
  } else {
    const scScript = document.createElement("script");
    scScript.src = "https://w.soundcloud.com/player/api.js";
    scScript.onload = initSoundCloud;
    document.body.appendChild(scScript);
  }

  /* ===== 7. Audio-Image initializer ===== */
  function initImageAudio(){
    document.querySelectorAll('.slot--audio').forEach((slot) => {
      const audio   = slot.querySelector('audio');
      const trigger = slot.querySelector('img.audio-trigger, .audio-trigger');
      if (!audio || !trigger) return;

      const srcAttr = (slot.dataset.audioSrc || '').trim();
      if (srcAttr) audio.src = srcAttr;

      audio.load();
      audio.loop = (slot.dataset.loop === 'true');
      audio.preload = 'auto';
      audio.setAttribute('playsinline', '');

      const updateUI = () => {
        const playing = !audio.paused && !audio.ended;
        slot.classList.toggle('is-playing', playing);
        trigger.setAttribute('aria-pressed', playing ? 'true' : 'false');
      };

      audio.addEventListener('play', () => {
        document.querySelectorAll('.slot--audio audio').forEach((a) => { if (a !== audio) a.pause(); });
        if (window.__scWidgets && Array.isArray(window.__scWidgets)) {
          window.__scWidgets.forEach(w => { try { w.pause(); } catch(e){} });
        }
        updateUI();
      });
      audio.addEventListener('pause', updateUI);
      audio.addEventListener('ended', updateUI);

      const toggle = () => {
        if (audio.paused || audio.ended) {
          const p = audio.play();
          if (p && typeof p.catch === 'function') {
            p.catch((e) => {
              console.warn('[VoiceMemo] play() failed. src:', audio.currentSrc || srcAttr, e);
            });
          }
        } else {
          audio.pause();
        }
      };

      if (window.PointerEvent) {
        trigger.addEventListener('pointerup', (e) => { e.preventDefault(); e.stopPropagation(); toggle(); }, { passive: false });
      } else {
        trigger.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); toggle(); }, { passive: false });
        trigger.addEventListener('touchend', () => toggle(), { passive: true });
      }

      audio.addEventListener('error', () => {
        const err = audio.error;
        console.warn('[VoiceMemo] <audio> error', {
          code: err && err.code,
          currentSrc: audio.currentSrc || srcAttr
        });
      });

      updateUI();
    });
  }
  initImageAudio();

  /* ===== 8. Overlay controls (open/close images) ===== */
  (() => {
    const overlay = document.getElementById('overlay');
    const ovCard  = overlay.querySelector('.ov-card');
    const ovImg   = overlay.querySelector('img');

    const openOverlay = (src, alt, w, h, p) => {
      ovImg.src = src;
      ovImg.alt = alt || '';
      if (w) ovCard.style.setProperty('--ov-max-w', w); else ovCard.style.removeProperty('--ov-max-w');
      if (h) ovCard.style.setProperty('--ov-max-h', h); else ovCard.style.removeProperty('--ov-max-h');
      if (p) ovCard.style.setProperty('--ov-pad', p); else ovCard.style.removeProperty('--ov-pad');
      overlay.classList.add('is-open');
    };

    const closeOverlay = () => {
      overlay.classList.remove('is-open');
      setTimeout(() => { ovImg.src = ''; }, 350);
    };

    document.querySelectorAll('.rail .slot[data-overlay-src]').forEach(slot => {
      const img = slot.querySelector('img');
      if (!img) return;
      img.addEventListener('click', e => {
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

    overlay.addEventListener('click', e => { if (e.target === overlay) closeOverlay(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeOverlay(); });
  })();

  /* ===== 9. Lottie controls ===== */
  document.querySelectorAll('.slot--lottie[data-link]').forEach(slot => {
    slot.style.cursor = 'pointer';
    slot.addEventListener('click', () => {
      const url = slot.getAttribute('data-link');
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    });
  });

  /* ===== 10. Lottie overlay trigger ===== */
  (() => {
    const overlay = document.getElementById('overlay');
    const ovImg   = overlay.querySelector('img');
    document.querySelectorAll('.slot--lottie[data-overlay-src]').forEach(slot => {
      const lottie = slot.querySelector('dotlottie-wc');
      if (!lottie) return;
      lottie.style.cursor = 'pointer';
      lottie.addEventListener('click', () => {
        const src = slot.getAttribute('data-overlay-src');
        const alt = slot.getAttribute('data-overlay-alt') || '';
        ovImg.src = src;
        ovImg.alt = alt;
        overlay.classList.add('is-open');
      });
    });
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('is-open'); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') overlay.classList.remove('is-open'); });
  })();

  /* ===== 11. Lottie visibility optimization ===== */
  const players = document.querySelectorAll('dotlottie-wc');
  const ioLottie = new IntersectionObserver((entries) => {
    entries.forEach(({ isIntersecting, target }) => {
      if (isIntersecting) target.play?.();
      else target.pause?.();
    });
  }, { threshold: 0.01 });
  players.forEach(p => ioLottie.observe(p));

});
