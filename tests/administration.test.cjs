// Recette connectée : nécessite les fichiers privés de configuration et de comptes.
const { test, before, after } = require('node:test'),
  assert = require('node:assert/strict'),
  { spawn } = require('node:child_process'),
  { chromium } = require('playwright'),
  fs = require('node:fs');
const {
  api,
  login,
  state,
  cmd,
  card,
  row,
  plus,
  cleanup,
  accounts,
} = require('./helpers.cjs');
let server, origin;
before(async () => {
  server = spawn('python', ['scripts/serve-dev.py', '--port', '0']);
  origin = await new Promise((resolve, reject) => {
    let output = '';
    server.stdout.on('data', (c) => {
      output += c;
      const m = output.match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (m) resolve(m[0]);
    });
    server.on('error', reject);
    setTimeout(() => reject(Error('Serveur non démarré')), 10000).unref();
  });
});
after(() => server?.kill());
async function text(p, selector, value) {
  await p.waitForFunction(
    ({ selector, value }) =>
      document.querySelector(selector)?.textContent.includes(value),
    { selector, value },
    { timeout: 15000 },
  );
}
async function enter(p, role) {
  await p.goto(origin + '/dev/index.html');
  await p.locator('#login [name=email]').fill(accounts[role].email);
  await p.locator('#login [name=password]').fill(accounts[role].password);
  await p.locator('#login button').click();
  await p.locator('main').waitFor({ state: 'visible' });
}
test(
  'Administration organisée et renommage transactionnel des postes JV',
  { timeout: 180000 },
  async () => {
    const token = await login('administrateur'),
      agent = await login('agent');
    let original, browser;
    try {
      let s = await state(token);
      original = structuredClone(s.settings);
      const old = 'ADMIN-' + Date.now(),
        renamed = old + '-NOUVEAU',
        other = old + '-AUTRE',
        cfg = structuredClone(original);
      cfg.stations[old] = {
        capacity: 2,
        games: ['Fictif'],
        slots: ['09:00–10:00', '10:00–11:00'],
        enabled: true,
        instruction: '',
        weekdays: {},
        exceptions: {
          [plus(s.day, 1)]: { instruction: 'Exception conservée' },
        },
      };
      cfg.stations[other] = {
        capacity: 1,
        games: ['Fictif'],
        slots: ['09:00–10:00'],
        enabled: true,
      };
      await cmd(token, 'config.save', {
        settings: cfg,
        revision: s.settingsRevision,
      });
      const c1 = await card(token),
        c2 = await card(token),
        book = (c) => ({
          date: s.day,
          post: old,
          slot: '09:00',
          game: 'Fictif',
          players: [{ card: c, companions: 0 }],
        });
      const active = (await cmd(agent, 'video.book', book(c1))).ids[0],
        removed = (await cmd(agent, 'video.book', book(c2))).ids[0];
      s = await state(token);
      await cmd(agent, 'video.remove', {
        rows: [row(s.videos.find((x) => x.id === removed))],
      });
      browser = await chromium.launch({
        headless: true,
        ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
          : {}),
      });
      const desktop = await browser.newContext({
          viewport: { width: 1440, height: 1050 },
          locale: 'fr-FR',
        }),
        mobile = await browser.newContext({
          viewport: { width: 360, height: 900 },
          locale: 'fr-FR',
        }),
        a = await desktop.newPage(),
        b = await mobile.newPage(),
        errors = [];
      for (const p of [a, b]) p.on('pageerror', (e) => errors.push(e.message));
      await Promise.all([enter(a, 'administrateur'), enter(b, 'agent')]);
      await a.locator('#openAdmin').click();
      assert.equal(await a.locator('[data-admin-tab]').count(), 5);
      assert.equal(await a.locator('[data-admin-panel]:visible').count(), 1);
      assert.equal(
        await a.locator('#adminExceptions').getAttribute('open'),
        null,
      );
      await a.locator('#editPost').selectOption(old);
      assert.equal(
        await a.locator('#config [name=postName]').evaluate((e) => e.readOnly),
        false,
      );
      await a.locator('#config [name=postName]').fill(renamed);
      await a.locator('#adminSave').click();
      await text(a, '#configMsg', 'Poste renommé');
      s = await state(token);
      assert.equal(s.settings.stations[old], undefined);
      assert.deepEqual(s.settings.stations[renamed], cfg.stations[old]);
      assert.equal(s.videos.find((x) => x.id === active).post, renamed);
      assert.equal(s.trash.find((x) => x.id === removed).post, renamed);
      await text(b, '#videoPlanning', renamed);
      assert.equal(await a.locator('#editPost').inputValue(), renamed);
      await cmd(
        agent,
        'video.book',
        { ...book(c1), post: renamed, slot: '10:00' },
        409,
      );
      const staleRevision = s.settingsRevision;
      const invalid = structuredClone(s.settings);
      invalid.stations[other] = invalid.stations[renamed];
      delete invalid.stations[renamed];
      await cmd(
        token,
        'config.save',
        {
          settings: invalid,
          revision: s.settingsRevision,
          renamePost: { source: renamed, target: other },
        },
        409,
      );
      const broken = structuredClone(s.settings),
        attempt = renamed + '-ECHEC';
      broken.stations[attempt] = {
        ...broken.stations[renamed],
        games: ['Incompatible'],
      };
      delete broken.stations[renamed];
      await cmd(
        token,
        'config.save',
        {
          settings: broken,
          revision: s.settingsRevision,
          renamePost: { source: renamed, target: attempt },
        },
        400,
      );
      assert.equal(
        (await state(token)).videos.find((x) => x.id === active).post,
        renamed,
      );
      await cmd(
        agent,
        'config.save',
        {
          settings: s.settings,
          revision: s.settingsRevision,
          renamePost: { source: renamed, target: attempt },
        },
        403,
      );
      console.log(
        'OK : nom modifiable, réservation et corbeille synchronisées, quota conservé ; doublon, incompatibilité et agent refusés',
      );
      await a.locator('#newPost').click();
      assert.equal(await a.locator('#config [name=postName]').inputValue(), '');
      await a.locator('[data-admin-tab=animations]').click();
      assert.equal(
        await a.locator('#config [name=postName]').isDisabled(),
        true,
      );
      await a.locator('#config [name=limit]').fill('7');
      await a.locator('#adminSave').click();
      await text(a, '#configMsg', 'Animations');
      s = await state(token);
      assert.equal(s.settings.limit, 7);
      assert.deepEqual(s.settings.stations[renamed], cfg.stations[old]);
      await cmd(
        token,
        'config.save',
        { settings: s.settings, revision: staleRevision },
        409,
      );
      await a.locator('[data-admin-tab=societe]').click();
      await a.locator('#config [name=boxCode]').fill('BOITE-ADMIN-FICTIVE');
      await a.locator('#config [name=boxTitle]').fill('Titre fictif');
      await a.locator('#adminSave').click();
      await text(a, '#configMsg', 'Jeux de société');
      assert.equal(
        await a.locator('#editBox').inputValue(),
        'BOITE-ADMIN-FICTIVE',
      );
      assert.equal(
        (await state(token)).settings.boxes['BOITE-ADMIN-FICTIVE'].title,
        'Titre fictif',
      );
      await a.locator('[data-admin-tab=liens]').click();
      await a
        .locator('#config [name=vsmart]')
        .fill('https://example.com/fictif');
      a.once('dialog', (d) => d.dismiss());
      await a.locator('[data-admin-tab=postes]').click();
      assert.equal(
        await a.locator('[data-admin-tab=liens]').getAttribute('aria-selected'),
        'true',
      );
      assert.equal(
        await a.locator('#config [name=vsmart]').inputValue(),
        'https://example.com/fictif',
      );
      a.once('dialog', (d) => d.accept());
      await a.locator('[data-admin-tab=postes]').click();
      assert.equal(
        (await state(token)).settings.links?.vsmart,
        original.links?.vsmart,
      );
      console.log(
        'OK : sauvegardes par rubrique sans validation parasite, catalogue de boîtes et avertissement sur brouillon',
      );
      const m = await browser.newPage({
        viewport: { width: 360, height: 900 },
      });
      m.on('pageerror', (e) => errors.push(e.message));
      await enter(m, 'administrateur');
      await m.locator('#openAdmin').click();
      await m.locator('#theme').click();
      assert.equal(
        await m.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await m.locator('[data-admin-tab=acces]').click();
      assert.equal(await m.locator('#manageRoles').isVisible(), true);
      assert.equal(
        await m.locator('#config [name=postName]').isDisabled(),
        true,
      );
      fs.mkdirSync('test-results', { recursive: true });
      await m.screenshot({
        path: 'test-results/administration-mobile.png',
        fullPage: true,
      });
      await a.locator('#editPost').selectOption(renamed);
      await a.screenshot({
        path: 'test-results/administration-organisee.png',
        fullPage: true,
      });
      assert.deepEqual(errors, []);
    } finally {
      await browser?.close();
      await cleanup(token, original);
    }
  },
);
