// 0.4.77: YouTube home-feed scrolling must stay responsive. Classify 2,000 titles
// under a time budget, and a mutation storm must not cause unbounded rescans.
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const C = require('../contentClassifier.js');
const U = require('../webUnits.js');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const YT = { requireHeadline: true };

test('versions agree at 0.4.80', () => {
  assert.equal(JSON.parse(R('manifest.json')).version, '0.4.80');
  assert.equal(JSON.parse(R('package.json')).version, '0.4.80');
});

test('2,000 synthetic YouTube titles classify under 2000ms', () => {
  const samples = [
    'Your Thanksgiving Turkey Is About to Get a MASSIVE Upgrade!',
    'These Viral Butter Beans Are Actually Worth the Hype',
    'New & Improved Vegan Deli Roast Beef + French Dip',
    'Best Ribeye Steak Recipe',
    'vegan vs beef',
    'Travel to Turkey this summer',
    "Lion's Mane Steak Is Better",
    'How to make peanut butter cookies',
    'Grilled Chicken Recipe',
    'Minecraft speedrun world record',
    "I'm vegan but ate beef",
    'Plant-Based Burgers Outsell Beef at Campus Dining',
    'cold turkey',
    'Vegan Thanksgiving Turkey roast'
  ];
  const titles = [];
  for (let i = 0; i < 2000; i++) titles.push(samples[i % samples.length] + ' #' + i);
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < titles.length; i++) C.classify({ headline: titles[i], creators: ['SAM THE COOKING GUY'] }, YT);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  // Measured ~276ms on the build machine after the 0.4.76 regexes + 0.4.77 holiday context.
  // A 2000ms budget still fails if a regex hangs or is rebuilt into a backtracking trap.
  assert.ok(ms < 2000, '2000 titles took ' + ms.toFixed(1) + 'ms');
});

test('long vegan-modifier titles do not hang (no catastrophic backtracking)', () => {
  const long = 'vegan ' + 'delicious homemade smoked sliced grilled baked roasted juicy crispy '.repeat(30) + 'word '.repeat(200) + ' vs beef';
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 200; i++) C.classify({ headline: long }, YT);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(ms < 1000, '200 long titles took ' + ms.toFixed(1) + 'ms');
});

test('a 5,000-node mutation storm is chunked, not one run per node', () => {
  let now = 0;
  const scheduled = [];
  const processed = [];
  const q = U.createScanBatcher({
    now: () => now,
    maxMs: 50,
    schedule: fn => scheduled.push(fn),
    process: el => { processed.push(el); now += 1; }
  });
  // Naive before: scan() per added node, or a scroll handler that rescans the whole
  // feed, is one main-thread task per event — 5,000 unbounded runs. After: one
  // scheduled flush per storm, yielding every 50ms (~100 runs for 5,000 × 1ms).
  for (let i = 0; i < 5000; i++) q.add({ id: i, nodeType: 1 });
  assert.equal(scheduled.length, 1, 'adds coalesce onto one scheduled flush');
  let loops = 0;
  while (scheduled.length) {
    scheduled.shift()();
    loops++;
    assert.ok(loops <= 200, 'unbounded flush loop');
  }
  assert.equal(processed.length, 5000);
  const s = q.stats();
  assert.equal(s.runs, 100);
  assert.equal(s.pending, 0);
  assert.ok(s.runs * 50 >= 5000, 'chunks stay on the 50ms budget');
});

test('injected Vegan Lens UI is not queued as a rescan target', () => {
  const q = U.createScanBatcher({ schedule: fn => fn(), process() { throw new Error('should not process UI'); } });
  const chip = { nodeType: 1, classList: { contains: k => k === 'vl-w-chip' }, closest: sel => (sel.includes('.vl-w-chip') ? chip : null) };
  assert.equal(q.add(chip), false);
  assert.equal(q.stats().added, 0);
  assert.ok(U.isVlUi(chip));
});

test('web.js ignores our mutations, chunks scans, and does not treat the YouTube feed as a carousel', () => {
  const js = R('web.js');
  assert.match(js, /ownMut/);
  assert.match(js, /withOwnMutations/);
  assert.match(js, /createScanBatcher/);
  assert.match(js, /if \(ownMut\) return/);
  assert.match(js, /performance\.now\(\) - start > 50/);
  assert.match(js, /scan\(root, i \+ 1, unitsCache, token\)/);
  assert.match(js, /yt-horizontal-list-renderer/);
  assert.doesNotMatch(js, /SCROLL_SEL = '[^']*\[role=list\]/);
  assert.doesNotMatch(js, /SCROLL_SEL = '[^']*\[role=region\]/);
  assert.doesNotMatch(js, /SCROLL_SEL = '[^']*class\*=scroll/);
  assert.match(js, /scrollQueued/);
  assert.match(js, /requestIdle\(\(\) => \{/);
});
