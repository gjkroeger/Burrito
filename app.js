(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const RADIUS_METERS = 16093.44;
  const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
  const OVERPASS = [
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass-api.de/api/interpreter'
  ];
  const CACHE_PREFIX = 'br-v2:';
  const RESULT_TTL = 15 * 60 * 1000;
  const GEOCODE_TTL = 7 * 24 * 60 * 60 * 1000;
  let lastResults = [];
  let searchSequence = 0;
  let activeController = null;

  function distanceMeters(aLat, aLon, bLat, bLon) {
    const rad = d => d * Math.PI / 180;
    const dLat = rad(bLat - aLat), dLon = rad(bLon - aLon);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }
  function directions(lat, lon) { return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`; }
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function cacheGet(key, ttl) {
    try {
      const item = JSON.parse(localStorage.getItem(CACHE_PREFIX + key) || 'null');
      if (item && Date.now() - item.savedAt < ttl) return item.value;
    } catch (_) {}
    return null;
  }
  function cacheSet(key, value) {
    try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ savedAt: Date.now(), value })); } catch (_) {}
  }
  async function fetchJson(url, options = {}, timeoutMs = 12000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error(`Service returned ${response.status}`);
      return await response.json();
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('The search service took too long to respond. Please try again in a moment.');
      throw err;
    } finally { clearTimeout(timer); }
  }
  async function geocode(query) {
    const key = 'geo:' + query.toLowerCase().replace(/\s+/g, ' ').trim();
    const cached = cacheGet(key, GEOCODE_TTL);
    if (cached) return cached;
    const url = NOMINATIM + '?format=jsonv2&limit=1&q=' + encodeURIComponent(query);
    const found = await fetchJson(url, { headers: { Accept: 'application/json' } }, 10000);
    if (!found.length) throw new Error("I couldn't find that location. Try a full address, city, or ZIP code.");
    const result = { lat: Number(found[0].lat), lon: Number(found[0].lon), label: found[0].display_name };
    cacheSet(key, result);
    return result;
  }
  function queryFor(lat, lon, includeMexican) {
    const around = `(around:${RADIUS_METERS},${lat},${lon})`;
    const parts = [
      `nwr${around}[amenity~"restaurant|fast_food|cafe",i][cuisine~"burrito|mexican|tex-mex|tacos",i]`,
      `nwr${around}[name~"burrito|taqueria|taco|mexican",i]`
    ];
    if (includeMexican) parts.push(`nwr${around}[description~"burrito|mexican|tex.mex|taqueria|taco",i]`);
    return `[out:json][timeout:18];(${parts.join(';')};);out center tags;`;
  }
  function mapTags(el) {
    const t = el.tags || {};
    const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) return null;
    const name = t.name || t.brand || t.operator;
    if (!name) return null;
    const searchable = [name, t.cuisine, t.description, t.amenity, t.food].filter(Boolean).join(' ').toLowerCase();
    if (!/burrito|mexican|tex.mex|taqueria|taco/.test(searchable)) return null;
    const address = [t['addr:housenumber'], t['addr:street'], t['addr:city'] || t['addr:town'] || t['addr:village'], t['addr:state']].filter(Boolean).join(' ') || 'Address not listed';
    return { id: `${el.type}/${el.id}`, name, lat: Number(lat), lon: Number(lon), address, cuisine: t.cuisine || '', website: t.website || t['contact:website'] || '', phone: t.phone || t['contact:phone'] || '', opening: t.opening_hours || '', amenity: t.amenity || '' };
  }
  function makeCard(p) {
    const menuQuery = encodeURIComponent(`${p.name} ${p.address} menu burrito`);
    const website = p.website && /^https?:\/\//i.test(p.website) ? `<a href="${esc(p.website)}" target="_blank" rel="noopener">Website</a>` : '';
    const specialty = p.cuisine ? `Cuisine: ${esc(p.cuisine.replaceAll('; ', ', '))}` : 'Burrito offering not verified from a menu';
    const hours = p.opening ? `<span class="tag">Hours listed: ${esc(p.opening)}</span>` : '';
    return `<article class="place"><div class="place-top"><div class="pin">🌯</div><div style="min-width:0;flex:1"><h3>${esc(p.name)}</h3><p class="address">${esc(p.address)}</p></div><span class="distance">${p.miles.toFixed(1)} mi</span></div><div class="tags"><span class="tag">${specialty}</span>${hours}<span class="tag">Open status not verified</span></div><div class="actions"><a href="${directions(p.lat, p.lon)}" target="_blank" rel="noopener">Directions</a><a href="https://www.google.com/search?q=${menuQuery}" target="_blank" rel="noopener">Check menu</a>${website}</div></article>`;
  }
  function render() {
    const sort = $('sort').value;
    const items = [...lastResults];
    if (sort === 'name') items.sort((a, b) => a.name.localeCompare(b.name)); else items.sort((a, b) => a.miles - b.miles);
    $('count').textContent = `${items.length} possible burrito spots within 10 miles`;
    $('results').innerHTML = items.length ? items.map(makeCard).join('') : '<div class="empty">No likely matches were found in the available map data. Try a nearby town or use the Google Maps link below to broaden the search.</div>';
  }
  async function findMappedPlaces(center, includeMexican, signal) {
    const query = queryFor(center.lat, center.lon, includeMexican);
    let lastError;
    for (const endpoint of OVERPASS) {
      try {
        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8', Accept: 'application/json' }, body: query, signal, cache: 'no-store' });
        if (!response.ok) throw new Error(`Map search service returned ${response.status}`);
        return await response.json();
      } catch (err) {
        if (err.name === 'AbortError') throw err;
        lastError = err;
      }
    }
    throw lastError || new Error('The map search service is temporarily unavailable.');
  }
  async function search() {
    const location = $('location').value.trim();
    if (!location) { $('status').textContent = 'Enter an address, city, or ZIP code first.'; return; }
    const sequence = ++searchSequence;
    if (activeController) activeController.abort();
    activeController = new AbortController();
    const signal = activeController.signal;
    const includeMexican = $('includeNearby').checked;
    $('searchBtn').disabled = true;
    $('status').textContent = 'Finding location…';
    $('results').innerHTML = '<div class="empty loading">Searching nearby mapped restaurants…</div>';
    try {
      const center = await geocode(location);
      if (sequence !== searchSequence) return;
      const cacheKey = `results:${center.lat.toFixed(3)}:${center.lon.toFixed(3)}:${includeMexican}`;
      const cached = cacheGet(cacheKey, RESULT_TTL);
      let data;
      if (cached) {
        data = cached;
        $('status').textContent = 'Loaded a recent cached search. Refresh again later for updated map data.';
      } else {
        $('status').textContent = 'Searching mapped restaurants (this can take a few seconds)…';
        const timeout = setTimeout(() => activeController?.abort(), 22000);
        try { data = await findMappedPlaces(center, includeMexican, signal); }
        finally { clearTimeout(timeout); }
      }
      if (sequence !== searchSequence) return;
      const dedup = new Map();
      for (const el of data.elements || []) {
        const p = mapTags(el); if (!p) continue;
        const d = distanceMeters(center.lat, center.lon, p.lat, p.lon);
        if (d > RADIUS_METERS) continue;
        p.miles = d / 1609.344;
        const key = (p.name + '|' + p.address).toLowerCase();
        const existing = dedup.get(key);
        if (!existing || (existing.address === 'Address not listed' && p.address !== 'Address not listed')) dedup.set(key, p);
      }
      lastResults = [...dedup.values()];
      if (!cached) cacheSet(cacheKey, data);
      $('status').textContent = `Search centered on ${center.label}. Distances are straight-line estimates; coverage depends on OpenStreetMap data.`;
      render();
    } catch (err) {
      if (sequence !== searchSequence) return;
      const message = err.name === 'AbortError' ? 'The restaurant search timed out. The public map service may be busy; please try again.' : (err.message || 'Something went wrong. Please try again.');
      $('status').textContent = message;
      $('results').innerHTML = `<div class="empty">${esc(message)}<p><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('burritos near ' + location)}" target="_blank" rel="noopener">Search Google Maps for burritos near this location</a></p></div>`;
    } finally {
      if (sequence === searchSequence) $('searchBtn').disabled = false;
    }
  }
  $('searchBtn').addEventListener('click', search);
  $('location').addEventListener('keydown', e => { if (e.key === 'Enter') search(); });
  $('sort').addEventListener('change', render);
  // Changing this option affects the next search only; avoid surprise network calls.
  $('includeNearby').addEventListener('change', () => { $('status').textContent = 'Search options changed. Tap “Find burritos” to search again.'; });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(reg => reg.update()).catch(() => {}));
  }
})();
