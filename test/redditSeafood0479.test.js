// 0.4.79: a Reddit r/INTP post, "How do you guys handle death?", was hidden as "about seafood".
// Visible title, body, community and the r/AMA neighbour do not mention seafood. Require a title
// (or flair) to hide, keep each shreddit-post's text to itself, and do not treat decorative alts
// or incidental class*="tag" chrome as evidence.
const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const { parse } = require('./helpers/minidom.js');
const C = require('../contentClassifier.js');
const U = require('../webUnits.js');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

const TITLE = 'How do you guys handle death?';
const BODY = 'What are things that have helped you through or caused pain during loss. And what age did it occur?';
const COMMUNITY = 'r/INTP';
const RH = { requireHeadline: true };

function judge(el, opts) {
  const p = U.redditParts(el);
  return C.classify(p, { ...RH, ...(opts || {}) });
}

function feed() {
  // Realistic home-feed markup: two sibling shreddit-posts (grief, then an r/AMA neighbour)
  // plus the kinds of hidden chrome that had been leaking into extract(): icon alts,
  // a wrapper whose class contains "tag", and a neighbouring seafood title/body.
  return parse(
    '<main>' +
      '<article>' +
        '<shreddit-post post-title="' + TITLE + '" subreddit-prefixed-name="r/INTP" author="someuser" comment-count="60" score="23" post-type="text">' +
          '<img alt="r/INTP icon" width="32" height="32">' +
          '<img alt="user avatar" width="32" height="32">' +
          '<a slot="title" href="/r/INTP/comments/abc/' + 'how_do_you_guys_handle_death/' + '">' + TITLE + '</a>' +
          '<div slot="text-body"><p>' + BODY + '</p></div>' +
          '<span class="staging-tag">Share</span>' +
          '<a href="/r/INTP/comments/abc/how_do_you_guys_handle_death/">60 comments</a>' +
        '</shreddit-post>' +
      '</article>' +
      '<article>' +
        '<shreddit-post post-title="I make lobster rolls for a living. AMA" subreddit-prefixed-name="r/AMA" author="chef" post-type="text">' +
          '<img alt="r/AMA icon" width="32" height="32">' +
          '<a slot="title" href="/r/AMA/comments/def/lobster/">I make lobster rolls for a living. AMA</a>' +
          '<div slot="text-body"><p>Ask me about fresh lobster, shrimp and seafood.</p></div>' +
        '</shreddit-post>' +
      '</article>' +
    '</main>'
  );
}

test('versions agree at 0.4.80', () => {
  assert.equal(JSON.parse(R('manifest.json')).version, '0.4.80');
  assert.equal(JSON.parse(R('package.json')).version, '0.4.80');
});

test('visible INTP death-post text is not seafood, with or without requireHeadline', () => {
  const parts = [
    TITLE,
    TITLE + ' ' + BODY,
    COMMUNITY + ' ' + TITLE + ' 2 days ago ' + BODY + ' 23 votes 60 comments Share',
    { headline: TITLE, snippet: BODY, community: COMMUNITY },
    { headline: TITLE, snippet: BODY, community: COMMUNITY, alt: 'r/INTP icon user avatar' },
  ];
  for (const p of parts) {
    for (const opts of [{}, RH]) {
      const r = C.classify(p, opts);
      assert.notEqual(r.verdict, 'nonvegan', JSON.stringify({ p, opts, topic: r.topic, matches: r.matches }));
    }
  }
});

test('handle, guys, INTP, AMA, through, occur, comments are not seafood / fish hits', () => {
  for (const w of ['handle', 'guys', 'INTP', 'r/INTP', 'AMA', 'r/AMA', 'through', 'occur', 'comments', 'Share', 'votes', 'death', 'loss', 'age']) {
    const r = C.classify(w, {});
    assert.equal(r.verdict, 'neutral', w + ' topic=' + r.topic);
    assert.equal(r.matches && r.matches.length, 0, w);
  }
});

