// Recette autonome dans le navigateur, sans compte ni base distante.
const { test, before, after } = require('node:test');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
let server, origin;
before(async () => {
  server = spawn('python', [
    'scripts/serve-dev.py',
    '--config',
    'dev/config.json',
    '--port',
    '0',
  ]);
  origin = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(Error('Serveur non démarré')), 10000);
    server.stdout.on('data', (c) => {
      output += c;
      const m = output.match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (m) {
        clearTimeout(timer);
        resolve(m[0]);
      }
    });
    server.on('error', reject);
  });
});
after(() => server?.kill());
async function waitText(page, selector, text) {
  await page.waitForFunction(
    ({ selector, text }) =>
      document.querySelector(selector)?.textContent.includes(text),
    { selector, text },
  );
}
async function board(page, card) {
  await page.locator('[data-tab=soc]').click();
  await page.locator('#board [name=card]').fill(card);
  await page.locator('#board [name=box]').fill('BOITE-FICTIVE');
  await page.locator('#board button').click();
}
test('Démonstration publique autonome et entrée connectée séparée', async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {}),
  });
  const errors = [];
  try {
    // La page publique conserve sa CSP sans connexions et ses trois activités.
    const demo = await browser.newPage({
      viewport: { width: 360, height: 900 },
    });
    const connections = [];
    demo.on('request', (r) => {
      if (r.url().startsWith('https://')) connections.push(r.url());
    });
    demo.on('pageerror', (e) => errors.push(e.message));
    await demo.goto(origin + '/');
    await board(demo, 'ESSAI-01');
    await waitText(demo, '#notice', 'Consultation enregistrée.');
    await demo.locator('#identity [name=first]').fill('Démo');
    await demo.locator('#identity button').click();
    await demo.locator('[data-tab=vid]').click();
    await demo.locator('#addvideo').click();
    await demo.locator('#vf [name=slot]').selectOption({ index: 4 });
    await demo.locator('#vf [name=game]').selectOption({ index: 1 });
    await demo.locator('#vf [name=card]').fill('ESSAI-01');
    const bookedPost = await demo.locator('#vf [name=post]').inputValue();
    await demo.locator('#vf button.primary').click();
    await waitText(demo, '#vfmsg', 'Inscription enregistrée.');
    await demo.locator('#close').click();
    await demo.locator('#role').selectOption('Administrateur');
    await demo.locator('[data-tab=ani]').click();
    await demo.locator('#calendar button.today').click();
    await demo.locator('#new').click();
    await demo.locator('#af [name=title]').fill('Atelier fictif');
    await demo.locator('#af [name=room]').selectOption('Créazone');
    await demo.locator('#af [name=time]').fill('18:00');
    await demo.locator('#af [name=endTime]').fill('19:00');
    await demo.locator('#af button.primary').click();
    await demo.locator('#guest [name=card]').fill('ESSAI-01');
    await demo.locator('#guest button.primary').click();
    await waitText(demo, '#guests', 'Démo');
    await demo.locator('#close').click();
    await demo.locator('#openAdmin').click();
    await demo.locator('#editPost').selectOption(bookedPost);
    await demo.locator('#config [name=postName]').fill(bookedPost + '-Démo');
    await demo.locator('#adminSave').click();
    await waitText(demo, '#configMsg', 'Poste renommé');
    await demo.locator('[data-tab=vid]').click();
    await waitText(demo, '#videoPlanning', bookedPost + '-Démo');
    assert.deepEqual(connections, []);
    assert.equal(
      await demo.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await demo.reload();
    await demo.locator('[data-tab=soc]').click();
    assert.doesNotMatch(
      await demo.locator('#boards').innerText(),
      /BOITE-FICTIVE/,
    );
    assert.match(await demo.locator('#boards').innerText(), /DÉMO/);
    assert.deepEqual(errors, []);

    const connected = await browser.newPage();
    connected.on('pageerror', (e) => errors.push(e.message));
    await connected.goto(origin + '/dev/index.html');
    assert.equal(await connected.locator('#login').isVisible(), true);
    assert.equal(await connected.locator('main').isVisible(), false);
    assert.equal(await connected.locator('#login button').isEnabled(), true);
    assert.deepEqual(errors, []);
    const noScript = await browser.newPage({ javaScriptEnabled: false });
    await noScript.goto(origin + '/dev/index.html');
    assert.equal(await noScript.locator('#login button').isDisabled(), true);
  } finally {
    await browser.close();
  }
});
