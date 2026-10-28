const DEFAULTS = { checkAds: true, enabled: true, mode: 'dim', strictness: 'strict', showSwaps: true, groceryMode: 'hide',
  webEnabled: true, webMode: 'dim', sensitivity: 'med', siteBlock: [], siteAllow: [], pageBlock: [], webAllowOnly: false, contextCards: true, markPeople: true, markMeat: true, searchAssist: 'suggest', whitelist: [], whitelistDisabled: [], debug: false };
const SENS = ['low', 'med', 'high'];
const $ = id => document.getElementById(id);
const toList = v => v.split(/[\s,]+/).map(d => d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')).filter(Boolean);
const set = o => chrome.storage.sync.set(o);
let host = null;

$('version').textContent = 'v' + chrome.runtime.getManifest().version;
const showTotal = t => { if (!t) return; $('total').textContent = t.count.toLocaleString(); $('since').textContent = t.since ? 'since ' + new Date(t.since).toLocaleDateString() : 'all time'; };
chrome.runtime.sendMessage({ type: 'getTotal' }, showTotal);
$('resetTotal').addEventListener('click', e => { e.preventDefault(); if (confirm('Reset the all-time non-vegan items count?')) chrome.runtime.sendMessage({ type: 'resetTotal' }, showTotal); });

chrome.storage.sync.remove('sortTop'); // 0.4.0: sort-to-top removed; drop any stored value
chrome.storage.sync.get(DEFAULTS, s => {
  for (const k of ['enabled', 'mode', 'strictness', 'showSwaps', 'groceryMode', 'webEnabled', 'webMode', 'webAllowOnly', 'contextCards', 'markPeople', 'markMeat', 'searchAssist', 'checkAds', 'debug']) {
    const el = $(k);
    if (el.type === 'checkbox') el.checked = s[k]; else el.value = s[k];
    el.addEventListener('change', () => set({ [k]: el.type === 'checkbox' ? el.checked : el.value }));
  }
  const sens = $('sensitivity');
  const showSens = () => $('sensLabel').textContent = '(' + SENS[sens.value] + ')';
  sens.value = SENS.indexOf(s.sensitivity); showSens();
  sens.addEventListener('input', showSens);
  sens.addEventListener('change', () => set({ sensitivity: SENS[sens.value] }));
  for (const k of ['siteBlock', 'siteAllow']) {
    $(k).value = s[k].join('\n');
    $(k).addEventListener('change', () => set({ [k]: toList($(k).value) }));
  }
  renderWhitelist(s);
  $('wlForm').addEventListener('submit', e => {
    e.preventDefault();
    const v = $('wlInput').value.trim(); if (!VeganBrands.norm(v).trim()) return;
    chrome.storage.sync.get(DEFAULTS, cur => {
      if (!cur.whitelist.some(x => VeganBrands.norm(x) === VeganBrands.norm(v))) cur.whitelist = [...cur.whitelist, v];
      set({ whitelist: cur.whitelist }); $('wlInput').value = ''; renderWhitelist(cur);
    });
  });
  // activeTab grants the current tab's URL when the popup is opened.
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab) chrome.runtime.sendMessage({ type: 'getCounts', tabId: tab.id }, c => { if (c) for (const k in c) { const e = $('c-' + k); if (e) e.textContent = c[k]; } });
    try { host = new URL(tab.url).hostname.replace(/^www\./, ''); } catch (e) {}
    const pk = tab && VeganPage.pageKey(tab.url), pbox = $('pageOff'), prow = pbox.closest('.page');
    if (!pk) { $('page').textContent = 'n/a'; pbox.disabled = true; }
    else {
      const u = new URL(pk); $('page').textContent = u.hostname.replace(/^www\./, '') + u.pathname; $('page').title = pk;
      const renderPage = list => { const off = list.includes(pk); pbox.checked = off; prow.classList.toggle('off', off); $('h-icon').src = off ? 'icons/icon48-red.png' : 'icons/icon48.png'; };
      renderPage(s.pageBlock);
      pbox.addEventListener('change', () => chrome.storage.sync.get(DEFAULTS, cur => {
        const list = VeganPage.togglePage(cur.pageBlock, tab.url); set({ pageBlock: list }); renderPage(list);
      }));
    }
    const btn = $('toggleSite');
    if (!host || !/^https?:/.test(tab.url)) { $('site').textContent = 'n/a'; btn.disabled = true; return; }
    $('site').textContent = host;
    const render = list => { const on = list.includes(host); btn.textContent = on ? 'Enable on this site' : 'Disable on this site'; btn.classList.toggle('on', on); };
    render(s.siteBlock);
    btn.addEventListener('click', () => chrome.storage.sync.get(DEFAULTS, cur => {
      const list = cur.siteBlock.includes(host) ? cur.siteBlock.filter(d => d !== host) : [...cur.siteBlock, host];
      set({ siteBlock: list }); $('siteBlock').value = list.join('\n'); render(list);
    }));
  });
});

function wlItem(text, btnText, cls, onClick) {
  const li = document.createElement('li'); if (cls) li.className = cls;
  const sp = document.createElement('span'); sp.textContent = text;
  const b = document.createElement('button'); b.type = 'button'; b.textContent = btnText; if (cls === 'off') b.classList.add('on');
  b.addEventListener('click', onClick); li.append(sp, b); return li;
}
function renderWhitelist(s) {
  const u = $('wlUser'); u.innerHTML = '';
  if (!s.whitelist.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = 'No entries yet'; u.append(li); }
  for (const n of s.whitelist) u.append(wlItem(n, 'Remove', '', () => chrome.storage.sync.get(DEFAULTS, cur => {
    cur.whitelist = cur.whitelist.filter(x => x !== n); set({ whitelist: cur.whitelist }); renderWhitelist(cur);
  })));
  const b = $('wlBuiltin'); b.innerHTML = ''; $('wlCount').textContent = VeganBrands.BUILTIN.length;
  const off = new Set(s.whitelistDisabled);
  for (const e of VeganBrands.BUILTIN) {
    const dis = off.has(e.name);
    b.append(wlItem(e.name, dis ? 'Enable' : 'Disable', dis ? 'off' : '', () => chrome.storage.sync.get(DEFAULTS, cur => {
      cur.whitelistDisabled = cur.whitelistDisabled.includes(e.name) ? cur.whitelistDisabled.filter(x => x !== e.name) : [...cur.whitelistDisabled, e.name];
      set({ whitelistDisabled: cur.whitelistDisabled }); renderWhitelist(cur);
    })));
  }
}
