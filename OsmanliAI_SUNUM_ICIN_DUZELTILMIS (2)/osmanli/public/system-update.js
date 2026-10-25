
(() => {
  "use strict";

  const $id = id => document.getElementById(id);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function clearOldSystemData() {
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(reg => reg.unregister()));
      }
    } catch (e) {
      console.warn("Service worker temizliği:", e);
    }

    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
      }
    } catch (e) {
      console.warn("Önbellek temizliği:", e);
    }
  }

  function setPanel(panel, open) {
    if (!panel) return;
    panel.classList.toggle("hidden", !open);
    panel.style.display = open ? "block" : "none";
    panel.style.visibility = open ? "visible" : "hidden";
    panel.style.opacity = open ? "1" : "0";
    panel.style.pointerEvents = open ? "auto" : "none";
  }

  function wirePanel(buttonId, panelId, closeId) {
    const button = $id(buttonId);
    const panel = $id(panelId);
    const close = $id(closeId);
    if (!button || !panel) return;

    setPanel(panel, false);

    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      const open = panel.classList.contains("hidden");
      setPanel(panel, open);
    });

    if (close) {
      close.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        setPanel(panel, false);
      });
    }
  }

  function repairAudio() {
    const audio = $id("mehterAudio");
    const testButton = $id("audioTestButton");
    const enabled = $id("musicEnabled");
    const volume = $id("musicVolume");
    const volumeText = $id("musicVolumeValue");
    const status = $id("ceddinStatus");
    const introButton = $id("enterImperialApp");
    const intro = $id("imperialIntro");
    const audioButton = $id("audioSettingsButton");
    const track = $id("musicTrackSelect");

    if (!audio) return;

    function prepare() {
      audio.src = "/assets/ceddin-deden.mp3?v=21";
      audio.loop = true;
      audio.preload = "auto";
      audio.muted = false;
      audio.volume = 0.35;
      if (volume) volume.value = "35";
      if (volumeText) volumeText.textContent = "%35";
      if (track) track.value = "ceddin";
    }

    function statusText(text, playing) {
      if (status) status.textContent = text;
      if (audioButton) audioButton.textContent = playing ? "🔊" : "🔇";
      if (enabled) enabled.checked = playing;
    }

    async function play() {
      prepare();
      try {
        await audio.play();
        statusText("Ceddin Deden çalıyor • Ses %35", true);
      } catch (error) {
        console.warn("Ses başlatılamadı:", error);
        statusText("▶ Müziği Başlat / Dene düğmesine bas", false);
      }
    }

    function stop() {
      audio.pause();
      statusText("Fon müziği kapalı", false);
    }

    if (testButton) {
      testButton.onclick = () => audio.paused ? play() : stop();
    }

    if (enabled) {
      enabled.onchange = () => enabled.checked ? play() : stop();
    }

    if (volume) {
      volume.oninput = () => {
        audio.volume = Number(volume.value) / 100;
        if (volumeText) volumeText.textContent = `%${volume.value}`;
        if (!audio.paused) statusText(`Ceddin Deden çalıyor • Ses %${volume.value}`, true);
      };
    }

    if (track) {
      track.onchange = () => {
        track.value = "ceddin";
        play();
      };
    }

    if (introButton) {
      introButton.addEventListener("click", async () => {
        await play();
        if (intro) {
          intro.classList.add("hidden-intro");
          intro.style.pointerEvents = "none";
          setTimeout(() => { intro.style.display = "none"; }, 850);
        }
      });
    }

    prepare();
    statusText("Ceddin Deden hazır • Başlat düğmesine bas", false);
  }

  function repairGuide() {
    const input = $id("aiAvatarInput");
    const send = $id("aiAvatarSend");
    const messages = $id("aiAvatarMessages");
    const voice = $id("aiAvatarVoice");
    const status = $id("aiAvatarStatus");
    const character = $id("aiAvatarCharacter");

    if (!input || !send || !messages) return;

    function speak(text) {
      if (!voice?.checked || !("speechSynthesis" in window)) return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "tr-TR";
      u.rate = 0.95;
      u.onstart = () => {
        if (status) status.textContent = "Konuşuyor";
        character?.classList.add("speaking");
      };
      u.onend = () => {
        if (status) status.textContent = "Hazır";
        character?.classList.remove("speaking");
      };
      u.onerror = u.onend;
      speechSynthesis.speak(u);
    }

    function add(text, type) {
      const div = document.createElement("div");
      div.className = `avatar-message ${type}`;
      div.textContent = text;
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
      if (type === "ai") speak(text);
    }

    function answer(question) {
      const q = question.toLocaleLowerCase("tr-TR");
      if (q.includes("fatih")) return "Fatih Sultan Mehmed, İstanbul'u 1453 yılında fetheden Osmanlı padişahıdır.";
      if (q.includes("kanuni")) return "Kanuni Sultan Süleyman döneminde Osmanlı; hukuk, mimari ve askerî güç bakımından zirve dönemlerinden birini yaşadı.";
      if (q.includes("yavuz")) return "Yavuz Sultan Selim, doğu ve güney seferleriyle Osmanlı topraklarını genişletti.";
      if (q.includes("istanbul")) return "İstanbul, 1453 yılında Fatih Sultan Mehmed tarafından fethedildi.";
      if (q.includes("1299")) return "1299, Osmanlı Beyliği'nin kuruluş yılı olarak kabul edilir.";
      if (q.includes("harita")) return "Osmanlı Haritası bölümünde 1299'dan 1922'ye kadar gelişmeleri inceleyebilirsin.";
      if (q.includes("oyun")) return "Osmanlı Oyunları, Fetih Simülatörü ve Escape Room bölümlerini kullanabilirsin.";
      return "Fatih, Kanuni, Yavuz, İstanbul, 1299, harita veya oyunlar hakkında soru sorabilirsin.";
    }

    function submit() {
      const question = input.value.trim();
      if (!question) return;
      add(question, "user");
      input.value = "";
      setTimeout(() => add(answer(question), "ai"), 150);
    }

    send.onclick = submit;
    input.onkeydown = event => {
      if (event.key === "Enter") {
        event.preventDefault();
        submit();
      }
    };
  }

  async function runUpdate() {
    // V29.3: Açılış perdesi kaldırıldı. Bakım işlemleri arka planda ve gecikmesiz yapılır.
    try { await clearOldSystemData(); } catch (_) {}
    try { wirePanel("aiAvatarButton", "aiAvatarPanel", "closeAiAvatar"); } catch (_) {}
    try { wirePanel("audioSettingsButton", "audioSettingsPanel", "closeAudioSettings"); } catch (_) {}
    try { repairAudio(); } catch (_) {}
    try { repairGuide(); } catch (_) {}
    try { localStorage.setItem("oa_system_version", "29.3"); } catch (_) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runUpdate, { once: true });
  } else {
    runUpdate();
  }
})();
