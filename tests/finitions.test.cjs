// Recette autonome dans le navigateur, sans compte ni base distante.
const { test, before, after } = require('node:test'),
  assert = require('node:assert/strict'),
  { spawn } = require('node:child_process'),
  { chromium } = require('playwright');
const { sampleDayPlan } = require('../dev/sample-data.js');
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
    server.stdout.on('data', (c) => {
      output += c;
      const m = output.match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (m) resolve(m[0]);
    });
    server.on('error', reject);
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
test('Journée fictive cohérente avec cartes individuelles et salles sans chevauchement', () => {
  const settings = {
      stations: {
        MARIO: {
          capacity: 4,
          games: ['Fictif'],
          slots: ['09:00–10:00', '10:00–11:00', '11:00–12:00', '14:00–15:00'],
          enabled: true,
        },
      },
    },
    p = sampleDayPlan('2026-11-14', settings);
  assert.equal(p.people.length, 120);
  assert.equal(p.boards.length, 28);
  assert.ok(p.videos.length > 8);
  assert.equal(
    new Set(p.videos.map((x) => x.players[0].card)).size,
    p.videos.length,
  );
  for (const e of p.events) {
    assert.equal(new Set(e.players.map((x) => x.card)).size, e.players.length);
    for (const g of e.players) {
      assert.ok(p.people.some((x) => x.carte === g.card));
      assert.equal(g.companions, g.companionNames.length);
      if (e.cap) assert.equal(g.companions, 0);
    }
    assert.ok(
      !p.events.some(
        (x) =>
          x !== e &&
          x.date === e.date &&
          x.room === e.room &&
          x.time < e.endTime &&
          e.time < x.endTime,
      ),
    );
  }
  assert.equal(Object.keys(p.templates).length, 3);
});

test(
  'Refus JV : rappel du jour, de l’horaire et du poste existant',
  { timeout: 60000 },
  async () => {
    const browser = await chromium.launch({
      headless: true,
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
        : {}),
    });
    try {
      const p = await browser.newPage();
      await p.goto(origin + '/');
      await p.locator('#videoPlanning').waitFor({ state: 'visible' });
      const before = await p.evaluate(() =>
          globalThis.guichetDirectory.state(),
        ),
        existing = before.videos[0];
      await p.locator('#addvideo').click();
      await p.locator('#vf [name=slot]').selectOption({ index: 4 });
      await p.locator('#vf [name=game]').selectOption({ index: 1 });
      await p.locator('#vf [name=card]').fill(existing.card);
      await p.locator('#vf button.primary').click();
      await text(p, '#vfmsg', 'déjà inscrit(e)');
      const message = await p.locator('#vfmsg').textContent();
      assert.ok(message.includes(existing.card));
      assert.ok(message.includes(existing.post));
      assert.ok(message.includes(existing.date.split('-').reverse().join('/')));
      assert.ok(message.includes('de ' + existing.slot + ' à ' + existing.end));
      assert.equal(
        (await p.evaluate(() => globalThis.guichetDirectory.state())).videos
          .length,
        before.videos.length,
      );
      assert.equal(
        await p.locator('#vf [name=card]').inputValue(),
        existing.card,
      );
    } finally {
      await browser.close();
    }
  },
);

