// Drives real Chrome (GPU on) through the profiling scenarios; prints probe results + Chrome CPU/energy from `top`.
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const URL = process.env.URL ?? 'http://localhost:4180/';
const PROBE = readFileSync(process.argv[2], 'utf8');
const mode = process.argv[3] ?? 'desktop';
const SECS = 15;
const dir = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), 'wm-prof-'));

const phone = mode === 'phone';
const ctx = await chromium.launchPersistentContext(dir, {
  channel: 'chrome',
  headless: false,
  viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  deviceScaleFactor: phone ? 3 : 2,
  hasTouch: phone,
  isMobile: phone,
  args: ['--disable-background-timer-throttling', '--mute-audio'],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
if (phone) {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.THROTTLE ?? 4) });
}

const pids = () =>
  execSync(`pgrep -f ${dir}`).toString().trim().split('\n').filter(Boolean);
function power(seconds) {
  const args = pids().map((p) => `-pid ${p}`).join(' ');
  const out = execSync(`top -l ${seconds + 1} -s 1 ${args} -stats pid,cpu,power`).toString();
  // top prints one block per sample; skip the first (it has no deltas).
  const blocks = out.split(/\n(?=Processes:)/).slice(1);
  let cpu = 0;
  let pw = 0;
  for (const b of blocks)
    for (const line of b.split('\n')) {
      const m = line.match(/^(\d+)\s+([\d.]+)\s+([\d.]+)/);
      if (m) {
        cpu += +m[2];
        pw += +m[3];
      }
    }
  return { chromeCpuPct: Math.round(cpu / blocks.length), chromeEnergyImpact: Math.round(pw / blocks.length) };
}

async function measure(name) {
  await page.evaluate(PROBE);
  const [probe, pw] = await Promise.all([page.evaluate((s) => window.probe(s), SECS), Promise.resolve().then(() => power(SECS))]);
  console.log(JSON.stringify({ mode, scenario: name, ...probe, ...pw }));
}

await page.goto(URL + (process.env.DEBUG ? '?debug' : ''));
await page.waitForFunction(() => window.app?.ui?.loading === 1, null, { timeout: 60000 });
await page.waitForTimeout(3000);
await measure('title screen (paused showcase store)');

// Blank baseline: an empty page in the same Chrome, so the game's share is visible.
const blank = await ctx.newPage();
await page.bringToFront();

await page.evaluate(() => window.app.play());
await page.waitForTimeout(6000);
await measure('in game, fresh Map 1, Player idle');

if (process.env.DEBUG) {
  await page.evaluate(() => [...document.querySelectorAll('.lil-name')].find((e) => e.textContent === 'unlock all').closest('button').click());
  await page.evaluate(() => {
    window.app.game.world.money += 1e6;
    window.app.game.speed = 6;
  });
  await page.waitForTimeout(40000);
  await page.evaluate(() => (window.app.game.speed = 1));
  await page.waitForTimeout(3000);
  await measure('in game, everything unlocked, Staff + Customers busy');
  // Walk the Player around to add camera movement.
  await page.keyboard.down('KeyW');
  await page.keyboard.down('KeyD');
  await measure('busy + Player walking (camera moving)');
  await page.keyboard.up('KeyW');
  await page.keyboard.up('KeyD');
}

await blank.bringToFront();
await page.goto('about:blank');
await page.waitForTimeout(2000);
console.log(JSON.stringify({ mode, scenario: 'baseline: Chrome with blank tabs', ...power(SECS) }));
await ctx.close();
