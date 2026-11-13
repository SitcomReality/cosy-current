// Deterministic weather QA scenario.
//
//   node ../webgame-tools/bin/webgame-harness.mjs run --scenario scripts/weather-smoke.mjs
// or
//   webgame_smoke --scenario scripts/weather-smoke.mjs
//
// It forces manual weather through the ?dev debug surface, checks that the
// night+storm composite is darker than clear night, triggers lightning, and
// captures forest/wind and splash frames. Manual mode is then handed back to
// the automatic simulation.

export default async function ({ page, assert, screenshot, log }) {
  await page.goto('/?dev');
  await page.click('#btn-new-journey');
  await page.waitFor('window.__webgame && window.__webgame.ready === true');
  await page.waitFor('window.__webgame.snapshot().isPlaying === true');

  const luminance = `(() => {
    const c = document.querySelector('#main-canvas');
    const ctx = c.getContext('2d');
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    }
    return sum / (data.length / 4);
  })()`;

  // 1. Night darkness must increase when a storm is layered on top.
  await page.evaluate(`window.__webgame.setWeather({rain: 0, windStrength: 0, time: 0.95, auto: false})`);
  await page.pause(450);
  const nightClear = await page.evaluate(luminance);
  await screenshot('weather-night-clear.png');

  await page.evaluate(`window.__webgame.setWeather({rain: 1, windStrength: 0.7, time: 0.95, auto: false})`);
  await page.pause(450);
  const nightStorm = await page.evaluate(luminance);
  await screenshot('weather-night-storm.png');
  assert.ok(nightStorm < nightClear - 1, `night storm should be darker (${nightStorm} < ${nightClear})`);

  // 2. Directional lightning flash.
  const storm = await page.evaluate('window.__webgame.snapshot()');
  await page.evaluate('window.__webgame.strikeLightning()');
  await page.pause(40);
  const flash = await page.evaluate('window.__webgame.snapshot()');
  assert.ok(flash.weather.lightning.flash > 0.3, 'lightning flash should be active shortly after a strike');
  const dirLen = Math.hypot(flash.weather.lightning.dirX, flash.weather.lightning.dirY);
  assert.ok(Math.abs(dirLen - 1) < 0.01, 'lightning direction should be a unit vector');
  log(`lightning flash=${flash.weather.lightning.flash.toFixed(2)} bearing=${storm.weather.stormBearing.toFixed(2)}`);
  await screenshot('weather-lightning.png');
  await page.pause(750);

  // 3. Windy weather + surface-aware splashes.
  const snap = await page.evaluate('window.__webgame.snapshot()');
  const side = snap.player.angle + Math.PI / 2;
  await page.evaluate(`window.__webgame.setWeather({rain: 1, windStrength: 1, windAngle: 0, time: 0.38, auto: false})`);
  await page.evaluate(`window.__webgame.setCamera(${snap.player.x + Math.cos(side) * 30}, ${snap.player.y + Math.sin(side) * 30})`);
  await page.pause(900);
  const wind = await page.evaluate('window.__webgame.snapshot()');
  assert.ok(wind.weather.wind.strength > 0.99, 'manual wind should hold at full strength');
  assert.ok(wind.weather.particles, 'rain particle pools should be initialized');
  log(`particles: ${JSON.stringify(wind.weather.particles)}`);
  await screenshot('weather-wind-rain.png');

  // 4. Hand control back to the automatic simulation.
  await page.evaluate('window.__webgame.setWeather({auto: true})');
  const auto = await page.evaluate('window.__webgame.snapshot()');
  assert.ok(auto.weather.auto === true, 'auto weather should re-enable');

  log(`night luminance clear=${nightClear.toFixed(1)} storm=${nightStorm.toFixed(1)}`);
}
