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
  /* Draft dictionary (data/dict-draft.json, PR #11): look-up only. Meanings still need teaching review, there
     is no checked KK, and nothing from it is graded. Common function words are not linked from the draft. */
  let DRAFT = null;
  // (function words are linked too: "is" opens be, shown as the form it is)
  if (typeof fetch !== "undefined" && typeof document !== "undefined")
    fetch("data/dict-draft.json")
      .then((r) => r.json())
      .then((d) => (DRAFT = d))
      .catch(() => {});
  /* Whole-line context translations and fixed phrases (data/line-zh.json): a phrase is understood as one unit
     ("Good evening" is a greeting, not "good + evening"); a line's Chinese is its own translation, never the
     word meanings strung together. Editorial (AI) translations, pending teaching review. */
  let LINES = {},
    PHRASES = [];
  const norm = (part) => String(part).toLowerCase().replace(/[’]/g, "'").replace(/^[^a-z']+|[^a-z']+$/g, "");
  if (typeof fetch !== "undefined" && typeof document !== "undefined")
    fetch("data/line-zh.json")
      .then((r) => r.json())
      .then((d) => {
        LINES = d.lines || {};
        // longest first, so "how can i help you" wins over "can i help you"
        PHRASES = (d.phrases || []).map((x) => ({ ...x, words: x.p.split(" ") })).sort((a, b) => b.words.length - a.words.length);
      })
      .catch(() => {});
  const lineZh = (text) => LINES[String(text).trim()] || "";
  const phrase = (key) => PHRASES.find((x) => x.p === key) || null;
  function draft(t) {
    if (!DRAFT) return null;
    const base = DRAFT.words[t] ? t : DRAFT.forms[t];
    const e = base && DRAFT.words[base];
    return e ? { w: base, z: e[0], pos: e[1], kk: null, au: "", draft: true, form: base !== t ? t : "" } : null;
  }
  function lookup(raw) {
    if (!index) {
      index = new Map();
      bank().forEach((w) => index.set(String(w.w).toLowerCase(), w));
    }
    const t = String(raw).toLowerCase().replace(/[’]/g, "'").replace(/^[^a-z]+|[^a-z]+$/g, "");
    if (!t) return null;
    const verified = index.get(t) || index.get(t.replace(/'s$/, "")) || (t.length > 3 && (index.get(t.replace(/es$/, "")) || index.get(t.replace(/s$/, ""))));
    if (verified) return verified;
    const base = DRAFT && DRAFT.forms[t],
      vb = base && index.get(base);
    return (vb && { ...vb, form: t }) || draft(t) || draft(t.replace(/'s$/, "")) || null;
  }
  /* A sentence the player can tap: the line plays; dotted words open their card; a fixed phrase is one unit
     (tapping any of its words opens the phrase first). opt.zh (or a known line translation) adds a 「看中文」 toggle. */
  function sent(text, file, opt = {}) {
    if (!text) return "";
    const parts = String(text).split(/(\s+)/),
      wordIdx = parts.map((p, i) => (/^\s+$/.test(p) || !p ? -1 : i)).filter((i) => i >= 0),
      inPhrase = new Map(); // part index -> { key, shown }
    if (!opt.noWords)
      for (let k = 0; k < wordIdx.length; k++) {
        const hit = PHRASES.find((ph) => ph.words.every((w, j) => k + j < wordIdx.length && norm(parts[wordIdx[k + j]]) === w));
        if (!hit) continue;
        const span = wordIdx.slice(k, k + hit.words.length),
          shown = parts.slice(span[0], span[span.length - 1] + 1).join("").replace(/[^A-Za-z']+$/, "");
        span.forEach((i) => inPhrase.set(i, { key: hit.p, shown }));
        k += hit.words.length - 1;
      }
    const words = parts
      .map((part, i) => {
        if (/^\s+$/.test(part)) return part;
        const ph = inPhrase.get(i);
        if (ph) return `<span class="pw pw-p" data-p="${ESC(ph.key)}" data-pt="${ESC(ph.shown)}" role="button" tabindex="0" aria-label="片語 ${ESC(ph.shown)} 的意思和發音">${ESC(part)}</span>`;
        const w = opt.noWords ? null : lookup(part);
        const form = norm(part);
        return w ? `<span class="pw" data-w="${ESC(form || w.w)}" role="button" tabindex="0" aria-label="${ESC(form || w.w)} 的意思和發音">${ESC(part)}</span>` : ESC(part);
      })
      .join("");
    if (opt.wordsOnly) return words; // e.g. a fill-in-the-blank: words can be looked up, the line is not played
    const zh = opt.noZh ? "" : opt.zh || lineZh(text),
      zhHTML = zh ? `<button type="button" class="zh-btn" aria-expanded="false">看中文</button><span class="zh-line" hidden>${ESC(zh)}</span>` : "";
    if (opt.noBtn) return `<span class="say-s" data-say="${ESC(text)}"${file ? ` data-file="${ESC(file)}"` : ""}>${words}</span>${zhHTML}`;
    return `<span class="say-s" data-say="${ESC(text)}"${file ? ` data-file="${ESC(file)}"` : ""} role="button" tabindex="0">${words}</span><span class="say-btn" data-say="${ESC(text)}"${file ? ` data-file="${ESC(file)}"` : ""} role="button" tabindex="0" aria-label="播放整句">🔊</span>${zhHTML}`;
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
  /* Resolves true when the sound played to the end, false if it could not play (or a newer tap replaced it). */
  function play(text, file) {
    let resolve;
    const result = new Promise((r) => (resolve = r));
    const my = ++seq;
    stopAll();
    busy(true);
    let done = false;
    const fin = (ok) => {
      if (done) return;
      done = true;
      clearTimeout(guard);
      busy(false);
      resolve(ok !== false && my === seq);
    };
    const guard = setTimeout(() => fin(false), 12000);
    const tts = () => {
      try {
        if (my !== seq || !window.speechSynthesis) return fin(false);
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "en-US";
        u.rate = 0.85;
        const v = (speechSynthesis.getVoices() || []).find((x) => /^en[-_]US/i.test(x.lang)) || (speechSynthesis.getVoices() || []).find((x) => /^en/i.test(x.lang));
        if (v) u.voice = v;
        u.onend = () => fin(true);
        u.onerror = () => fin(false);
        speechSynthesis.speak(u);
      } catch (e) {
        fin(false);
      }
    };
    if (!file || typeof VOICE === "undefined") {
      tts();
      return result;
    }
    try {
      VOICE.onended = () => my === seq && fin(true);
      VOICE.onerror = () => (my === seq ? tts() : fin(false));
      VOICE.src = file;
      VOICE.currentTime = 0;
      VOICE.volume = 1;
      const p = VOICE.play();
      if (p) p.catch(() => (my === seq ? tts() : fin(false)));
    } catch (e) {
      tts();
    }
    // a newer tap ends this one for the busy count
    const check = setInterval(() => {
      if (my !== seq) {
        clearInterval(check);
        fin(false);
      } else if (done) clearInterval(check);
    }, 100);
    return result;
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
      document.body.appendChild(card);
    } else if (!card.hidden) busy(false);
    card.setAttribute("aria-label", "單字發音");
    card.hidden = false;
    busy(true);
    card.innerHTML = `<b class="wd-w">${w.form ? `${ESC(w.form)} <small>→ 原形 ${ESC(w.w)}</small>` : ESC(w.w)}</b> ${w.kk ? `<span class="wd-kk">${ESC(w.kk)}</span>` : '<span class="wd-none">音標待補（還沒有核對過的 KK）</span>'}<span class="wd-z">${ESC(w.z || "")}${w.pos ? ` <small>（${ESC(w.pos)}）</small>` : ""}</span>${w.draft ? '<span class="wd-none">釋義草稿，待教學校對</span>' : ""}${w.au ? "" : '<span class="wd-none">🔊 裝置語音念整個字（正式配音待補）</span>'}<span class="wd-row"><button type="button" class="wd-play">🔊 再聽一次</button><button type="button" class="wd-close">✕ 關閉</button></span>`;
    // the word as it appears ("went"): its recording only when it is the bank word itself
    const say = () => (w.form ? play(w.form, "") : play(w.w, w.au));
    card.querySelector(".wd-play").onclick = say;
    card.querySelector(".wd-close").onclick = closeWord;
    say();
  }
  /* A fixed phrase: its meaning as one unit and the whole phrase played first; its single words on request. */
  function openPhrase(key, shown) {
    const ph = phrase(key);
    if (!ph) return;
    const text = shown || ph.p;
    if (!card) {
      card = document.createElement("div");
      card.className = "wd-card";
      card.setAttribute("role", "dialog");
      document.body.appendChild(card);
    } else if (!card.hidden) busy(false);
    card.setAttribute("aria-label", "片語意思與發音");
    card.hidden = false;
    busy(true);
    const singles = text.split(/\s+/).map((w) => {
      const f = norm(w),
        hit = lookup(w);
      return hit ? `<span class="pw" data-w="${ESC(f)}" role="button" tabindex="0">${ESC(w.replace(/[^A-Za-z']+$/, ""))}</span>` : `<span class="wd-plain">${ESC(w)}</span>`;
    });
    card.innerHTML = `<small class="wd-tag">片語・整組理解</small><b class="wd-w wd-phrase">${ESC(text)}</b><span class="wd-z">${ESC(ph.zh)}</span>${ph.note ? `<small class="wd-note">${ESC(ph.note)}</small>` : ""}<span class="wd-none">🔊 裝置語音念整組（正式配音待補）</span><span class="wd-row"><button type="button" class="wd-play">🔊 再聽一次</button><button type="button" class="wd-words" aria-expanded="false">查看個別單字</button><button type="button" class="wd-close">✕ 關閉</button></span><span class="wd-singles" hidden>${singles.join(" ")}</span>`;
    const say = () => play(text, "");
    card.querySelector(".wd-play").onclick = say;
    card.querySelector(".wd-close").onclick = closeWord;
    card.querySelector(".wd-words").onclick = (e) => {
      const list = card.querySelector(".wd-singles");
      list.hidden = !list.hidden;
      e.currentTarget.setAttribute("aria-expanded", String(!list.hidden));
    };
    say();
  }
  function closeWord() {
    if (!card || card.hidden) return;
    card.hidden = true;
    busy(false);
  }

  if (typeof document !== "undefined") {
    // Capture phase: a hear control never reaches an answer button, a dialog, or the map underneath.
    const act = (e) => {
      const zb = e.target.closest && e.target.closest(".zh-btn");
      if (zb) {
        // the line's Chinese: shown / folded again; never an answer
        e.preventDefault();
        e.stopPropagation();
        const line = zb.nextElementSibling;
        if (line && line.classList.contains("zh-line")) {
          line.hidden = !line.hidden;
          zb.setAttribute("aria-expanded", String(!line.hidden));
          zb.textContent = line.hidden ? "看中文" : "收起中文";
        }
        return;
      }
      const pp = e.target.closest && e.target.closest(".pw[data-p]");
      if (pp) {
        e.preventDefault();
        e.stopPropagation();
        return openPhrase(pp.dataset.p, pp.dataset.pt);
      }
      const wd = e.target.closest && e.target.closest(".pw[data-w]");
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
        if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches(".pw, .say-s, .say-btn, .qz-hear")) act(e); // .zh-btn is a real button: Enter clicks it already
        if (e.key === "Escape") closeWord();
      },
      true,
    );
  }
  return { sent, hear, optionText, play, openWord, openPhrase, closeWord, lookup, lineZh, phrase, get busy() { return busyN > 0; } };
})();
if (typeof module !== "undefined") module.exports = Pron;
