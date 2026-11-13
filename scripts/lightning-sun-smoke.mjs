// Deterministic lightning-as-sun QA scenario.
//
// Forces a night storm, fixes the strike direction, and captures the frame
// while the flash is still near its peak. This makes it easy to inspect that:
//   * the flash lights the scene from the strike side,
//   * cast shadows point away from that side,
//   * the raft headlamp cone is gone while the flash is active.
//
// It then samples the decay to prove the shadow direction and headlamp state
// are latched (hard switch), not tweened between the lightning and sun states.
//
// Run with:
//   webgame_smoke --scenario scripts/lightning-sun-smoke.mjs

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

  // Night storm with the headlamp active, framed on the river.
  await page.evaluate('window.__webgame.setWeather({rain: 1, windStrength: 0.35, time: 0.95, auto: false})');
  await page.pause(500);
  const storm = await page.evaluate(luminance);
  const before = await page.evaluate('window.__webgame.snapshot()');
  await screenshot('lightning-sun-before.png');

  // Strike from the upper-left. The resulting shadows must point lower-right.
  await page.evaluate('window.__webgame.setLightning({flash: 1, dirX: -0.7, dirY: -0.7, boltSeed: 0.9})');
  await page.pause(35);
  const during = await page.evaluate('window.__webgame.snapshot()');
  const light = during.weather.lightning;
  const flash = light.flash;

  assert.ok(flash > 0.75, `flash should still be near peak (${flash.toFixed(2)})`);
  assert.ok(light.sunActive === true, 'the temporary sun should be latched on');
  assert.ok(light.dirX < 0 && light.dirY < 0, 'the strike should come from the upper-left');
  assert.ok(light.shadowDirX > 0 && light.shadowDirY > 0, 'shadows should point away from the strike');
  assert.ok(during.lighting, 'the renderer should have published its lightning frame state');
  assert.ok(during.lighting.headlampActive === false, 'the lightning should suppress the raft headlamp');
  assert.ok(during.lighting.shadowDirX > 0 && during.lighting.shadowDirY > 0,
    'the rendered shadow direction should match the strike');

  const lit = await page.evaluate(luminance);
  assert.ok(lit > storm + 10, `lightning should light the scene (${lit.toFixed(1)} > ${storm.toFixed(1)} + 10)`);
  log(`storm=${storm.toFixed(1)} lightning=${lit.toFixed(1)} flash=${flash.toFixed(2)}`);
  log(`shadow dir=(${light.shadowDirX.toFixed(2)}, ${light.shadowDirY.toFixed(2)})`);
  await screenshot('lightning-sun-during.png');

  // Let the flash end, then verify the temporary sun actually releases.
  await page.pause(900);
  const after = await page.evaluate('window.__webgame.snapshot()');
  assert.ok(after.weather.lightning.sunActive === false, 'the lightning sun should switch off');
  assert.ok(after.lighting === null, 'the base day/night lighting should take over');

  // Strike again and sample the decay. A tween would make the shadow vector
  // drift toward the night-sun vector; a hard switch keeps it fixed until the
  // lighting override disappears.
  await page.evaluate('window.__webgame.setLightning({flash: 1, dirX: -0.7, dirY: -0.7, boltSeed: 0.9})');
  await page.pause(20);
  for (let i = 0; i < 6; i++) {
    const sample = await page.evaluate('window.__webgame.snapshot()');
    const rendered = sample.lighting;
    assert.ok(rendered, `lightning lighting should still be latched (sample ${i})`);
    assert.ok(rendered.headlampActive === false, `headlamp must stay hard-off (sample ${i})`);
    assert.ok(Math.abs(rendered.shadowDirX - 0.7071) < 0.01 &&
      Math.abs(rendered.shadowDirY - 0.7071) < 0.01,
      `shadow direction must not tween (sample ${i}: ${rendered.shadowDirX.toFixed(3)}, ${rendered.shadowDirY.toFixed(3)})`);
    await page.pause(30);
  }
  log('shadow direction and headlamp state stayed latched through the decay');

  assert.ok(before.weather.auto === false, 'weather should stay in manual mode for the test');
}
