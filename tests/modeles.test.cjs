// Recette connectée : nécessite les fichiers privés de configuration et de comptes.
const { test, before, after } = require('node:test'),
  assert = require('node:assert/strict'),
  { spawn } = require('node:child_process'),
  { chromium } = require('playwright');
const { login, state, cmd, cleanup, accounts, api } = require('./helpers.cjs');
let server, origin;
before(async () => {
  server = spawn('python', ['scripts/serve-dev.py', '--port', '0']);
  origin = await new Promise((resolve) => {
    let out = '';
    server.stdout.on('data', (c) => {
      out += c;
      const m = out.match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (m) resolve(m[0]);
    });
  });
});
after(() => server?.kill());
async function text(p, selector, value) {
  await p.waitForFunction(
    ({ selector, value }) =>
      document.querySelector(selector)?.textContent.includes(value),
    { selector, value },
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
  'Délégation des modèles : refus par défaut, gestion limitée et synchronisée, révocation',
  { timeout: 120000 },
  async () => {
    const admin = await login('administrateur'),
      agent = await login('agent');
    let original, browser;
    try {
      let s = await state(admin);
      original = structuredClone(s.settings);
      const cfg = structuredClone(original);
      cfg.permissions = { ...cfg.permissions, templates: false };
      await cmd(admin, 'config.save', {
        settings: cfg,
        revision: s.settingsRevision,
      });
      s = await state(admin);
      const name = 'Modèle fictif ' + Date.now(),
        model = {
          title: 'Animation fictive',
          time: '10:00',
          endTime: '11:00',
          room: 'Créazone',
          mode: 'inscription',
          cap: 4,
          count: true,
        };
      for (const action of ['template.save', 'template.remove'])
        await cmd(
          agent,
          action,
          { name, model, revision: s.settingsRevision },
          403,
        );
      browser = await chromium.launch({
        headless: true,
        ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
          : {}),
      });
      const a = await (await browser.newContext()).newPage(),
        b = await (
          await browser.newContext({ viewport: { width: 360, height: 900 } })
        ).newPage();
      await Promise.all([enter(a, 'administrateur'), enter(b, 'agent')]);
      assert.equal(await b.locator('#openAdmin').isVisible(), false);
      await a.locator('#openAdmin').click();
      await a.locator('[data-admin-tab=acces]').click();
      await a.locator('[name=permission-templates]').check();
      await a.locator('#adminSave').click();
      await text(a, '#configMsg', 'Accès des agents');
      await b.locator('#openAdmin').waitFor({ state: 'visible' });
      await b.locator('#openAdmin').click();
      assert.equal(await b.locator('#openStats').isVisible(), false);
      assert.equal(await b.locator('[data-admin-tab]:visible').count(), 1);
      assert.equal(await b.locator('#adminSave').isVisible(), false);
      assert.equal(await b.locator('[name=eventTypes]').isVisible(), false);
      const before = await state(admin);
      await cmd(
        agent,
        'config.save',
        { settings: before.settings, revision: before.settingsRevision },
        403,
      );
      assert.equal(
        (
          await api('/rest/v1/rpc/statistiques_guichet', agent, {
            debut: before.day,
            fin: before.day,
          })
        ).status,
        403,
      );
      await b.locator('#newTemplate').click();
      await b.locator('#templateForm [name=name]').fill(name);
      await b.locator('#templateForm [name=title]').fill(model.title);
      await b.locator('#templateForm [name=room]').selectOption(model.room);
      await b.locator('#templateForm button.primary').click();
      await text(b, '#notice', 'Modèle enregistré.');
      s = await state(admin);
      assert.ok(s.settings.eventTemplates[name]);
      assert.deepEqual(
        { ...s.settings, eventTemplates: before.settings.eventTemplates },
        before.settings,
      );
      assert.deepEqual(s.events, before.events);
      await cmd(
        agent,
        'template.save',
        { name: 'Autre nom', model, revision: before.settingsRevision },
        409,
      );
      await cmd(
        agent,
        'template.save',
        { name: '__proto__', model, revision: s.settingsRevision },
        400,
      );
      await cmd(
        agent,
        'template.save',
        {
          name: 'Invalide',
          model: { ...model, endTime: '09:00' },
          revision: s.settingsRevision,
        },
        400,
      );
      await a.locator('[data-admin-tab=animations]').click();
      await a
        .getByRole('button', {
          name: 'Modifier le modèle ' + name,
          exact: true,
        })
        .waitFor();
      await b
        .getByRole('button', {
          name: 'Modifier le modèle ' + name,
          exact: true,
        })
        .click();
      await b
        .locator('#templateForm [name=title]')
        .fill('Titre corrigé fictif');
      await b.locator('#templateForm button.primary').click();
      await text(b, '#templateList', 'Titre corrigé fictif');
      await text(a, '#templateList', 'Titre corrigé fictif');
      b.once('dialog', (d) => d.accept());
      await b
        .getByRole('button', {
          name: 'Supprimer le modèle ' + name,
          exact: true,
        })
        .click();
      await text(b, '#notice', 'Modèle supprimé.');
      assert.equal(
        (await state(admin)).settings.eventTemplates[name],
        undefined,
      );
      assert.deepEqual((await state(admin)).events, before.events);
      await a
        .getByRole('button', {
          name: 'Modifier le modèle ' + name,
          exact: true,
        })
        .waitFor({ state: 'hidden' });
      await a.locator('[data-admin-tab=acces]').click();
      await a.locator('[name=permission-templates]').uncheck();
      await a.locator('#adminSave').click();
      await text(a, '#configMsg', 'Accès des agents');
      await b.locator('#openAdmin').waitFor({ state: 'hidden' });
      s = await state(admin);
      await cmd(
        agent,
        'template.save',
        { name, model, revision: s.settingsRevision },
        403,
      );
    } finally {
      await browser?.close();
      await cleanup(admin, original);
    }
  },
);
