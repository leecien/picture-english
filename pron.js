/* Tap-to-hear for every English line that is already on screen (questions, options, answers, dialog, chats).
   - Tap a sentence (or its 🔊): the whole sentence plays (recording first, else the fixed en-US voice).
   - Tap a dotted word inside it: a small card shows that word's KK and meaning from the word bank and plays it.
     Words that are not in the bank stay plain: no guessed KK.
   - Listening never answers: the hear controls are separate elements (never nested inside answer buttons),
     and they keep working after a question is settled.
   - One sound at a time; while something plays or the word card is open, "pron:busy" lets a timed battle pause.
   Only render text that is already allowed to be visible: never use this to put a hidden answer into the page. */
const Pron = (() => {
  const ESC = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const bank = () => (typeof WORDS !== "undefined" ? WORDS : []);
  let index = null;
  /* word bank lookup, tolerant of case, punctuation, plural -s/-es and possessive 's */
  function lookup(raw) {
    if (!index) {
      index = new Map();
      bank().forEach((w) => index.set(String(w.w).toLowerCase(), w));
    }
    const t = String(raw).toLowerCase().replace(/[’]/g, "'").replace(/^[^a-z]+|[^a-z]+$/g, "");
    if (!t) return null;
    return index.get(t) || index.get(t.replace(/'s$/, "")) || (t.length > 3 && (index.get(t.replace(/es$/, "")) || index.get(t.replace(/s$/, "")))) || null;
  }
  /* A sentence the player can tap: the line plays; dotted words open their card. */
  function sent(text, file, opt = {}) {
    if (!text) return "";
    const words = String(text)
      .split(/(\s+)/)
      .map((part) => {
        if (/^\s+$/.test(part)) return part;
        const w = opt.noWords ? null : lookup(part);
        return w ? `<span class="wd" data-w="${ESC(w.w)}" role="button" tabindex="0" aria-label="${ESC(w.w)} 的發音">${ESC(part)}</span>` : ESC(part);
      })
      .join("");
    return `<span class="say-s" data-say="${ESC(text)}"${file ? ` data-file="${ESC(file)}"` : ""} role="button" tabindex="0">${words}</span><span class="say-btn" data-say="${ESC(text)}"${file ? ` data-file="${ESC(file)}"` : ""} role="button" tabindex="0" aria-label="播放整句">🔊</span>`;
  }
  /* A separate listen control for an answer option (a sibling of the answer button, not inside it). */
  function hear(text, file, label) {
    return `<span class="qz-hear" data-say="${ESC(text)}"${file ? ` data-file="${ESC(file)}"` : ""} role="button" tabindex="0" aria-label="${ESC(label || "聽這個選項")}">🔊</span>`;
  }
  /* English text an option shows (only plain English: KK symbols and pictures are never read out). */
  function optionText(o) {
    if (o.say) return o.say;
    const txt = String(o.html || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').trim();
    if (!/^[A-Za-z][A-Za-z0-9 ,.'’?!-]*$/.test(txt)) return null;
    const w = lookup(txt);
    return { text: txt, file: w && !/\s/.test(txt) ? w.au || "" : "" };
  }

  /* ---------- playback: one at a time, with an end callback ---------- */
  let busyN = 0,
    seq = 0;
  const busy = (on) => {
    busyN = Math.max(0, busyN + (on ? 1 : -1));
    try {
      window.dispatchEvent(new CustomEvent("pron:busy", { detail: busyN > 0 }));
    } catch (e) {}
  };
  function stopAll() {
    try {
      if (typeof VOICE !== "undefined") VOICE.pause();
    } catch (e) {}
    try {
      if (window.speechSynthesis) speechSynthesis.cancel();
    } catch (e) {}
  }
  function play(text, file) {
    const my = ++seq;
    stopAll();
    busy(true);
    let done = false;
    const fin = () => {
      if (done) return;
      done = true;
      clearTimeout(guard);
      busy(false);
    };
    const guard = setTimeout(fin, 12000);
    const tts = () => {
      try {
        if (my !== seq || !window.speechSynthesis) return fin();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "en-US";
        u.rate = 0.85;
        const v = (speechSynthesis.getVoices() || []).find((x) => /^en[-_]US/i.test(x.lang)) || (speechSynthesis.getVoices() || []).find((x) => /^en/i.test(x.lang));
        if (v) u.voice = v;
        u.onend = fin;
        u.onerror = fin;
        speechSynthesis.speak(u);
      } catch (e) {
        fin();
      }
    };
    if (!file || typeof VOICE === "undefined") return tts();
    try {
      VOICE.onended = () => my === seq && fin();
      VOICE.onerror = () => (my === seq ? tts() : fin());
      VOICE.src = file;
      VOICE.currentTime = 0;
      VOICE.volume = 1;
      const p = VOICE.play();
      if (p) p.catch(() => (my === seq ? tts() : fin()));
    } catch (e) {
      tts();
    }
    // a newer tap ends this one for the busy count
    const check = setInterval(() => {
      if (my !== seq) {
        clearInterval(check);
        fin();
      } else if (done) clearInterval(check);
    }, 100);
  }

  /* ---------- word card ---------- */
  let card = null;
  function openWord(name) {
    const w = lookup(name);
    if (!w) return;
    if (!card) {
      card = document.createElement("div");
      card.className = "wd-card";
      card.setAttribute("role", "dialog");
      card.setAttribute("aria-label", "單字發音");
      document.body.appendChild(card);
    } else if (!card.hidden) busy(false);
    card.hidden = false;
    busy(true);
    card.innerHTML = `<b class="wd-w">${ESC(w.w)}</b> ${w.kk ? `<span class="wd-kk">${ESC(w.kk)}</span>` : '<span class="wd-none">題庫沒有這個字的音標</span>'}<span class="wd-z">${ESC(w.z || "")}</span><span class="wd-row"><button type="button" class="wd-play">🔊 再聽一次</button><button type="button" class="wd-close">✕ 關閉</button></span>`;
    card.querySelector(".wd-play").onclick = () => play(w.w, w.au);
    card.querySelector(".wd-close").onclick = closeWord;
    play(w.w, w.au);
  }
  function closeWord() {
    if (!card || card.hidden) return;
    card.hidden = true;
    busy(false);
  }

  if (typeof document !== "undefined") {
    // Capture phase: a hear control never reaches an answer button, a dialog, or the map underneath.
    const act = (e) => {
      const wd = e.target.closest && e.target.closest(".wd");
      if (wd) {
        e.preventDefault();
        e.stopPropagation();
        return openWord(wd.dataset.w);
      }
      const s = e.target.closest && e.target.closest("[data-say]");
      if (s && (s.classList.contains("say-s") || s.classList.contains("say-btn") || s.classList.contains("qz-hear"))) {
        e.preventDefault();
        e.stopPropagation();
        play(s.dataset.say, s.dataset.file || "");
      }
    };
    document.addEventListener("click", act, true);
    document.addEventListener(
      "keydown",
      (e) => {
        if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches(".wd, .say-s, .say-btn, .qz-hear")) act(e);
        if (e.key === "Escape") closeWord();
      },
      true,
    );
  }
  return { sent, hear, optionText, play, openWord, closeWord, lookup, get busy() { return busyN > 0; } };
})();
if (typeof module !== "undefined") module.exports = Pron;
