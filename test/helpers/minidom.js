// Tiny HTML -> DOM-like tree for fixture tests (no dependencies). Supports what sites.js/searchRewrite.js use:
// querySelector(All) with compound selectors, descendant combinators and comma lists; getAttribute, textContent,
// innerText (block-aware), parentElement, contains, closest, cloneNode, remove, tagName, className.
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const BLOCK = new Set(['div', 'p', 'li', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'section', 'article', 'main', 'nav', 'button', 'table', 'tr']);
const ent = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&nbsp;/g, ' ');
class Node {
  constructor(tag, attrs, parent) { this.tag = tag; this.attrs = attrs || {}; this.children = []; this.parentElement = parent || null; }
  get tagName() { return this.tag.toUpperCase(); }
  get className() { return this.attrs.class || ''; }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  get dataset() { const a = this.attrs; return new Proxy({}, { get: (_, k) => a['data-' + String(k).replace(/[A-Z]/g, c => '-' + c.toLowerCase())] }); }
  get textContent() { return this.children.map(c => typeof c === 'string' ? c : c.textContent).join(''); }
  get innerText() { return this.children.map(c => typeof c === 'string' ? c : (BLOCK.has(c.tag) ? '\n' + c.innerText + '\n' : c.innerText)).join('').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n'); }
  _all() { const o = []; for (const c of this.children) if (typeof c !== 'string') o.push(c, ...c._all()); return o; }
  matches(sel) { return splitList(sel).some(s => matchComplex(this, s)); }
  querySelectorAll(sel) { return this._all().filter(e => e.matches(sel)); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  closest(sel) { for (let e = this; e; e = e.parentElement) if (e.matches(sel)) return e; return null; }
  contains(o) { return o === this || this._all().includes(o); }
  remove() { const p = this.parentElement; if (p) p.children = p.children.filter(c => c !== this); this.parentElement = null; }
  cloneNode() { const n = new Node(this.tag, { ...this.attrs }); n.children = this.children.map(c => { if (typeof c === 'string') return c; const k = c.cloneNode(); k.parentElement = n; return k; }); return n; }
}
const splitList = s => s.split(/,(?![^\[]*\])/).map(x => x.trim()).filter(Boolean);
function matchCompound(e, sel) {
  const m = sel.match(/^([a-z0-9-]+|\*)?((?:#[\w-]+|\.[\w:-]+|\[[^\]]+\]|:not\([^)]*\))*)$/i); if (!m) throw new Error('selector: ' + sel);
  if (m[1] && m[1] !== '*' && e.tag !== m[1].toLowerCase()) return false;
  for (const p of m[2].match(/#[\w-]+|\.[\w:-]+|\[[^\]]+\]|:not\([^)]*\)/g) || []) {
    if (p[0] === '#') { if (e.attrs.id !== p.slice(1)) return false; }
    else if (p[0] === '.') { if (!e.className.split(/\s+/).includes(p.slice(1))) return false; }
    else if (p[0] === ':') { if (matchCompound(e, p.slice(5, -1))) return false; }
    else { const a = p.slice(1, -1).match(/^([\w-]+)\s*(?:([\^*$]?=)\s*["']?([^"'\]]*?)["']?(\s+i)?)?$/); const v = e.attrs[a[1]];
      if (v == null) return false; if (!a[2]) continue;
      const [x, y] = a[4] ? [String(v).toLowerCase(), a[3].toLowerCase()] : [String(v), a[3]];
      if (a[2] === '=' ? x !== y : a[2] === '^=' ? !x.startsWith(y) : a[2] === '$=' ? !x.endsWith(y) : !x.includes(y)) return false; }
  }
  return true;
}
function matchComplex(e, sel) {
  const parts = sel.split(/\s+(?![^\[]*\])/);
  if (!matchCompound(e, parts[parts.length - 1])) return false;
  let cur = e.parentElement;
  for (let i = parts.length - 2; i >= 0; i--) { while (cur && !matchCompound(cur, parts[i])) cur = cur.parentElement; if (!cur) return false; cur = cur.parentElement; }
  return true;
}
function parse(html) {
  const root = new Node('body', {}); let cur = root;
  const re = /<!--[\s\S]*?-->|<\/([a-z0-9-]+)\s*>|<([a-z0-9-]+)((?:\s+[^\s=>\/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/gi;
  let m;
  while ((m = re.exec(html))) {
    if (m[5] != null) cur.children.push(ent(m[5]));
    else if (m[1]) { const t = m[1].toLowerCase(); let n = cur; while (n && n.tag !== t) n = n.parentElement; if (n && n.parentElement) cur = n.parentElement; }
    else if (m[2]) {
      const attrs = {}; const ar = /([^\s=>\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g; let a;
      while ((a = ar.exec(m[3] || ''))) attrs[a[1].toLowerCase()] = ent(a[2] ?? a[3] ?? a[4] ?? '');
      const n = new Node(m[2].toLowerCase(), attrs, cur); cur.children.push(n);
      if (!VOID.has(n.tag) && !m[4]) cur = n;
    }
  }
  return root;
}
module.exports = { parse };
