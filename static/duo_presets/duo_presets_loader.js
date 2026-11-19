/* Installs the Duo presets into CaptionStudio's "My presets" (localStorage key cs_presets).
   Add to the website page:  <script src="/static/duo_presets/duo_presets_loader.js"></script>
   Runs once per version, never removes anything, never duplicates (matches by name). */
(async function () {
  const VERSION = 'duo-v4';
  try {
    if (localStorage.getItem('cs_duo_installed') === VERSION) return;
    const list = await (await fetch('/static/duo_presets/duo_presets.json')).json();
    let mine = []; try { mine = JSON.parse(localStorage.getItem('cs_presets') || '[]'); } catch (e) {}
    list.forEach((p) => {
      const idx = mine.findIndex(x => (x && (x.id === p.id || x.name === p.name)));
      if (idx >= 0) {
        mine[idx] = Object.assign({}, mine[idx], p);
      } else {
        mine.push(p);
      }
    });
    localStorage.setItem('cs_presets', JSON.stringify(mine));
    localStorage.setItem('cs_duo_installed', VERSION);
  } catch (e) { console.warn('duo presets not installed', e); }
})();
