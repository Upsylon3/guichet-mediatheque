'use strict';
// Parcours du guichet et services communs aux activités.
const $ = (id) => document.getElementById(id),
  api = globalThis.guichetDirectory;
// Échapper les valeurs avant leur insertion dans les fragments HTML.
const esc = (x) =>
  String(x ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
const opts = (items, selected) =>
  items
    .map(
      (x) =>
        `<option ${x === selected ? 'selected' : ''} value="${esc(x)}">${esc(x)}</option>`,
    )
    .join('');
const field = (label, name, value = '', type = 'text', extra = '') =>
  `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
const select = (label, name, items, value) => {
  const labels =
    name === 'scope'
      ? {
          one: 'Cette séance',
          following: 'Celle-ci et les suivantes',
          all: 'Toute la série',
        }
      : name === 'mode'
        ? { inscription: 'Sur inscription', libre: 'Entrée libre' }
        : name === 'frequency'
          ? { week: 'Semaine(s)', month: 'Mois' }
          : {};
  return `<label>${label}<select name="${name}">${items.map((x) => `<option value="${esc(x)}" ${x === value ? 'selected' : ''}>${esc(labels[x] || x)}</option>`).join('')}</select></label>`;
};
// Ces contrôles adaptent l’interface ; le serveur reste responsable des habilitations.
const admin = () => api.profile === 'administrateur';
// État partagé confirmé et caches locaux de la session courante.
let state = {
    boards: [],
    videos: [],
    events: [],
    trash: [],
    totals: [],
    settings: { stations: {} },
  },
  people = {},
  poll,
  refreshPromise,
  personRequest = 0,
  initialized = false;
let month = new Date(),
  lastVideo = {},
  lastUndo,
  tableFilters = {},
  selectedEvent = null;
const selectedRows = {};
// Conserver les identités incomplètes et les brouillons jusqu’à leur enregistrement.
const drafts = new Map(),
  pending = new Set();
const day = () =>
  state.day ||
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' }).format(
    new Date(),
  );
const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const labelDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR');
const nameOf = (card) =>
  [people[card]?.prenom, people[card]?.nom].filter(Boolean).join(' ');
const cardLabel = (card) => [card, nameOf(card)].filter(Boolean).join(' · ');
const may = (right) =>
  admin() ||
  (!['bulk', 'export', 'stats'].includes(right) &&
    (right === 'events'
      ? state.settings.manageEvents
      : (state.settings.permissions?.[right] ??
        ['edit', 'cancel'].includes(right))));
const record = (id) =>
  [
    ...state.boards,
    ...state.videos,
    ...state.events,
    ...state.events.flatMap((e) => [...e.guests, ...e.counts]),
    ...state.trash,
  ].find((x) => x.id === id);
const rows = (items) => items.map((x) => ({ id: x.id, revision: x.revision }));
const notice = (text) => ($('notice').textContent = text);
const cardPattern = api.demo
  ? 'required pattern="ESSAI-[0-9]{1,4}" title="Utiliser une carte ESSAI" placeholder="ESSAI-01"'
  : 'required pattern="[0-9]{7}" title="Saisir les 7 chiffres imprimés sous le code-barres" placeholder="0000001"';
// Adapter la structure commune au mode autonome ou au guichet connecté.
document.querySelector('header .muted').textContent = api.demo
  ? 'Démonstration autonome · données fictives'
  : 'Développement partagé · données fictives uniquement';
$('role').closest('label').hidden = !api.demo;
for (const input of document.querySelectorAll('input[name=card]')) {
  input.pattern = api.demo ? 'ESSAI-[0-9]{1,4}' : '[0-9]{7}';
  input.placeholder = api.demo ? 'ESSAI-01' : '0000001';
  input.title = api.demo
    ? 'Carte fictive de la forme ESSAI-01'
    : 'Saisir les 7 chiffres imprimés sous le code-barres';
}
for (const label of document.querySelectorAll('label'))
  if (
    label.firstChild?.nodeType === Node.TEXT_NODE &&
    label.firstChild.textContent === 'Carte fictive'
  )
    label.firstChild.textContent = api.demo
      ? 'Carte fictive'
      : 'Carte (7 chiffres)';
$('lookup').placeholder = api.demo ? 'ESSAI-01' : '0000001';
$('board')
  .querySelector('.fields')
  .insertAdjacentHTML(
    'beforeend',
    field('Date', 'date', day(), 'date', 'required') +
      '<output name="boxTitle"></output>',
  );
$('board').insertAdjacentHTML(
  'afterend',
  '<div class="actions"><label>Filtrer les consultations<input id="filter-soc"></label><button id="bulkBoard">Corriger la sélection</button></div>',
);
$('videos').insertAdjacentHTML(
  'beforebegin',
  '<div class="actions" id="videoListTools"><label>Filtrer les inscriptions<input id="filter-vid"></label><button id="bulkVideo" disabled>Déplacer la sélection</button></div>',
);
$('ani')
  .querySelector('.bar')
  .insertAdjacentHTML(
    'afterend',
    '<button id="quickRegister" class="primary">Inscrire</button>',
  );
$('quickRegister').onclick = quickRegistration;
$('calendar').insertAdjacentHTML(
  'afterend',
  '<h3>Tableau des séances</h3><label>Filtrer les séances<input id="filter-ani"></label><div id="eventsTable"></div>',
);
$('openAdmin').insertAdjacentHTML(
  'afterend',
  '<button id="openTrash">Corbeille</button><button id="undo" disabled>Annuler la dernière opération</button>',
);
$('settings').insertAdjacentHTML(
  'beforeend',
  '<h3>Comptes attribués par le service</h3><button id="manageRoles">Gérer les habilitations</button><p>Les comptes sont créés par l’administration Auth du service, sans inscription publique.</p>',
);
$('deleteUser').insertAdjacentHTML(
  'beforebegin',
  '<button type="button" id="replaceCard" hidden>Changer le numéro de carte</button>',
);
$('deleteUser').insertAdjacentHTML(
  'afterend',
  '<button type="button" id="mergeUser" hidden>Remplacer / fusionner la carte</button><button type="button" id="undoMerge" hidden>Annuler la fusion du jour</button>',
);
$('pending').insertAdjacentHTML(
  'afterend',
  '<section id="trash" hidden><h2>Corbeille des 30 derniers jours et des réservations futures</h2><div id="trashList"></div></section>',
);
$('config').insertAdjacentHTML(
  'beforeend',
  `<h3>Disponibilité du poste</h3><label><span><input name="enabled" type="checkbox" checked> Poste ouvert</span></label>${field('Consigne affichée', 'instruction')}
<h3>Exception pour une date</h3><div class="fields">${field('Date de l’exception', 'exceptionDate', '', 'date')}<label><span><input type="checkbox" name="exceptionClosed"> Fermer le poste ce jour</span></label></div>
<label>Créneaux exceptionnels (un par ligne)<textarea name="exceptionSlots" rows="3"></textarea></label><label>Jeux exceptionnels (un par ligne)<textarea name="exceptionGames" rows="3"></textarea></label><p>Une date et des horaires vides conservent la grille habituelle. Les réservations incompatibles bloquent l’enregistrement.</p>
<h3>Journées fermées</h3><label>Dates AAAA-MM-JJ (une par ligne)<textarea name="closedDates" rows="3"></textarea></label>
<h3>Actions déléguées aux agents</h3>${['edit', 'cancel', 'bulk', 'export', 'templates'].map((k, i) => `<label><span><input type="checkbox" name="permission-${k}"> ${['Corriger et déplacer', 'Annuler des inscriptions', 'Importer et corriger en lot', 'Exporter une sélection nominative', 'Gérer les modèles d’animations'][i]}</span></label>`).join('')}
<h3>Raccourcis du service</h3>${field('Catalogue', 'catalogue', '', 'url')}${field('V-smart (facultatif)', 'vsmart', '', 'url')}
<h3>Boîtes de jeux de société</h3><div class="fields">${field('Numéro de boîte', 'boxCode')}${field('Titre', 'boxTitle')}${select('Secteur de la boîte', 'boxSector', ['Jeunesse', 'Pop Zone'], 'Jeunesse')}</div><p>Pour ajouter ou corriger une boîte, renseigner ces champs puis enregistrer les réglages.</p>`,
);
$('config')
  .elements.games.closest('label')
  .insertAdjacentHTML(
    'beforebegin',
    `<label>Grille concernée<select name="weekday"><option value="default">Grille habituelle</option>${['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'].map((d, i) => `<option value="${i}">${d}</option>`).join('')}</select></label>`,
  );
$('config').insertAdjacentHTML(
  'beforeend',
  '<h3>Types d’animation</h3><label>Types proposés (un par ligne)<textarea name="eventTypes" rows="3"></textarea></label><label><span><input name="askAge" type="checkbox" checked> Proposer le champ âge dans les animations</span></label>',
);
$('config').append($('config').querySelector('.actions'), $('configMsg'));

// Mutualiser les lectures en cours pour éviter des rafraîchissements concurrents.
async function refresh(force = false) {
  if (refreshPromise) {
    await refreshPromise;
    if (!force) return;
  }
  refreshPromise = (async () => {
    try {
      const [next, list, profile] = await Promise.all([
        api.state(),
        api.list(),
        api.currentProfile(),
      ]);
      const changed =
        api.profile !== profile ||
        JSON.stringify(state) !== JSON.stringify(next) ||
        JSON.stringify(Object.values(people)) !== JSON.stringify(list);
      api.profile = profile;
      state = next;
      people = Object.fromEntries(list.map((p) => [p.carte, p]));
      if (changed) render();
      for (const input of document.querySelectorAll('input[name=card]'))
        updateKnown(input);
      if ($('syncStatus'))
        $('syncStatus').textContent =
          'Données partagées synchronisées · ' +
          new Date().toLocaleTimeString('fr-FR');
    } catch (error) {
      if ($('syncStatus'))
        $('syncStatus').textContent = 'Non synchronisé : ' + error.message;
      throw error;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}
api.onReady = async () => {
  clearInterval(poll);
  await refresh(true);
  if (!initialized) {
    month = new Date(day().slice(0, 7) + '-01T12:00:00');
    $('board').elements.date.value = day();
    initialized = true;
  }
  $('board').elements.date.min = day();
  render();
  poll = setInterval(() => refresh().catch(() => {}), 2000);
};
function updateKnown(input) {
  const output =
    input.closest('.player')?.querySelector('output') ||
    input.form?.querySelector('[name=known]');
  if (output) output.value = nameOf(input.value.trim());
}
document.addEventListener('input', (e) => {
  if (e.target.name === 'card') {
    e.target.value = e.target.value.trim();
    e.target.setCustomValidity('');
    updateKnown(e.target);
  }
});
document.addEventListener(
  'invalid',
  (e) => {
    if (e.target.name === 'card')
      e.target.setCustomValidity(
        api.demo
          ? 'Carte fictive de la forme ESSAI-01'
          : 'Saisir les 7 chiffres imprimés sous le code-barres',
      );
  },
  true,
);
function modal(title, html) {
  $('heading').textContent = title;
  $('body').innerHTML = html;
  if (!$('modal').open) $('modal').showModal();
}
$('close').onclick = () => $('modal').close();
// Signaler les conflits de révision sans effacer la saisie de l’agent.
function conflict(error, form) {
  if (!['40001', 'PT409'].includes(error.code) || !error.details) return;
  let current;
  try {
    current = JSON.parse(error.details);
  } catch {
    return;
  }
  const existing = form.querySelector('.conflict');
  existing?.remove();
  const section = document.createElement('details');
  section.className = 'conflict';
  section.open = true;
  const summary = document.createElement('summary');
  summary.textContent = 'Comparer avec la version du serveur';
  const text = document.createElement('p');
  const labels = {
    date: 'Date',
    card: 'Carte',
    kids: 'Enfants',
    adults: 'Adultes',
    box: 'Boîte',
    sector: 'Secteur',
    slot: 'Début',
    end: 'Fin',
    post: 'Poste',
    game: 'Jeu',
    title: 'Titre',
    time: 'Heure',
    cap: 'Plafond',
    prenom: 'Prénom',
    nom: 'Nom',
    date_naissance: 'Naissance',
    note_interne: 'Note',
  };
  text.textContent = current.stations
    ? Object.entries(current.stations)
        .map(
          ([name, p]) =>
            `${name} : ${p.capacity} place(s), ${p.games.join(', ')}, ${p.slots.join(', ')}`,
        )
        .join(' | ')
    : Object.entries(labels)
        .filter(([k]) => current[k] !== undefined)
        .map(([k, label]) => label + ' : ' + (current[k] ?? ''))
        .join(' · ');
  const p = document.createElement('p');
  p.textContent =
    'Votre brouillon reste dans le formulaire. Fermer puis rouvrir la fiche charge la version du serveur.';
  section.append(summary, p, text);
  form.append(section);
}
// Centraliser la soumission, la reprise après erreur et l’annulation éventuelle.
async function submit(form, msg, action, data, onSuccess, undo) {
  if (form.dataset.saving) return;
  const controls = [
    ...form.querySelectorAll('input,select,textarea,button'),
  ].filter((x) => !x.disabled);
  form.dataset.saving = '1';
  controls.forEach((x) => (x.disabled = true));
  const operation = form.dataset.operation || crypto.randomUUID();
  form.dataset.operation = operation;
  let focus;
  try {
    const result =
      typeof action === 'function'
        ? await action()
        : await api.command(action, data, operation);
    await refresh(true);
    if (undo) {
      lastUndo = undo(result);
      $('undo').disabled = false;
    } else if (typeof action === 'string') {
      lastUndo = null;
      $('undo').disabled = true;
    }
    focus = await onSuccess?.(result);
    delete form.dataset.operation;
    return true;
  } catch (error) {
    $(msg).textContent =
      'Écriture non confirmée. Saisie conservée. ' + error.message;
    conflict(error, form);
  } finally {
    delete form.dataset.saving;
    controls.forEach((x) => (x.disabled = false));
    focus?.focus();
  }
}
async function command(
  action,
  data,
  message = 'Modification enregistrée.',
  undo,
) {
  return submit(
    document.createElement('form'),
    'notice',
    action,
    data,
    () => {
      notice(message);
    },
    undo,
  );
}
const inverseAdd = (kind, result) => ({
  action: kind + '.remove',
  data: { rows: rows(result.ids.map(record).filter(Boolean)) },
});
async function remove(kind, items) {
  if (
    !confirm(
      `Retirer ${items.length} saisie(s) ? Elles resteront dans la corbeille jusqu’à l’expiration des 30 jours suivant leur date d’activité.`,
    )
  )
    return;
  await command(
    kind + '.remove',
    { rows: rows(items) },
    'Saisie retirée.',
    (result) => ({
      action: kind + '.restore',
      data: { rows: rows(result.ids.map(record).filter(Boolean)) },
    }),
  );
}
$('undo').onclick = async () => {
  if (!lastUndo) return;
  const undo = lastUndo;
  if (await command(undo.action, undo.data, 'Dernière opération annulée.')) {
    lastUndo = null;
    $('undo').disabled = true;
  }
};
$('openTrash').onclick = () => {
  $('trash').hidden = !$('trash').hidden;
  renderTrash();
};
// Présenter les éléments supprimés dont la restauration reste contrôlée par le service.
function renderTrash() {
  $('trashList').replaceChildren();
  for (const item of state.trash) {
    const row = document.createElement('div');
    row.className = 'row';
    const text = document.createElement('span');
    text.textContent = [
      labelDate(item.date),
      {
        soc: 'Consultation',
        vid: 'Jeux vidéo',
        ani: 'Animation',
        guest: 'Participant',
        count: 'Comptage',
      }[item.kind],
      item.title || cardLabel(item.card),
    ].join(' · ');
    const b = document.createElement('button');
    b.textContent = 'Restaurer';
    b.onclick = () => {
      if (['guest', 'count'].includes(item.kind) && !confirmHorizon(item.date))
        return;
      return command(
        {
          soc: 'board',
          vid: 'video',
          ani: 'event',
          guest: 'guest',
          count: 'count',
        }[item.kind] + '.restore',
        { rows: rows([item]), confirmEarly: beyondHorizon(item.date) },
        'Saisie restaurée.',
      );
    };
    row.append(text, b);
    $('trashList').append(row);
  }
  if (!state.trash.length) $('trashList').textContent = 'Corbeille vide.';
}

// Annuaire et compléments : aucun rafraîchissement ne remplace un brouillon.
function userList() {
  const search = $('filterUsers').value.trim().toLocaleLowerCase('fr');
  $('userList').replaceChildren();
  for (const p of Object.values(people).sort((a, b) =>
    a.carte.localeCompare(b.carte),
  )) {
    const label = cardLabel(p.carte);
    if (!label.toLocaleLowerCase('fr').includes(search)) continue;
    const button = document.createElement('button');
    button.textContent = label;
    button.onclick = () => openPerson(p.carte);
    $('userList').append(button);
  }
}
$('openUsers').onclick = () => {
  $('users').hidden = !$('users').hidden;
  $('settings').hidden = true;
  userList();
};
$('filterUsers').oninput = userList;
$('createUser').onclick = () => openPerson();
// Charger la fiche détaillée à la demande, séparément du cache de recherche.
async function openPerson(card = '') {
  if ($('personForm').dataset.saving) return;
  const request = ++personRequest;
  let p = {};
  const loadingForm = $('personForm');
  for (const input of loadingForm.elements) input.disabled = true;
  try {
    if (card) p = await api.get(card);
  } catch (error) {
    notice(error.message);
    return;
  } finally {
    if (request === personRequest)
      for (const input of loadingForm.elements) input.disabled = false;
  }
  if (request !== personRequest) return;
  const form = $('personForm'),
    f = form.elements;
  form.reset();
  form.hidden = false;
  delete form.dataset.operation;
  f.card.value = card;
  f.card.readOnly = !!card;
  f.first.value = p.prenom || '';
  f.last.value = p.nom || '';
  f.birth.value = p.date_naissance || '';
  f.birth.max = day();
  f.note.value = p.note_interne || '';
  form.dataset.revision = p.revision || '';
  $('personTitle').textContent = card ? 'Fiche usager' : 'Nouvel usager';
  $('noteDetails').hidden = !card;
  $('noteDetails').open = false;
  $('replaceCard').hidden = !card;
  $('deleteUser').hidden = !card || !admin();
  $('personMsg').textContent = '';
  $('mergeUser').hidden = !card || !admin();
}
$('personForm').onsubmit = (e) => {
  e.preventDefault();
  const f = e.target.elements,
    card = f.card.value.trim();
  submit(
    e.target,
    'personMsg',
    () =>
      api.save(
        card,
        {
          prenom: f.first.value.trim() || null,
          nom: f.last.value.trim() || null,
          date_naissance: f.birth.value || null,
          note_interne: f.note.value.trim() || null,
        },
        !f.card.readOnly,
        +e.target.dataset.revision || undefined,
      ),
    null,
    () => {
      e.target.dataset.revision = people[card]?.revision || '';
      f.card.readOnly = true;
      $('noteDetails').hidden = false;
      $('replaceCard').hidden = false;
      $('deleteUser').hidden = !admin();
      pending.delete(card);
      drafts.delete(card);
      renderPending();
      notice('Fiche enregistrée.');
    },
  );
};
$('deleteUser').onclick = () => {
  if (
    !admin() ||
    !confirm(
      'Supprimer cette fiche usager ? Les activités encore liées bloqueront la suppression.',
    )
  )
    return;
  const card = $('personForm').elements.card.value;
  submit(
    $('personForm'),
    'personMsg',
    () => api.remove(card),
    null,
    () => {
      $('personForm').hidden = true;
      pending.delete(card);
      drafts.delete(card);
      notice('Fiche supprimée.');
    },
  );
};
function queue(cards) {
  for (const card of cards)
    if (
      people[card] &&
      !people[card].prenom &&
      !people[card].nom &&
      !people[card].date_naissance
    )
      pending.add(card);
  renderPending();
}
function renderPending() {
  const f = $('identity').elements,
    selected = f.reader.value;
  for (const card of pending)
    if (
      !people[card] ||
      (!drafts.has(card) &&
        (people[card].prenom ||
          people[card].nom ||
          people[card].date_naissance))
    )
      pending.delete(card);
  f.reader.replaceChildren(
    ...[...pending].map((card) => new Option(cardLabel(card), card)),
  );
  if (pending.has(selected)) f.reader.value = selected;
  $('pending').hidden =
    pending.size === 0 || !['soc', 'vid', 'ani', 'users'].includes(activeTab);
  if (f.reader.value !== selected) readDraft();
}
function readDraft() {
  const f = $('identity').elements,
    d = drafts.get(f.reader.value) || {};
  for (const k of ['first', 'last', 'birth']) f[k].value = d[k] || '';
  f.birth.max = day();
  $('identity').dataset.revision =
    d.revision || people[f.reader.value]?.revision || '';
}
$('identity').elements.reader.onchange = readDraft;
$('identity').oninput = () => {
  const f = $('identity').elements;
  drafts.set(f.reader.value, {
    first: f.first.value,
    last: f.last.value,
    birth: f.birth.value,
    revision:
      $('identity').dataset.revision || people[f.reader.value]?.revision,
  });
};
$('identity').onsubmit = (e) => {
  e.preventDefault();
  const f = e.target.elements,
    card = f.reader.value;
  submit(
    e.target,
    'notice',
    () =>
      api.save(
        card,
        {
          prenom: f.first.value.trim() || null,
          nom: f.last.value.trim() || null,
          date_naissance: f.birth.value || null,
        },
        false,
        +e.target.dataset.revision || undefined,
      ),
    null,
    () => {
      pending.delete(card);
      drafts.delete(card);
      renderPending();
      notice('Fiche enregistrée.');
    },
  );
};

function search() {
  const card = $('lookup').value.trim(),
    list = $('results');
  list.replaceChildren();
  if (!card) return;
  const lines = [
    cardLabel(card),
    ...state.boards
      .filter((x) => x.card === card)
      .map(
        (x) =>
          `${labelDate(x.date)} · ${x.sector} · boîte ${x.box} · ${x.kids + x.adults} personnes`,
      ),
    ...state.videos
      .filter((x) => x.card === card)
      .map(
        (x) =>
          `${labelDate(x.date)} · ${x.slot}–${x.end} · ${x.post} · ${x.game}`,
      ),
    ...state.events
      .filter((x) => x.guests.some((g) => g.card === card))
      .map(
        (x) =>
          `${labelDate(x.date)} · ${x.time} · ${x.title} · ${x.info || ''}`,
      ),
  ];
  for (const line of lines) {
    const p = document.createElement('p');
    p.textContent = line;
    list.append(p);
  }
  if (lines.length === 1) {
    const p = document.createElement('p');
    p.textContent =
      'Aucune activité dans les 30 derniers jours ni inscription à venir.';
    list.append(p);
  }
}
$('lookup').oninput = search;
for (const b of document.querySelectorAll('[data-tab]'))
  b.onclick = () => {
    for (const x of document.querySelectorAll('[data-tab]')) {
      $(x.dataset.tab).hidden = x !== b;
      x.setAttribute('aria-current', String(x === b));
    }
    notice('');
  };
try {
  $('sector').value = localStorage.getItem('guichet-secteur') || 'Jeunesse';
} catch {}
$('sector').onchange = () => {
  try {
    localStorage.setItem('guichet-secteur', $('sector').value);
  } catch {}
  renderBoards();
};
$('board').elements.box.oninput = () => {
  $('board').elements.boxTitle.value =
    state.settings.boxes?.[$('board').elements.box.value.trim()]?.title ||
    'Boîte à compléter';
};
$('board').onsubmit = (e) => {
  e.preventDefault();
  const f = e.target.elements,
    card = f.card.value.trim(),
    date = f.date.value;
  submit(
    e.target,
    'notice',
    'board.save',
    {
      card,
      date,
      sector: $('sector').value,
      box: f.box.value.trim(),
      kids: +f.kids.value,
      adults: +f.adults.value,
    },
    () => {
      queue([card]);
      e.target.reset();
      f.date.value = day();
      notice('Consultation enregistrée.');
      return f.card;
    },
    (result) => inverseAdd('board', result),
  );
};
function table(container, items, kind, description, edit) {
  const selectable = admin() && ['board', 'video'].includes(kind),
    search = (tableFilters[kind] || '').toLocaleLowerCase('fr');
  $(container).replaceChildren();
  const wrap = document.createElement('div');
  wrap.className = 'tableWrap';
  const table = document.createElement('table');
  table.innerHTML =
    '<thead><tr>' +
    (selectable ? '<th>Sélection</th>' : '') +
    '<th>Saisie</th><th>Actions</th></tr></thead>';
  const tbody = document.createElement('tbody');
  table.append(tbody);
  wrap.append(table);
  for (const item of items) {
    const label = description(item);
    if (!label.toLocaleLowerCase('fr').includes(search)) continue;
    const row = document.createElement('tr'),
      checkCell = document.createElement('td'),
      textCell = document.createElement('td'),
      actionCell = document.createElement('td');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = item.id;
    checkbox.dataset.kind = kind;
    checkbox.setAttribute('aria-label', 'Sélectionner ' + label);
    selectedRows[kind] ??= new Set();
    checkbox.checked = selectedRows[kind].has(item.id);
    checkbox.onchange = () => {
      if (checkbox.checked) selectedRows[kind].add(item.id);
      else selectedRows[kind].delete(item.id);
      updateBulkTools();
    };
    checkCell.append(checkbox);
    textCell.textContent = label;
    if (edit && may('edit')) {
      const b = document.createElement('button');
      b.textContent = 'Modifier / déplacer';
      b.onclick = () => edit(item);
      actionCell.append(b);
    }
    if (may('cancel') && (kind !== 'event' || may('events'))) {
      const b = document.createElement('button');
      b.textContent = 'Retirer';
      b.onclick = () => remove(kind, [item]);
      actionCell.append(b);
    }
    if (selectable) row.append(checkCell);
    row.append(textCell, actionCell);
    tbody.append(row);
  }
  if (tbody.children.length) $(container).append(wrap);
  else $(container).textContent = 'Aucune saisie.';
}
function renderBoards() {
  table(
    'boards',
    state.boards.filter((x) => x.sector === $('sector').value),
    'board',
    (x) =>
      `${labelDate(x.date)} · ${cardLabel(x.card)} · ${state.settings.boxes?.[x.box]?.title || 'Boîte ' + x.box} · ${x.kids} enf. + ${x.adults} ad. = ${x.kids + x.adults}`,
    editBoard,
  );
}
function editBoard(item) {
  modal(
    'Corriger la consultation',
    `<form id="editBoard"><div class="fields">${field('Carte', 'card', item.card, 'text', cardPattern)}${field('Boîte', 'box', item.box, 'text', 'required')}${field('Date', 'date', item.date, 'date', `required min="${day()}"`)}${select('Secteur', 'sector', ['Jeunesse', 'Pop Zone'], item.sector)}${field('Enfants', 'kids', item.kids, 'number', 'min="0" required')}${field('Adultes', 'adults', item.adults, 'number', 'min="0" required')}</div><p role="status" id="editMsg"></p><button>Enregistrer</button></form>`,
  );
  $('editBoard').onsubmit = (e) => {
    e.preventDefault();
    const f = e.target.elements,
      data = {
        ...item,
        card: f.card.value.trim(),
        box: f.box.value.trim(),
        date: f.date.value,
        sector: f.sector.value,
        kids: +f.kids.value,
        adults: +f.adults.value,
      };
    submit(
      e.target,
      'editMsg',
      'board.save',
      data,
      () => {
        $('modal').close();
        queue([data.card]);
        notice('Consultation corrigée.');
      },
      (result) => ({
        action: 'board.save',
        data: { ...item, revision: record(result.ids[0]).revision },
      }),
    );
  };
}

// Jeux vidéo : tous les joueurs sont confirmés dans une seule transaction.
// Priorité des réglages : grille habituelle, jour de semaine, exception datée.
function station(post, date) {
  const p = state.settings.stations[post];
  return p
    ? {
        ...p,
        ...p.weekdays?.[new Date(date + 'T12:00:00').getDay()],
        ...p.exceptions?.[date],
      }
    : null;
}
function playerRow(
  {
    card = '',
    age = '',
    ageUnit = 'ans',
    category = 'Enfant',
    companionNames = [],
  } = {},
  ageFields = false,
  unlimited = false,
) {
  return `<div class="player fields">${field('Carte', 'card', card, 'text', cardPattern)}<output name="known">${esc(nameOf(card))}</output>${ageFields ? select('Participant', 'category', ['Enfant', 'Adulte'], category) + field('Âge facultatif', 'age', age, 'number', 'min="0" step="0.1"') + select('Unité', 'ageUnit', ['ans', 'mois'], ageUnit) : ''}${unlimited ? `<label>Noms des accompagnateurs sans carte (un par ligne)<textarea name="companionNames" rows="2">${esc(companionNames.join('\n'))}</textarea></label>` : ''}<button type="button" class="removePlayer">Retirer cette personne</button></div>`;
}
function bindPlayers(form, ageFields = false, unlimited = false) {
  form.querySelector('.addPlayer').onclick = () => {
    form
      .querySelector('.players')
      .insertAdjacentHTML('beforeend', playerRow({}, ageFields, unlimited));
    bindRemovals(form);
  };
  bindRemovals(form);
}
function bindRemovals(form) {
  for (const b of form.querySelectorAll('.removePlayer'))
    b.onclick = () => {
      if (form.querySelectorAll('.player').length > 1)
        b.closest('.player').remove();
    };
}
function players(form) {
  return [...form.querySelectorAll('.player')].map((row) => {
    const names =
      row
        .querySelector('[name=companionNames]')
        ?.value.split('\n')
        .map((x) => x.trim())
        .filter(Boolean) || [];
    return {
      card: row.querySelector('[name=card]').value.trim(),
      companions: names.length,
      companionNames: names,
      ...(row.querySelector('[name=age]')
        ? {
            age: row.querySelector('[name=age]').value,
            ageUnit: row.querySelector('[name=ageUnit]').value,
            category: row.querySelector('[name=category]').value,
          }
        : {}),
    };
  });
}
const nowTime = () =>
  new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date());
const plusDays = (date, n) => {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return iso(d);
};
// Au-delà de J+15, les agents doivent confirmer l’inscription anticipée.
const beyondHorizon = (date) => !admin() && date > plusDays(day(), 15);
function confirmHorizon(date) {
  return (
    !beyondHorizon(date) ||
    confirm(
      'Attention : cette animation se déroule au-delà des 15 prochains jours. Confirmer cette inscription anticipée ?',
    )
  );
}
function defaultSlot(slots, date) {
  const time = nowTime();
  return date === day()
    ? (
        slots.find((x) => x.slice(0, 5) <= time && x.slice(-5) > time) ||
        slots.find((x) => x.slice(0, 5) >= time) ||
        slots[slots.length - 1]
      )?.slice(0, 5)
    : slots[0]?.slice(0, 5);
}
// Réutiliser le formulaire JV pour une inscription et pour un déplacement.
function videoForm(moving = []) {
  const initial = moving[0] || { ...lastVideo, date: day(), slot: '' },
    date = initial.date || day(),
    post = initial.post || Object.keys(state.settings.stations)[0];
  modal(
    moving.length ? 'Déplacer les joueurs' : 'Inscrire aux jeux vidéo',
    `<form id="vf"><div class="fields">${field('Jour', 'date', date, 'date', `required min="${day()}"`)}${select('Poste', 'post', Object.keys(state.settings.stations), post)}<label>Créneau<select name="slot"></select></label><label>Jeu<select name="game" required></select></label></div><p id="videoInstruction"></p><div class="players">${(moving.length ? moving : [{}]).map((p) => playerRow(p)).join('')}</div><button type="button" class="addPlayer">Ajouter un joueur</button><p id="vfmsg" role="status"></p><div id="alternatives"></div><button class="primary">${moving.length ? 'Déplacer' : 'Inscrire'}</button></form>`,
  );
  const form = $('vf'),
    f = form.elements;
  bindPlayers(form);
  if (moving.length) {
    for (const input of form.querySelectorAll('.players input'))
      input.readOnly = true;
    form.querySelector('.addPlayer').hidden = true;
    for (const b of form.querySelectorAll('.removePlayer')) b.hidden = true;
  }
  function availability(reset = false) {
    const cfg = station(f.post.value, f.date.value);
    const current = f.slot.value;
    if (reset) {
      f.slot.innerHTML = opts(
        (cfg?.slots || []).map((s) => s.slice(0, 5)),
        initial.slot || defaultSlot(cfg?.slots || [], f.date.value) || current,
      );
    }
    const bookings = state.videos.filter(
      (x) =>
        x.date === f.date.value &&
        x.post === f.post.value &&
        x.slot === f.slot.value &&
        !moving.some((m) => m.id === x.id),
    );
    const remaining =
      cfg?.enabled === false ||
      state.settings.closedDates?.includes(f.date.value)
        ? 0
        : (cfg?.capacity || 0) - bookings.length;
    const shared = bookings[0]?.game,
      game = f.game.value || initial.game || '';
    f.game.innerHTML =
      '<option value="">Choisir un jeu</option>' +
      opts(shared ? [shared] : cfg?.games || [], shared || game);
    $('vfmsg').textContent =
      remaining +
      ' place(s) disponible(s). ' +
      (shared ? 'Jeu en cours : ' + shared : '');
    $('videoInstruction').textContent = [
      (cfg?.slots || []).find((x) => x.startsWith(f.slot.value)) ||
        'Aucun créneau',
      cfg?.instruction || '',
    ]
      .filter(Boolean)
      .join(' · ');
    alternatives(form, moving);
    return remaining;
  }
  f.post.onchange = f.date.onchange = () => availability(true);
  f.slot.onchange = f.game.onchange = () => availability();
  form.addEventListener('input', () => alternatives(form, moving));
  availability(true);
  form.onsubmit = (e) => {
    e.preventDefault();
    const group = players(form),
      data = {
        date: f.date.value,
        post: f.post.value,
        slot: f.slot.value,
        game: f.game.value,
        ...(moving.length ? { rows: rows(moving) } : { players: group }),
      };
    submit(
      form,
      'vfmsg',
      moving.length ? 'video.move' : 'video.book',
      data,
      (result) => {
        queue(group.map((p) => p.card));
        lastVideo = {
          date: data.date,
          post: data.post,
          slot: data.slot,
          game: data.game,
        };
        if (moving.length) {
          $('modal').close();
          notice('Joueurs déplacés.');
          return;
        }
        form.querySelector('.players').innerHTML = playerRow();
        bindRemovals(form);
        availability();
        $('vfmsg').textContent =
          'Inscription enregistrée. ' + $('vfmsg').textContent;
        return form.querySelector('[name=card]');
      },
      (result) =>
        moving.length
          ? {
              action: 'video.move',
              data: {
                date: moving[0].date,
                post: moving[0].post,
                slot: moving[0].slot,
                game: moving[0].game,
                rows: rows(result.ids.map(record).filter(Boolean)),
              },
            }
          : inverseAdd('video', result),
    );
  };
}
function alternatives(form, moving = []) {
  const f = form.elements,
    group = players(form),
    need = group.length,
    target = $('alternatives');
  target.replaceChildren();
  if (!f.game.value) return;
  let count = 0;
  for (const [post] of Object.entries(state.settings.stations))
    for (const range of station(post, f.date.value)?.slots || []) {
      const cfg = station(post, f.date.value),
        slot = range.slice(0, 5),
        bookings = state.videos.filter(
          (x) =>
            x.date === f.date.value &&
            x.post === post &&
            x.slot === slot &&
            !moving.some((m) => m.id === x.id),
        );
      if (
        (post === f.post.value && slot === f.slot.value) ||
        slot < f.slot.value ||
        cfg.enabled === false ||
        !cfg.games.includes(f.game.value) ||
        bookings.some((x) => x.game !== f.game.value) ||
        bookings.length + need > cfg.capacity
      )
        continue;
      if (count++ >= 5) break;
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = `Autre possibilité : ${post} ${range}`;
      b.onclick = () => {
        f.post.value = post;
        f.post.onchange();
        f.slot.value = slot;
        f.slot.onchange();
      };
      target.append(b);
    }
}
$('addvideo').onclick = () => videoForm();
function editVideo(item) {
  const group = state.videos.filter((x) => x.group === item.group);
  modal(
    'Déplacer une inscription',
    `<p>${esc(cardLabel(item.card))} · ${esc(item.post)} · ${esc(item.slot)}</p><button id="moveOne">Cette personne</button><button id="moveGroup">Tout le groupe (${group.length})</button>`,
  );
  $('moveOne').onclick = () => videoForm([item]);
  $('moveGroup').onclick = () => videoForm(group);
}

// Calendrier mensuel et séances récurrentes.
function calendar() {
  $('month').textContent = month.toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });
  const grid = $('calendar');
  grid.innerHTML = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
    .map((d) => '<b>' + d + '</b>')
    .join('');
  for (let i = 0; i < (month.getDay() + 6) % 7; i++)
    grid.append(document.createElement('span'));
  for (
    let n = 1;
    n <= new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    n++
  ) {
    const date = iso(new Date(month.getFullYear(), month.getMonth(), n)),
      events = state.events.filter((e) => e.date === date),
      b = document.createElement('button');
    b.className =
      'day' + (date === day() ? ' today' : '') + (events.length ? ' busy' : '');
    b.dataset.date = date;
    if (beyondHorizon(date)) {
      b.classList.add('beyondHorizon');
      b.title = 'Au-delà de J+15 : confirmation nécessaire pour inscrire';
    }
    b.textContent = n;
    b.setAttribute('aria-label', labelDate(date));
    for (const ev of events) {
      const s = document.createElement('small');
      s.textContent = ev.title;
      b.append(s);
    }
    b.onclick = () => openDay(date);
    b.onkeydown = (e) => {
      const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[
        e.key
      ];
      if (step) {
        e.preventDefault();
        const d = new Date(date + 'T12:00:00');
        d.setDate(d.getDate() + step);
        month = new Date(d.getFullYear(), d.getMonth(), 1);
        calendar();
        document.querySelector(`[data-date="${iso(d)}"]`)?.focus();
      }
    };
    grid.append(b);
  }
}
$('prev').onclick = () => {
  month.setMonth(month.getMonth() - 1);
  calendar();
};
$('next').onclick = () => {
  month.setMonth(month.getMonth() + 1);
  calendar();
};
$('now').onclick = () => {
  month = new Date(day().slice(0, 7) + '-01T12:00:00');
  calendar();
};
function openDay(date) {
  modal(
    labelDate(date),
    '<div id="agenda"></div><button id="new">Ajouter une animation</button>',
  );
  for (const ev of state.events.filter((e) => e.date === date)) {
    const b = document.createElement('button');
    b.textContent = ev.time + ' · ' + ev.title;
    b.onclick = () => detailEvent(ev.id);
    $('agenda').append(b);
  }
  $('new').hidden = !may('events') || date < day();
  $('new').onclick = () => editEvent({ date });
}
function editEvent(ev = {}, duplicate = false) {
  const previous = state.events.filter(
    (x) => x.id === ev.id || (ev.group && x.group === ev.group && !x.exception),
  );
  const defaults = state.settings;
  modal(
    duplicate
      ? 'Dupliquer la séance'
      : ev.id
        ? 'Modifier la séance'
        : 'Nouvelle animation',
    `<form id="af"><div class="fields">
 ${field('Titre', 'title', ev.title || '', 'text', 'required')}${select('Type d’animation (facultatif)', 'eventType', ['', ...(defaults.eventTypes || [])], ev.eventType || '')}${field('Jour', 'date', ev.date || day(), 'date', `required min="${day()}"`)}${field('Heure de début', 'time', ev.time || nowTime(), 'time', 'required')}${field('Heure de fin', 'endTime', ev.endTime || addHour(nowTime()), 'time', 'required')}${select('Salle obligatoire', 'room', ['', 'Créazone', 'Salle JV'], ev.room || '')}${field('Renseignements', 'info', ev.info || '')}${field('Intervenant ou référent', 'referent', ev.referent || '')}${field('Public', 'audience', ev.audience || '')}${field('Âge minimum (ans)', 'minAge', ev.minAge ?? '', 'number', 'min="0" step="0.1"')}${field('Âge maximum (ans)', 'maxAge', ev.maxAge ?? '', 'number', 'min="0" step="0.1"')}${select('Mode', 'mode', ['inscription', 'libre'], ev.mode || 'inscription')}${field('Plafond strict facultatif', 'cap', ev.cap ?? defaults.limit ?? '', 'number', 'min="1"')}</div><label>Texte d’annonce<textarea name="announcement" rows="3">${esc(ev.announcement || '')}</textarea></label>${field('Lien vers un visuel facultatif', 'image', ev.image || '', 'url')}
 ${ev.id && !duplicate ? select('Portée de la modification', 'scope', ['one', 'following', 'all'], 'one') : field('Nombre de séances (1 à 52)', 'repeat', 1, 'number', 'required min="1" max="52"') + select('Récurrence', 'frequency', ['week', 'month'], 'week') + field('Tous les', 'repeatEvery', 1, 'number', 'required min="1" max="12"')}
 <p id="seriesPreview"></p><p id="afmsg" role="status"></p><button class="primary">Enregistrer</button></form>`,
  );
  const form = $('af'),
    f = form.elements;
  f.room.required = true;
  if (f.scope)
    f.scope.querySelector('[value=all]').textContent =
      'Cette séance et les séances à venir';
  f.eventType.options[0].textContent = 'Non renseigné';
  f.eventType
    .closest('label')
    .insertAdjacentHTML(
      'beforeend',
      '<small>Sert à classer les séances et à filtrer les statistiques.</small>',
    );
  if (!ev.id || duplicate) {
    form.insertAdjacentHTML(
      'afterbegin',
      '<div class="templatePicker">' +
        select('Partir d’un modèle', 'template', [''], '') +
        '<small>' +
        'Le modèle remplit les paramètres de la séance. Les modèles se gèrent dans Administration → Animations.' +
        '</small></div>',
    );
    updateTemplateChoices(form);
    f.template.onchange = () => {
      const model = state.settings.eventTemplates?.[f.template.value];
      if (model) {
        for (const [k, v] of Object.entries(model))
          if (f[k])
            f[k].value = k === 'count' ? (v ? 'oui' : 'non') : (v ?? '');
      }
    };
  }
  function preview() {
    const scope = f.scope?.value || 'one',
      affected = state.events.filter(
        (x) =>
          x.id === ev.id ||
          (ev.group &&
            x.group === ev.group &&
            !x.exception &&
            x.date >= day() &&
            (scope === 'all' || (scope === 'following' && x.date >= ev.date))),
      );
    $('seriesPreview').textContent =
      ev.id && !duplicate
        ? `${affected.length} séance(s) et ${affected.reduce((n, e) => n + e.guests.length, 0)} inscription(s) concernées. Les exceptions sont préservées.`
        : '';
  }
  if (f.scope) f.scope.onchange = preview;
  preview();
  form.onsubmit = (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    data.count = true;
    for (const k of ['cap', 'minAge', 'maxAge'])
      data[k] = data[k] === '' ? null : +data[k];
    if (ev.id && !duplicate) {
      data.id = ev.id;
      data.revision = ev.revision;
    } else data.repeat = +f.repeat.value;
    if (
      ev.id &&
      !duplicate &&
      !confirm($('seriesPreview').textContent + ' Enregistrer ?')
    )
      return;
    submit(
      form,
      'afmsg',
      'event.save',
      data,
      (result) => {
        month = new Date(data.date.slice(0, 7) + '-01T12:00:00');
        calendar();
        detailEvent(result.ids[0]);
        notice('Séance enregistrée.');
      },
      (result) =>
        ev.id && !duplicate
          ? {
              action: 'event.undo',
              data: {
                events: previous
                  .filter((x) => result.ids.includes(x.id))
                  .map((x) => ({
                    ...x,
                    revision: record(x.id).revision,
                    scope: 'one',
                    restoreException: !!x.exception,
                  })),
              },
            }
          : inverseAdd('event', result),
    );
  };
}
// Proposer les séances chronologiques sans passer par le calendrier.
function quickRegistration() {
  const events = state.events
    .filter((e) => e.mode === 'inscription' && e.date >= day())
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.time.localeCompare(b.time) ||
        a.title.localeCompare(b.title, 'fr'),
    );
  modal(
    'Inscription rapide à une animation',
    `<form id="quickGuest"><label>Animation (ordre chronologique)<select name="eventId" required><option value="">Choisir une séance</option>${events.map((e) => `<option value="${esc(e.id)}" ${e.cap && occupied(e) >= e.cap ? 'disabled' : ''}>${esc(labelDate(e.date) + ' · ' + e.time + ' · ' + e.title + ' · ' + e.room + ' · ' + (e.cap ? Math.max(0, e.cap - occupied(e)) + ' place(s) libre(s)' : 'sans jauge'))}</option>`).join('')}</select></label><p id="quickInfo">Les animations en entrée libre se comptent depuis leur séance. Les séances complètes sont indiquées dans la liste.</p><div class="players">${playerRow({}, true)}</div><button type="button" class="addPlayer">Ajouter une personne</button><p>La carte retrouve l’identité connue. Une fiche nouvelle pourra être complétée après l’inscription.</p><p id="quickMsg" role="status"></p><button class="primary">Inscrire</button></form>`,
  );
  const form = $('quickGuest'),
    choice = form.elements.eventId;
  bindPlayers(form, true);
  choice.onchange = () => {
    const ev = state.events.find((e) => e.id === choice.value),
      saved = players(form);
    form.querySelector('.players').innerHTML = saved
      .map((x) => playerRow(x, true, !!ev && !ev.cap))
      .join('');
    bindPlayers(form, true, !!ev && !ev.cap);
    $('quickInfo').textContent = ev
      ? (ev.cap
          ? 'Une carte par personne.'
          : 'Accompagnateurs sans carte autorisés : renseigner leurs noms.') +
        (beyondHorizon(ev.date)
          ? ' Au-delà de J+15 : une confirmation sera demandée.'
          : '')
      : '';
  };
  form.onsubmit = (e) => {
    e.preventDefault();
    const ev = state.events.find((x) => x.id === choice.value);
    if (!ev || ev.mode !== 'inscription' || ev.date < day()) {
      $('quickMsg').textContent =
        'Séance indisponible. Choisir une autre animation.';
      return;
    }
    if (!confirmHorizon(ev.date)) return;
    const group = players(form);
    submit(
      form,
      'quickMsg',
      'guest.book',
      { eventId: ev.id, players: group, confirmEarly: beyondHorizon(ev.date) },
      () => {
        queue(group.map((x) => x.card));
        $('modal').close();
        notice('Inscription à « ' + ev.title + ' » enregistrée.');
      },
      (result) => inverseAdd('guest', result),
    );
  };
  if (!events.length)
    $('quickMsg').textContent = 'Aucune séance sur inscription à venir.';
}
function occupied(ev) {
  return ev.mode === 'libre'
    ? ev.counts.reduce((n, c) => n + c.kids + c.adults, 0)
    : ev.guests.reduce((n, g) => n + 1 + (ev.count ? g.companions : 0), 0);
}
function detailEvent(id) {
  const ev = state.events.find((x) => x.id === id);
  if (!ev) {
    notice('Séance absente ou supprimée.');
    return;
  }
  selectedEvent = id;
  modal(
    ev.title,
    `<p>${esc(labelDate(ev.date) + ' · ' + ev.time + (ev.endTime ? '–' + ev.endTime : '') + ' · ' + (ev.room || '') + ' · ' + (ev.info || ''))}</p><p>${esc([ev.referent, ev.audience, ev.minAge != null ? 'À partir de ' + ev.minAge + ' ans' : '', ev.maxAge != null ? 'Jusqu’à ' + ev.maxAge + ' ans' : ''].filter(Boolean).join(' · '))}</p><p>${esc(ev.announcement || '')}</p>${safeLink(ev.image) ? `<p><a href="${esc(safeLink(ev.image))}" target="_blank" rel="noopener noreferrer">Voir le visuel ↗</a></p>` : ''}<p id="eventPlaces">${occupied(ev)}${ev.cap ? ' / ' + ev.cap : ''} personne(s)${!ev.cap ? ' · accompagnateurs nommés sans carte autorisés' : ' · une carte par personne'}</p><div id="guests"></div>
 ${ev.mode === 'libre' ? `<form id="freeCount"><div class="fields">${field('Enfants', 'kids', 0, 'number', 'min="0" required')}${field('Adultes', 'adults', 0, 'number', 'min="0" required')}</div><p id="guestmsg" role="status"></p><button>Ajouter le comptage</button></form>` : `<form id="guest"><div class="players">${playerRow({}, true, !ev.cap)}</div><button type="button" class="addPlayer">Ajouter une personne</button><p id="guestmsg" role="status"></p><button class="primary">Inscrire le groupe</button></form>`}
 <div class="actions"><button id="change">Modifier</button><button id="duplicate">Dupliquer</button><button id="remove">Supprimer la séance</button></div>`,
  );
  renderGuests(ev);
  for (const id of ['change', 'duplicate', 'remove'])
    $(id).hidden = !may('events');
  $('change').onclick = () => editEvent(ev);
  $('duplicate').onclick = () => editEvent(ev, true);
  $('remove').onclick = () => removeSeries(ev);
  if (ev.mode === 'libre') {
    $('freeCount').onsubmit = (e) => {
      e.preventDefault();
      const f = e.target.elements;
      if (!confirmHorizon(ev.date)) return;
      submit(
        e.target,
        'guestmsg',
        'count.add',
        {
          eventId: id,
          kids: +f.kids.value,
          adults: +f.adults.value,
          confirmEarly: beyondHorizon(ev.date),
        },
        () => {
          detailEvent(id);
          notice('Comptage enregistré.');
        },
        (result) => inverseAdd('count', result),
      );
    };
    return;
  }
  const form = $('guest');
  bindPlayers(form, true, !ev.cap);
  if (beyondHorizon(ev.date))
    $('guestmsg').textContent =
      'Au-delà de J+15 : une confirmation sera demandée.';
  if (
    state.settings.askAge === false &&
    ev.minAge == null &&
    ev.maxAge == null
  ) {
    for (const input of form.querySelectorAll('[name=age],[name=ageUnit]'))
      input.closest('label').hidden = true;
  }
  form.onsubmit = (e) => {
    e.preventDefault();
    const group = players(form);
    if (!confirmHorizon(ev.date)) return;
    submit(
      form,
      'guestmsg',
      'guest.book',
      { eventId: id, players: group, confirmEarly: beyondHorizon(ev.date) },
      () => {
        queue(group.map((p) => p.card));
        detailEvent(id);
        notice('Personne inscrite.');
      },
      (result) => inverseAdd('guest', result),
    );
  };
}
function renderGuests(ev) {
  table(
    'guests',
    ev.mode === 'libre' ? ev.counts : ev.guests,
    ev.mode === 'libre' ? 'count' : 'guest',
    (g) =>
      ev.mode === 'libre'
        ? `${g.kids} enfants + ${g.adults} adultes`
        : cardLabel(g.card) +
          (g.category ? ' · ' + g.category : '') +
          (g.age ? ` · ${g.age} ${g.ageUnit || 'ans'}` : '') +
          (g.companionNames?.length
            ? ' · Accompagnateurs : ' + g.companionNames.join(', ')
            : ''),
    ev.mode === 'libre' ? null : moveGuest,
  );
}
function moveGuest(item) {
  const group = state.events
    .flatMap((e) => e.guests)
    .filter((g) => g.group === item.group);
  modal(
    'Déplacer des participants',
    `<form id="moveGuest"><label>Séance de destination<select name="eventId">${state.events
      .filter((e) => e.mode !== 'libre')
      .map(
        (e) =>
          `<option value="${esc(e.id)}" ${e.id === item.eventId ? 'selected' : ''}>${esc(labelDate(e.date) + ' · ' + e.time + ' · ' + e.title)}</option>`,
      )
      .join(
        '',
      )}</select></label>${select('Participants', 'scope', ['Cette personne', 'Tout le groupe'], 'Cette personne')}<p id="moveMsg" role="status"></p><button>Déplacer</button></form>`,
  );
  $('moveGuest').onsubmit = (e) => {
    e.preventDefault();
    const f = e.target.elements,
      selected = f.scope.value === 'Tout le groupe' ? group : [item],
      target = state.events.find((e) => e.id === f.eventId.value);
    if (!confirmHorizon(target.date)) return;
    submit(
      e.target,
      'moveMsg',
      'guest.move',
      {
        eventId: f.eventId.value,
        rows: rows(selected),
        confirmEarly: beyondHorizon(target.date),
      },
      () => detailEvent(f.eventId.value),
    );
  };
}

// Administration partagée, avec contrôle de révision et protection des réservations.
function configList(post) {
  $('editPost').innerHTML =
    opts(Object.keys(state.settings.stations), post) +
    '<option value="">Ajouter un poste</option>';
  readConfig();
}
$('openAdmin').onclick = () => {
  if (!admin()) return;
  $('settings').hidden = !$('settings').hidden;
  $('users').hidden = true;
  configList(Object.keys(state.settings.stations)[0]);
};
$('editPost').onchange = readConfig;
function readConfig() {
  const form = $('config'),
    f = form.elements,
    key = $('editPost').value,
    p = state.settings.stations[key],
    cfg = state.settings;
  form.dataset.revision = state.settingsRevision;
  form.dataset.postKey = key;
  delete form.dataset.operation;
  delete form.dataset.dirty;
  f.postName.value = key;
  f.postName.readOnly = false;
  f.postName.maxLength = 50;
  f.capacity.value = p?.capacity || 1;
  f.weekday.value = 'default';
  f.weekday.disabled = !p;
  f.games.value = p?.games.join('\n') || '';
  f.slots.value = p?.slots.join('\n') || '';
  f.limit.value = cfg.limit ?? '';
  f.count.value = cfg.count || 'oui';
  f.manageEvents.checked = !!cfg.manageEvents;
  f.enabled.checked = p?.enabled !== false;
  f.instruction.value = p?.instruction || '';
  f.exceptionDate.value = '';
  f.exceptionClosed.checked = false;
  f.exceptionSlots.value = '';
  f.exceptionGames.value = '';
  f.closedDates.value = (cfg.closedDates || []).join('\n');
  for (const k of ['edit', 'cancel', 'bulk', 'export', 'templates'])
    f['permission-' + k].checked =
      cfg.permissions?.[k] ?? ['edit', 'cancel'].includes(k);
  for (const k of ['catalogue', 'vsmart']) f[k].value = cfg.links?.[k] || '';
  $('configMsg').textContent = '';
  f.eventTypes.value = (cfg.eventTypes || []).join('\n');
  f.askAge.checked = cfg.askAge !== false;
  f.boxCode.value = '';
  f.boxTitle.value = '';
  f.boxSector.value = 'Jeunesse';
  f.weekday.onchange = () => {
    const grid = { ...p, ...p?.weekdays?.[f.weekday.value] };
    f.capacity.value = grid.capacity;
    f.games.value = grid.games.join('\n');
    f.slots.value = grid.slots.join('\n');
    f.enabled.checked = grid.enabled !== false;
    f.instruction.value = grid.instruction || '';
  };
  f.exceptionDate.onchange = () => {
    const ex = p?.exceptions?.[f.exceptionDate.value] || {};
    f.exceptionClosed.checked = ex.enabled === false;
    f.exceptionSlots.value = ex.slots?.join('\n') || '';
    f.exceptionGames.value = ex.games?.join('\n') || '';
  };
  if ($('adminTabs')) {
    readBoxList();
    applyAdminPanel();
  }
}
const lines = (text) => [
  ...new Set(
    text
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean),
  ),
];
$('config').onsubmit = (e) => {
  e.preventDefault();
  if (!admin()) return;
  const form = e.target,
    f = form.elements,
    cfg = structuredClone(state.settings),
    source = form.dataset.postKey || '',
    key = f.postName.value.trim();
  let renamePost;
  if (adminSection === 'postes') {
    if (
      !key ||
      key.length > 50 ||
      ['__proto__', 'constructor', 'prototype'].includes(key)
    ) {
      $('configMsg').textContent =
        'Choisir un nom de poste de 1 à 50 caractères.';
      return;
    }
    if (
      Object.keys(cfg.stations).some(
        (k) =>
          k !== source &&
          k.toLocaleLowerCase('fr') === key.toLocaleLowerCase('fr'),
      )
    ) {
      $('configMsg').textContent =
        'Ce nom est déjà utilisé par un autre poste.';
      return;
    }
    let p = {
      ...cfg.stations[source],
      capacity: +f.capacity.value,
      games: lines(f.games.value),
      slots: lines(f.slots.value)
        .map((s) => s.replace(/\s*[-–]\s*/g, '–'))
        .sort(),
      enabled: f.enabled.checked,
      instruction: f.instruction.value.trim(),
    };
    if (f.weekday.value !== 'default') {
      const base = cfg.stations[source];
      p = {
        ...base,
        weekdays: {
          ...base.weekdays,
          [f.weekday.value]: {
            capacity: p.capacity,
            games: p.games,
            slots: p.slots,
            enabled: p.enabled,
            instruction: p.instruction,
          },
        },
      };
    }
    if (f.exceptionDate.value) {
      p.exceptions = { ...p.exceptions };
      p.exceptions[f.exceptionDate.value] = {
        enabled: !f.exceptionClosed.checked,
        ...(f.exceptionSlots.value.trim()
          ? {
              slots: lines(f.exceptionSlots.value)
                .map((s) => s.replace(/\s*[-–]\s*/g, '–'))
                .sort(),
            }
          : {}),
        ...(f.exceptionGames.value.trim()
          ? { games: lines(f.exceptionGames.value) }
          : {}),
      };
    }
    if (source && source !== key) {
      renamePost = { source, target: key };
      delete cfg.stations[source];
    }
    cfg.stations[key] = p;
    cfg.closedDates = lines(f.closedDates.value);
  } else if (adminSection === 'animations') {
    cfg.limit = f.limit.value === '' ? null : +f.limit.value;
    cfg.eventTypes = lines(f.eventTypes.value);
    cfg.askAge = f.askAge.checked;
  } else if (adminSection === 'acces') {
    cfg.manageEvents = f.manageEvents.checked;
    cfg.permissions = {
      ...cfg.permissions,
      edit: f['permission-edit'].checked,
      cancel: f['permission-cancel'].checked,
      bulk: false,
      export: false,
      templates: f['permission-templates'].checked,
    };
  } else if (adminSection === 'liens') {
    cfg.links = Object.fromEntries(
      ['catalogue', 'vsmart'].map((k) => [k, f[k].value.trim()]),
    );
  } else if (adminSection === 'societe') {
    const code = f.boxCode.value.trim();
    if (!code || !f.boxTitle.value.trim()) {
      $('configMsg').textContent =
        'Renseigner le numéro et le titre de la boîte.';
      return;
    }
    if (['__proto__', 'constructor', 'prototype'].includes(code)) {
      $('configMsg').textContent = 'Choisir un autre numéro de boîte.';
      return;
    }
    cfg.boxes = {
      ...cfg.boxes,
      [code]: { title: f.boxTitle.value.trim(), sector: f.boxSector.value },
    };
  }
  const closing =
    adminSection === 'postes'
      ? state.videos.filter((a) => {
          if (a.date < day()) return false;
          const post = renamePost && a.post === source ? key : a.post,
            base = cfg.stations[post],
            next = {
              ...base,
              ...base?.weekdays?.[new Date(a.date + 'T12:00:00').getDay()],
              ...base?.exceptions?.[a.date],
            };
          return next.enabled === false || cfg.closedDates.includes(a.date);
        })
      : [];
  if (
    closing.length &&
    !confirm(
      'Êtes-vous sûr de fermer ? ' +
        closing.length +
        ' réservation(s) seront retirées et placées dans la corbeille.',
    )
  )
    return;
  const section = adminSection,
    box = f.boxCode.value.trim();
  submit(
    form,
    'configMsg',
    'config.save',
    {
      settings: cfg,
      revision: +form.dataset.revision,
      forceClose: closing.length > 0,
      ...(renamePost ? { renamePost } : {}),
    },
    () => {
      configList(adminSection === 'postes' ? key : source);
      if (section === 'societe') {
        readBoxList(box);
        loadBox(box);
      }
      notice('Réglages partagés enregistrés.');
      $('configMsg').textContent = renamePost
        ? 'Poste renommé. Ses réservations actives et en corbeille suivent le nouveau nom.'
        : 'Réglages « ' +
          adminLabels[section] +
          ' » enregistrés pour tous les postes.';
    },
  );
};

$('manageRoles').onclick = async () => {
  try {
    const accounts = await api.accounts();
    modal(
      'Habilitations du guichet',
      `<form id="roles"><label>Compte attribué<select name="account">${accounts.map((a) => `<option value="${esc(a.id)}">${esc(a.email)} · ${esc(a.profil || 'sans accès')}</option>`).join('')}</select></label>${select('Profil', 'profile', ['agent', 'administrateur', 'sans accès'], 'agent')}<p>Une révocation prend effet côté serveur sans attendre le renouvellement du jeton. Le dernier administrateur est protégé.</p><p id="roleMsg" role="status"></p><button>Appliquer</button></form>`,
    );
    $('roles').onsubmit = (e) => {
      e.preventDefault();
      const f = e.target.elements;
      if (!confirm('Appliquer cette habilitation au compte sélectionné ?'))
        return;
      submit(
        e.target,
        'roleMsg',
        () =>
          api.setRole(
            f.account.value,
            f.profile.value === 'sans accès' ? null : f.profile.value,
          ),
        null,
        () => {
          $('modal').close();
          notice('Habilitation appliquée.');
        },
      );
    };
  } catch (error) {
    notice(error.message);
  }
};
$('mergeUser').onclick = () => {
  const source = $('personForm').elements.card.value;
  modal(
    'Remplacement de carte — aperçu',
    `<form id="merge"><p>Fiche source : ${esc(cardLabel(source))}. L’identité de la fiche cible est conservée. Aucun rapprochement automatique sur le nom.</p><label>Carte cible<select name="target">${Object.values(
      people,
    )
      .filter((p) => p.carte !== source)
      .map(
        (p) =>
          `<option value="${esc(p.carte)}">${esc(cardLabel(p.carte))}</option>`,
      )
      .join(
        '',
      )}</select></label><div id="mergePreview"></div><p>L’ancienne carte sera désactivée. L’annulation est possible aujourd’hui tant que les fiches et les activités transférées n’ont pas été modifiées.</p><p id="mergeMsg" role="status"></p><button>Confirmer la fusion</button></form>`,
  );
  const form = $('merge'),
    f = form.elements;
  function preview() {
    const sourceRows = [
      ...state.boards,
      ...state.videos,
      ...state.events.flatMap((e) => e.guests),
    ].filter((x) => x.card === source);
    const targetRows = [
      ...state.boards,
      ...state.videos,
      ...state.events.flatMap((e) => e.guests),
    ].filter((x) => x.card === f.target.value);
    $('mergePreview').textContent =
      `${sourceRows.length} activité(s) source à transférer ; ${targetRows.length} activité(s) déjà liées à la cible. ` +
      sourceRows
        .map(
          (x) => labelDate(x.date) + ' · ' + (x.post || x.box || 'Animation'),
        )
        .join(' / ');
  }
  f.target.onchange = preview;
  preview();
  form.onsubmit = (e) => {
    e.preventDefault();
    if (
      !f.target.value ||
      !confirm($('mergePreview').textContent + ' Fusionner ces deux fiches ?')
    )
      return;
    const operation = form.dataset.operation || crypto.randomUUID();
    form.dataset.operation = operation;
    submit(
      form,
      'mergeMsg',
      () => api.merge(source, f.target.value, operation),
      null,
      async () => {
        $('modal').close();
        await openPerson(f.target.value);
        $('undoMerge').hidden = false;
        $('undoMerge').dataset.operation = operation;
        $('undoMerge').dataset.source = source;
        $('undoMerge').dataset.target = f.target.value;
        notice('Fusion effectuée.');
      },
    );
  };
};
$('undoMerge').onclick = async () => {
  const b = $('undoMerge'),
    source = b.dataset.source;
  if (
    await submit(
      $('personForm'),
      'personMsg',
      () => api.merge(source, b.dataset.target, b.dataset.operation, true),
      null,
      () => {
        b.hidden = true;
        notice('Fusion annulée.');
      },
    )
  )
    await openPerson(source);
};

// Sélections et corrections groupées.
function selected(kind, list) {
  const ids = [
    ...document.querySelectorAll(`input[data-kind="${kind}"]:checked`),
  ].map((x) => x.value);
  return list.filter((x) => ids.includes(x.id));
}
for (const [suffix, kind] of [
  ['soc', 'board'],
  ['vid', 'video'],
])
  $('filter-' + suffix).oninput = (e) => {
    tableFilters[kind] = e.target.value;
    render();
  };
function safeLink(url) {
  try {
    const parsed = new URL(url);
    return ['https:', 'http:'].includes(parsed.protocol) ? url : null;
  } catch {
    return null;
  }
}
function renderLinks() {
  const header = document.querySelector('header');
  let links = $('serviceLinks');
  if (!links) {
    links = document.createElement('div');
    links.id = 'serviceLinks';
    header.append(links);
  }
  links.replaceChildren();
  for (const [key, label] of [['vsmart', 'V-smart ↗']]) {
    const url = safeLink(state.settings.links?.[key]);
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = label;
      links.append(a);
    }
  }
  const catalogue = safeLink(state.settings.links?.catalogue);
  if (catalogue) header.querySelector('a').href = catalogue;
}
function render() {
  userList();
  renderBoards();
  renderVideoPlanning();
  table(
    'videos',
    state.videos,
    'video',
    (x) =>
      `${labelDate(x.date)} · ${x.slot}–${x.end} · ${x.post} · ${cardLabel(x.card)} · ${x.game} · 1 joueur`,
    editVideo,
  );
  updateBulkTools();
  calendar();
  renderTrash();
  renderPending();
  search();
  renderLinks();
  $('openAdmin').hidden = !may('templates');
  $('openStats').hidden = !admin();
  if (
    !admin() &&
    (activeTab === 'stats' || (activeTab === 'settings' && !may('templates')))
  )
    activateTab('vid');
  applyAdminPanel();
  renderTemplates();
  if (!admin()) {
    $('statsTable').replaceChildren();
    $('statsSummary').textContent = '';
    statsRows = [];
  }
  table(
    'eventsTable',
    state.events,
    'event',
    (e) =>
      `${labelDate(e.date)} · ${e.time} · ${e.title}${e.eventType ? ' · ' + e.eventType : ''} · ${e.room || ''} · ${e.info || ''} · ${occupied(e)} place(s)`,
    may('events') ? editEvent : null,
  );
  $('bulkBoard').hidden = !may('bulk');
  $('bulkVideo').hidden = !admin();
  $('mergeUser').hidden = !admin() || !$('personForm').elements.card.readOnly;
  $('totals').textContent =
    (state.totals || [])
      .map(
        (t) =>
          `${labelDate(t.jour)} · ${t.activite} ${t.secteur} : ${t.passages} passage(s), ${t.personnes} personnes`,
      )
      .join(' | ') || 'Aucun jour clôturé.';
  if ($('modal').open && $('af')?.elements.template)
    updateTemplateChoices($('af'), $('af').elements.template.value);
  if ($('modal').open && $('guests') && selectedEvent) {
    const ev = state.events.find((x) => x.id === selectedEvent);
    if (ev) {
      renderGuests(ev);
      $('eventPlaces').textContent =
        `${occupied(ev)}${ev.cap ? ' / ' + ev.cap : ''} place(s)`;
    }
  }
}
$('filter-ani').oninput = (e) => {
  tableFilters.event = e.target.value;
  render();
};

$('bulkVideo').onclick = () => {
  const items = selected('video', state.videos);
  if (!items.length) {
    notice('Sélectionner des inscriptions.');
    return;
  }
  videoForm(items);
};
$('bulkBoard').onclick = () => {
  const items = selected('board', state.boards);
  if (!items.length) {
    notice('Sélectionner des consultations.');
    return;
  }
  modal(
    'Corriger la sélection',
    `<form id="bulk"><p>${items.length} consultation(s). Les champs vides conservent la valeur actuelle.</p><div class="fields">${field('Nouvelle date', 'date', '', 'date', `min="${day()}"`)}${select('Nouveau secteur', 'sector', ['', 'Jeunesse', 'Pop Zone'], '')}${field('Enfants', 'kids', '', 'number', 'min="0"')}${field('Adultes', 'adults', '', 'number', 'min="0"')}</div><p id="bulkMsg" role="status"></p><button>Confirmer tout le lot</button></form>`,
  );
  $('bulk').onsubmit = (e) => {
    e.preventDefault();
    const f = e.target.elements;
    const commands = items.map((x) => ({
      action: 'board.save',
      data: {
        ...x,
        ...Object.fromEntries(
          ['date', 'sector', 'kids', 'adults']
            .filter((k) => f[k].value !== '')
            .map((k) => [
              k,
              ['kids', 'adults'].includes(k) ? +f[k].value : f[k].value,
            ]),
        ),
      },
    }));
    if (
      !confirm(
        'Confirmer la correction de ' + items.length + ' consultation(s) ?',
      )
    )
      return;
    submit(
      e.target,
      'bulkMsg',
      'batch',
      { commands },
      () => {
        $('modal').close();
        notice('Sélection corrigée en entier.');
      },
      () => ({
        action: 'batch',
        data: {
          commands: items.map((x) => ({
            action: 'board.save',
            data: { ...x, revision: record(x.id)?.revision || x.revision + 1 },
          })),
        },
      }),
    );
  };
};
function removeSeries(ev) {
  modal(
    'Supprimer une séance ou une série',
    `<form id="removeSeries">${select('Portée', 'scope', ['one', 'following', 'all'], 'one')}<p id="removePreview"></p><p id="removeMsg" role="status"></p><button>Mettre à la corbeille</button></form>`,
  );
  const form = $('removeSeries');
  let affected = [];
  function preview() {
    const scope = form.elements.scope.value;
    affected = state.events.filter(
      (x) =>
        x.id === ev.id ||
        (ev.group &&
          x.group === ev.group &&
          (scope === 'all' || (scope === 'following' && x.date >= ev.date))),
    );
    $('removePreview').textContent =
      affected.length +
      ' séance(s) et ' +
      affected.reduce((n, e) => n + e.guests.length, 0) +
      ' inscription(s) concernées.';
  }
  form.elements.scope.onchange = preview;
  preview();
  form.onsubmit = (e) => {
    e.preventDefault();
    if (!confirm($('removePreview').textContent + ' Continuer ?')) return;
    submit(
      form,
      'removeMsg',
      'event.remove',
      { rows: rows(affected) },
      (result) => {
        $('modal').close();
        notice('Séances placées dans la corbeille.');
      },
      (result) => ({
        action: 'event.restore',
        data: { rows: rows(result.ids.map(record)) },
      }),
    );
  };
}
function addHour(time) {
  const n = Math.min(1439, +time.slice(0, 2) * 60 + +time.slice(3) + 60);
  return (
    String(Math.floor(n / 60)).padStart(2, '0') +
    ':' +
    String(n % 60).padStart(2, '0')
  );
}
let activeTab = 'vid',
  statsRows = [];
function activateTab(tab) {
  if (
    (tab === 'stats' && !admin()) ||
    (tab === 'settings' && !may('templates'))
  )
    tab = 'vid';
  if (activeTab === 'settings' && tab !== 'settings' && !discardAdminDraft())
    return;
  activeTab = tab;
  for (const id of ['soc', 'vid', 'ani', 'users', 'settings', 'stats', 'trash'])
    $(id).hidden = id !== tab;
  for (const b of document.querySelectorAll('[data-tab]'))
    b.setAttribute('aria-current', String(b.dataset.tab === tab));
  $('pending').hidden =
    pending.size === 0 || !['soc', 'vid', 'ani', 'users'].includes(tab);
  if (tab === 'settings' && !admin()) adminSection = 'animations';
  if (tab === 'users') userList();
  if (tab === 'settings')
    configList($('editPost').value || Object.keys(state.settings.stations)[0]);
  if (tab === 'trash') renderTrash();
  if (tab === 'stats') loadStats();
  notice('');
}
// Organiser la navigation et relier les commandes aux vues métier.
function setupWorkspace() {
  const main = document.querySelector('main'),
    nav = document.querySelector('nav');
  const aside = document.createElement('aside');
  aside.id = 'sidebar';
  aside.setAttribute('aria-label', 'Menu du guichet');
  aside.innerHTML = '<div class="brand">Guichet<br>médiathèque</div>';
  main.prepend(aside);
  aside.append(nav);
  const buttons = [...nav.querySelectorAll('button')];
  nav.replaceChildren(buttons[1], buttons[0], buttons[2]);
  for (const [id, tab, label] of [
    ['openUsers', 'users', 'Usagers'],
    ['openAdmin', 'settings', 'Administration'],
    ['openTrash', 'trash', 'Corbeille'],
  ]) {
    const b = $(id);
    b.dataset.tab = tab;
    b.textContent = label;
    nav.append(b);
  }
  const stats = document.createElement('section');
  stats.id = 'stats';
  stats.hidden = true;
  stats.innerHTML =
    '<h2>Statistiques</h2><p>Effectifs déclarés et inscriptions. Les réservations ne constituent pas une présence vérifiée.</p><form id="statsFilter"><div class="fields">' +
    field('Du', 'from', plusDays(day(), -30), 'date', 'required') +
    field('Au', 'to', day(), 'date', 'required') +
    select('Regroupement', 'period', ['jour', 'semaine', 'mois'], 'jour') +
    '</div><div class="fields">' +
    [
      'activite',
      'secteur',
      'poste',
      'jeu',
      'boite',
      'salle',
      'type',
      'categorie',
    ]
      .map((k, i) =>
        select(
          [
            'Activité',
            'Secteur',
            'Poste JV',
            'Jeu vidéo',
            'Boîte',
            'Salle',
            'Type d’animation',
            'Catégorie',
          ][i],
          k,
          [''],
          '',
        ),
      )
      .join('') +
    '</div><button>Actualiser</button><button type="button" id="exportStats">Extraire les statistiques (CSV)</button></form><p id="statsMsg" role="status"></p><div id="statsSummary"></div><div id="statsTable" class="tableWrap"></div>';
  main.append(stats);
  const sb = document.createElement('button');
  sb.id = 'openStats';
  sb.dataset.tab = 'stats';
  sb.textContent = 'Statistiques';
  nav.insertBefore(sb, $('openAdmin'));
  const tools = document.createElement('div');
  tools.className = 'sidebarTools';
  tools.append($('undo'));
  const theme = document.createElement('button');
  theme.id = 'theme';
  theme.type = 'button';
  theme.textContent = 'Mode sombre';
  tools.append(theme);
  aside.append(tools);
  $('undo').title =
    'Annuler la dernière opération (Ctrl+Z, hors champ de saisie)';
  const setTheme = (value) => {
    document.documentElement.dataset.theme = value;
    theme.textContent = value === 'dark' ? 'Mode clair' : 'Mode sombre';
    theme.setAttribute('aria-pressed', String(value === 'dark'));
  };
  try {
    setTheme(
      localStorage.getItem('guichet-theme') ||
        (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
    );
  } catch {
    setTheme('light');
  }
  theme.onclick = () => {
    const value =
      document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    setTheme(value);
    try {
      localStorage.setItem('guichet-theme', value);
    } catch {}
  };
  document.addEventListener('keydown', (e) => {
    if (
      (e.ctrlKey || e.metaKey) &&
      !e.shiftKey &&
      e.key.toLowerCase() === 'z' &&
      !e.target.closest('input,textarea,select,[contenteditable="true"]')
    ) {
      e.preventDefault();
      if (!$('undo').disabled) $('undo').click();
    }
  });
  for (const b of nav.querySelectorAll('[data-tab]'))
    b.onclick = () => activateTab(b.dataset.tab);
  const bar = document.createElement('div');
  bar.className = 'bar';
  bar.innerHTML =
    '<h3>Aujourd’hui</h3><button id="videoToday">Aujourd’hui</button><button id="videoAll">Toutes les réservations</button>';
  $('videos').before(bar);
  const planning = document.createElement('div');
  planning.id = 'videoPlanning';
  planning.className = 'tableWrap';
  bar.after(planning);
  $('videoToday').onclick = () => {
    tableFilters.videoToday = true;
    renderVideoPlanning();
  };
  $('videoAll').onclick = () => {
    tableFilters.videoToday = false;
    renderVideoPlanning();
  };
  tableFilters.videoToday = true;
  const total = $('totals');
  total.previousElementSibling.remove();
  total.hidden = true;
  for (const k of ['bulk', 'export'])
    $('config').elements['permission-' + k].closest('label').hidden = true;
  $('config').elements.count.closest('label').hidden = true;
  setupAdministration();
  $('exportStats').onclick = exportStats;
  $('statsFilter').onsubmit = (e) => {
    e.preventDefault();
    loadStats();
  };
  for (const select of $('statsFilter').querySelectorAll('select'))
    select.onchange = renderStats;
  $('replaceCard').onclick = () => {
    const f = $('personForm').elements,
      source = f.card.value,
      revision = +$('personForm').dataset.revision;
    modal(
      'Remplacement d’une carte perdue',
      `<form id="replacement"><p>${esc(cardLabel(source))}. Vérifier l’identité avant de changer le numéro. Les inscriptions et la limite hebdomadaire suivent la même fiche.</p>${field('Nouveau numéro de carte', 'target', '', 'text', cardPattern)}<p id="replaceMsg" role="status"></p><button>Remplacer la carte</button></form>`,
    );
    $('replacement').onsubmit = (e) => {
      e.preventDefault();
      const target = e.target.elements.target.value.trim();
      if (
        !confirm(
          'Remplacer ' +
            source +
            ' par ' +
            target +
            ' pour ' +
            nameOf(source) +
            ' ?',
        )
      )
        return;
      submit(
        e.target,
        'replaceMsg',
        'user.replace',
        { source, target, revision },
        async () => {
          $('modal').close();
          await openPerson(target);
          notice('Numéro de carte remplacé.');
        },
      );
    };
  };
  activateTab('vid');
}
// Construire le planning du jour à partir des postes et réservations confirmées.
function renderVideoPlanning() {
  const today = tableFilters.videoToday !== false;
  $('videos').hidden = today;
  $('videoPlanning').hidden = !today;
  $('videoListTools').hidden = today;
  $('videoToday').setAttribute('aria-pressed', String(today));
  $('videoAll').setAttribute('aria-pressed', String(!today));
  const container = $('videoPlanning');
  container.replaceChildren();
  if (!today) return;
  const posts = Object.keys(state.settings.stations),
    ranges = [
      ...new Set(posts.flatMap((p) => station(p, day())?.slots || [])),
    ].sort();
  const t = document.createElement('table');
  t.className = 'planningGrid';
  const caption = document.createElement('caption');
  caption.textContent = 'Planning JV du ' + labelDate(day());
  t.append(caption);
  const head = document.createElement('thead'),
    hr = document.createElement('tr');
  for (const label of ['Horaire', ...posts]) {
    const th = document.createElement('th');
    th.textContent = label;
    hr.append(th);
  }
  head.append(hr);
  t.append(head);
  const body = document.createElement('tbody');
  t.append(body);
  for (const range of ranges) {
    const tr = document.createElement('tr');
    if (range.slice(0, 5) <= nowTime() && range.slice(-5) > nowTime())
      tr.className = 'currentSlot';
    const time = document.createElement('th');
    time.scope = 'row';
    time.textContent = range;
    tr.append(time);
    for (const post of posts) {
      const td = document.createElement('td'),
        cfg = station(post, day());
      if (!cfg.slots.includes(range)) {
        td.textContent = 'Hors grille';
        td.className = 'unavailable';
        tr.append(td);
        continue;
      }
      const list = state.videos.filter(
          (x) =>
            x.date === day() && x.post === post && x.slot === range.slice(0, 5),
        ),
        closed =
          cfg.enabled === false || state.settings.closedDates?.includes(day());
      const title = document.createElement('strong');
      title.textContent =
        list[0]?.game || (closed ? 'Poste fermé' : 'Jeu à choisir');
      td.append(title);
      for (const x of list) {
        const line = document.createElement('div');
        line.className = 'planningBooking';
        const name = document.createElement(may('edit') ? 'button' : 'span');
        name.textContent = cardLabel(x.card);
        if (may('edit')) {
          name.title = 'Déplacer cette inscription';
          name.onclick = () => editVideo(x);
        }
        line.append(name);
        if (may('cancel')) {
          const cancel = document.createElement('button');
          cancel.textContent = 'Retirer';
          cancel.className = 'cancelBooking';
          cancel.setAttribute(
            'aria-label',
            'Retirer ' + cardLabel(x.card) + ' · ' + post + ' · ' + range,
          );
          cancel.onclick = () => remove('video', [x]);
          line.append(cancel);
        }
        td.append(line);
      }
      const space = document.createElement('small');
      space.textContent = closed
        ? 'Fermé'
        : Math.max(0, cfg.capacity - list.length) + ' place(s) libre(s)';
      td.append(space);
      tr.append(td);
    }
    body.append(tr);
  }
  container.append(t);
}
async function loadStats() {
  if (!admin()) return;
  const f = $('statsFilter').elements;
  try {
    statsRows = await api.stats(f.from.value, f.to.value);
    for (const key of [
      'activite',
      'secteur',
      'poste',
      'jeu',
      'boite',
      'salle',
      'type',
      'categorie',
    ]) {
      const before = f[key].value;
      f[key].innerHTML = opts(
        [
          '',
          ...new Set(statsRows.map((x) => x.dimensions[key]).filter(Boolean)),
        ],
        before,
      );
    }
    renderStats();
    $('statsMsg').textContent = 'Statistiques actualisées.';
    return true;
  } catch (error) {
    $('statsMsg').textContent = error.message;
  }
}
function statsDisplay() {
  const f = $('statsFilter').elements,
    groups = new Map();
  for (const row of statsRows) {
    if (
      [
        'activite',
        'secteur',
        'poste',
        'jeu',
        'boite',
        'salle',
        'type',
        'categorie',
      ].some((k) => f[k].value && row.dimensions[k] !== f[k].value)
    )
      continue;
    let period = row.jour;
    if (f.period.value === 'mois') period = period.slice(0, 7);
    if (f.period.value === 'semaine') {
      const date = new Date(period + 'T12:00:00');
      date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
      period = iso(date);
    }
    const dims = row.dimensions,
      key = JSON.stringify([period, dims]),
      sum = groups.get(key) || {
        periode: period,
        ...dims,
        passages: 0,
        personnes: 0,
        enfants: 0,
        adultes: 0,
        accompagnateurs: 0,
      };
    for (const k of [
      'passages',
      'personnes',
      'enfants',
      'adultes',
      'accompagnateurs',
    ])
      sum[k] += row[k];
    groups.set(key, sum);
  }
  return [...groups.values()].sort(
    (a, b) =>
      a.periode.localeCompare(b.periode) ||
      a.activite.localeCompare(b.activite),
  );
}
function renderStats() {
  const list = statsDisplay();
  $('statsSummary').textContent =
    list.reduce((n, x) => n + x.passages, 0) +
    ' saisie(s), ' +
    list.reduce((n, x) => n + x.personnes, 0) +
    ' personnes déclarées. Enfants/adultes détaillés seulement lorsque ces champs existent.';
  const t = document.createElement('table'),
    cols = [
      'periode',
      'activite',
      'secteur',
      'poste',
      'jeu',
      'boite',
      'salle',
      'type',
      'heure',
      'categorie',
      'passages',
      'personnes',
      'enfants',
      'adultes',
      'accompagnateurs',
    ];
  const head = document.createElement('thead'),
    hr = document.createElement('tr');
  for (const c of cols) {
    const th = document.createElement('th');
    th.textContent = c;
    hr.append(th);
  }
  head.append(hr);
  t.append(head);
  const body = document.createElement('tbody');
  for (const x of list) {
    const tr = document.createElement('tr');
    for (const c of cols) {
      const td = document.createElement('td');
      td.textContent = x[c] ?? '';
      tr.append(td);
    }
    body.append(tr);
  }
  t.append(body);
  $('statsTable').replaceChildren(t);
}
let adminSection = 'postes';
const adminLabels = {
  postes: 'Postes JV',
  animations: 'Animations',
  societe: 'Jeux de société',
  acces: 'Accès des agents',
  liens: 'Liens du service',
};
// Demander confirmation avant d’abandonner des réglages non enregistrés.
function discardAdminDraft() {
  const form = $('config');
  if (form.dataset.saving) return false;
  if (
    form.dataset.dirty &&
    !confirm(
      'Des modifications ne sont pas enregistrées dans cette rubrique. Les abandonner ?',
    )
  )
    return false;
  delete form.dataset.dirty;
  return true;
}
function applyAdminPanel() {
  if (!admin() && may('templates')) adminSection = 'animations';
  for (const panel of document.querySelectorAll('[data-admin-panel]')) {
    const active =
      panel.dataset.adminPanel === adminSection &&
      (admin() || may('templates'));
    panel.hidden = !active;
    for (const input of panel.querySelectorAll('input,select,textarea,button'))
      input.disabled =
        !!$('config').dataset.saving ||
        !active ||
        input.closest('label')?.hidden ||
        (input.name === 'weekday' && !$('config').dataset.postKey);
  }
  for (const button of document.querySelectorAll('[data-admin-tab]')) {
    const active = button.dataset.adminTab === adminSection;
    button.hidden = !admin() && button.dataset.adminTab !== 'animations';
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  }
  for (const group of $('admin-animations').children)
    if (group.id !== 'templateManager')
      group.hidden = !admin() || group.querySelector('[name=count]') !== null;
  $('adminSave').closest('.actions').hidden = !admin();
  $('adminSave').textContent = 'Enregistrer : ' + adminLabels[adminSection];
}
function readBoxList(selected = '') {
  $('editBox').innerHTML =
    '<option value="">Nouvelle boîte</option>' +
    Object.entries(state.settings.boxes || {})
      .sort(([a], [b]) => a.localeCompare(b, 'fr', { numeric: true }))
      .map(
        ([code, box]) =>
          `<option value="${esc(code)}" ${selected === code ? 'selected' : ''}>${esc(code + ' · ' + box.title)}</option>`,
      )
      .join('');
}
function loadBox(code) {
  const f = $('config').elements,
    box = state.settings.boxes?.[code];
  f.boxCode.value = code;
  f.boxTitle.value = box?.title || '';
  f.boxSector.value = box?.sector || 'Jeunesse';
  delete $('config').dataset.dirty;
}
// Séparer les rubriques d’administration et leurs enregistrements.
function setupAdministration() {
  const form = $('config'),
    f = form.elements,
    settings = $('settings'),
    actions = form.querySelector('.actions'),
    msg = $('configMsg'),
    roles = $('manageRoles');
  const tabs = document.createElement('div');
  tabs.id = 'adminTabs';
  tabs.className = 'adminTabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Rubriques d’administration');
  const intro = document.createElement('p');
  intro.className = 'muted';
  intro.textContent =
    'Choisir une rubrique. Le bouton d’enregistrement applique uniquement ses réglages.';
  settings.querySelector('h2').after(intro, tabs);
  const panels = {};
  for (const [key, label] of Object.entries(adminLabels)) {
    const panel = document.createElement('div');
    panel.dataset.adminPanel = key;
    panel.id = 'admin-' + key;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', 'admin-tab-' + key);
    panels[key] = panel;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'admin-tab-' + key;
    button.dataset.adminTab = key;
    button.textContent = label;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', panel.id);
    tabs.append(button);
    button.onclick = () => {
      if (!admin() && key !== 'animations') return;
      if (key === adminSection) return;
      if (!discardAdminDraft()) return;
      readConfig();
      adminSection = key;
      applyAdminPanel();
    };
    button.onkeydown = (e) => {
      const list = [...tabs.children].filter((x) => !x.hidden),
        index = list.indexOf(button);
      let target;
      if (e.key === 'ArrowRight') target = list[(index + 1) % list.length];
      if (e.key === 'ArrowLeft')
        target = list[(index + list.length - 1) % list.length];
      if (e.key === 'Home') target = list[0];
      if (e.key === 'End') target = list[list.length - 1];
      if (target) {
        e.preventDefault();
        target.click();
        if (target.getAttribute('aria-selected') === 'true') target.focus();
      }
    };
  }
  const group = (panel, title, names, help) => {
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'adminGroup';
    const legend = document.createElement('legend');
    legend.textContent = title;
    fieldset.append(legend);
    if (help) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = help;
      fieldset.append(p);
    }
    const fields = document.createElement('div');
    fields.className = 'adminFields';
    for (const name of names)
      fields.append(
        (name === 'editPost' ? $('editPost') : f[name]).closest('label'),
      );
    fieldset.append(fields);
    panel.append(fieldset);
    return fieldset;
  };
  group(
    panels.postes,
    'Poste à gérer',
    ['editPost'],
    'Sélectionner un poste existant pour le modifier ou créer un nouveau poste.',
  );
  const newPost = document.createElement('button');
  newPost.type = 'button';
  newPost.id = 'newPost';
  newPost.textContent = 'Ajouter un poste';
  panels.postes.firstElementChild.append(newPost);
  group(
    panels.postes,
    'Identité et disponibilité',
    ['postName', 'capacity', 'enabled', 'instruction'],
    'Le nom peut être modifié. Les réservations et les réglages propres au poste suivent son nouveau nom.',
  );
  group(
    panels.postes,
    'Jeux et horaires',
    ['weekday', 'games', 'slots'],
    'La grille du jour de semaine remplace la grille habituelle. Un jeu ou un créneau par ligne.',
  );
  const exceptions = group(
    panels.postes,
    'Exception à une date',
    ['exceptionDate', 'exceptionClosed', 'exceptionSlots', 'exceptionGames'],
    'Une exception datée prime sur la grille. Sans jeu ou créneau exceptionnel, la grille du jour reste utilisée.',
  );
  const details = document.createElement('details');
  details.id = 'adminExceptions';
  const summary = document.createElement('summary');
  summary.textContent = 'Exceptions par date et fermetures';
  details.append(summary, exceptions);
  panels.postes.append(details);
  group(
    details,
    'Journées fermées',
    ['closedDates'],
    'Dates au format AAAA-MM-JJ, une par ligne. Fermer un poste réservé nécessite une confirmation.',
  );
  group(
    panels.animations,
    'Valeurs proposées à la création',
    ['limit', 'askAge', 'eventTypes'],
    'Ces valeurs concernent les nouvelles séances. Les types servent à classer les séances dans les statistiques.',
  );
  group(panels.animations, 'Réglage conservé', ['count']);
  const rules = document.createElement('p');
  rules.className = 'adminHelp';
  rules.textContent =
    'Les salles Créazone et Salle JV, les cartes individuelles et la confirmation au-delà de J+15 suivent les règles communes du service.';
  panels.animations.append(rules);
  const models = document.createElement('fieldset');
  models.id = 'templateManager';
  models.className = 'adminGroup';
  models.innerHTML =
    '<legend>Modèles d’animations</legend><p>Un modèle prépare les paramètres d’une nouvelle séance. Le modifier ou le supprimer ne change pas les séances déjà créées.</p><button type="button" id="newTemplate">Créer un modèle</button><div id="templateList"></div>';
  panels.animations.append(models);
  models.querySelector('#newTemplate').onclick = () => editTemplate();
  const boxSelect = document.createElement('label');
  boxSelect.textContent = 'Boîte à gérer';
  const boxChoice = document.createElement('select');
  boxChoice.id = 'editBox';
  boxSelect.append(boxChoice);
  panels.societe.append(boxSelect);
  group(
    panels.societe,
    'Catalogue des boîtes',
    ['boxCode', 'boxTitle', 'boxSector'],
    'Choisir une boîte pour la corriger. Pour en ajouter une, choisir Nouvelle boîte et renseigner son numéro, son titre et son secteur.',
  );
  group(
    panels.acces,
    'Actions autorisées aux agents',
    [
      'manageEvents',
      'permission-edit',
      'permission-cancel',
      'permission-templates',
      'permission-bulk',
      'permission-export',
    ],
    'Ces droits s’appliquent aux agents réguliers. La gestion des modèles est indépendante de celle des séances. Les statistiques, autres paramètres et suppressions de fiches restent réservés à l’administration.',
  );
  const accountGroup = document.createElement('fieldset');
  accountGroup.className = 'adminGroup';
  accountGroup.innerHTML =
    '<legend>Comptes du personnel</legend><p class="muted">Créer les comptes dans l’administration Auth du service, puis leur attribuer une habilitation. L’inscription publique est désactivée.</p>';
  roles.type = 'button';
  accountGroup.append(roles);
  panels.acces.append(accountGroup);
  group(
    panels.liens,
    'Raccourcis du service',
    ['catalogue', 'vsmart'],
    'Adresses complètes commençant par https:// ou http://. V-smart est facultatif.',
  );
  actions.classList.add('adminActions');
  actions.querySelector('button').id = 'adminSave';
  msg.className = 'adminFeedback';
  actions.append(msg);
  form.replaceChildren(...Object.values(panels), actions);
  // Les éléments ont été déplacés : retirer les anciens textes d’introduction.
  for (const child of [...settings.children])
    if (
      ![settings.querySelector('h2'), intro, tabs, form, $('totals')].includes(
        child,
      )
    )
      child.remove();
  for (const name of ['count', 'permission-bulk', 'permission-export'])
    f[name].closest('label').hidden = true;
  f.count.closest('fieldset').hidden = true;
  form.addEventListener('input', (e) => {
    if (['editPost', 'editBox'].includes(e.target.id)) return;
    form.dataset.dirty = '1';
    $('configMsg').textContent = 'Modifications non enregistrées.';
  });
  form.addEventListener('change', (e) => {
    if (e.target.id !== 'editPost' && e.target.id !== 'editBox')
      form.dataset.dirty = '1';
  });
  $('editPost').onchange = () => {
    const selected = $('editPost').value;
    if (!discardAdminDraft()) {
      $('editPost').value = form.dataset.postKey || '';
      return;
    }
    readConfig();
  };
  newPost.onclick = () => {
    if (!discardAdminDraft()) return;
    $('editPost').value = '';
    readConfig();
    f.postName.focus();
  };
  boxChoice.onchange = () => {
    const code = boxChoice.value;
    if (!discardAdminDraft()) {
      boxChoice.value = f.boxCode.value;
      return;
    }
    loadBox(code);
  };
  f.boxCode.onchange = () => {
    const box = state.settings.boxes?.[f.boxCode.value.trim()];
    if (box) {
      f.boxTitle.value = box.title;
      f.boxSector.value = box.sector;
    }
  };
  applyAdminPanel();
}

const eventTemplateKeys = [
  'title',
  'time',
  'endTime',
  'room',
  'info',
  'referent',
  'audience',
  'minAge',
  'maxAge',
  'mode',
  'cap',
  'count',
  'announcement',
  'image',
  'eventType',
];
function renderTemplates() {
  const list = $('templateList');
  if (!list) return;
  const signature = JSON.stringify([
    !!may('templates'),
    state.settings.eventTemplates,
  ]);
  if (list.dataset.signature === signature) return;
  list.dataset.signature = signature;
  list.replaceChildren();
  if (!may('templates')) return;
  for (const [name, model] of Object.entries(
    state.settings.eventTemplates || {},
  ).sort(([a], [b]) => a.localeCompare(b, 'fr'))) {
    const row = document.createElement('div');
    row.className = 'templateActions';
    const label = document.createElement('span');
    label.textContent = name + ' · ' + model.title;
    row.append(label);
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = 'Modifier';
    edit.setAttribute('aria-label', 'Modifier le modèle ' + name);
    edit.onclick = () => editTemplate(name);
    row.append(edit);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Supprimer';
    remove.setAttribute('aria-label', 'Supprimer le modèle ' + name);
    remove.onclick = async () => {
      if (
        confirm(
          'Supprimer le modèle « ' +
            name +
            ' » ? Les séances existantes seront conservées.',
        )
      )
        await command(
          'template.remove',
          { name, revision: state.settingsRevision },
          'Modèle supprimé.',
        );
    };
    row.append(remove);
    list.append(row);
  }
  if (!list.children.length)
    list.textContent =
      'Aucun modèle. Créer un premier modèle pour préparer les prochaines séances.';
}
function editTemplate(name = '') {
  if (!may('templates')) return;
  const m = state.settings.eventTemplates?.[name] || {},
    revision = state.settingsRevision;
  modal(
    name ? 'Modifier un modèle' : 'Créer un modèle',
    `<form id="templateForm"><p>Ces paramètres seront proposés pour une nouvelle séance ; aucune séance n’est créée ici.</p><div class="fields">
 ${field('Nom du modèle', 'name', name, 'text', 'required maxlength="100"')}${field('Titre de la séance', 'title', m.title || '', 'text', 'required maxlength="200"')}${select('Type d’animation (facultatif)', 'eventType', ['', ...(state.settings.eventTypes || []), ...(m.eventType && !(state.settings.eventTypes || []).includes(m.eventType) ? [m.eventType] : [])], m.eventType || '')}
 ${field('Heure de début', 'time', m.time || '14:00', 'time', 'required')}${field('Heure de fin', 'endTime', m.endTime || '15:00', 'time', 'required')}${select('Salle obligatoire', 'room', ['', 'Créazone', 'Salle JV'], m.room || '')}
 ${field('Renseignements', 'info', m.info || '')}${field('Intervenant ou référent', 'referent', m.referent || '')}${field('Public', 'audience', m.audience || '')}${field('Âge minimum (ans)', 'minAge', m.minAge ?? '', 'number', 'min="0" step="0.1"')}${field('Âge maximum (ans)', 'maxAge', m.maxAge ?? '', 'number', 'min="0" step="0.1"')}${select('Mode', 'mode', ['inscription', 'libre'], m.mode || 'inscription')}${field('Plafond strict facultatif', 'cap', m.cap ?? '', 'number', 'min="1"')}</div><label>Texte d’annonce<textarea name="announcement" rows="3">${esc(m.announcement || '')}</textarea></label>${field('Lien vers un visuel facultatif', 'image', m.image || '', 'url')}<p id="templateMsg" role="status"></p><button class="primary">Enregistrer le modèle</button></form>`,
  );
  const form = $('templateForm');
  form.elements.room.required = true;
  form.onsubmit = (e) => {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    for (const k of ['cap', 'minAge', 'maxAge'])
      values[k] = values[k] === '' ? null : +values[k];
    values.count = true;
    submit(
      form,
      'templateMsg',
      'template.save',
      {
        name: values.name.trim(),
        oldName: name,
        model: Object.fromEntries(
          eventTemplateKeys.map((k) => [k, values[k] ?? null]),
        ),
        revision,
      },
      () => {
        $('modal').close();
        notice('Modèle enregistré.');
        renderTemplates();
      },
    );
  };
}
// Exporter les agrégats filtrés, sans identité ni numéro de carte.
async function exportStats() {
  if (!admin() || !$('statsFilter').reportValidity() || !(await loadStats()))
    return;
  const cols = [
    'periode',
    'activite',
    'secteur',
    'poste',
    'jeu',
    'boite',
    'salle',
    'type',
    'heure',
    'categorie',
    'passages',
    'personnes',
    'enfants',
    'adultes',
    'accompagnateurs',
  ];
  const quote = (value) => {
    let v = String(value ?? '');
    if (/^[\s]*[=+@-]/.test(v)) v = "'" + v;
    return '"' + v.replace(/"/g, '""') + '"';
  };
  const csv =
    '\ufeff' +
    [cols, ...statsDisplay().map((x) => cols.map((k) => x[k] ?? ''))]
      .map((row) => row.map(quote).join(';'))
      .join('\r\n');
  const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    ),
    a = document.createElement('a');
  a.href = url;
  a.download =
    'statistiques-' +
    $('statsFilter').elements.from.value +
    '-' +
    $('statsFilter').elements.to.value +
    '.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  $('statsMsg').textContent =
    'Extraction CSV des statistiques affichées téléchargée.';
}
function updateTemplateChoices(form, selected = '') {
  const input = form.elements.template;
  if (!input) return;
  input.innerHTML =
    '<option value="">Sans modèle</option>' +
    opts(
      Object.keys(state.settings.eventTemplates || {}).sort((a, b) =>
        a.localeCompare(b, 'fr'),
      ),
      selected,
    );
}
function updateBulkTools() {
  for (const [id, kind, list] of [
    ['bulkVideo', 'video', state.videos],
    ['bulkBoard', 'board', state.boards],
  ])
    if ($(id))
      $(id).disabled = !list.some((x) => selectedRows[kind]?.has(x.id));
}

setupWorkspace();
api.enableLogin();