test(
  'Inscription rapide : chronologie, jauge, accompagnateurs et confirmation J+15',
  { timeout: 60000 },
  async () => {
    const browser = await chromium.launch({
      headless: true,
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
        : {}),
    });
    try {
      const p = await browser.newPage({
        viewport: { width: 360, height: 900 },
      });
      await p.goto(origin + '/');
      await p.locator('[data-tab=ani]').click();
      await p.locator('#quickRegister').click();
      const choices = await p
        .locator('#quickGuest [name=eventId] option')
        .allTextContents();
      assert.match(choices[1], /Origami/);
      assert.match(choices[2], /Découverte coopérative/);
      assert.equal(
        await p
          .locator('#quickGuest [name=eventId] option')
          .nth(1)
          .getAttribute('disabled'),
        '',
      );
      assert.ok(!choices.some((x) => x.includes('Création libre')));
      await p.locator('#quickGuest [name=card]').fill('ESSAI-9997');
      const uncapped = p
        .locator('#quickGuest [name=eventId] option')
        .filter({ hasText: 'Rencontre autour du jeu' });
      await p
        .locator('#quickGuest [name=eventId]')
        .selectOption(await uncapped.getAttribute('value'));
      assert.equal(
        await p.locator('#quickGuest [name=card]').inputValue(),
        'ESSAI-9997',
      );
      await p.locator('#quickGuest [name=companionNames]').fill('Alex Fictif');
      await p.locator('#quickGuest button.primary').click();
      await text(p, '#notice', 'enregistrée.');
      await p.locator('#calendar .today').click();
      await p
        .locator('#agenda button')
        .filter({ hasText: 'Rencontre autour du jeu' })
        .click();
      await text(p, '#guests', 'Alex Fictif');
      await p.locator('#close').click();
      await p.locator('#quickRegister').click();
      const far = p.locator('#quickGuest [name=eventId] option').last();
      await p
        .locator('#quickGuest [name=eventId]')
        .selectOption(await far.getAttribute('value'));
      await p.locator('#quickGuest [name=card]').fill('ESSAI-9998');
      assert.equal(
        await p.locator('#quickGuest [name=companionNames]').count(),
        0,
      );
      p.once('dialog', (d) => d.dismiss());
      await p.locator('#quickGuest button.primary').click();
      assert.equal(await p.locator('#quickGuest').isVisible(), true);
      p.once('dialog', (d) => d.accept());
      await p.locator('#quickGuest button.primary').click();
      await text(p, '#notice', 'enregistrée.');
      assert.equal(await p.locator('#modal').isVisible(), false);
    } finally {
      await browser.close();
    }
  },
);
test(
  'Écrans épurés, retrait depuis Aujourd’hui et création de modèles sans séance',
  { timeout: 60000 },
  async () => {
    const browser = await chromium.launch({
      headless: true,
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
        : {}),
    });
    try {
      const p = await browser.newPage({
          viewport: { width: 1440, height: 1000 },
        }),
        errors = [];
      p.on('pageerror', (e) => errors.push(e.message));
      await p.goto(origin + '/');
      await p.locator('#videoPlanning').waitFor({ state: 'visible' });
      assert.equal(
        await p.getByRole('button', { name: /Exporter|Coller/ }).count(),
        0,
      );
      assert.equal(await p.locator('#videoListTools').isVisible(), false);
      assert.equal(await p.locator('#bulkVideo').isVisible(), false);
      const remove = p.locator('#videoPlanning .cancelBooking').first(),
        label = await remove.getAttribute('aria-label');
      p.once('dialog', (d) => d.dismiss());
      await remove.click();
      assert.equal(
        await p.getByRole('button', { name: label, exact: true }).count(),
        1,
      );
      p.once('dialog', (d) => d.accept());
      await remove.click();
      await text(p, '#notice', 'Saisie retirée.');
      assert.equal(
        await p.getByRole('button', { name: label, exact: true }).count(),
        0,
      );
      await p.locator('#role').selectOption('Administrateur');
      await p.locator('#videoAll').click();
      assert.equal(await p.locator('#videoListTools').isVisible(), true);
      assert.equal(await p.locator('#bulkVideo').isDisabled(), true);
      await p.locator('#videos input[type=checkbox]').first().check();
      assert.equal(await p.locator('#bulkVideo').isEnabled(), true);
      await p.locator('#videoToday').click();
      assert.equal(await p.locator('#videoListTools').isVisible(), false);
      await p.locator('[data-tab=ani]').click();
      await p.locator('#calendar .today').click();
      await p.locator('#new').click();
      assert.equal(await p.locator('#af [name=template] option').count(), 4);
      await p
        .locator('#af [name=template]')
        .selectOption('DÉMO · Atelier créatif (8 places)');
      assert.equal(await p.locator('#af [name=cap]').inputValue(), '8');
      await p.locator('#af [name=title]').fill('Modèle fictif de recette');
      assert.match(
        await p.locator('#af [name=eventType]').locator('..').textContent(),
        /statistiques/,
      );
      assert.equal(await p.locator('#saveDraftTemplate').count(), 0);
      await p.locator('#close').click();
      await p.locator('#openAdmin').click();
      await p.locator('[data-admin-tab=animations]').click();
      await p.locator('#newTemplate').click();
      await p.locator('#templateForm [name=name]').fill('Mon modèle fictif');
      await p
        .locator('#templateForm [name=title]')
        .fill('Modèle fictif de recette');
      await p.locator('#templateForm [name=room]').selectOption('Créazone');
      await p.locator('#templateForm button.primary').click();
      await text(p, '#notice', 'Modèle enregistré.');
      assert.doesNotMatch(
        await p.locator('#eventsTable').innerText(),
        /Modèle fictif de recette/,
      );
      await p.locator('[data-tab=ani]').click();
      await p.locator('#calendar .today').click();
      await p.locator('#new').click();
      await p.locator('#af [name=template]').selectOption('Mon modèle fictif');
      assert.equal(
        await p.locator('#af [name=title]').inputValue(),
        'Modèle fictif de recette',
      );
      await p.locator('#close').click();
      await p.locator('#openAdmin').click();
      await p.locator('[data-admin-tab=liens]').click();
      assert.equal(await p.locator('#config [name=selections]').count(), 0);
      await p.locator('#openStats').click();
      await text(p, '#statsMsg', 'actualisées');
      const download = p.waitForEvent('download');
      await p.locator('#exportStats').click();
      const file = await download;
      const fs = require('node:fs');
      const csv = fs.readFileSync(await file.path(), 'utf8');
      assert.match(csv, /"periode";"activite"/);
      assert.match(csv, /Jeux vidéo/);
      assert.doesNotMatch(csv, /ESSAI-/);
      assert.equal(await p.getByRole('button', { name: /Coller/ }).count(), 0);
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  },
);

