// Shared by the teacher and check-in pages: identity in localStorage + a reconnecting socket.
(function (root) {
  const KEY = 'pm-identity';

  function load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode: identity lasts this tab only */ }
  }

  const newId = () =>
    (root.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2, 10)).slice(0, 36);

  const identity = {
    get: () => load(KEY, null),
    set: (name) => {
      const cur = load(KEY, null);
      const next = { id: cur?.id || newId(), name };
      save(KEY, next);
      return next;
    },
  };

  // Every (re)connect re-sends `join` plus whatever onOpen returns, so the server
  // always matches this phone even after a restart.
  function connect({ onOpen, onMessage, onStatus }) {
    let ws, retry = 500, queue = [];
    const open = () => {
      ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);
      ws.onopen = () => {
        retry = 500;
        onStatus?.(true);
        const me = identity.get();
        if (me) ws.send(JSON.stringify({ type: 'join', ...me }));
        for (const m of onOpen?.() || []) ws.send(JSON.stringify(m));
        for (const m of queue.splice(0)) ws.send(JSON.stringify(m));
      };
      ws.onmessage = (ev) => onMessage?.(JSON.parse(ev.data));
      ws.onclose = () => { onStatus?.(false); setTimeout(open, (retry = Math.min(retry * 2, 8000))); };
    };
    open();
    return {
      send(msg) {
        if (ws.readyState === 1) ws.send(JSON.stringify(msg));
        else if (msg.type !== 'loc') queue.push(msg);
      },
    };
  }

  root.PM = { identity, connect, load, save };
})(globalThis);
