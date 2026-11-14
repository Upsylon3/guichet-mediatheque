'use strict';
// Jeu fictif commun aux essais connectés et à la démonstration autonome.
function sampleDayPlan(day, settings, existingVideos = [], demo = false) {
  const plus = (n) => {
    const d = new Date(day + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const cohort = (new Date(day + 'T12:00:00Z').getUTCDay() + 6) % 7;
  const card = (i) =>
    demo
      ? 'ESSAI-' + (700 + cohort * 150 + i)
      : String(900100 + cohort * 150 + i).padStart(7, '0');
  const names = [
    'Lina',
    'Noé',
    'Camille',
    'Sacha',
    'Mila',
    'Adam',
    'Lou',
    'Jules',
    'Inès',
    'Robin',
    'Nina',
    'Alex',
    'Éden',
    'Léa',
    'Maël',
    'Zoé',
    'Charlie',
    'Élie',
    'Jade',
    'Tom',
  ];
  const people = Array.from({ length: 120 }, (_, i) => ({
    carte: card(i),
    prenom: names[i % names.length],
    nom: 'Démo ' + String(i + 1).padStart(3, '0'),
    date_naissance: (i % 3 === 0 ? '1990' : '2015') + '-05-12',
    note_interne:
      i % 12 === 0 ? 'Fiche fictive destinée aux essais du guichet.' : null,
  }));
  const boxes = Object.fromEntries(
    [
      'Les aventuriers du rail',
      'Dixit',
      'Azul',
      'Dobble',
      'Kingdomino',
      'Carcassonne',
    ].map((title, i) => [
      'DEMO-' + (i + 1),
      { title: 'DÉMO · ' + title, sector: i % 2 ? 'Pop Zone' : 'Jeunesse' },
    ]),
  );
  const boards = Array.from({ length: 28 }, (_, i) => ({
    date: day,
    card: card(i),
    box: 'DEMO-' + ((i % 6) + 1),
    sector: i % 2 ? 'Pop Zone' : 'Jeunesse',
    kids: 1 + (i % 3),
    adults: i % 3 === 0 ? 1 : 0,
    sampleKey: 'soc-' + i,
  }));
  const videos = [];
  let player = 30;
  for (const [post, base] of Object.entries(settings.stations)) {
    const cfg = {
      ...base,
      ...base.weekdays?.[new Date(day + 'T12:00:00').getDay()],
      ...base.exceptions?.[day],
    };
    if (cfg.enabled === false || settings.closedDates?.includes(day)) continue;
    for (const [index, range] of cfg.slots.slice(0, 4).entries()) {
      const occupied = existingVideos.filter(
        (x) =>
          x.date === day && x.post === post && x.slot === range.slice(0, 5),
      );
      const target =
          index % 3 === 0 ? cfg.capacity : Math.max(1, cfg.capacity - 1),
        remaining = Math.max(0, target - occupied.length);
      for (let i = 0; i < remaining; i++)
        videos.push({
          date: day,
          post,
          slot: range.slice(0, 5),
          game: occupied[0]?.game || cfg.games[index % cfg.games.length],
          players: [{ card: card(player++), companions: 0 }],
        });
    }
  }
  let participant = 75;
  const event = (
    key,
    date,
    title,
    room,
    time,
    endTime,
    cap,
    n,
    extra = {},
  ) => ({
    sampleKey: key,
    date,
    title: 'DÉMO · ' + title,
    room,
    time,
    endTime,
    cap,
    count: true,
    mode: 'inscription',
    repeat: 1,
    eventType: 'Atelier',
    referent: 'Équipe fictive',
    audience: 'Public de démonstration',
    announcement:
      'Séance fictive pour tester les inscriptions et les corrections.',
    ...extra,
    players: Array.from({ length: n }, (_, i) => ({
      card: card(participant++),
      companions: extra.cap === null && i === 0 ? 2 : 0,
      companionNames:
        extra.cap === null && i === 0 ? ['Dominique Démo', 'Sam Démo'] : [],
      age: i % 2 ? 32 : 10,
      ageUnit: 'ans',
      category: i % 2 ? 'Adulte' : 'Enfant',
    })),
  });
  const events = [
    event(
      'origami',
      day,
      'Origami (complet)',
      'Créazone',
      '10:30',
      '11:30',
      6,
      6,
    ),
    event(
      'cooperation',
      day,
      'Découverte coopérative',
      'Salle JV',
      '11:00',
      '12:00',
      8,
      5,
      { eventType: 'Découverte JV' },
    ),
    event('dessin', day, 'Atelier dessin', 'Créazone', '14:00', '15:30', 10, 7),
    event(
      'rencontre',
      day,
      'Rencontre autour du jeu',
      'Salle JV',
      '14:00',
      '15:00',
      null,
      3,
      { cap: null, eventType: 'Rencontre' },
    ),
    event(
      'libre',
      day,
      'Création libre',
      'Créazone',
      '16:00',
      '17:00',
      null,
      0,
      {
        mode: 'libre',
        eventType: 'Création libre',
        counts: [{ kids: 8, adults: 4 }],
      },
    ),
    event(
      'semaine',
      plus(7),
      'Atelier de la semaine prochaine',
      'Créazone',
      '14:00',
      '15:30',
      8,
      3,
    ),
    event(
      'anticipe',
      plus(16),
      'Découverte anticipée J+16',
      'Salle JV',
      '15:00',
      '16:00',
      6,
      2,
      { eventType: 'Découverte JV' },
    ),
  ];
  const templates = {
    'DÉMO · Atelier créatif (8 places)': {
      title: 'Atelier créatif',
      room: 'Créazone',
      time: '14:00',
      endTime: '15:30',
      mode: 'inscription',
      cap: 8,
      count: true,
      eventType: 'Atelier',
    },
    'DÉMO · Découverte JV (6 places)': {
      title: 'Découverte JV',
      room: 'Salle JV',
      time: '15:00',
      endTime: '16:00',
      mode: 'inscription',
      cap: 6,
      count: true,
      eventType: 'Découverte JV',
    },
    'DÉMO · Rencontre sans jauge': {
      title: 'Rencontre autour du jeu',
      room: 'Créazone',
      time: '10:30',
      endTime: '12:00',
      mode: 'inscription',
      cap: null,
      count: true,
      eventType: 'Rencontre',
    },
  };
  return {
    people,
    boards,
    videos,
    events,
    boxes,
    templates,
    types: ['Atelier', 'Découverte JV', 'Rencontre', 'Création libre'],
  };
}
if (typeof module !== 'undefined' && module.exports)
  module.exports = { sampleDayPlan };
