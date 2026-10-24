const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const typography = require('../assets/smart-typography.js');
const moduleText = fs.readFileSync(path.join(__dirname, '../assets/smart-typography.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const newsroom = fs.readFileSync(path.join(__dirname, '../assets/newsroom.js'), 'utf8');

function canvas(size = 60) {
  return {
    font: '800 ' + size + 'px Inter, sans-serif',
    measureText(text) {
      const px = Number(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1] || size);
      // Monospace-like approximation for deterministic geometry tests.
      return { width: Array.from(text).length * px * 0.55 };
    }
  };
}
test('long unbroken words wrap without exceeding canvas width or losing letters', () => {
  const ctx = canvas(48);
  const original = 'LONGUNBROKENNEWSLOCATIONNAMEWITHMANYCHARACTERS';
  const lines = typography.wrapLines(ctx, original, 145);
  assert.ok(lines.length > 1);
  assert.equal(lines.join(''), original);
  for (const line of lines) assert.ok(ctx.measureText(line).width <= 145);
});
test('adaptive font size fits long but reasonable headlines without dropping words', () => {
  const ctx = canvas();
  const headline = 'City officials announce overnight subway service changes across Manhattan and Brooklyn ahead of a major infrastructure repair project affecting weekend commuters';
  const result = typography.fitHeadline(ctx, headline, {
    width: 820, bottom: 805, safeTop: 225, maxLines: 5, preferredSize: 76, auto: true
  });
  assert.equal(result.overflow, false);
  assert.ok(result.fontSize < 76, 'auto mode should reduce font size');
  assert.equal(result.lines.join(' ').replace(/\s+/g, ' '), headline);
  assert.ok(result.badgeTop >= 225);
});
test('oversized headlines use visible ellipsis and raise a warning instead of silently cropping', () => {
  const ctx = canvas();
  const headline = Array(60).fill('neighborhood').join(' ');
  const before = headline;
  const result = typography.fitHeadline(ctx, headline, {
    width: 700, bottom: 710, safeTop: 225, maxLines: 5, preferredSize: 65, auto: true
  });
  assert.equal(result.overflow, true);
  assert.ok(result.lines.length <= 5);
  assert.ok(result.lines.at(-1).endsWith('…'));
  assert.equal(headline, before, 'original editorial headline must remain unchanged');
});
test('manual mode honors requested font size, still explicitly warns of clipping', () => {
  const ctx = canvas();
  const result = typography.fitHeadline(ctx, 'New York City '.repeat(40), {
    width: 760, bottom: 780, safeTop: 225, maxLines: 5, preferredSize: 72, auto: false
  });
  assert.equal(result.fontSize, 72);
  assert.equal(result.overflow, true);
});
test('long summary last line ends in a measured ellipsis', () => {
  const ctx = canvas(31);
  const trimmed = typography.ellipsize(ctx, 'This is a long story description that should be shortened', 150);
  assert.ok(trimmed.endsWith('…'));
  assert.ok(ctx.measureText(trimmed).width <= 150);
});
test('auto fit toggle is accessible and updates existing editor state', () => {
  const dom = new JSDOM('<!doctype html><html><body><textarea id="headlineInput"></textarea>' +
    '<input id="titleSizeRange" type="range" min="44" max="76" value="60"></body></html>',
    { runScripts:'outside-only', url:'https://tony-studio-lmeo.vercel.app' });
  const w = dom.window;
  let rendered = 0;
  w.TONYStudio = { state:{autoFitHeadline:true}, renderCanvas(){rendered++;} };
  w.eval(moduleText);
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  assert.ok(w.document.getElementById('tonyTypographyPanel'));
  const toggle = w.document.getElementById('tonyAutoFitToggle');
  assert.equal(toggle.getAttribute('aria-pressed'), 'true');
  toggle.click();
  assert.equal(w.TONYStudio.state.autoFitHeadline, false);
  assert.equal(rendered, 2);
  const slider = w.document.getElementById('titleSizeRange');
  assert.equal(slider.min, '28');
  w.TONYStudio.state.autoFitHeadline = true;
  slider.dispatchEvent(new w.Event('input'));
  assert.equal(w.TONYStudio.state.autoFitHeadline, false);
  w.TONYTypography.reportLayout({headline:{fontSize:28,overflow:true},summaryOverflow:true,auto:false});
  assert.equal(w.document.getElementById('tonyTypographyStatus').dataset.overflow,'true');
  assert.match(w.document.getElementById('tonyTypographyStatus').textContent,/Shorten it before publishing/);
  dom.window.close();
});
test('real canvas, saved grid and browser drafts use the smart headline engine', () => {
  assert.match(html,/src="\/assets\/smart-typography\.js/);
  assert.match(html,/window\.TONYTypography\.fitHeadline\(/);
  assert.match(html,/window\.TONYTypography\?\.reportLayout\(/);
  assert.match(html,/let summaryOverflow = false/);
  assert.match(html,/autoFitHeadline: state\.autoFitHeadline !== false/);
  assert.match(html,/state\.autoFitHeadline = post\.autoFitHeadline !== false/);
  assert.match(newsroom,/autoFitHeadline:s\.autoFitHeadline !== false/);
  assert.match(newsroom,/app\.state\.autoFitHeadline = d\.autoFitHeadline !== false/);
});
