// 0.4.40: Konjoun barefoot-sock ad: leather claim only inside the image (FB auto alt "text that says ...").
const test = require('node:test'); const assert = require('node:assert');
const { classify } = require('../contentClassifier.js');
const { altSays, fbExtraText } = require('../webUnits.js');
const ALT = 'May be an image of shoes and text that says "Rubber wears through. Leather wears in. Full-grain cowhide gets better with use, not thinner."';
const HEAD = "The Toughest Barefoot Sock We've Ever Made", VIS = "Worried a barefoot sock won't survive the first month?... See more";
const node = (attrs, text) => ({ getAttribute: k => (k in attrs ? attrs[k] : null), textContent: text || '' });
const post = { getAttribute: () => null, querySelectorAll: sel => {
  if (/img/.test(sel)) return [node({ alt: ALT })];
  if (/a\[href\]/.test(sel)) return [node({ href: 'https://l.facebook.com/l.php?u=https%3A%2F%2Fkonjoun.com' }, 'KONJOUN.COM ' + HEAD + ' Learn more'), node({ href: 'https://www.facebook.com/konjoun' }, 'Konjoun Barefoot')];
  if (/data-ad/.test(sel)) return [node({}, VIS.replace('... See more', '') + ' Our new sock has a hidden full-grain sole.')];
  return [];
} };
test('altSays parses FB auto alt text', () => {
  assert.strictEqual(altSays(ALT), 'Rubber wears through. Leather wears in. Full-grain cowhide gets better with use, not thinner.');
  assert.strictEqual(altSays('May be an image of a dog'), '');
});
test('fbExtraText collects image text, link preview and DOM-only See more text', () => {
  const x = fbExtraText(post);
  assert.match(x.snippet, /Full-grain cowhide/); assert.match(x.snippet, /KONJOUN\.COM/); assert.match(x.snippet, /hidden full-grain sole/);
  assert.doesNotMatch(x.snippet, /Konjoun Barefoot$/); assert.match(x.alt, /May be an image of shoes/);
});
test('ad with image text is flagged as leather', () => {
  for (const s of ['low', 'med', 'high']) {
    const r = classify({ headline: HEAD, snippet: VIS + ' . ' + fbExtraText(post).snippet, alt: ALT, author: 'Konjoun Barefoot' }, { sensitivity: s });
    assert.strictEqual(r.verdict, 'nonvegan', s); assert.ok(r.about['animal fabrics'], s);
  }
});
test('same ad with only visible text is not flagged', () => {
  assert.notStrictEqual(classify({ headline: HEAD, snippet: VIS, author: 'Konjoun Barefoot' }).verdict, 'nonvegan');
});
test('vegan/faux leather ads are not dimmed', () => {
  for (const t of ['Vegan leather wallet', 'Faux leather boots for winter'])
    assert.notStrictEqual(classify({ headline: t, snippet: 'Shop now' }).verdict, 'nonvegan', t);
});
