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
  all,
  row,
  plus,
  cleanup,
  accounts,
  fixture,
} = require('./helpers.cjs');
let server, origin;
before(async () => {
  server = spawn('python', ['scripts/serve-dev.py', '--port', '0']);
  origin = await new Promise((resolve, reject) => {
    let output = '';
    server.stdout.on('data', (c) => {
      output += c;
      const match = output.match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (match) resolve(match[0]);
    });
    server.on('error', reject);
    setTimeout(() => reject(Error('Serveur non démarré')), 10000).unref();
  });
});
after(() => server?.kill());
async function waitText(p, selector, text) {
  await p.waitForFunction(
    ({ selector, text }) =>
      document.querySelector(selector)?.textContent.includes(text),
    { selector, text },
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
  'Parcours réels à deux sessions : navigation, droits, annuaire, planning, J+15 et thème',
  { timeout: 180000 },
  async () => {
    const token = await login('administrateur');
    let original, browser;
    try {
      let s = await state(token);
      original = structuredClone(s.settings);
      const cfg = structuredClone(original),
        post = 'UI-' + Date.now();
      cfg.stations[post] = {
        capacity: 2,
        games: ['Jeu fictif'],
        slots: ['09:00–10:00', '10:00–11:00', '20:00–21:00'],
        enabled: true,
      };
      cfg.manageEvents = true;
      await cmd(token, 'config.save', {
        settings: cfg,
        revision: s.settingsRevision,
      });
      browser = await chromium.launch({
        headless: true,
        ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
          : {}),
      });
      const ca = await browser.newContext({
          viewport: { width: 1440, height: 1000 },
          locale: 'fr-FR',
          timezoneId: 'Europe/Paris',
        }),
        cb = await browser.newContext({
          viewport: { width: 360, height: 900 },
          locale: 'fr-FR',
          timezoneId: 'Europe/Paris',
        }),
        a = await ca.newPage(),
        b = await cb.newPage(),
        errors = [];
      for (const p of [a, b]) p.on('pageerror', (e) => errors.push(e.message));
      await Promise.all([enter(a, 'administrateur'), enter(b, 'agent')]);
      assert.equal(await a.locator('#sidebar [data-tab]').count(), 7);
      assert.equal(await b.locator('#openStats').isVisible(), false);
      assert.equal(await b.locator('#openAdmin').isVisible(), false);
      assert.equal(await b.locator('#export-vid,#paste-vid').count(), 0);
      assert.equal(await a.locator('#videoPlanning').isVisible(), true);
      assert.match(await a.locator('#videoPlanning').innerText(), /Horaire/);
      await a.locator('#videoAll').click();
      assert.equal(await a.locator('#videos').isVisible(), true);
      const c = await card(token);
      await b.locator('#openUsers').click();
      await b.locator('#createUser').click();
      await b.locator('#personForm [name=card]').fill(c);
      await b.locator('#personForm [name=first]').fill('Camille');
      await b.locator('#personForm [name=last]').fill('Fictif');
      await b.locator('#personForm button').first().click();
      await waitText(b, '#notice', 'Fiche enregistrée.');
      await a.locator('#openUsers').click();
      await waitText(a, '#userList', c);
      await a.locator('#filterUsers').fill('Camille');
      await a.locator('#userList button').filter({ hasText: c }).click();
      await a.locator('#deleteUser').waitFor({ state: 'visible' });
      assert.equal(await b.locator('#deleteUser').isVisible(), false);
      const agentToken = await login('agent');
      assert.equal(
        (await api('/rest/v1/rpc/supprimer_usager', agentToken, { numero: c }))
          .status,
        403,
      );
      a.once('dialog', (d) => d.accept());
      await a.locator('#deleteUser').click();
      await waitText(a, '#notice', 'Fiche supprimée.');
      await b.waitForFunction(
        (c) => !document.querySelector('#userList').textContent.includes(c),
        c,
      );
      console.log(
        'OK : fiche créée par l’agent, retrouvée par nom dans l’autre session, suppression administrative propagée',
      );
      await b.locator('[data-tab=soc]').click();
      const bc = await card(token);
      await b.locator('#board [name=card]').fill(bc);
      await b.locator('#board [name=box]').fill('FICTIF-CTRLZ');
      await b.locator('#board button').click();
      await waitText(b, '#notice', 'Consultation enregistrée.');
      await b.locator('main h1').click();
      await b.keyboard.press('Control+z');
      await waitText(b, '#notice', 'Dernière opération annulée.');
      await b.locator('[data-tab=vid]').click();
      await b.locator('#addvideo').click();
      assert.equal(await b.locator('#vf [name=companions]').count(), 0);
      await b.locator('#vf [name=post]').selectOption(post);
      const vc = await card(token);
      await b.locator('#vf [name=card]').fill(vc);
      await b.locator('#vf [name=game]').selectOption('Jeu fictif');
      await b.locator('#vf button.primary').click();
      await waitText(b, '#vfmsg', 'Inscription enregistrée.');
      await b.locator('#close').click();
      await a.locator('[data-tab=vid]').click();
      await a.locator('#videoToday').click();
      await waitText(a, '#videoPlanning', vc);
      console.log(
        'OK : Ctrl+Z annule une opération, formulaire JV sans accompagnateur et planning synchronisé',
      );
      await b.locator('#theme').click();
      assert.equal(await b.locator('html').getAttribute('data-theme'), 'dark');
      assert.equal(
        await b.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      const far = plus(s.day, 16);
      const ev = (
        await cmd(token, 'event.save', {
          date: far,
          title: 'Atelier fictif UI ' + Date.now(),
          time: '21:00',
          endTime: '22:00',
          room: 'Créazone',
          mode: 'inscription',
          cap: 3,
          count: true,
          repeat: 1,
        })
      ).ids[0];
      await b.locator('[data-tab=ani]').click();
      if (far.slice(0, 7) !== s.day.slice(0, 7))
        await b.locator('#next').click();
      await waitText(b, '#eventsTable', 'Atelier fictif UI');
      assert.match(
        await b.locator(`[data-date="${far}"]`).getAttribute('class'),
        /beyondHorizon/,
      );
      await b.locator(`[data-date="${far}"]`).click();
      await b
        .locator('#agenda button')
        .filter({ hasText: 'Atelier fictif UI' })
        .click();
      const gc = await card(token);
      await b.locator('#guest [name=card]').fill(gc);
      assert.equal(await b.locator('#guest [name=companions]').count(), 0);
      assert.equal(await b.locator('#guest [name=companionNames]').count(), 0);
      b.once('dialog', (d) => {
        assert.match(d.message(), /15 prochains jours/);
        return d.dismiss();
      });
      await b.locator('#guest button.primary').click();
      assert.equal(
        (await state(token)).events.find((x) => x.id === ev).guests.length,
        0,
      );
      b.once('dialog', (d) => d.accept());
      await b.locator('#guest button.primary').click();
      await waitText(b, '#guests', gc);
      await b.locator('#close').click();
      console.log(
        'OK : calendrier grisé après J+15, refus de la confirmation sans écriture, accord explicite accepté',
      );
      await a.locator('[data-tab=ani]').click();
      await a.locator('#calendar .today').click();
      await a.locator('#new').click();
      assert.equal(await a.locator('#af [name=openDate]').count(), 0);
      assert.equal(
        await a.locator('#af [name=room]').getAttribute('required'),
        '',
      );
      assert.equal(
        await a.locator('#af [name=endTime]').getAttribute('required'),
        '',
      );
      await a
        .locator('#af [name=title]')
        .fill('Animation fictive de formation');
      await a.locator('#af [name=room]').selectOption('Salle JV');
      await a.locator('#close').click();
      await a.locator('#openAdmin').click();
      await a.locator('[data-admin-tab=animations]').click();
      await a.locator('#newTemplate').click();
      const model = 'Modèle de recette ' + Date.now();
      await a.locator('#templateForm [name=name]').fill(model);
      await a
        .locator('#templateForm [name=title]')
        .fill('Animation fictive de formation');
      await a.locator('#templateForm [name=room]').selectOption('Salle JV');
      await a.locator('#templateForm button.primary').click();
      await waitText(a, '#notice', 'Modèle enregistré.');
      assert.ok((await state(token)).settings.eventTemplates[model]);
      assert.ok(
        !(await state(token)).events.some(
          (e) => e.title === 'Animation fictive de formation',
        ),
      );
      await b.locator('#now').click();
      await b.locator('#calendar .today').click();
      await b.locator('#new').click();
      await b.locator('#af [name=template]').selectOption(model);
      assert.equal(
        await b.locator('#af [name=title]').inputValue(),
        'Animation fictive de formation',
      );
      await b.locator('#close').click();
      await a.locator('#openStats').click();
      await waitText(a, '#statsMsg', 'actualisées');
      assert.ok((await a.locator('#statsTable tbody tr').count()) > 0);
      assert.equal(await a.locator('#exportStats').isVisible(), true);
      await a.locator('#openAdmin').click();
      await a.locator('[data-admin-tab=postes]').click();
      await a.locator('#editPost').selectOption(post);
      await a.locator('#config [name=enabled]').uncheck();
      a.once('dialog', (d) => {
        assert.match(d.message(), /réservation/);
        return d.dismiss();
      });
      await a.locator('#config .actions button').click();
      assert.equal(
        (await state(token)).videos.some((x) => x.card === vc),
        true,
      );
      a.once('dialog', (d) => d.accept());
      await a.locator('#config .actions button').click();
      await waitText(a, '#configMsg', 'Postes JV');
      assert.equal(
        (await state(token)).videos.some((x) => x.card === vc),
        false,
      );
      console.log(
        'OK : salle et fin obligatoires, statistiques administratives, fermeture forcée après confirmation',
      );
      await a.locator('[data-tab=vid]').click();
      await a.locator('#theme').click();
      await a.screenshot({ path: 'test-results/guichet-bureau-sombre.png' });
      await b.locator('[data-tab=vid]').click();
      await b.screenshot({ path: 'test-results/guichet-360-sombre.png' });
      assert.deepEqual(errors, []);
    } finally {
      await browser?.close();
      await cleanup(token, original);
    }
  },
);
test('Inscription publique désactivée', async () => {
  assert.equal(
    (await api('/auth/v1/settings', null, undefined, 'GET')).data
      .disable_signup,
    true,
  );
});
