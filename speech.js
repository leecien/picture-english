/* Speech judging for spoken answers (commute mode, read-aloud practice).
   What this can and cannot say: it compares the WORDS a speech recognizer heard with the target, in order.
   Green means "the recognizer heard this word in this place", not that the sounds, KK or accent were assessed;
   phoneme-level pronunciation scoring would need a separate speech-assessment service. */
const Speech = (() => {
  const CONTR = {
    "i'm": "i am", "it's": "it is", "don't": "do not", "can't": "cannot", "won't": "will not", "i've": "i have", "she's": "she is", "he's": "he is",
    "we're": "we are", "i'd": "i would", "that's": "that is", "what's": "what is", "where's": "where is", "there's": "there is", "let's": "let us",
    "i'll": "i will", "we'll": "we will", "you're": "you are", "they're": "they are", "isn't": "is not", "doesn't": "does not", "hasn't": "has not",
    "haven't": "have not", "didn't": "did not", "wasn't": "was not", "aren't": "are not", "couldn't": "could not", "shouldn't": "should not",
    "wouldn't": "would not", "here's": "here is", "how's": "how is", "who's": "who is", "you've": "you have", "we've": "we have", "they've": "they have",
    "he'll": "he will", "she'll": "she will", "they'll": "they will", "it'll": "it will", "you'll": "you will", "we'd": "we would", "you'd": "you would",
    ok: "okay", "can not": "cannot",
  };
  /* Recognizers write numbers as digits ("5 days", "3:00", "2nd"); spell them out so they match the written answer. */
  const NUM1 = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split(" "),
    NUM10 = "  twenty thirty forty fifty sixty seventy eighty ninety".split(" "),
    ORD = { 1: "first", 2: "second", 3: "third", 4: "fourth", 5: "fifth", 6: "sixth", 7: "seventh", 8: "eighth", 9: "ninth", 10: "tenth" };
  function numWords(n) {
    if (n < 20) return NUM1[n];
    if (n < 100) return NUM10[Math.floor(n / 10)] + (n % 10 ? " " + NUM1[n % 10] : "");
    if (n < 1000) return NUM1[Math.floor(n / 100)] + " hundred" + (n % 100 ? " " + numWords(n % 100) : "");
    if (n < 10000) return numWords(Math.floor(n / 1000)) + " thousand" + (n % 1000 ? " " + numWords(n % 1000) : "");
    return String(n);
  }
  const spellNums = (s) =>
    s
      .replace(/\b(\d{1,2}):00\b/g, "$1 o'clock")
      .replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, (m, d) => ORD[+d] || m)
      .replace(/(\d),(\d{3})/g, "$1$2")
      .replace(/\b\d{1,4}\b/g, (m) => numWords(+m));
  /* Lower case, no punctuation, contractions expanded, numbers spelled out. */
  const norm = (s) =>
    spellNums(String(s).toLowerCase().replace(/[’']/g, "'").replace(/-/g, " "))
      .split(/\s+/)
      .map((w) => CONTR[w.replace(/[^a-z']/g, "")] || w)
      .join(" ")
      .replace(/[^a-z0-9' ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const toks = (s) => (norm(s) ? norm(s).split(" ") : []);
  function lev(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  const FILLER = new Set(["um", "uh", "er", "erm", "ah", "hmm", "mm"]);
  const ARTICLE = new Set(["a", "an", "the"]);

  /* Ordered alignment of the target's words against what was heard (edit distance with backtrace).
     Repeated words are matched by position, never "somewhere in the sentence". Two words written as one
     ("check out" / "checkout") match both ways. Returns one entry per written target word:
       st: "ok" heard here · "miss" not heard · "sub" something else heard here (heard: what) */
  function align(target, heard) {
    const disp = String(target).trim().split(/\s+/).filter(Boolean),
      T = [],
      owner = [];
    disp.forEach((w, i) => toks(w).forEach((t) => (T.push(t), owner.push(i))));
    const H = toks(heard).filter((w) => !FILLER.has(w)),
      n = T.length,
      m = H.length,
      INF = 1e9,
      D = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(INF)),
      B = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(null));
    D[0][0] = 0;
    for (let i = 0; i <= n; i++)
      for (let j = 0; j <= m; j++) {
        const c = D[i][j];
        if (c === INF) continue;
        const relax = (ii, jj, cost, op) => {
          if (c + cost < D[ii][jj]) (D[ii][jj] = c + cost), (B[ii][jj] = { i, j, op });
        };
        if (i < n && j < m) relax(i + 1, j + 1, T[i] === H[j] ? 0 : 1, T[i] === H[j] ? "ok" : "sub");
        if (i < n) relax(i + 1, j, 1, "miss");
        if (j < m) relax(i, j + 1, 1, "extra");
        if (i + 1 < n && j < m && T[i] + T[i + 1] === H[j]) relax(i + 2, j + 1, 0, "ok2t");
        if (i < n && j + 1 < m && H[j] + H[j + 1] === T[i]) relax(i + 1, j + 2, 0, "ok2h");
      }
    const st = new Array(n).fill("miss"),
      got = new Array(n).fill(""),
      extra = [];
    for (let i = n, j = m; i || j; ) {
      const b = B[i][j];
      if (b.op === "ok" || b.op === "sub") (st[b.i] = b.op), (got[b.i] = H[b.j]);
      else if (b.op === "ok2t") (st[b.i] = st[b.i + 1] = "ok"), (got[b.i] = got[b.i + 1] = H[b.j]);
      else if (b.op === "ok2h") (st[b.i] = "ok"), (got[b.i] = H[b.j] + " " + H[b.j + 1]);
      else if (b.op === "extra") extra.unshift(H[b.j]);
      i = b.i;
      j = b.j;
    }
    const words = disp.map((w, k) => {
      const idx = owner.map((o, t) => (o === k ? t : -1)).filter((t) => t >= 0),
        s = idx.map((t) => st[t]);
      const state = !idx.length || s.every((x) => x === "ok") ? "ok" : s.every((x) => x === "miss") ? "miss" : "sub";
      return { w, st: state, heard: idx.map((t) => got[t]).filter(Boolean).join(" ") };
    });
    // One-word targets: "a cat" / "the cat" still read the word itself.
    const extraLeft = n <= 1 ? extra.filter((x) => !ARTICLE.has(x)) : extra;
    const okN = st.filter((x) => x === "ok").length;
    return { words, extra: extraLeft, score: n ? okN / n : 0, pass: n > 0 && okN === n && !extraLeft.length, heard: H.join(" ") };
  }

  /* Judge one recognition result.
     alts: the recognizer's candidates, best first (alts.conf = confidence of the best one, when given).
     accept: other replies that are explicitly valid for this item (e.g. the same question's other answer).
     Rule: only the BEST candidate is graded and coloured. If it fails but a lower candidate happens to match,
     the result is "uncertain" (not right, not wrong); so is a very low confidence. pass = every target word heard,
     in order, nothing else said (fillers ignored). partial = at least half the words. */
  const CONF_MIN = 0.35;
  function judge(target, alts, opt = {}) {
    const list = (alts || []).map((a) => String(a || "").trim()).filter(Boolean);
    const targets = [target, ...(opt.accept || [])].filter(Boolean);
    if (!list.length) return { status: "silent", words: String(target).split(/\s+/).map((w) => ({ w, st: "none" })), extra: [], basis: "", target, rule: "no speech" };
    const best = (said) =>
      targets
        .map((t) => ({ t, r: align(t, said) }))
        .sort((a, b) => (b.r.pass - a.r.pass) || (b.r.score - a.r.score))[0];
    const top = best(list[0]);
    const out = { target: top.t, words: top.r.words, extra: top.r.extra, score: top.r.score, basis: list[0], alt: 0, conf: alts && alts.conf };
    if (alts && typeof alts.conf === "number" && alts.conf > 0 && alts.conf < CONF_MIN) return { ...out, status: "uncertain", rule: `low confidence ${alts.conf.toFixed(2)}` };
    if (top.r.pass) return { ...out, status: "pass", rule: "best candidate: every word in order" };
    const other = list.slice(1).findIndex((a) => best(a).r.pass);
    if (other >= 0) return { ...out, status: "uncertain", rule: `best candidate failed; candidate ${other + 1} matched` };
    return { ...out, status: top.r.score >= 0.5 ? "partial" : "fail", rule: `best candidate ${Math.round(top.r.score * 100)}% of words` };
  }

  /* Coloured target: colour plus a text mark, so it does not rely on colour alone. */
  const ESC = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const MARK = { ok: "✓", miss: "漏", sub: "≠", none: "", pending: "" };
  function html(j, uncertain) {
    const ws = j.words
      .map((x) => {
        const st = uncertain && x.st !== "none" ? "unsure" : x.st;
        return `<span class="sw sw-${st}" title="${st === "sub" && x.heard ? "聽到：" + ESC(x.heard) : ""}">${ESC(x.w)}${MARK[x.st] && !uncertain ? `<sup>${MARK[x.st]}</sup>` : ""}</span>`;
      })
      .join(" ");
    const ex = j.extra && j.extra.length ? `<small class="sw-extra">多說了：${j.extra.map(ESC).join(" ")}</small>` : "";
    return `<span class="sw-line">${ws}</span>${ex}`;
  }
  /* Short spoken feedback (for driving: no need to read colours). */
  function problems(j) {
    return j.words.filter((x) => x.st === "miss" || x.st === "sub").map((x) => x.w.replace(/[^A-Za-z0-9'’-]/g, ""));
  }
  return { norm, toks, lev, align, judge, html, problems, CONF_MIN };
})();
if (typeof module !== "undefined") module.exports = Speech;
