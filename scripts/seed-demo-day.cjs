// Préparer uniquement le projet distant de développement avec des données fictives.
const fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto');
const { sampleDayPlan } = require('../dev/sample-data.js');
const { isDeepStrictEqual } = require('node:util');
const root = path.join(__dirname, '..'),
  cfg = JSON.parse(fs.readFileSync(path.join(root, 'dev/config.json'))),
  account = JSON.parse(
    fs.readFileSync(path.join(root, '.env.accounts.json')),
  ).administrateur;
if (
  !process.argv.includes('--seed-fictional') ||
  new URL(cfg.url).hostname !== 'tmsmjerslmogjhyzkfrn.supabase.co'
)
  throw Error(
    'Utiliser --seed-fictional sur le projet réservé au développement fictif.',
  );
let token;
async function request(route, body, method = 'POST', prefer) {
  const response = await fetch(cfg.url + route, {
    method,
    headers: {
      apikey: cfg.anonKey,
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(20000),
  });
  const text = await response.text(),
    data = text ? JSON.parse(text) : null;
  if (!response.ok)
    throw Error(data?.message || 'Requête refusée ' + response.status);
  return data;
}
const state = () => request('/rest/v1/rpc/etat_guichet', {});
// Produire un identifiant stable pour éviter de rejouer une même création fictive.
function operation(key) {
  const hash = crypto
    .createHash('sha256')
    .update('jour-fictif-v1:' + key)
    .digest('hex')
    .slice(0, 32);
  return (
    hash.slice(0, 8) +
    '-' +
    hash.slice(8, 12) +
    '-' +
    hash.slice(12, 16) +
    '-' +
    hash.slice(16, 20) +
    '-' +
    hash.slice(20)
  );
}
const command = (action, donnees, key) =>
  request('/rest/v1/rpc/commande_guichet', {
    action,
    donnees,
    operation: operation(key),
  });
(async () => {
  token = (await request('/auth/v1/token?grant_type=password', account))
    .access_token;
  if ((await request('/rest/v1/rpc/mon_profil', {})) !== 'administrateur')
    throw Error('Compte administrateur requis');
  let s = await state(),
    day = s.day;
  const people = await request(
    '/rest/v1/usagers?select=carte,prenom,nom&limit=1000',
    undefined,
    'GET',
  );
  const own = new Set(
    people.filter((p) => /^Démo \d{3}$/.test(p.nom || '')).map((p) => p.carte),
  );
  const plan = sampleDayPlan(
    day,
    s.settings,
    s.videos.filter((v) => !own.has(v.card)),
  );
  const settings = structuredClone(s.settings);
  settings.boxes = { ...plan.boxes, ...settings.boxes };
  settings.eventTemplates = { ...plan.templates, ...settings.eventTemplates };
  settings.eventTypes = [
    ...new Set([...(settings.eventTypes || []), ...plan.types]),
  ];
  if (!isDeepStrictEqual(settings, s.settings))
    await command(
      'config.save',
      { settings, revision: s.settingsRevision },
      day + ':config:' + s.settingsRevision,
    );
  for (const p of plan.people) {
    const existing = people.find((x) => x.carte === p.carte);
    if (existing && existing.nom !== p.nom)
      throw Error('Carte de démonstration déjà utilisée : ' + p.carte);
    if (!existing)
      await request('/rest/v1/usagers', p, 'POST', 'return=minimal');
  }
  s = await state();
  for (const data of plan.boards)
    if (!s.boards.some((x) => x.sampleKey === data.sampleKey && x.date === day))
      await command('board.save', data, day + ':' + data.sampleKey);
  for (const data of plan.videos)
    if (
      !s.videos.some((x) => x.card === data.players[0].card && x.date === day)
    )
      await command('video.book', data, day + ':video:' + data.players[0].card);
  let skipped = 0;
  for (const item of plan.events) {
    s = await state();
    let ev = s.events.find(
      (x) => x.date === item.date && x.sampleKey === item.sampleKey,
    );
    const { players, counts, ...metadata } = item;
    if (!ev) {
      if (
        s.events.some(
          (x) =>
            x.date === item.date &&
            x.room === item.room &&
            x.time < item.endTime &&
            item.time < x.endTime,
        )
      ) {
        skipped++;
        continue;
      }
      const result = await command(
        'event.save',
        metadata,
        day + ':event:' + item.sampleKey,
      );
      ev = (await state()).events.find((x) => x.id === result.ids[0]);
    }
    const missing = players.filter(
      (p) => !ev.guests.some((x) => x.card === p.card),
    );
    if (missing.length)
      await command(
        'guest.book',
        { eventId: ev.id, players: missing },
        day + ':guests:' + item.sampleKey,
      );
    if (
      counts?.length &&
      !ev.counts.some((x) => x.sampleKey === item.sampleKey)
    )
      await command(
        'count.add',
        { eventId: ev.id, ...counts[0], sampleKey: item.sampleKey },
        day + ':counts:' + item.sampleKey,
      );
  }
  s = await state();
  const report = {
    day,
    usagersFictifs: plan.people.length,
    consultations: s.boards.filter((x) => x.sampleKey?.startsWith('soc-'))
      .length,
    reservationsJV: s.videos.filter((x) =>
      plan.people.some((p) => p.carte === x.card),
    ).length,
    animations: s.events.filter((x) => x.sampleKey).length,
    inscrits: s.events
      .filter((x) => x.sampleKey)
      .reduce((n, x) => n + x.guests.length, 0),
    modeles: Object.keys(plan.templates).length,
    seancesIgnoreesPourConflit: skipped,
  };
  fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'test-results/journee-fictive.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
