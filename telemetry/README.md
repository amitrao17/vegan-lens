# Vegan Lens opt-in stats receiver

1. Create a free Cloudflare account, then a KV namespace named `STATS`.
2. Create a Worker from `worker.js` and bind the KV namespace as `STATS`.
3. Put the Worker URL plus `/v1` into `STATS_URL` in `background.js` and rebuild.
4. View daily totals at `<worker-url>/v1/summary`.

Users must switch on "Share anonymous usage stats" in the popup; it is off by default. The extension rounds the counts to the nearest 5 and sends no URLs, titles, search terms or IDs. The Worker keeps only per-day totals.

0.4.49 adds two aggregate objects to the report, `images` {imagesSeen, imagesContextless, imagesContextlessUndecided} and `adImages` {adsSeen, adsWithImages, adsImageTextless, adsTextlessUndecided}, used to size on-device OCR. They are numbers only; the Worker keeps only these keys.
