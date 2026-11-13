const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');

const origin=process.env.GUICHET_ORIGIN||'http://127.0.0.1:8000';
const config=JSON.parse(fs.readFileSync('.env.local.json','utf8'));
const accounts=JSON.parse(fs.readFileSync('.env.accounts.json','utf8'));
const base=config.SUPABASE_URL;
const key=config.ANON_KEY;
const cards=new Set();
const checks=[];
const passed=name=>{checks.push(name);console.log('OK : '+name)};
async function api(path,{token,method='GET',body,prefer}={}){
 const r=await fetch(base+path,{method,headers:{apikey:key,...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const text=await r.text();return {status:r.status,data:text?JSON.parse(text):null};
}
const rowPath=card=>'/rest/v1/usagers?carte=eq.'+card;
async function login(role){
 const r=await api('/auth/v1/token?grant_type=password',{method:'POST',body:accounts[role]});
 assert.equal(r.status,200,JSON.stringify(r.data));return r.data.access_token;
}
async function freshCard(token){
 for(;;){const card='0'+String(Math.floor(Math.random()*1000000)).padStart(6,'0');
  const r=await api(rowPath(card),{token});assert.equal(r.status,200);
  if(!r.data.length){cards.add(card);return card}
 }
}
async function visible(page,selector){await page.locator(selector).waitFor({state:'visible',timeout:12000})}
async function waitText(page,selector,text){await page.waitForFunction(({selector,text})=>document.querySelector(selector)?.textContent.includes(text),{selector,text},{timeout:12000})}
async function browserLogin(page,role){
 await page.goto(origin+'/dev.html');
 await page.locator('#login [name=email]').fill(accounts[role].email);
 await page.locator('#login [name=password]').fill(accounts[role].password);
 await page.locator('#login button').click();
 await visible(page,'main');
 assert.match(await page.locator('#sessionProfile').innerText(),new RegExp(role));
}
async function board(page,card){
 await page.locator('[data-tab=soc]').click();
 await page.locator('#board [name=card]').fill(card);
 await page.locator('#board [name=box]').fill('BOITE-FICTIVE');
 await page.locator('#board button').click();
}

test('Annuaire partagé : deux sessions et API Supabase réelle', {timeout:180000},async()=>{
 fs.mkdirSync('test-results',{recursive:true});
 let browser,agentToken,adminToken;
 try{
  agentToken=await login('agent');adminToken=await login('administrateur');
  assert.equal((await api('/rest/v1/rpc/mon_profil',{method:'POST',body:{},token:agentToken})).data,'agent');
  assert.equal((await api('/rest/v1/rpc/mon_profil',{method:'POST',body:{},token:adminToken})).data,'administrateur');
  passed('Deux comptes Auth avec profils attribués côté serveur');
  assert.ok([401,403].includes((await api('/rest/v1/usagers')).status));
  passed('Accès anonyme refusé');
  for(const carte of ['123456','12345678','12A4567',' 0123456','ESSAI-01']){
   const r=await api('/rest/v1/usagers',{method:'POST',token:agentToken,body:{carte}});assert.equal(r.status,400);
  }
  passed('Validation serveur des cartes : exactement sept chiffres');

  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
  const ca=await browser.newContext(),cb=await browser.newContext();
  const a=await ca.newPage(),b=await cb.newPage();
  const errors=[];
  for(const p of [a,b])p.on('pageerror',e=>errors.push(e.message));
  await Promise.all([browserLogin(a,'agent'),browserLogin(b,'administrateur')]);
  await Promise.all([a.locator('#openUsers').click(),b.locator('#openUsers').click()]);
  const card=await freshCard(adminToken);
  await a.locator('#createUser').click();
  await a.locator('#personForm [name=card]').fill('  '+card+'  ');
  await a.locator('#personForm [name=first]').fill('Camille');
  await a.locator('#personForm [name=last]').fill('Exemple-Fictif');
  await a.locator('#personForm [name=birth]').fill('2001-02-03');
  await a.locator('#personForm button').first().click();
  await waitText(a,'#notice','Fiche enregistrée.');
  await waitText(b,'#userList',card+' · Camille Exemple-Fictif');
  assert.equal(await a.locator('#deleteUser').isVisible(),false);
  await b.locator('#userList button').filter({hasText:card}).click();
  await visible(b,'#deleteUser');
  assert.equal(await b.locator('#personForm [name=birth]').inputValue(),'2001-02-03');
  passed('Fiche créée par l’agent visible sans rechargement dans la seconde session, zéro initial conservé');
  await a.locator('#personForm [name=note]').evaluate(e=>e.closest('details').open=true);
  await a.locator('#personForm [name=note]').fill('NOTE FICTIVE RÉSERVÉE À LA FICHE');
  await a.locator('#personForm button').first().click();
  await a.waitForFunction(()=>!document.querySelector('#personForm').dataset.saving);
  await b.locator('#userList button').filter({hasText:card}).click();
  await b.waitForFunction(()=>document.querySelector('#personForm [name=note]').value.includes('NOTE FICTIVE'));
  assert.doesNotMatch(await b.locator('#userList').innerText(),/NOTE FICTIVE/);
  await b.locator('#lookup').fill(card);assert.doesNotMatch(await b.locator('#results').innerText(),/NOTE FICTIVE/);
  await a.locator('#board [name=card]').fill(card);
  assert.equal(await a.locator('#board [name=known]').textContent(),'Camille Exemple-Fictif');
  passed('Identité commune et note accessible seulement depuis la fiche détaillée');

  const deletion=await api('/rest/v1/rpc/supprimer_usager',{method:'POST',token:agentToken,body:{numero:card}});
  assert.equal(deletion.status,403);assert.equal(deletion.data.code,'42501');
  const direct=await api(rowPath(card),{method:'DELETE',token:agentToken,prefer:'return=representation'});
  assert.equal(direct.status,200);assert.deepEqual(direct.data,[]);
  assert.equal((await api(rowPath(card),{token:adminToken})).data.length,1);
  // Le sélecteur client ne donne pas de droits supplémentaires.
  await a.locator('#role').evaluate(e=>{e.value='Administrateur';e.dispatchEvent(new Event('change'))});
  assert.equal(await a.locator('#openAdmin').isVisible(),false);
  passed('Suppression agent refusée (RPC 403 et DELETE direct sans effet), profil client sans autorité');

  await b.locator('#personForm [name=first]').fill('Claude');
  await b.locator('#personForm button').first().click();
  await waitText(a,'#userList',card+' · Claude Exemple-Fictif');
  await a.locator('[data-tab=vid]').click();await a.locator('#addvideo').click();
  await a.locator('#vf [name=card]').fill(card);
  assert.equal(await a.locator('#vf [name=known]').textContent(),'Claude Exemple-Fictif');
  await a.locator('#close').click();
  passed('Correction partagée et identité retrouvée dans le formulaire jeux vidéo, annulation sans création');

  const concurrent=await freshCard(adminToken);
  await Promise.all([board(a,concurrent),board(b,concurrent)]);
  await Promise.all([waitText(a,'#notice','Consultation enregistrée.'),waitText(b,'#notice','Consultation enregistrée.')]);
  const rows=await api(rowPath(concurrent),{token:adminToken});assert.equal(rows.data.length,1);assert.equal(rows.data[0].carte,concurrent);
  assert.equal(await a.locator('#pending').isVisible(),true);
  assert.equal(await a.locator('#identity [name=first]').inputValue(),'');
  assert.equal(await a.locator('#identity [name=birth]').inputValue(),'');
  assert.equal(await a.locator('#board [name=card]').evaluate(e=>e===document.activeElement),true);
  await a.locator('#identity [name=first]').fill('Ariane');await a.locator('#identity [name=last]').fill('Fictive');
  await a.locator('#identity [name=birth]').fill('1999-06-07');await a.locator('#identity button').click();
  await waitText(b,'#userList',concurrent+' · Ariane Fictive');
  passed('Deux scans concurrents : une seule fiche ; identité facultative complétée après passage');

  await b.locator('[data-tab=ani]').click();await b.locator('#calendar button.today').click();await b.locator('#new').click();
  await b.locator('#af [name=title]').fill('Atelier de recette fictif');await b.locator('#af [name=cap]').fill('1');await b.locator('#af button').click();
  const refused=await freshCard(adminToken);
  await b.locator('#guest [name=card]').fill(refused);await b.locator('#guest [name=companions]').fill('2');await b.locator('#guest button').click();
  await waitText(b,'#guestmsg','Plafond dépassé');
  assert.equal((await api(rowPath(refused),{token:adminToken})).data.length,0);
  await b.locator('#guest [name=card]').fill(concurrent);await b.locator('#guest [name=companions]').fill('0');
  assert.equal(await b.locator('#guest [name=known]').textContent(),'Ariane Fictive');
  await b.locator('#guest button').click();await waitText(b,'#guests','Ariane Fictive');await b.locator('#close').click();
  passed('Identité partagée retrouvée dans les animations ; inscription refusée sans créer de fiche');

  const failed=await freshCard(adminToken);
  const matcher=base+'/rest/v1/usagers**';
  await a.route(matcher,route=>route.request().method()==='POST'?route.abort():route.continue());
  await board(a,failed);await waitText(a,'#notice','Saisie conservée');
  assert.equal(await a.locator('#board [name=card]').inputValue(),failed);
  assert.equal(await a.locator('#board [name=box]').inputValue(),'BOITE-FICTIVE');
  assert.equal((await api(rowPath(failed),{token:adminToken})).data.length,0);
  assert.equal(await a.locator('#pending').isVisible(),false);
  await a.unroute(matcher);await a.locator('#board button').click();
  await waitText(a,'#notice','Consultation enregistrée.');
  assert.equal((await api(rowPath(failed),{token:adminToken})).data.length,1);
  passed('Échec réseau : carte et boîte conservées, aucune fiche en attente avant confirmation, reprise réussie');

  await a.locator('#userList button').filter({hasText:card}).click();
  await a.locator('#personForm [name=last]').fill('Brouillon conservé');
  await a.route(matcher,route=>route.request().method()==='PATCH'?route.abort():route.continue());
  await a.locator('#personForm button').first().click();await waitText(a,'#personMsg','Saisie conservée');
  assert.equal(await a.locator('#personForm [name=last]').inputValue(),'Brouillon conservé');
  await a.unroute(matcher);
  passed('Échec de complément : les champs saisis restent affichés');

  // Une session expirée peut être reconnectée sans recharger ni perdre le brouillon.
  await a.route(matcher,route=>route.fulfill({status:401,contentType:'application/json',body:'{}',headers:{'Access-Control-Allow-Origin':origin}}));
  await a.locator('#personForm button').first().click();await waitText(a,'#personMsg','Session expirée');
  assert.equal(await a.locator('#login').isVisible(),true);
  assert.equal(await a.locator('#personForm [name=last]').inputValue(),'Brouillon conservé');
  await a.unroute(matcher);
  await a.locator('#login [name=email]').fill(accounts.agent.email);await a.locator('#login [name=password]').fill(accounts.agent.password);await a.locator('#login button').click();
  await a.locator('#login').waitFor({state:'hidden'});
  assert.equal(await a.locator('#personForm [name=last]').inputValue(),'Brouillon conservé');
  passed('Session expirée : reconnexion sans rechargement et brouillon conservé');

  // Une réponse perdue après commit ne doit pas doubler la fiche lors de la reprise.
  const lost=await freshCard(adminToken);
  await a.route(matcher,async route=>{if(route.request().method()==='POST'){await route.fetch();await route.abort()}else await route.continue()});
  await board(a,lost);await waitText(a,'#notice','Saisie conservée');
  assert.equal((await api(rowPath(lost),{token:adminToken})).data.length,1);
  await a.unroute(matcher);await a.locator('#board button').click();await waitText(a,'#notice','Consultation enregistrée.');
  assert.equal((await api(rowPath(lost),{token:adminToken})).data.length,1);
  passed('Réponse perdue après écriture : nouvelle tentative sans doublon');

  await b.locator('#userList button').filter({hasText:card}).click();
  await b.waitForFunction(card=>document.querySelector('#personForm [name=card]').value===card,card);
  b.once('dialog',d=>d.accept());await b.locator('#deleteUser').click();await waitText(b,'#notice','Fiche supprimée.');
  await a.waitForFunction(card=>!document.querySelector('#userList').textContent.includes(card),card);
  assert.equal((await api(rowPath(card),{token:adminToken})).data.length,0);cards.delete(card);
  passed('Suppression administrateur effective et propagée à la session agent');

  // La page publique conserve sa CSP sans connexions et ses trois activités.
  const demo=await browser.newPage({viewport:{width:360,height:900}});const connections=[];
  demo.on('request',r=>{if(r.url().startsWith('https://'))connections.push(r.url())});
  demo.on('pageerror',e=>errors.push(e.message));await demo.goto(origin+'/');
  await board(demo,'ESSAI-01');await waitText(demo,'#notice','Consultation enregistrée.');
  await demo.locator('#identity [name=first]').fill('Démo');await demo.locator('#identity button').click();
  await demo.locator('[data-tab=vid]').click();await demo.locator('#addvideo').click();
  await demo.locator('#vf [name=game]').selectOption({index:1});await demo.locator('#vf [name=card]').fill('ESSAI-01');
  await demo.locator('#vf button').click();await waitText(demo,'#vfmsg','Inscription enregistrée.');await demo.locator('#close').click();
  await demo.locator('#role').selectOption('Administrateur');await demo.locator('[data-tab=ani]').click();
  await demo.locator('#calendar button.today').click();await demo.locator('#new').click();
  await demo.locator('#af [name=title]').fill('Atelier fictif');await demo.locator('#af button').click();
  await demo.locator('#guest [name=card]').fill('ESSAI-01');await demo.locator('#guest button').click();await waitText(demo,'#guests','Démo');
  await demo.locator('#close').click();
  assert.deepEqual(connections,[]);assert.equal(await demo.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await demo.reload();assert.equal(await demo.locator('#boards').innerText(),'Aucune saisie.');
  assert.deepEqual(errors,[]);
  passed('Démonstration autonome : trois parcours ESSAI, CSP active, largeur 360 px et effacement au rechargement');
  await a.screenshot({path:'test-results/session-agent.png',fullPage:true});
  await b.screenshot({path:'test-results/session-administrateur.png',fullPage:true});
 }finally{
  if(adminToken)for(const card of cards){await api('/rest/v1/rpc/supprimer_usager',{method:'POST',token:adminToken,body:{numero:card}})}
  await browser?.close();
  fs.writeFileSync('test-results/recette.json',JSON.stringify({date:new Date().toISOString(),base,checks},null,2));
 }
});

test('Supabase Auth : inscription publique désactivée',async()=>{
 const settings=await api('/auth/v1/settings');
 const report=JSON.parse(fs.readFileSync('test-results/recette.json','utf8'));
 report.inscriptionPubliqueDesactivee=settings.data.disable_signup===true;
 fs.writeFileSync('test-results/recette.json',JSON.stringify(report,null,2));
 assert.equal(settings.data.disable_signup,true,'Désactiver Allow new users to sign up dans le tableau de bord Supabase');
});
