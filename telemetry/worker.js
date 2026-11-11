// Cloudflare Worker that receives Vegan Lens opt-in daily stats and keeps only aggregate totals.
// It stores no IPs, headers or per-user records: each report is merged into a per-day total in KV (binding: STATS).
const ALLOWED = new Set(['v', 'day', 'features', 'mode', 'webMode', 'sensitivity', 'searchAssist', 'counts', 'reveals', 'offersShown', 'offersClicked', 'sharesClicked', 'images', 'adImages']);
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, GET', 'access-control-allow-headers': 'content-type' };
export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const url = new URL(req.url);
    if (req.method === 'GET' && url.pathname === '/v1/summary') {
      const list = await env.STATS.list({ prefix: 'day:' }); const out = {};
      for (const k of list.keys.slice(-60)) out[k.name.slice(4)] = await env.STATS.get(k.name, 'json');
      return Response.json(out, { headers: cors });
    }
    if (req.method !== 'POST' || url.pathname !== '/v1') return new Response('not found', { status: 404, headers: cors });
    let r; try { r = await req.json(); } catch (e) { return new Response('bad json', { status: 400, headers: cors }); }
    if (!r || typeof r !== 'object' || Object.keys(r).some(k => !ALLOWED.has(k)) || !/^\d{4}-\d{2}-\d{2}$/.test(r.day)) return new Response('rejected', { status: 400, headers: cors });
    const key = 'day:' + r.day, agg = (await env.STATS.get(key, 'json')) || { reports: 0, versions: {}, features: {}, modes: {}, counts: {}, reveals: 0, offersShown: 0, offersClicked: 0 };
    agg.reports++; agg.versions[r.v] = (agg.versions[r.v] || 0) + 1; agg.reveals += +r.reveals || 0; agg.offersShown = (agg.offersShown || 0) + (+r.offersShown || 0); agg.offersClicked = (agg.offersClicked || 0) + (+r.offersClicked || 0);
    agg.sharesClicked = agg.sharesClicked || {}; for (const [d, n] of Object.entries(r.sharesClicked || {})) if (/^(?:copy|email|x|facebook|reddit|whatsapp|telegram|linkedin|native)$/.test(d)) agg.sharesClicked[d] = (agg.sharesClicked[d] || 0) + (+n || 0);
    agg.images = agg.images || {}; for (const k of ['imagesSeen', 'imagesContextless', 'imagesContextlessUndecided']) agg.images[k] = (agg.images[k] || 0) + (+(r.images || {})[k] || 0);
    agg.adImages = agg.adImages || {}; for (const k of ['adsSeen', 'adsWithImages', 'adsImageTextless', 'adsTextlessUndecided']) agg.adImages[k] = (agg.adImages[k] || 0) + (+(r.adImages || {})[k] || 0); // other keys ignored
    for (const [k, on] of Object.entries(r.features || {})) if (on) agg.features[k] = (agg.features[k] || 0) + 1;
    for (const k of ['mode', 'webMode', 'sensitivity', 'searchAssist']) { const m = k + ':' + r[k]; agg.modes[m] = (agg.modes[m] || 0) + 1; }
    for (const [t, o] of Object.entries(r.counts || {})) { const a = agg.counts[t] = agg.counts[t] || {}; for (const [k, n] of Object.entries(o)) a[k] = (a[k] || 0) + (+n || 0); }
    await env.STATS.put(key, JSON.stringify(agg));
    return new Response('ok', { headers: cors });
  },
};
