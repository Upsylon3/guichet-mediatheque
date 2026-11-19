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
    await demo.clock.setFixedTime(new Date('2026-11-14T12:00:00+01:00'));
    await demo.goto(origin + '/');
    await demo.locator('#calendar [data-date="2026-11-18"]').click();
    await waitText(demo, '#videoPlanning caption', '18/11/2026');
    await demo.locator('[data-tab=soc]').click();
    assert.equal(await demo.locator('#calendar [aria-pressed=true]').getAttribute('data-date'), '2026-11-18');
    assert.equal(await demo.locator('#board [name=date]').inputValue(), '2026-11-18');
    await demo.locator('#now').click();
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
    await demo.locator('#guest [name=age]').fill('10');
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
    await connected.clock.setFixedTime(new Date('2026-11-14T12:00:00+01:00'));
    await connected.goto(origin + '/dev/index.html');
    assert.equal(await connected.locator('#login').isVisible(), true);
    assert.equal(await connected.locator('#login .libraryMark').isVisible(), true);
    assert.equal(await connected.locator('main').isVisible(), false);
    assert.equal(await connected.locator('#login [name=agentLogin]').isEnabled(), true);
    assert.equal(await connected.locator('#login [name=password]').isVisible(), false);
    await connected.locator('#login [name=adminLogin]').click();
    assert.equal(await connected.locator('#login [name=password]').isVisible(), true);
    assert.deepEqual(errors, []);
    const noScript = await browser.newPage({ javaScriptEnabled: false });
    await noScript.clock.setFixedTime(new Date('2026-11-14T12:00:00+01:00'));
    await noScript.goto(origin + '/dev/index.html');
    assert.equal(await noScript.locator('#login [name=agentLogin]').isDisabled(), true);
  } finally {
    await browser.close();
  }
});

test('Page connectée : contourner les anciens scripts en cache pour ouvrir les fiches', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    // Simuler une ancienne réponse encore en cache à l’URL historique.
    let staleScriptRequested = false;
    await page.route(
      (url) => url.pathname === '/dev/app.js' && !url.search,
      (route) => {
        staleScriptRequested = true;
        return route.fulfill({
          contentType: 'text/javascript',
          body: '// Ancienne application en cache.',
        });
      },
    );
    // Le test exerce la vraie entrée connectée, avec seulement le service distant simulé.
    const deviceId = '00000000-0000-0000-0000-000000000099';
    let stations = [];
    let expireSession = false;
    await page.route('https://*.supabase.co/**', (route) => {
      const url = route.request().url();
      const person = {
        id: '00000000-0000-0000-0000-000000000001',
        carte: '0000001',
        prenom: 'Camille',
        nom: 'Fictif',
        revision: 1,
      };
      const agent = route.request().headers().authorization === 'Bearer agent-fictif';
      if (expireSession && url.includes('/etat_guichet'))
        return route.fulfill({ status: 401, json: { message: 'Session expirée' } });
      if (url.includes('/administrer_postes_agents')) {
        const body = route.request().postDataJSON();
        if (body.action === 'activer') stations = [{ compte: deviceId, libelle: body.nom }];
        return route.fulfill({ json: stations });
      }
      const data = url.includes('/functions/v1/connexion-administration')
        ? { access_token: 'administration-fictive' }
        : url.includes('/auth/v1/signup')
          ? { user: { id: deviceId, is_anonymous: true }, refresh_token: 'poste-fictif' }
        : url.includes('/auth/v1/token?grant_type=refresh_token')
          ? { access_token: 'agent-fictif', refresh_token: 'poste-renouvele' }
        : url.includes('/mon_profil')
          ? (agent ? 'agent' : 'administrateur')
          : url.includes('/etat_guichet')
            ? {
                day: '2026-11-14',
                settings: { stations: {}, permissions: {}, boxes: {} },
                settingsRevision: 1,
                boards: [],
                videos: [],
                events: [],
                trash: [],
                totals: [],
              }
            : [person];
      return route.fulfill({ json: data });
    });
    await page.clock.install({ time: new Date('2026-11-14T12:00:00+01:00') });
    await page.goto(origin + '/dev/index.html');
    assert.equal(staleScriptRequested, false);
    await page.locator('#entryTheme').click();
    assert.equal(await page.locator('#entryTheme').getAttribute('aria-pressed'), 'true');
    await page.locator('#login [name=agentLogin]').click();
    await waitText(page, '#loginMsg', 'activé par un administrateur');
    await page.locator('#login [name=adminLogin]').click();
    await page.locator('#login [name=password]').fill('mot-de-passe-fictif');
    await page.locator('#login [name=submit]').click();
    await page.locator('main').waitFor({ state: 'visible' });
    await page.locator('#openUsers').click();
    await page.locator('#createUser').click();
    await page.locator('#personDialog').waitFor({ state: 'visible' });
    assert.equal(
      await page.locator('#personTitle').textContent(),
      'Nouvel usager',
    );
    const carte = page.locator('#personForm [name=card]');
    await carte.fill('00000012');
    assert.equal(await carte.inputValue(), '0000001');
    assert.equal(await page.locator('#personForm [name=last]').evaluate((input) => input === document.activeElement), true);
    await page.locator('#closePerson').click();
    await page.locator('[data-tab=vid]').click();
    await page.locator('#lookup').fill('Fictif Camille');
    await waitText(page, '#results', '0000001 · Camille Fictif');
    await page.locator('#lookup').fill('00000012');
    assert.equal(await page.locator('#lookup').inputValue(), '0000001');
    await page.locator('#openUsers').click();
    await page.locator('#userList button').click();
    await page.locator('#personDialog').waitFor({ state: 'visible' });
    assert.equal(
      await page.locator('#personForm [name=first]').inputValue(),
      'Camille',
    );
    await page.locator('#closePerson').click();
    await page.locator('#openAdmin').click();
    await page.locator('[data-admin-tab=acces]').click();
    await page.getByRole('button', { name: 'Gérer les postes agents' }).click();
    await page.locator('#agentDeviceForm [name=label]').fill('Poste de recette');
    await page.locator('#agentDeviceForm button').click();
    await waitText(page, '#agentDeviceStatus', 'Ce navigateur est activé');
    await page.reload();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.locator('#login [name=agentLogin]').click();
    await page.locator('main').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#sessionProfile').innerText(), 'Session agent');
    assert.equal(await page.locator('#openAdmin').isVisible(), false);
    await page.locator('#openUsers').click();
    await page.locator('#userList button').click();
    await page.locator('#personDialog').waitFor({ state: 'visible' });
    await page.clock.fastForward(15 * 60_000 + 100);
    await waitText(page, '#loginMsg', '15 minutes d’inactivité');
    assert.equal(await page.locator('main').isVisible(), false);
    assert.equal(await page.locator('#personDialog').isVisible(), false);
    await page.locator('#login [name=agentLogin]').click();
    await page.locator('main').waitFor({ state: 'visible' });
    expireSession = true;
    await waitText(page, '#loginMsg', 'Session expirée');
    assert.equal(await page.locator('main').isVisible(), false);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
