const {test,before,after}=require('node:test');
const {spawn}=require('node:child_process');
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const cfg=JSON.parse(fs.readFileSync('.env.local.json')),accounts=JSON.parse(fs.readFileSync('.env.accounts.json'));
let server,origin=process.env.GUICHET_ORIGIN;
before(async()=>{if(origin)return;server=spawn('python',['scripts/serve-dev.py','--port','0']);origin=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error('Serveur non démarré')),10000);server.stdout.on('data',c=>{output+=c;const m=output.match(/http:\/\/127\.0\.0\.1:(\d+)/);if(m){clearTimeout(timer);resolve(m[0])}});server.on('error',reject)})});
after(()=>server?.kill());
const fixture={ids:[],cards:[],operations:[]},checks=[];
const passed=s=>{checks.push(s);console.log('OK : '+s)};
async function api(path,token,body,method='POST'){
 const r=await fetch(cfg.SUPABASE_URL+path,{method,headers:{apikey:cfg.ANON_KEY,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});const text=await r.text();const data=text?JSON.parse(text):null;assert.equal(r.status,200,JSON.stringify(data));return data;
}
const snapshot=t=>api('/rest/v1/rpc/etat_guichet',t,{});
const all=s=>[...s.boards,...s.videos,...s.events,...s.events.flatMap(e=>[...e.guests,...e.counts]),...s.trash];
async function command(token,action,donnees){const operation=crypto.randomUUID();fixture.operations.push(operation);const r=await api('/rest/v1/rpc/commande_guichet',token,{action,donnees,operation});if(r.ids)fixture.ids.push(...r.ids);return r}
async function fresh(token){for(;;){const card='0'+String(crypto.randomInt(1000000)).padStart(6,'0');const rows=await api('/rest/v1/usagers?carte=eq.'+card,token,null,'GET');if(!rows.length){fixture.cards.push(card);return card}}}
async function text(page,selector,expected){await page.waitForFunction(({selector,expected})=>document.querySelector(selector)?.textContent.includes(expected),{selector,expected},{timeout:15000})}
async function login(page,role){await page.goto(origin+'/dev/index.html');await page.locator('#login [name=email]').fill(accounts[role].email);await page.locator('#login [name=password]').fill(accounts[role].password);await page.locator('#login button').click();await page.locator('main').waitFor({state:'visible'})}

test('Parcours complets connectés : deux sessions, bureau et écran 360 px',{timeout:180000},async()=>{
 const adminSession=await api('/auth/v1/token?grant_type=password',null,accounts.administrateur);const token=adminSession.access_token;
 const initial=await snapshot(token),original=structuredClone(initial.settings),title='Animation UI fictive '+Date.now();
 const station='UI_'+Date.now();const settings=structuredClone(original);settings.stations[station]={capacity:3,games:['Jeu fictif A','Jeu fictif B'],slots:['10:00–11:00','11:00–12:00'],enabled:true};
 let browser;
 try{
  await command(token,'config.save',{settings,revision:initial.settingsRevision});
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
  const ca=await browser.newContext({locale:'fr-FR',timezoneId:'Europe/Paris'}),cb=await browser.newContext({locale:'fr-FR',timezoneId:'Europe/Paris',viewport:{width:360,height:900}});
  const a=await ca.newPage(),b=await cb.newPage(),errors=[];for(const p of [a,b])p.on('pageerror',e=>errors.push(e.message));
  await Promise.all([login(a,'agent'),login(b,'administrateur')]);
  const card1=await fresh(token),card2=await fresh(token),card3=await fresh(token);
  await a.locator('[data-tab=vid]').click();await a.locator('#addvideo').click();await a.locator('#vf [name=post]').selectOption(station);await a.locator('#vf [name=game]').selectOption('Jeu fictif A');
  await a.locator('#vf .player [name=card]').fill(card1);await a.locator('#vf .player [name=companions]').fill('1');await a.locator('#vf .addPlayer').click();await a.locator('#vf .player').nth(1).locator('[name=card]').fill(card2);
  await a.locator('#vf button.primary').click();await text(a,'#vfmsg','Inscription enregistrée.');
  assert.equal(await a.locator('#vf [name=card]').inputValue(),'');assert.equal(await a.locator('#vf [name=post]').inputValue(),station);assert.equal(await a.locator('#vf [name=game]').inputValue(),'Jeu fictif A');
  await a.locator('#close').click();await b.locator('[data-tab=vid]').click();await text(b,'#videos',card1);
  await b.locator('#addvideo').click();await b.locator('#vf [name=post]').selectOption(station);await b.locator('#vf [name=card]').fill(card3);await b.locator('#vf button.primary').click();await text(b,'#vfmsg','Places insuffisantes');
  assert.equal(await b.locator('#vf [name=card]').inputValue(),card3);
  await b.locator('#alternatives button').filter({hasText:station+' 11:00'}).click();await b.locator('#vf button.primary').click();await text(b,'#vfmsg','Inscription enregistrée.');await b.locator('#close').click();
  passed('Groupe vidéo de trois places, partage sans rechargement, refus sans perte et alternative disponible');

  await b.locator('#openAdmin').click();await b.locator('#editPost').selectOption(station);await b.locator('#config [name=capacity]').fill('2');await b.locator('#config .actions button').click();await text(b,'#configMsg','Places déjà réservées');
  assert.equal(await b.locator('#config [name=capacity]').inputValue(),'2');
  await b.locator('#config [name=capacity]').fill('3');await b.locator('#config [name=manageEvents]').check();await b.locator('#config [name=permission-bulk]').check();await b.locator('#config .actions button').click();await text(b,'#configMsg','appliqués à tous les postes');
  passed('Réglage incompatible rejeté avec brouillon conservé, délégation partagée appliquée');

  await a.locator('[data-tab=soc]').click();await a.locator('#board [name=card]').fill(card1);await a.locator('#board [name=box]').fill('BOITE-UI');await a.locator('#board [name=kids]').fill('2');await a.locator('#board button').click();await text(a,'#notice','Consultation enregistrée.');
  await b.locator('[data-tab=soc]').click();await text(b,'#boards','BOITE-UI');
  const boardRow=b.locator('#boards tr').filter({hasText:'BOITE-UI'});await boardRow.getByRole('button',{name:'Modifier / déplacer'}).click();await b.locator('#editBoard [name=sector]').selectOption('Pop Zone');await b.locator('#editBoard [name=kids]').fill('4');await b.locator('#editBoard button').click();await text(b,'#notice','Consultation corrigée.');
  await a.locator('#lookup').fill(card1);await text(a,'#results','Pop Zone');
  await b.locator('#undo').click();await text(b,'#notice','Dernière opération annulée.');await text(a,'#results','Jeunesse');
  passed('Consultation corrigée et déplacée, recherche inter-activités et annulation synchronisées');

  await b.locator('[data-tab=vid]').click();const videoRow=b.locator('#videos tr').filter({hasText:card3});b.once('dialog',d=>d.accept());await videoRow.getByRole('button',{name:'Retirer',exact:true}).click();await text(b,'#notice','Saisie retirée.');
  await b.locator('#openTrash').click();const trashed=b.locator('#trashList .row').filter({hasText:card3});await trashed.getByRole('button',{name:'Restaurer'}).click();await text(b,'#notice','Saisie restaurée.');await text(a,'#videos',card3);
  passed('Corbeille partagée et restauration visible depuis l’autre session');

  await b.locator('[data-tab=ani]').click();await b.locator('#calendar .today').click();await b.locator('#new').click();await b.locator('#af [name=title]').fill(title);await b.locator('#af [name=cap]').fill('3');await b.locator('#af [name=repeat]').fill('2');await b.locator('#af button.primary').click();await b.locator('#guest').waitFor();
  const participant=await fresh(token);await b.locator('#guest [name=card]').fill(participant);await b.locator('#guest [name=companions]').fill('1');await b.locator('#guest .addPlayer').click();await b.locator('#guest .player').nth(1).locator('[name=card]').fill(participant);await b.locator('#guest button.primary').click();await text(b,'#guests',participant);
  await a.locator('[data-tab=ani]').click();await text(a,'#eventsTable',title);
  await b.locator('#change').click();await b.locator('#af [name=title]').fill(title+' corrigée');await b.locator('#af [name=scope]').selectOption('all');b.once('dialog',d=>d.accept());await b.locator('#af button.primary').click();await text(b,'#heading',title+' corrigée');await b.locator('#close').click();
  await b.locator('#undo').click();await text(b,'#notice','Dernière opération annulée.');await text(a,'#eventsTable',title);
  passed('Série d’animations, plusieurs participants sur une carte, modification et annulation de série');
  await b.locator('#calendar .today').click();await b.locator('#agenda button').filter({hasText:title}).click();
  const modelName='Modèle fictif '+Date.now();b.once('dialog',d=>d.accept(modelName));await b.locator('#saveTemplate').click();await text(b,'#notice','Modèle enregistré.');await b.locator('#close').click();
  await b.locator('#calendar .today').click();await b.locator('#new').click();await b.locator('#af [name=template]').selectOption(modelName);assert.equal(await b.locator('#af [name=title]').inputValue(),title);await b.locator('#close').click();
  passed('Modèle réutilisable conservant les paramètres sans copier les inscrits');

  await a.locator('[data-tab=soc]').click();await a.locator('#paste-soc').waitFor({state:'visible'});await a.locator('#paste-soc').click();const imported=await fresh(token),day=(await snapshot(token)).day;
  await a.locator('#paste textarea').fill(`${imported}\tBOITE-LOT\t1\t0\t${day}\tJeunesse\nINVALIDE\tBOITE-LOT\t1\t0\t${day}\tJeunesse`);await a.locator('#previewPaste').click();await a.locator('#confirmPaste').click();await text(a,'#pasteMsg','7 chiffres');
  assert.equal((await api('/rest/v1/usagers?carte=eq.'+imported,token,null,'GET')).length,0);
  await a.locator('#paste textarea').fill(`${imported}\tBOITE-LOT\t1\t0\t${day}\tJeunesse`);await a.locator('#previewPaste').click();await a.locator('#confirmPaste').click();await text(a,'#notice','Lot enregistré en entier.');
  await text(b,'#boards','BOITE-LOT');
  passed('Collage avec aperçu, échec atomique sans fiche puis correction du lot');
  await b.locator('[data-tab=soc]').click();await b.locator('#boards tr').filter({hasText:'BOITE-UI'}).locator('input[type=checkbox]').check();
  const downloading=b.waitForEvent('download');await b.locator('#export-soc').click();const download=await downloading;const csv=fs.readFileSync(await download.path(),'utf8');assert.ok(csv.includes(card1));assert.ok(!csv.includes('note_interne'));
  passed('Export de la sélection autorisé, sans note interne');
  const target=await fresh(token);if(!await b.locator('#users').isVisible())await b.locator('#openUsers').click();
  await b.locator('#createUser').click();await b.locator('#personForm [name=card]').fill(target);await b.locator('#personForm [name=first]').fill('Cible fictive');await b.locator('#personForm button').first().click();await text(b,'#notice','Fiche enregistrée.');
  await b.locator('#userList button').filter({hasText:imported}).click();await b.locator('#mergeUser').click();await b.locator('#merge [name=target]').selectOption(target);b.once('dialog',d=>d.accept());await b.locator('#merge button').click();await text(b,'#notice','Fusion effectuée.');assert.equal(await b.locator('#undoMerge').isVisible(),true);
  await b.locator('#undoMerge').click();await text(b,'#notice','Fusion annulée.');await b.waitForFunction(card=>document.querySelector('#personForm [name=card]').value===card,imported);
  passed('Fusion depuis la fiche détaillée et bouton d’annulation fonctionnel');

  await b.locator('[data-tab=soc]').click();assert.equal(await b.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
  fs.mkdirSync('test-results',{recursive:true});await a.screenshot({path:'test-results/guichet-bureau.png',fullPage:true});await b.screenshot({path:'test-results/guichet-360.png',fullPage:true});
  passed('Deux sessions isolées sans erreur JavaScript, écran 360 px sans débordement');
 }finally{
  const s=await snapshot(token),owned=all(s).filter(x=>fixture.cards.includes(x.card)||x.title?.startsWith(title)||fixture.ids.includes(x.id));fixture.ids.push(...owned.map(x=>x.id));
  for(const [kind,list] of [['guest',s.events.flatMap(e=>e.guests)],['count',s.events.flatMap(e=>e.counts)],['video',s.videos],['board',s.boards],['event',s.events]]){const selection=list.filter(x=>fixture.ids.includes(x.id));if(selection.length)await command(token,kind+'.remove',{rows:selection.map(x=>({id:x.id,revision:x.revision}))})}
  await command(token,'config.save',{settings:original,revision:(await snapshot(token)).settingsRevision});
  await browser?.close();fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/parcours.json',JSON.stringify({date:new Date().toISOString(),checks},null,2));
  let previous={ids:[],cards:[],operations:[]};try{previous=JSON.parse(fs.readFileSync('.env.test-cleanup.json'))}catch{}
  fs.writeFileSync('.env.test-cleanup.json',JSON.stringify(Object.fromEntries(['ids','cards','operations'].map(k=>[k,[...new Set([...previous[k],...fixture[k]])]]))));
 }
});