test('redditParts uses post-title and the post body, ignores icon alts and a neighbour seafood post', () => {
  const doc = feed();
  const posts = doc.querySelectorAll('shreddit-post');
  assert.equal(posts.length, 2);
  const grief = U.redditParts(posts[0]);
  assert.equal(grief.headline, TITLE);
  assert.match(grief.snippet, /helped you through/);
  assert.equal(grief.community, 'r/INTP');
  assert.doesNotMatch((grief.headline + ' ' + grief.snippet + ' ' + grief.alt + ' ' + grief.tags).toLowerCase(), /lobster|shrimp|seafood|clam|crab/);
  assert.ok(!grief.alt, 'decorative icon/avatar alts must not be scored: ' + grief.alt);
  const r = C.classify(grief, RH);
  assert.notEqual(r.verdict, 'nonvegan', JSON.stringify(r));

  const ama = U.redditParts(posts[1]);
  assert.match(ama.headline, /lobster rolls/i);
  assert.match(ama.snippet, /seafood/);
  assert.equal(C.classify(ama, RH).verdict, 'nonvegan');
  assert.equal(C.classify(ama, RH).topic, 'seafood');
});

test('a wrapper around two shreddit-posts is a container; each post is its own unit', () => {
  const doc = feed();
  const main = doc.querySelector('main');
  const articles = doc.querySelectorAll('article');
  assert.equal(U.unitRole(main, { unitSel: 'shreddit-post, article' }), 'container');
  assert.equal(U.unitRole(articles[0], { unitSel: 'shreddit-post, article' }), 'container');
  assert.equal(U.unitRole(doc.querySelectorAll('shreddit-post')[0], { unitSel: 'shreddit-post, article' }), 'unit');
  assert.equal(U.unitRole(doc.querySelectorAll('shreddit-post')[1], { unitSel: 'shreddit-post, article' }), 'unit');
});

test('snippet or alt seafood cannot hide a death-question title (requireHeadline / clear evidence)', () => {
  const r = C.classify({ headline: TITLE, snippet: 'Ask me about fresh lobster, shrimp and seafood.', community: COMMUNITY }, RH);
  assert.notEqual(r.verdict, 'nonvegan');
  const r2 = C.classify({ headline: TITLE, alt: 'shrimp lobster seafood platter', community: COMMUNITY }, RH);
  assert.notEqual(r2.verdict, 'nonvegan');
  // Without the 0.4.79 headline guard, a strong snippet used to be enough to hide this card.
  const old = C.classify({ headline: TITLE, snippet: 'Ask me about fresh lobster, shrimp and seafood.' }, {});
  assert.equal(old.verdict, 'nonvegan');
});

test('a real seafood Reddit title still hides', () => {
  const doc = parse('<shreddit-post post-title="Best shrimp tacos in town" subreddit-prefixed-name="r/Food">' +
    '<a slot="title">Best shrimp tacos in town</a><div slot="text-body"><p>Grilled shrimp and fish tacos.</p></div></shreddit-post>');
  const r = judge(doc.querySelector('shreddit-post'));
  assert.equal(r.verdict, 'nonvegan');
  assert.ok(r.topic === 'seafood' || r.topic === 'fish', r.topic);
});

test('tagText no longer scrapes arbitrary class*="tag" wrappers; Yelp cflt chips still count', () => {
  const doc = feed();
  const grief = doc.querySelectorAll('shreddit-post')[0];
  assert.doesNotMatch(U.tagText(grief), /Share|seafood|lobster/i);
  const yelp = parse('<li><h3><a href="/biz/the-capital-grille">The Capital Grille</a></h3><a href="/search?cflt=steak">Steakhouses</a></li>');
  assert.match(U.tagText(yelp.querySelector('li')), /Steakhouses/);
});

test('ownQuery does not read a sibling post\'s paragraphs or images', () => {
  const doc = feed();
  const grief = doc.querySelectorAll('shreddit-post')[0];
  const paras = U.ownQuery(grief, 'p').map(p => p.textContent).join(' ');
  assert.match(paras, /helped you through/);
  assert.doesNotMatch(paras, /lobster|shrimp|seafood/i);
});

test('web.js uses redditParts, requireHeadline on Reddit, and ownQuery for snippets/alts', () => {
  const s = R('web.js');
  assert.match(s, /const RD = U\.isRedditHost\(location\.hostname\)/);
  assert.match(s, /requireHeadline: YT \|\| PIN \|\| RD \}/);
  assert.match(s, /if \(RD\) \{ const rp = U\.redditParts\(el\)/);
  assert.match(s, /U\.ownQuery\(el,/);
  assert.match(s, /decorativeAlt/);
});

test('CHANGELOG records the Reddit seafood false positive in 0.4.79', () => {
  const log = R('CHANGELOG.md');
  assert.match(log, /^## 0\.4\.79\b/m);
  assert.match(log, /How do you guys handle death/);
  assert.match(log, /seafood/i);
  assert.match(log, /r\/INTP/);
});
