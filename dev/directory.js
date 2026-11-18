'use strict';
// Adaptateur du guichet partagé : entrée locale et page publiée sous /dev/.
// Appels HTTP directs à Supabase, sans SDK distant.
globalThis.guichetDirectory = (() => {
  const configUrl = new URL('config.json', document.currentScript.src).href;
  let base = '';
  let token = '',
    apiKey = '',
    lastProfile = '',
    agentRefreshToken = '';
  const directory = { profile: '', onReady: null };
  // Uniformiser les en-têtes, le délai maximal et les erreurs du service.
  async function request(path, { method = 'GET', body, prefer } = {}) {
    const response = await fetch(base + path, {
      method,
      headers: {
        apikey: apiKey,
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        'Content-Type': 'application/json',
        ...(prefer ? { Prefer: prefer } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(8000),
    });
    const data = await response.text();
    if (!response.ok) {
      if (response.status === 401 && token) {
        document.getElementById('login').hidden = false;
        directory.enableLogin();
        throw new Error(
          'Session expirée. Reconnectez-vous en haut de page ; votre saisie reste affichée.',
        );
      }
      if (response.status === 403)
        throw new Error('Action refusée par le serveur.');
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
  directory.enableLogin = () => {
    const form = document.getElementById('login');
    if (!form?.onsubmit || typeof directory.onReady !== 'function') return;
    for (const name of ['agentLogin', 'adminLogin', 'submit'])
      form.elements[name].disabled = false;
    form.elements.agentLogin.disabled = lastProfile === 'administrateur';
    form.elements.adminLogin.disabled = lastProfile === 'agent';
  };
  // Les jetons restent en mémoire et disparaissent quand la page est rechargée.
  function initializeLogin() {
    const form = document.getElementById('login'),
      f = form.elements,
      adminFields = document.getElementById('adminLoginFields'),
      msg = document.getElementById('loginMsg');
    async function signIn(profile) {
      for (const name of ['agentLogin', 'adminLogin', 'submit']) f[name].disabled = true;
      msg.textContent = 'Connexion en cours…';
      try {
        const config = await fetch(configUrl).then((response) => {
          if (!response.ok) throw new Error('Configuration absente.');
          return response.json();
        });
        apiKey = config.anonKey;
        base = config.url;
        token = '';
        const session = profile === 'agent'
          ? await (agentRefreshToken
              ? request('/auth/v1/token?grant_type=refresh_token', {
                  method: 'POST',
                  body: { refresh_token: agentRefreshToken },
                }).catch((error) => {
                  if (error.status >= 400 && error.status < 500 && error.status !== 429)
                    agentRefreshToken = '';
                  throw error;
                })
              : request('/auth/v1/signup', { method: 'POST', body: {} }))
          : await request('/functions/v1/connexion-administration', {
              method: 'POST',
              body: { password: f.password.value },
            });
        token = session.access_token;
        if (!token || (await directory.currentProfile()) !== profile)
          throw new Error('Profil indisponible.');
        directory.profile = profile;
        await directory.onReady();
        lastProfile = profile;
        if (profile === 'agent') {
          agentRefreshToken = session.refresh_token || '';
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
    document.getElementById('logout').onclick = () => window.location.reload();
    directory.enableLogin();
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', initializeLogin, {
      once: true,
    });
  else initializeLogin();
  return directory;
})();
