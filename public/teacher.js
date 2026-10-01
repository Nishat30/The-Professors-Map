// Join page: 1. your name  2. allow location  3. off to the map, which keeps sending your position.
(() => {
  const $ = (id) => document.getElementById(id);
  let me = PM.identity.get();

  const toMap = () => location.replace(`/?me=${encodeURIComponent(me.id)}`);
  if (me && Share.prefs().sharing) return toMap(); // already joined on this phone

  function render() {
    const step = me ? 2 : 1;
    $('nameCard').classList.toggle('hide', step !== 1);
    $('locCard').classList.toggle('hide', step !== 2);
    ['step1', 'step2', 'step3'].forEach((id, i) => {
      $(id).classList.toggle('on', i + 1 === step);
      $(id).classList.toggle('done', i + 1 < step);
    });
    if (me) $('hello').textContent = `Hi ${me.name}, one last thing`;
    else $('nameInput').focus();
  }

  $('joinForm').onsubmit = (e) => {
    e.preventDefault();
    const name = $('nameInput').value.trim().replace(/\s+/g, ' ');
    if (!name) return;
    me = PM.identity.set(name);
    render();
  };
  $('rename').onclick = () => { $('nameInput').value = me.name; me = null; render(); };

  function problem(html) {
    $('problem').innerHTML = html;
    $('problem').classList.toggle('hide', !html);
  }

  $('allow').onclick = () => {
    if (!window.isSecureContext || !navigator.geolocation) {
      return problem('<b>This link can’t use location.</b> Phones only share location over <i>https://</i>. Open the https link you were sent.');
    }
    $('allow').disabled = true;
    $('allow').textContent = 'Waiting for your phone…';
    const go = () => { Share.setPrefs({ sharing: true }); toMap(); };
    navigator.geolocation.getCurrentPosition(go, (err) => {
      $('allow').disabled = false;
      $('allow').textContent = 'Try again';
      if (err.code !== 1) return go(); // permission is fine, the fix is just slow: the map keeps trying
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      problem(`<b>Location was blocked.</b> Turn it on, then tap Try again.<ol>${ios
        ? '<li><i>Settings → Privacy &amp; Security → Location Services</i>: on.</li><li>In that list, <i>Safari Websites</i> (or your browser) → <i>While Using the App</i>.</li><li>Come back and reload this page.</li>'
        : '<li>Tap the icon left of the web address (🔒 or ⚙).</li><li><i>Permissions → Location → Allow</i>.</li><li>Make sure your phone’s Location is on.</li>'}</ol>`);
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  };

  render();
})();