test('Corbeille : confirmation, accès administrateur et suppression définitive', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(origin + '/');
    await page.locator('#videoPlanning').waitFor({ state: 'visible' });
    await page.locator('#openTrash').click();
    assert.equal(await page.locator('#emptyTrash').isVisible(), false);
    await page.locator('#role').selectOption({ label: 'Administrateur' });
    await page.waitForFunction(
      () => globalThis.guichetDirectory.profile === 'administrateur',
    );
    assert.equal(await page.locator('#emptyTrash').isDisabled(), true);
    const before = await page.evaluate(async () => {
      const api = globalThis.guichetDirectory,
        s = await api.state();
      await api.command('board.remove', {
        rows: [{ id: s.boards[0].id, revision: s.boards[0].revision }],
      });
      await api.command('event.remove', {
        rows: [{ id: s.events[0].id, revision: s.events[0].revision }],
      });
      await api.onReady();
      return { state: await api.state(), people: await api.list() };
    });
    await page.locator('#openTrash').click();
    page.once('dialog', async (dialog) => {
      assert.match(dialog.message(), /2 élément\(s\).*irréversible/);
      await dialog.dismiss();
    });
    await page.locator('#emptyTrash').click();
    assert.equal(
      await page.evaluate(
        async () => (await globalThis.guichetDirectory.state()).trash.length,
      ),
      2,
    );
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('#emptyTrash').click();
    await text(page, '#notice', 'Corbeille vidée définitivement.');
    assert.equal(await page.locator('#emptyTrash').isDisabled(), true);
    assert.equal(await page.locator('#undo').isDisabled(), true);
    const after = await page.evaluate(async () => ({
      state: await globalThis.guichetDirectory.state(),
      people: await globalThis.guichetDirectory.list(),
    }));
    assert.deepEqual(after.state.trash, []);
    assert.deepEqual(after.state.boards, before.state.boards);
    assert.deepEqual(after.state.videos, before.state.videos);
    assert.deepEqual(after.state.events, before.state.events);
    assert.deepEqual(after.people, before.people);
    // Le contrôle serveur simulé refuse aussi un appel direct d’un agent.
    const denied = await page.evaluate(async () => {
      const api = globalThis.guichetDirectory;
      api.profile = 'agent';
      try {
        await api.command('trash.empty', { rows: [] });
        return false;
      } catch (error) {
        return error.message.includes('Administration réservée');
      }
    });
    assert.equal(denied, true);
  } finally {
    await browser.close();
  }
});
