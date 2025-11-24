// js/lib/audio-img.js
// Image-controlled audio (Audrey style)
// -------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  const imgs = document.querySelectorAll("img[data-audio-src]");

  if (!imgs.length) return;

  const audioList = [];

  function pauseAllImgAudios(except) {
    audioList.forEach(a => {
      if (a !== except) {
        try { a.pause(); } catch (e) {}
      }
    });
  }

  imgs.forEach((img, index) => {
    const src = img.getAttribute("data-audio-src");
    if (!src) return;

    // Create hidden audio element (Audrey-style)
    const audio = document.createElement("audio");
    audio.id = `img_audio_${index + 1}`;
    audio.src = src;
    audio.preload = "auto";
    audio.setAttribute("playsinline", "");

    // visually hide
    audio.style.position = "absolute";
    audio.style.left = "-9999px";
    audio.style.top = "auto";
    audio.style.width = "1px";
    audio.style.height = "1px";
    audio.style.opacity = "0";

    // append after the current script (like Audrey)
    document.body.appendChild(audio);

    audioList.push(audio);

    function syncUI() {
      const isPlaying = !audio.paused && !audio.ended;
      img.classList.toggle("is-playing", isPlaying);
    }

    img.style.cursor = "pointer";

    img.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      // toggle behavior
      if (!audio.paused && !audio.ended) {
        audio.pause();
        syncUI();
        return;
      }

      // pause all other audio sources (using globals from main-13.js)
      if (typeof pauseAllHtmlAudio === "function") pauseAllHtmlAudio();
      pauseAllImgAudios(audio);
      if (typeof pauseAllSc === "function") pauseAllSc();
      if (Array.isArray(window.__vimeoPlayers)) {
        window.__vimeoPlayers.forEach(p => {
          try { p.pause(); } catch (err) {}
        });
      }

      const attempt = audio.play();
      if (attempt?.catch) {
        attempt.catch(err => console.warn("[img-audio] play() blocked:", err));
      }

      syncUI();
    });

    audio.addEventListener("play",  syncUI);
    audio.addEventListener("pause", syncUI);
    audio.addEventListener("ended", syncUI);
  });
});
