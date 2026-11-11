// 0.4.67: compact product-card badge pills (Amazon + grocery).
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const B = require('../brand.js');

function fakeDoc() {
  const mk = tag => {
    const el = {
      tagName: tag.toUpperCase(), attrs: {}, children: [], className: '', style: {},
      ownerDocument: null, parentElement: null, _t: '',
      setAttribute(k, v) { this.attrs[k] = String(v); },
      getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
      removeAttribute(k) { delete this.attrs[k]; },
      addEventListener() {},
      append(...n) { for (const x of n) { if (x && typeof x === 'object') x.parentElement = this; this.children.push(x); } },
      appendChild(n) { this.append(n); return n; },
      prepend(...n) { for (const x of n) { if (x && typeof x === 'object') x.parentElement = this; } this.children.unshift(...n); },
      contains(n) { return n === this || this.children.some(c => c === n || (c && c.contains && c.contains(n))); },
      querySelector(sel) {
        const walk = (nodes) => {
          for (const n of nodes) {
            if (!n || typeof n === 'string') continue;
            if (sel.startsWith('.') && (n.className || '').split(/\s+/).includes(sel.slice(1))) return n;
            const hit = walk(n.children || []); if (hit) return hit;
          }
          return null;
        };
        return walk(this.children);
      },
      get textContent() { return this.children.map(c => typeof c === 'string' ? c : (c.textContent || '')).join('') + (this._t || ''); },
      set textContent(v) { this.children = []; this._t = String(v); },
    };
    return el;
  };
  const doc = { createElement: mk, activeElement: null };
  // wire ownerDocument
  const _ce = doc.createElement;
  doc.createElement = tag => { const e = _ce(tag); e.ownerDocument = doc; return e; };
  return doc;
}

// Mirror of content.js badge() for behavioral coverage (source is also guarded below).
function makeBadge(doc, S, cls, text, title, extra) {
  const mark = (el, opts) => B.mark(el, { ...(opts || {}), doc });
  const compact = (S.badgeStyle || 'compact') !== 'full';
  const b = doc.createElement('span');
  b.className = 'vl-badge ' + cls + (compact ? ' vl-badge-compact' : '');
  b.setAttribute('role', 'status');
  if (title) b.title = title;
  if (compact) {
    b.tabIndex = 0;
    const tip = doc.createElement('span'); tip.className = 'vl-badge-tip';
    const lab = doc.createElement('span'); lab.className = 'vl-badge-text'; lab.textContent = text; tip.appendChild(lab);
    if (extra) tip.appendChild(extra);
    b.appendChild(tip);
  } else {
    b.textContent = text;
    if (extra) b.appendChild(extra);
  }
  mark(b, { compact: true });
  return b;
}

test('versions agree at 0.4.70', () => {
  assert.equal(JSON.parse(R('manifest.json')).version, '0.4.70');
  assert.equal(JSON.parse(R('package.json')).version, '0.4.70');
});

test('compact default: icon-only pill, full text in tip + aria-label', () => {
  const d = fakeDoc();
  const b = makeBadge(d, { badgeStyle: 'compact' }, 'vl-badge-probably', '🌱 Probably vegan', 'Listed materials are non-animal');
  assert.match(b.className, /\bvl-badge\b/);
  assert.match(b.className, /\bvl-badge-probably\b/);
  assert.match(b.className, /\bvl-badge-compact\b/);
  assert.equal(b.tabIndex, 0);
  assert.equal(b.getAttribute('role'), 'status');
  const tip = b.querySelector('.vl-badge-tip');
  assert.ok(tip);
  assert.match(tip.textContent, /🌱 Probably vegan/);
  assert.match(b.getAttribute('aria-label'), /Vegan Lens/);
  assert.match(b.getAttribute('aria-label'), /Probably vegan/);
  assert.doesNotMatch(b.getAttribute('aria-label') || '', /Sponsored/);
  assert.doesNotMatch(tip.textContent, /Sponsored/);
  assert.ok(b.children.some(c => c.tagName === 'IMG' && /vl-mark-icon/.test(c.className)));
  assert.equal(b.querySelector('.vl-badge-ad'), null);
  // Visible label lives in the tip, not as a bare text node competing with the icon.
  assert.ok(b.querySelector('.vl-badge-text'));
});

