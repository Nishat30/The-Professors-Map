// Sends this phone's GPS to the map while the person has chosen to share. Used by the map page,
// so joining is just: name -> allow location -> you're on the map.
(function (root) {
  const PREFS = 'pm-share';
  const MIN_MOVE_M = 2;          // don't bother sending smaller moves
  const HEARTBEAT_MS = 15000;    // resend position this often even when standing still

  const prefs = () => PM.load(PREFS, { sharing: false });
  const setPrefs = (p) => PM.save(PREFS, p);

  const metersBetween = (a, b) => {
    const p = GEO.toMeters(CAMPUS, a.lat, a.lng), q = GEO.toMeters(CAMPUS, b.lat, b.lng);
    return Math.hypot(p.x - q.x, p.y - q.y);
  };

  /**
   * @param onChange called with { sharing, gps, acc, server } whenever something changes.
   *   gps: idle | asking | ok | vague | denied | unavailable | insecure
   */
  function start(onChange) {
    const me = PM.identity.get();
    if (!me) return null;
    let sharing = prefs().sharing;
    let gps = 'idle', acc = null, server = null;
    let watchId = null, wakeLock = null, smooth = null, lastSent = null;
    const emit = () => onChange?.({ sharing, gps, acc, server });

    // GPS can't tell floors apart: anyone inside the building is shown on the 7th floor.
    const sock = PM.connect({
      onOpen: () => [{ type: 'share', on: sharing }, { type: 'floor', on: true }],
      onMessage: (msg) => {
        const mine = (msg.type === 'update' ? [msg.teacher] : msg.teachers || []).find((t) => t.id === me.id);
        if (mine) { server = mine; emit(); }
      },
    });

    function send(lat, lng, a) {
      if (lastSent && metersBetween({ lat, lng }, lastSent) < MIN_MOVE_M && Date.now() - lastSent.at < HEARTBEAT_MS) return;
      sock.send({ type: 'floor', on: true });
      sock.send({ type: 'loc', lat, lng, acc: a });
      lastSent = { lat, lng, at: Date.now() };
    }

    function onFix(pos) {
      const { latitude: lat, longitude: lng, accuracy: a } = pos.coords;
      acc = a;
      if (a > CAMPUS.maxAcc && !GEO.surelyOff(CAMPUS, lat, lng, a)) { gps = 'vague'; return emit(); }
      gps = 'ok';
      // Smooth the jitter: trust precise fixes more than vague ones. Start over after a big jump.
      if (!smooth || smooth.acc > CAMPUS.maxAcc || a > CAMPUS.maxAcc || metersBetween(smooth, { lat, lng }) > 100) smooth = { lat, lng, acc: a };
      else {
        const k = Math.max(0.25, Math.min(1, 10 / a));
        smooth = { lat: smooth.lat + (lat - smooth.lat) * k, lng: smooth.lng + (lng - smooth.lng) * k, acc: a };
      }
      send(smooth.lat, smooth.lng, smooth.acc);
      emit();
    }

    function startGps() {
      stopGps();
      if (!root.isSecureContext || !navigator.geolocation) { gps = 'insecure'; return emit(); }
      gps = 'asking'; emit();
      watchId = navigator.geolocation.watchPosition(onFix, (err) => {
        gps = err.code === 1 ? 'denied' : 'unavailable';
        emit();
      }, { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
    }
    function stopGps() {
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      watchId = null; smooth = null; lastSent = null;
    }

    async function keepAwake(on) {
      try {
        if (on && !wakeLock && navigator.wakeLock) {
          wakeLock = await navigator.wakeLock.request('screen');
          wakeLock.addEventListener('release', () => (wakeLock = null));
        } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
      } catch { /* not supported or denied */ }
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && sharing) keepAwake(true);
    });

    setInterval(() => {
      if (!sharing) return;
      if (smooth) send(smooth.lat, smooth.lng, smooth.acc);
      else sock.send({ type: 'ping' });
    }, 5000);

    function setSharing(on) {
      sharing = on;
      setPrefs({ sharing: on });
      sock.send({ type: 'share', on });
      if (on) { sock.send({ type: 'floor', on: true }); startGps(); } else { stopGps(); gps = 'idle'; }
      keepAwake(on);
      emit();
    }

    if (sharing) { startGps(); keepAwake(true); }
    emit();
    return { setSharing, retry: startGps, me };
  }

  root.Share = { start, prefs, setPrefs };
})(globalThis);
