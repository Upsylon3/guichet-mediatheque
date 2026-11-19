'use strict';
// Adaptateur du guichet partagé : entrée locale et page publiée sous /dev/.
// Appels HTTP directs à Supabase, sans SDK distant.
globalThis.guichetDirectory = (() => {
  const configUrl = new URL('config.json', document.currentScript.src).href;
  let base = '';
  let token = '',
    apiKey = '',
    lastProfile = '';
  const directory = { profile: '', onReady: null };
  const idleDelay = 15 * 60 * 1000;
  let idleTimer;
  function concealWorkspace() {
    document.querySelector('main').hidden = true;
    for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
  }
  function lockWorkspace(message, allowProfileChange = false) {
    clearTimeout(idleTimer);
    token = '';
    directory.profile = '';
    if (allowProfileChange) lastProfile = '';
    concealWorkspace();
    const form = document.getElementById('login');
    form.hidden = false;
    document.getElementById('loginMsg').textContent = message;
    directory.enableLogin();
  }
  function scheduleIdleLock() {
    if (!token || document.querySelector('main').hidden) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => lockWorkspace('Guichet verrouillé après 15 minutes d’inactivité.'), idleDelay);
  }
  // Uniformiser les en-têtes, le délai maximal et les erreurs du service.
  async function request(path, { method = 'GET', body, prefer, bearer = token } = {}) {
    const response = await fetch(base + path, {
      method,
      headers: {
        apikey: apiKey,
        ...(bearer ? { Authorization: 'Bearer ' + bearer } : {}),
        'Content-Type': 'application/json',
        ...(prefer ? { Prefer: prefer } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    const data = await response.text();
    if (!response.ok) {
      if (response.status === 401 && bearer && bearer === token) {
        const message = 'Session expirée. Ouvrez une nouvelle session pour retrouver le guichet.';
        lockWorkspace(message);
        throw new Error(message);
      }
      if (response.status === 403) {
        if (bearer && bearer === token && path === '/rest/v1/rpc/etat_guichet')
          lockWorkspace(directory.profile === 'agent' ? 'Ce poste n’est plus autorisé.' : 'Cette session n’est plus autorisée.', true);
        throw new Error('Action refusée par le serveur.');
      }
      let problem;
      try {
        problem = JSON.parse(data);
      } catch {}
      const error = new Error(
        problem?.message ||
          'Le serveur a refusé la saisie (' + response.status + ').',
      );
      error.code = problem?.code || problem?.error_code;
      error.details = problem?.details;
      error.status = response.status;
      throw error;
    }
    return data ? JSON.parse(data) : null;
  }
  const path = (card) =>
    '/rest/v1/usagers?carte=eq.' + encodeURIComponent(card);
  // Lire toutes les pages sans charger les notes internes dans le cache de recherche.
  directory.list = async () => {
    const result = [];
    for (let offset = 0; ; offset += 500) {
      const page = await request(
        '/rest/v1/usagers?select=id,carte,prenom,nom,date_naissance,revision&fusion_cible=is.null&order=carte&limit=500&offset=' +
          offset,
      );
      result.push(...page);
      if (page.length < 500) return result;
    }
  };
  directory.get = async (card) => {
    const rows = await request(
      path(card) +
        '&select=id,carte,prenom,nom,date_naissance,note_interne,revision,fusion_cible',
    );
    if (rows.length !== 1) throw new Error('Fiche absente ou supprimée.');
    if (rows[0].fusion_cible)
      throw new Error(
        'Carte remplacée. Ouvrir la fiche ' + rows[0].fusion_cible + '.',
      );
    return rows[0];
  };
  directory.ensure = async (card) => {
    // La clé primaire arbitre les scans concurrents, sans écraser les identités.
    await request('/rest/v1/usagers?on_conflict=carte', {
      method: 'POST',
      body: { carte: card },
      prefer: 'resolution=ignore-duplicates,return=minimal',
    });
    // Pas de note dans les formulaires de passage ni dans le cache de l'annuaire.
    const rows = await request(
      path(card) + '&select=carte,prenom,nom,date_naissance',
    );
    if (rows.length !== 1) throw new Error('Fiche non confirmée. Réessayez.');
    return rows[0];
  };
  directory.save = async (card, person, create = false, revision) => {
    let rows;
    try {
      rows = await request(
        create
          ? '/rest/v1/usagers?select=carte'
          : path(card) +
              '&select=carte' +
              (revision !== undefined ? '&revision=eq.' + revision : ''),
        {
          method: create ? 'POST' : 'PATCH',
          body: create ? { carte: card, ...person } : person,
          prefer: 'return=representation',
        },
      );
    } catch (error) {
      if (!create || error.status !== 409) throw error;
      rows = [];
    }
    if (rows.length !== 1) {
      const current = (
        await request(
          path(card) +
            '&select=carte,revision,' +
            Object.keys(person).join(','),
        )
      )[0];
      // Une réponse perdue peut être confirmée sans écraser une autre version.
      if (
        current &&
        Object.entries(person).every(
          ([k, v]) => (current[k] ?? null) === (v ?? null),
        )
      )
        return;
      const error = new Error(
        current
          ? 'Conflit : la fiche a changé. Votre brouillon est conservé.'
          : 'Fiche absente ou supprimée.',
      );
      error.code = '40001';
      error.details = JSON.stringify(current || {});
      throw error;
    }
  };
  directory.remove = (numero) =>
    request('/rest/v1/rpc/supprimer_usager', {
      method: 'POST',
      body: { numero },
    });
  directory.state = () =>
    request('/rest/v1/rpc/etat_guichet', { method: 'POST', body: {} });
  directory.stats = (debut, fin) =>
    request('/rest/v1/rpc/statistiques_guichet', {
      method: 'POST',
      body: { debut, fin },
    });
  // L’identifiant d’opération permet au serveur de reconnaître une tentative répétée.
  directory.command = (action, donnees, operation = crypto.randomUUID()) =>
    request('/rest/v1/rpc/commande_guichet', {
      method: 'POST',
      body: { action, donnees, operation },
    });
  directory.merge = (source, cible, operation, annuler = false) =>
    request('/rest/v1/rpc/fusionner_fiches', {
      method: 'POST',
      body: { source, cible, operation, annuler },
    });
  directory.currentProfile = () =>
    request('/rest/v1/rpc/mon_profil', { method: 'POST', body: {} });
  const deviceKey = () => 'ludion-poste-agent:' + base;
  function readDevice() {
    try {
      return JSON.parse(localStorage.getItem(deviceKey())) || null;
    } catch {
      return null;
    }
  }
  directory.activeDevice = () => readDevice()?.id;
  directory.devices = (action = 'lister', identifiant = null, nom = null) =>
    request('/rest/v1/rpc/administrer_postes_agents', {
      method: 'POST',
      body: { action, identifiant, nom },
    });
  directory.activateDevice = async (name) => {
    const session = await request('/auth/v1/signup', {
      method: 'POST', body: {}, bearer: '',
    });
    const id = session?.user?.id;
    if (!id || !session.user.is_anonymous || !session.refresh_token)
      throw new Error('Impossible de préparer ce poste.');
    await directory.devices('activer', id, name);
    try {
      localStorage.setItem(deviceKey(), JSON.stringify({ id, refresh: session.refresh_token }));
    } catch {
      await directory.devices('revoquer', id);
      throw new Error('Autorisez le stockage local pour activer ce navigateur.');
    }
  };
  async function agentSession() {
    const renew = async () => {
      const device = readDevice();
      if (!device?.refresh)
        throw new Error('Ce navigateur doit d’abord être activé par un administrateur.');
      let session;
      try {
        session = await request('/auth/v1/token?grant_type=refresh_token', {
          method: 'POST', body: { refresh_token: device.refresh }, bearer: '',
        });
      } catch (error) {
        if ([400, 401].includes(error.status)) {
          localStorage.removeItem(deviceKey());
          throw new Error('Ce poste doit être réactivé par un administrateur.');
        }
        throw error;
      }
      localStorage.setItem(deviceKey(), JSON.stringify({ id: device.id, refresh: session.refresh_token }));
      return session;
    };
    return navigator.locks ? navigator.locks.request(deviceKey(), renew) : renew();
  }
  directory.enableLogin = () => {
    const form = document.getElementById('login');
    if (!form?.onsubmit || typeof directory.onReady !== 'function') return;
    for (const name of ['agentLogin', 'adminLogin', 'submit'])
      form.elements[name].disabled = false;
    form.elements.agentLogin.disabled = lastProfile === 'administrateur';
    form.elements.adminLogin.disabled = lastProfile === 'agent';
  };
  // Les accès administrateur restent en mémoire. Le poste conserve sa session Agent.
  function initializeLogin() {
    const form = document.getElementById('login'),
      f = form.elements,
      adminFields = document.getElementById('adminLoginFields'),
      msg = document.getElementById('loginMsg');
    async function signIn(profile) {
      for (const name of ['agentLogin', 'adminLogin', 'submit']) f[name].disabled = true;
      msg.textContent = 'Connexion en cours…';
      try {
        const config = await fetch(configUrl, { cache: 'no-store' }).then((response) => {
          if (!response.ok) throw new Error('Configuration absente.');
          return response.json();
        });
        apiKey = config.anonKey;
        base = config.url;
        token = '';
        const session = profile === 'agent'
          ? await agentSession()
          : await request('/functions/v1/connexion-administration', {
              method: 'POST',
              body: { password: f.password.value },
            });
        token = session.access_token;
        if (!token || (await directory.currentProfile()) !== profile) {
          if (profile === 'agent') localStorage.removeItem(deviceKey());
          throw new Error(profile === 'agent' ? 'Ce poste doit être réactivé par un administrateur.' : 'Profil indisponible.');
        }
        directory.profile = profile;
        await directory.onReady();
        lastProfile = profile;
        if (profile === 'agent') {
          adminFields.hidden = true;
          f.adminLogin.setAttribute('aria-expanded', 'false');
        }
        f.password.value = '';
        msg.textContent = '';
        form.hidden = true;
        document.querySelector('main').hidden = false;
        const status = document.getElementById('sessionProfile');
        status.textContent = profile === 'agent' ? 'Session agent' : 'Session administrateur';
        status.hidden = false;
        document.getElementById('logout').hidden = false;
        scheduleIdleLock();
      } catch (error) {
        token = '';
        directory.profile = '';
        msg.textContent = profile === 'agent' &&
          ['anonymous_provider_disabled', 'signup_disabled'].includes(error.code)
          ? 'L’accès Agent n’est pas encore activé sur ce guichet partagé.'
          : 'Connexion impossible. ' + error.message;
      } finally {
        f.password.value = '';
        directory.enableLogin();
      }
    }
    f.agentLogin.onclick = () => signIn('agent');
    f.adminLogin.onclick = () => {
      adminFields.hidden = !adminFields.hidden;
      f.adminLogin.setAttribute('aria-expanded', String(!adminFields.hidden));
      if (!adminFields.hidden) f.password.focus();
    };
    form.onsubmit = (event) => {
      event.preventDefault();
      if (!adminFields.hidden) signIn('administrateur');
    };
    document.getElementById('logout').onclick = async () => {
      const adminToken = lastProfile === 'administrateur' ? token : '';
      lockWorkspace('Session fermée.', true);
      if (adminToken) {
        for (const name of ['agentLogin', 'adminLogin', 'submit']) f[name].disabled = true;
        await request('/auth/v1/logout?scope=local', { method: 'POST', bearer: adminToken }).catch(() => {});
      }
      window.location.reload();
    };
    for (const event of ['pointerdown', 'keydown', 'input', 'wheel'])
      document.addEventListener(event, scheduleIdleLock, { passive: true });
    // Ne pas réafficher les données d’un écran restauré depuis l’historique.
    window.addEventListener('pagehide', concealWorkspace);
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) window.location.reload();
    });
    directory.enableLogin();
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', initializeLogin, {
      once: true,
    });
  else initializeLogin();
  return directory;
})();
