<script>
(function () {
  // All images that should control audio
  const imgAudioEls = document.querySelectorAll("img[data-audio-src]");

  const audioList = [];

  function pauseAllImgAudios(except) {
    audioList.forEach(a => {
      if (a !== except) {
        try { a.pause(); } catch (e) {}
      }
    });
  }

  imgAudioEls.forEach((img, index) => {
    const src = img.getAttribute("data-audio-src");
    if (!src) return;

    // Create a hidden <audio> element, Audrey-style
    const audio = document.createElement("audio");
    audio.id = `img_audio_${index + 1}`;
    audio.src = src;
    audio.preload = "auto";
    audio.setAttribute("playsinline", "");
    audio.dataset.audioImg = "true";

    // Hide it visually but keep it in the DOM
    audio.style.position = "absolute";
    audio.style.left = "-9999px";
    audio.style.top = "auto";
    audio.style.width = "1px";
    audio.style.height = "1px";
    audio.style.opacity = "0";
    audio.style.pointerEvents = "none";
    audio.style.border = "0";

    // Append near the scripts block (like Audrey)
    (document.currentScript && document.currentScript.parentElement || document.body)
      .appendChild(audio);

    audioList.push(audio);

    function syncUI() {
      const isPlaying = !audio.paused && !audio.ended;
      img.classList.toggle("is-playing", isPlaying);
    }

    img.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();

      // If this one is currently playing → pause on second click
      if (!audio.paused && !audio.ended) {
        audio.pause();
        syncUI();
        return;
      }

      // Pause all our other img-audios
      pauseAllImgAudios(audio);

      // Also try to pause Vimeo + SoundCloud if your globals exist
      if (Array.isArray(window.__vimeoPlayers)) {
        window.__vimeoPlayers.forEach(p => {
          try { p.pause(); } catch (err) {}
        });
      }
      if (window.__scSingleWidget) {
        try { window.__scSingleWidget.pause(); } catch (err) {}
      }
      if (Array.isArray(window.__scWidgets)) {
        window.__scWidgets.forEach(w => {
          try { w.pause(); } catch (err) {}
        });
      }

      const playAttempt = audio.play();
      if (playAttempt && typeof playAttempt.catch === "function") {
        playAttempt.catch(err => {
          console.warn("[ImgAudio] play() was blocked:", err);
        });
      }

      syncUI();
    });

    audio.addEventListener("play",  syncUI);
    audio.addEventListener("pause", syncUI);
    audio.addEventListener("ended", syncUI);
  });
})();
</script>
