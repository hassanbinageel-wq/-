// Builds the per-turn tool context shared by all tools.
export function makeContextFactory({ host, analyzer, index, memory, settings, helper, fsio, ui, log = () => {}, state = {} }) {
  const getMemory = typeof memory === "function" ? memory : () => memory;
  const getIndex = typeof index === "function" ? index : () => index;
  const getAnalyzer = typeof analyzer === "function" ? analyzer : () => analyzer;
  return ({ stop, signal, userText }) => {
    const ctx = {
      host,
      helper,
      fsio,
      settings,
      ui,
      log,
      stop,
      signal,
      state,
      get memory() {
        return getMemory();
      },
      get index() {
        return getIndex();
      },
      get analyzer() {
        return getAnalyzer();
      },
      turn: { backedUp: new Set(), userText },
      progress: (p) => ui.progress?.(p),
      async ensureConsent(kind) {
        const consent = settings.get("consent") || {};
        if (consent[kind]) return true;
        const ok = await ui.askConsent?.(kind);
        if (ok) await settings.set({ consent: { ...consent, [kind]: true } });
        return !!ok;
      },
    };
    return ctx;
  };
}