test('full mode: renders text badge without compact class or tip', () => {
  const d = fakeDoc();
  const b = makeBadge(d, { badgeStyle: 'full' }, 'vl-badge-caution', '⚠ Caution: may contain animal products', 'neoprene');
  assert.doesNotMatch(b.className, /vl-badge-compact/);
  assert.equal(b.querySelector('.vl-badge-tip'), null);
  assert.match(b.textContent, /Caution: may contain animal products/);
  assert.match(b.className, /\bvl-badge-caution\b/);
});

test('color class per verdict', () => {
  const d = fakeDoc();
  for (const [cls, text] of [
    ['vl-badge-vegan', '🌱 Vegan'],
    ['vl-badge-probably', '🌱 Probably vegan'],
    ['vl-badge-caution', '⚠ Caution: may contain animal products'],
    ['vl-badge-nonvegan', '✕ Not vegan: contains leather'],
    ['vl-badge-unknown', '?'],
  ]) {
    const b = makeBadge(d, { badgeStyle: 'compact' }, cls, text, '');
    assert.match(b.className, new RegExp('\\b' + cls + '\\b'));
    assert.match(b.className, /\bvl-badge-compact\b/);
  }
});

test('compact tip can hold a swap action', () => {
  const d = fakeDoc();
  const sw = d.createElement('span'); sw.className = 'vl-swap'; const a = d.createElement('a'); a.href = 'https://www.amazon.com/s?k=vegan'; a.textContent = 'vegan leather'; sw.appendChild(a);
  const b = makeBadge(d, { badgeStyle: 'compact' }, 'vl-badge-nonvegan', '✕ Not vegan: contains leather', null, sw);
  const tip = b.querySelector('.vl-badge-tip');
  assert.ok(tip);
  assert.equal(tip.querySelector('.vl-swap'), sw);
  assert.match(tip.textContent, /leather/);
  assert.match(tip.textContent, /vegan leather/);
});

test('content.js: compact badge wiring, default, tap/focus, nested swap', () => {
  const c = R('content.js');
  assert.match(c, /badgeStyle: 'compact'/);
  assert.match(c, /vl-badge-compact/);
  assert.match(c, /vl-badge-tip/);
  assert.match(c, /vl-badge-open/);
  assert.doesNotMatch(c, /vl-badge-ad/);
  assert.match(c, /tabIndex = 0/);
  assert.match(c, /S\.badgeStyle \|\| 'compact'/);
  assert.match(c, /badge\(el, 'vl-badge-nonvegan', '✕ ' \+ why, null, sw\)/);
});

test('content.css: compact pill size, expands in place on hover/focus, top-left', () => {
  const css = R('content.css');
  assert.match(css, /\.vl-badge\{[^}]*left:6px/);
  assert.match(css, /\.vl-badge\.vl-badge-compact\{[^}]*width:22px/);
  assert.match(css, /\.vl-badge-compact:hover/);
  assert.match(css, /\.vl-badge-compact:focus/);
  assert.match(css, /\.vl-badge-compact\.vl-badge-open/);
  assert.match(css, /height:auto/);
  assert.match(css, /max-width:220px/);
  assert.match(css, /white-space:normal/);
  assert.match(css, /overflow:visible/);
  assert.match(css, /overflow:visible!important/);
  assert.match(css, /\.vl-badge-compact:hover \.vl-badge-tip/);
  assert.doesNotMatch(css, /\.vl-badge-ad\{/);
  assert.match(css, /\.vl-badge-tip \.vl-swap\{[^}]*position:static/);
  assert.match(css, /z-index:2147483000/);
});

test('popup: Badge style setting persisted like other selects', () => {
  const h = R('popup.html'), j = R('popup.js');
  assert.match(h, /id="badgeStyle"/);
  assert.match(h, /<option value="compact">Compact/);
  assert.match(h, /<option value="full">Full text/);
  assert.match(j, /badgeStyle: 'compact'/);
  assert.match(j, /'badgeStyle'/);
});

test('CHANGELOG mentions 0.4.67 compact badges', () => {
  assert.match(R('CHANGELOG.md'), /^## 0\.4\.67 — Compact product badges/m);
});
