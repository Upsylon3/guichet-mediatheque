// Outils des essais connectés : comptes privés locaux et nettoyage des données créées.
const fs = require('node:fs'),
  crypto = require('node:crypto'),
  assert = require('node:assert/strict');
const config = JSON.parse(fs.readFileSync('.env.local.json')),
  accounts = JSON.parse(fs.readFileSync('.env.accounts.json'));
if (new URL(config.SUPABASE_URL).hostname === 'tmsmjerslmogjhyzkfrn.supabase.co')
  throw new Error('Utiliser un projet Supabase isolé pour la recette connectée.');
const fixture = { ids: [], cards: [], operations: [] };
const testDevices = new Set();
async function api(path, token, body, method = 'POST') {
  const r = await fetch(config.SUPABASE_URL + path, {
    method,
    headers: {
      apikey: config.ANON_KEY,
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(20000),
  });
  const text = await r.text();
  return { status: r.status, data: text ? JSON.parse(text) : null };
}
async function login(role) {
  if (role === 'agent') return (await newAgentDevice()).access_token;
  const r = await api('/functions/v1/connexion-administration', null, {
        password: accounts.administrateur.password,
      });
  assert.equal(r.status, 200, r.data?.message);
  return r.data.access_token;
}
async function newAgentDevice() {
  const admin = await login('administrateur');
  const session = await api('/auth/v1/signup', null, {});
  assert.equal(session.status, 200, session.data?.message);
  const id = session.data.user.id;
  const activated = await api('/rest/v1/rpc/administrer_postes_agents', admin, {
    action: 'activer', identifiant: id, nom: 'Poste fictif de recette',
  });
  assert.equal(activated.status, 200, activated.data?.message);
  testDevices.add(id);
  return session.data;
}
async function enter(page, origin, role) {
  await page.goto(origin + '/dev/index.html');
  if (role === 'agent') {
    const device = await newAgentDevice();
    await page.evaluate(({ url, id, refresh }) => {
      localStorage.setItem('ludion-poste-agent:' + url, JSON.stringify({ id, refresh }));
    }, { url: config.SUPABASE_URL, id: device.user.id, refresh: device.refresh_token });
    await page.locator('#login [name=agentLogin]').click();
  } else {
    await page.locator('#login [name=adminLogin]').click();
    await page.locator('#login [name=password]').fill(accounts.administrateur.password);
    await page.locator('#login [name=submit]').click();
  }
  await page.locator('main').waitFor({ state: 'visible' });
}
async function state(token) {
  const r = await api('/rest/v1/rpc/etat_guichet', token, {});
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.data;
}
async function cmd(
  token,
  action,
  donnees,
  expect = 200,
  operation = crypto.randomUUID(),
) {
  fixture.operations.push(operation);
  const r = await api('/rest/v1/rpc/commande_guichet', token, {
    action,
    donnees,
    operation,
  });
  assert.equal(r.status, expect, JSON.stringify({ action, ...r }));
  if (r.data?.ids) fixture.ids.push(...r.data.ids);
  return r.data;
}
async function card(token) {
  for (;;) {
    const card = '0' + String(crypto.randomInt(1000000)).padStart(6, '0');
    const r = await api(
      '/rest/v1/usagers?carte=eq.' + card,
      token,
      undefined,
      'GET',
    );
    if (!r.data.length) {
      fixture.cards.push(card);
      return card;
    }
  }
}
const all = (s) => [
  ...s.boards,
  ...s.videos,
  ...s.events,
  ...s.events.flatMap((e) => [...e.guests, ...e.counts]),
  ...s.trash,
];
const row = (x) => ({ id: x.id, revision: x.revision });
const plus = (date, n) => {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
async function cleanup(token, original) {
  for (const id of testDevices) {
    const revoked = await api('/rest/v1/rpc/administrer_postes_agents', token, { action: 'revoquer', identifiant: id });
    assert.equal(revoked.status, 200);
    testDevices.delete(id);
  }
  try {
    const s = await state(token);
    fixture.ids.push(
      ...all(s)
        .filter((x) => fixture.cards.includes(x.card))
        .map((x) => x.id),
    );
    for (const [kind, list] of [
      ['guest', s.events.flatMap((e) => e.guests)],
      ['count', s.events.flatMap((e) => e.counts)],
      ['video', s.videos],
      ['board', s.boards],
      ['event', s.events],
    ]) {
      const owned = list.filter(
        (x) => fixture.ids.includes(x.id) || fixture.cards.includes(x.card),
      );
      if (owned.length)
        await cmd(token, kind + '.remove', { rows: owned.map(row) });
    }
    if (original)
      await cmd(token, 'config.save', {
        settings: original,
        revision: (await state(token)).settingsRevision,
      });
  } finally {
    let old = { ids: [], cards: [], operations: [] };
    try {
      old = JSON.parse(fs.readFileSync('.env.test-cleanup.json'));
    } catch {}
    fs.writeFileSync(
      '.env.test-cleanup.json',
      JSON.stringify(
        Object.fromEntries(
          Object.keys(fixture).map((k) => [
            k,
            [...new Set([...old[k], ...fixture[k]])],
          ]),
        ),
      ),
    );
  }
}
module.exports = {
  api,
  login,
  state,
  cmd,
  card,
  all,
  row,
  plus,
  cleanup,
  fixture,
  enter,
  config,
};
