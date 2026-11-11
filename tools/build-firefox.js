#!/usr/bin/env node
// Builds the Firefox (desktop + Android) package from the same source as the Chrome build.
// Only manifest.json differs; all JS is shared (APIs missing on Android are feature-checked at runtime).
// Usage: node tools/build-firefox.js [outDir]   -> <outDir>/vegan-lens-firefox-<version>.zip (default /workspace)
'use strict';
const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const GECKO_ID = 'vegan-lens@veganlens.app'; // placeholder: keep it stable forever once published on AMO
const MIN_DESKTOP = '140.0', MIN_ANDROID = '142.0'; // MV3 event page + storage.session; 140/142 = first versions that read data_collection_permissions (AMO requires it)

function backgroundScripts() {
  const m = /importScripts\(([^)]*)\)/.exec(fs.readFileSync(path.join(ROOT, 'background.js'), 'utf8'));
  return [...(m ? m[1].match(/'[^']+'/g).map(s => s.slice(1, -1)) : []), 'background.js'];
}
function firefoxManifest(chromeManifest, scripts) {
  const m = JSON.parse(JSON.stringify(chromeManifest));
  m.background = { scripts: scripts || backgroundScripts() }; // Firefox MV3: event page, no service_worker
  m.browser_specific_settings = { gecko: { id: GECKO_ID, strict_min_version: MIN_DESKTOP, data_collection_permissions: { required: ['none'], optional: ['technicalAndInteraction'] } }, gecko_android: { strict_min_version: MIN_ANDROID } };
  // Firefox names the context-menu permission "menus"; "contextMenus" is an accepted alias on desktop and ignored on Android.
  m.permissions = (m.permissions || []).filter(p => !['offscreen', 'sidePanel', 'declarativeNetRequest', 'webNavigation'].includes(p));
  delete m.minimum_chrome_version; delete m.key; delete m.update_url; delete m.side_panel; delete m.offscreen;
  return m;
}
const EXCLUDE = new Set(['test', 'node_modules', '.git', 'telemetry', 'docs', 'tools']);
function files(dir = ROOT, rel = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) { if (!EXCLUDE.has(e.name)) out.push(...files(path.join(dir, e.name), r)); }
    else if (!/\.zip$|\.xpi$|^\.gitignore$|^\.DS_Store$/.test(e.name) && r !== 'manifest.json') out.push(r);
  }
  return out;
}
function build(outDir) {
  const chrome = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  const ff = firefoxManifest(chrome);
  const stage = fs.mkdtempSync(path.join(require('os').tmpdir(), 'vl-ff-'));
  for (const f of files()) { fs.mkdirSync(path.dirname(path.join(stage, f)), { recursive: true }); fs.copyFileSync(path.join(ROOT, f), path.join(stage, f)); }
  fs.writeFileSync(path.join(stage, 'manifest.json'), JSON.stringify(ff, null, 2) + '\n');
  const out = path.join(outDir || '/workspace', 'vegan-lens-firefox-' + chrome.version + '.zip');
  if (fs.existsSync(out)) fs.unlinkSync(out);
  execFileSync('python3', ['-c', 'import os,sys,zipfile\nz=zipfile.ZipFile(sys.argv[1],"w",zipfile.ZIP_DEFLATED)\nfor r,d,f in os.walk("."):\n  d.sort()\n  for n in sorted(f): z.write(os.path.join(r,n),os.path.relpath(os.path.join(r,n)))\nz.close()', out], { cwd: stage }); // python zipfile: no zip binary needed
  fs.rmSync(stage, { recursive: true, force: true });
  return { out, manifest: ff };
}
module.exports = { firefoxManifest, backgroundScripts, files, build, GECKO_ID };
if (require.main === module) { const r = build(process.argv[2]); console.log(r.out); }
