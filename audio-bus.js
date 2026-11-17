/* One playback owner for words, KK demos, battles, dialogue and commute mode.
   The provider owns playback/recording; auxiliary UI holds (word cards) are ORed
   with provider busy so closing one source cannot resume another's battle clock. */
const AudioBus = (() => {
  let providerBusy = false, emitted = null, initialized = false;
  const holds = new Set(), normalized = new Set();
  let catalogReady = Promise.resolve();
  function emit() {
    const value = providerBusy || holds.size > 0;
    if (value === emitted) return;
    emitted = value;
    window.dispatchEvent(new CustomEvent('pron:busy', { detail: value }));
  }
  function init() {
    if (initialized) return catalogReady;
    initialized = true;
    AudioPractice.onBusy((busy) => { providerBusy = !!busy; emit(); });
    catalogReady = fetch('modules/audio-practice/processed-audio/normalize-plan.json')
      .then(r => r.ok ? r.json() : null)
      .then(data => { for (const f of data && data.files || []) if (typeof f.file === 'string' && !f.file.includes('..') && /\.mp3$/.test(f.file)) normalized.add(f.file); })
      .catch(() => {});
    return catalogReady;
  }
  function setHold(owner, on) { if (on) holds.add(owner); else holds.delete(owner); emit(); }
  function balanced() { return typeof DP === 'undefined' || DP.balanced !== false; }
  function source(file) {
    if (!file || !balanced()) return file || '';
    try {
      const base = new URL('./', document.baseURI), url = new URL(file, base);
      const prefix = new URL('assets/voice/', base);
      if (url.origin !== prefix.origin || !url.pathname.startsWith(prefix.pathname) || url.search || url.hash) return file;
      const relative = url.pathname.slice(prefix.pathname.length);
      return normalized.has(relative) ? new URL('modules/audio-practice/processed-audio/' + relative, base).href : file;
    } catch (_) { return file; }
  }
  function play(opt = {}) {
    init();
    // Call the provider during the original gesture; do not await an asset fetch.
    return AudioPractice.play({ ...opt, url: source(opt.url) });
  }
  function stop() { AudioPractice.stop(); }
  function stopAll() {
    AudioPractice.stop();
    AudioPractice.cancelListen();
    return AudioPractice.stopRecording();
  }
  function setBalanced(value) {
    if (typeof DP !== 'undefined') { DP.balanced = !!value; if (typeof saveDP === 'function') saveDP(); }
  }
  return { init, play, stop, stopAll, source, setHold, setBalanced,
    startRecording: opt => AudioPractice.startRecording(opt),
    stopRecording: () => AudioPractice.stopRecording(),
    get busy() { return providerBusy || holds.size > 0; },
    get normalizedCount() { return normalized.size; },
  };
})();
