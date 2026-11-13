const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const config=JSON.parse(fs.readFileSync('.env.local.json'));
const accounts=JSON.parse(fs.readFileSync('.env.accounts.json'));
const fixture={ids:[],cards:[],operations:[]};
const checks=[];
const ok=x=>{checks.push(x);console.log('OK : '+x)};
async function request(path,token,body,method='POST'){
 const r=await fetch(config.SUPABASE_URL+path,{method,headers:{apikey:config.ANON_KEY,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
 const text=await r.text();return {status:r.status,data:text?JSON.parse(text):null};
}
async function login(role){const r=await request('/auth/v1/token?grant_type=password',null,accounts[role]);assert.equal(r.status,200);return r.data.access_token}
async function state(token){const r=await request('/rest/v1/rpc/etat_guichet',token,{});assert.equal(r.status,200,JSON.stringify(r.data));return r.data}
async function cmd(token,action,donnees,operation=crypto.randomUUID(),expect=200){
 fixture.operations.push(operation);const r=await request('/rest/v1/rpc/commande_guichet',token,{action,donnees,operation});
 assert.equal(r.status,expect,JSON.stringify({action,...r}));if(r.status===200&&r.data?.ids)fixture.ids.push(...r.data.ids);return r;
}
async function card(token){
 for(;;){const c='0'+String(crypto.randomInt(1000000)).padStart(6,'0');const r=await request('/rest/v1/usagers?carte=eq.'+c,token,undefined,'GET');if(!r.data.length){fixture.cards.push(c);return c}}
}
async function hasCard(token,c){return (await request('/rest/v1/usagers?carte=eq.'+c,token,undefined,'GET')).data.length}
const all=s=>[...s.boards,...s.videos,...s.events,...s.events.flatMap(e=>[...e.guests,...e.counts]),...s.trash];
const row=x=>({id:x.id,revision:x.revision});
const event=(date,title,extra={})=>({date,title,time:'14:00',endTime:'16:00',mode:'inscription',count:true,cap:10,repeat:1,...extra});

test('Activités partagées : transactions, conflits, groupes, réglages et confidentialité', {timeout:180000},async()=>{
 const agent=await login('agent'),agent2=await login('agent'),admin=await login('administrateur');
 let original;
 try{
  let s=await state(admin);original=structuredClone(s.settings);const date=s.day;
  assert.ok([401,403].includes((await request('/rest/v1/rpc/etat_guichet',null,{})).status));
  await cmd(agent,'config.save',{revision:s.settingsRevision,settings:s.settings},undefined,403);
  await cmd(agent,'event.save',event(date,'Séance interdite'),undefined,403);
  assert.ok([401,403,404].includes((await request('/rest/v1/activites',agent,undefined,'GET')).status));
  ok('Tables privées, contrôle des réglages et séances côté serveur');

  const cfg=structuredClone(original);
  cfg.stations.TEST_A={capacity:1,games:['Fictif A','Fictif B'],slots:['10:00–11:00','11:00–12:00','14:00–15:00'],enabled:true};
  cfg.stations.TEST_B={capacity:3,games:['Fictif A','Fictif B'],slots:['10:00–11:00','11:00–12:00','14:00–15:00'],enabled:true};
  await cmd(admin,'config.save',{settings:cfg,revision:s.settingsRevision});
  const first=await card(admin),op=crypto.randomUUID();
  const data={date,card:first,box:'TEST-FICTIF',sector:'Jeunesse',kids:2,adults:1};
  const saved=(await cmd(agent,'board.save',data,op)).data;
  assert.deepEqual((await cmd(agent,'board.save',data,op)).data,saved);
  await cmd(agent,'board.save',{...data,kids:9},op,409);
  s=await state(agent2);assert.equal(s.boards.find(x=>x.id===saved.ids[0]).kids,2);
  const before=s.boards.find(x=>x.id===saved.ids[0]);
  await cmd(agent2,'board.save',{...data,id:before.id,revision:before.revision,kids:4});
  const conflict=await cmd(agent,'board.save',{...data,id:before.id,revision:before.revision,kids:5},undefined,409);
  assert.equal(conflict.data.code,'PT409');assert.equal(JSON.parse(conflict.data.details).kids,4);
  assert.equal((await request('/rest/v1/rpc/supprimer_usager',admin,{numero:first})).status,409);
  ok('Consultation partagée, replay sans doublon, conflit avec version serveur et fiche liée protégée');

  const ca=await card(admin),cb=await card(admin);
  const book=c=>({date,post:'TEST_A',slot:'10:00',game:'Fictif A',players:[{card:c,companions:0}]});
  const races=await Promise.all([request('/rest/v1/rpc/commande_guichet',agent,{action:'video.book',donnees:book(ca),operation:crypto.randomUUID()}),request('/rest/v1/rpc/commande_guichet',agent2,{action:'video.book',donnees:book(cb),operation:crypto.randomUUID()})]);
  assert.equal(races.filter(r=>r.status===200).length,1);assert.equal(races.filter(r=>r.status>=400).length,1);
  const winner=races.find(r=>r.status===200);fixture.ids.push(...winner.data.ids);
  const loser=races[0].status===200?cb:ca;assert.equal(await hasCard(admin,loser),0);
  s=await state(admin);const reserved=s.videos.find(x=>x.id===winner.data.ids[0]);
  await cmd(agent,'video.book',{...book(reserved.card),post:'TEST_B'},undefined,409);
  ok('Dernière place concurrente : une seule confirmation ; aucun usager créé pour le groupe refusé ; chevauchement inter-postes refusé');

  const group=[await card(admin),await card(admin),await card(admin)];
  const full=(await cmd(agent,'video.book',{date,post:'TEST_B',slot:'11:00',game:'Fictif A',players:group.map(card=>({card,companions:0}))})).data.ids;
  assert.equal(full.length,3);
  const rejected=await card(admin);
  await cmd(agent2,'video.book',{date,post:'TEST_B',slot:'11:00',game:'Fictif A',players:[{card:rejected,companions:0}]},undefined,400);
  assert.equal(await hasCard(admin,rejected),0);
  s=await state(admin);const groupRows=s.videos.filter(x=>full.includes(x.id));
  await cmd(agent,'video.move',{date,post:'TEST_A',slot:'14:00',game:'Fictif A',rows:groupRows.map(row)},undefined,400);
  assert.equal((await state(admin)).videos.filter(x=>full.includes(x.id)&&x.post==='TEST_B').length,3);
  await cmd(agent,'video.move',{date,post:'TEST_B',slot:'14:00',game:'Fictif A',rows:groupRows.map(row)});
  ok('Groupe de trois atomique ; déplacement impossible sans perte puis déplacement complet réussi');

  s=await state(admin);const one=s.videos.find(x=>full.includes(x.id));
  await cmd(agent,'video.remove',{rows:[row(one)]});
  s=await state(admin);const trash=s.trash.find(x=>x.id===one.id);
  const replacement=await card(admin);
  await cmd(agent2,'video.book',{date,post:'TEST_B',slot:'14:00',game:'Fictif A',players:[{card:replacement,companions:0}]});
  await cmd(agent,'video.restore',{rows:[row(trash)]},undefined,400);
  assert.ok((await state(admin)).trash.some(x=>x.id===one.id));
  const incompatible=structuredClone((await state(admin)).settings);incompatible.stations.TEST_B.capacity=1;
  await cmd(admin,'config.save',{settings:incompatible,revision:(await state(admin)).settingsRevision},undefined,400);
  ok('Corbeille contrôlée par la jauge et réglage incompatible bloqué sans modifier les réservations');

  const empty1=await card(admin),empty2=await card(admin);
  await cmd(agent,'video.book',{date,post:'TEST_A',slot:'11:00',game:'Fictif A',players:[{card:empty1,companions:0}]});
  await cmd(agent2,'video.book',{date,post:'TEST_A',slot:'11:00',game:'Fictif B',players:[{card:empty2,companions:0}]},undefined,400);
  s=await state(admin);await cmd(agent,'video.remove',{rows:s.videos.filter(x=>x.card===empty1).map(row)});
  await cmd(agent2,'video.book',{date,post:'TEST_A',slot:'11:00',game:'Fictif B',players:[{card:empty2,companions:0}]});
  ok('Le choix du jeu redevient libre après la dernière annulation');

  const evIds=(await cmd(admin,'event.save',event(date,'Série fictive',{repeat:3}))).data.ids;
  s=await state(admin);const second=s.events.find(x=>x.id===evIds[1]);
  await cmd(admin,'event.save',{...second,title:'Exception préservée',scope:'one'});
  s=await state(admin);const firstEvent=s.events.find(x=>x.id===evIds[0]);
  await cmd(admin,'event.save',{...firstEvent,title:'Série corrigée',scope:'all'});
  s=await state(admin);assert.equal(s.events.find(x=>x.id===second.id).title,'Exception préservée');assert.equal(s.events.find(x=>x.id===evIds[2]).title,'Série corrigée');
  const undoEvents=s.events.filter(x=>[evIds[0],evIds[2]].includes(x.id)).map(x=>({...x,title:'Série fictive',scope:'one',restoreException:false}));
  await cmd(admin,'event.undo',{events:undoEvents});
  s=await state(admin);assert.equal(s.events.find(x=>x.id===evIds[2]).title,'Série fictive');assert.equal(s.events.find(x=>x.id===evIds[2]).exception,false);
  const family=await card(admin);const participants=(await cmd(agent,'guest.book',{eventId:evIds[0],players:[{card:family,companions:1,age:'36',ageUnit:'mois',category:'Enfant'},{card:family,companions:0,age:'36',ageUnit:'ans',category:'Adulte'}]})).data.ids;
  s=await state(admin);const ev=s.events.find(x=>x.id===evIds[0]);
  assert.equal(ev.guests.find(g=>g.id===participants[0]).category,'Enfant');assert.equal(ev.guests.find(g=>g.id===participants[1]).category,'Adulte');
  await cmd(admin,'event.save',{...ev,cap:1,scope:'one'},undefined,400);
  const tomorrow=new Date(date+'T12:00:00Z');tomorrow.setUTCDate(tomorrow.getUTCDate()+1);const next=tomorrow.toISOString().slice(0,10);
  await cmd(admin,'event.save',{...ev,date:next,scope:'one'});
  s=await state(agent);assert.equal(s.events.find(x=>x.id===ev.id).guests.every(g=>g.date===next),true);
  ok('Série, exception préservée, plusieurs participants sur une carte et déplacement des inscrits avec la séance');

  const limited=(await cmd(admin,'event.save',event(date,'Dernière place animation',{cap:1}))).data.ids[0];
  const c1=await card(admin),c2=await card(admin);
  const competition=await Promise.all([request('/rest/v1/rpc/commande_guichet',agent,{action:'guest.book',donnees:{eventId:limited,players:[{card:c1,companions:0}]},operation:crypto.randomUUID()}),request('/rest/v1/rpc/commande_guichet',agent2,{action:'guest.book',donnees:{eventId:limited,players:[{card:c2,companions:0}]},operation:crypto.randomUUID()})]);
  assert.equal(competition.filter(r=>r.status===200).length,1);fixture.ids.push(...competition.find(r=>r.status===200).data.ids);
  assert.equal(await hasCard(admin,competition[0].status===200?c2:c1),0);
  const libre=(await cmd(admin,'event.save',event(date,'Entrée libre fictive',{mode:'libre',cap:3}))).data.ids[0];
  const counting=(await cmd(agent,'count.add',{eventId:libre,kids:2,adults:1})).data.ids[0];
  await cmd(agent,'count.add',{eventId:libre,kids:1,adults:0},undefined,400);
  s=await state(admin);await cmd(agent,'count.remove',{rows:[row(all(s).find(x=>x.id===counting))]});
  s=await state(admin);await cmd(agent,'count.restore',{rows:[row(s.trash.find(x=>x.id===counting))]});
  ok('Jauge animation concurrente et comptage libre sans carte, annulation/restauration contrôlée');

  const good=await card(admin);const batch={commands:[{action:'board.save',data:{...data,card:good}},{action:'board.save',data:{...data,card:'INVALIDE'}}]};
  await cmd(admin,'batch',batch,undefined,400);assert.equal(await hasCard(admin,good),0);
  await cmd(agent,'batch',{commands:[{action:'board.save',data}]},undefined,403);
  await cmd(agent,'export',{},undefined,403);await cmd(admin,'export',{});
  ok('Import en lot annulé intégralement si une ligne est invalide ; export et import protégés au serveur');

  s=await state(admin);const stale=s.settingsRevision;await cmd(admin,'config.save',{settings:s.settings,revision:stale});
  await cmd(admin,'config.save',{settings:s.settings,revision:stale},undefined,409);
  const bad=structuredClone(s.settings);bad.stations.TEST_A.exceptions={[next]:{slots:['11:00–10:00']}};
  await cmd(admin,'config.save',{settings:bad,revision:(await state(admin)).settingsRevision},undefined,400);
  ok('Révisions des réglages et validation des exceptions de dates côté serveur');
  s=await state(admin);const futureDate=new Date(date+'T12:00:00Z');futureDate.setUTCDate(futureDate.getUTCDate()+2);const futureDay=futureDate.toISOString().slice(0,10);
  const byWeekday=structuredClone(s.settings);byWeekday.stations.TEST_A.weekdays={[futureDate.getUTCDay()]:{slots:['15:00–16:30']}};
  await cmd(admin,'config.save',{settings:byWeekday,revision:s.settingsRevision});
  const futureCard=await card(admin);const futureBooking=(await cmd(agent,'video.book',{date:futureDay,post:'TEST_A',slot:'15:00',game:'Fictif A',players:[{card:futureCard,companions:0}]})).data.ids[0];
  assert.equal((await state(admin)).videos.find(x=>x.id===futureBooking).end,'16:30');
  await cmd(agent,'video.book',{date:futureDay,post:'TEST_A',slot:'10:00',game:'Fictif A',players:[{card:await card(admin),companions:0}]},undefined,400);
  ok('Grille par jour de semaine et réservation future avec horaire de fin correct');
  const year=+date.slice(0,4);const monthly=(await cmd(admin,'event.save',event(year+'-12-31','Série mensuelle fictive',{repeat:2,repeatEvery:1,frequency:'month'}))).data.ids;
  s=await state(admin);assert.equal(s.events.find(e=>e.id===monthly[0]).date,year+'-12-31');assert.equal(s.events.find(e=>e.id===monthly[1]).date,(year+1)+'-01-31');
  ok('Récurrence mensuelle de décembre à janvier avec enfants et adultes distincts');

  const roles=await request('/rest/v1/rpc/comptes_guichet',admin,{});assert.equal(roles.status,200);
  const myAdmin=roles.data.find(x=>x.profil==='administrateur');
  assert.equal((await request('/rest/v1/rpc/attribuer_profil',agent,{compte:myAdmin.id,profil:'administrateur'})).status,403);
  assert.equal((await request('/rest/v1/rpc/attribuer_profil',admin,{compte:myAdmin.id,profil:'agent'})).status,400);
  ok('Aucune auto-attribution de rôle ; dernier administrateur protégé');

  const target=await card(admin);await request('/rest/v1/usagers',agent,{carte:target,prenom:'Homonyme fictif'});
  const fusion=crypto.randomUUID();
  const merge=await request('/rest/v1/rpc/fusionner_fiches',admin,{source:first,cible:target,operation:fusion});assert.equal(merge.status,200,JSON.stringify(merge.data));
  assert.equal((await state(admin)).boards.find(x=>x.id===saved.ids[0]).card,target);
  await cmd(agent,'board.save',{...data,card:first},undefined,400);
  const undo=await request('/rest/v1/rpc/fusionner_fiches',admin,{source:first,cible:target,operation:fusion,annuler:true});assert.equal(undo.status,200,JSON.stringify(undo.data));
  assert.equal((await state(admin)).boards.find(x=>x.id===saved.ids[0]).card,first);
  ok('Fusion manuelle réversible, activités transférées et ancienne carte refusée après remplacement');
 }finally{
  let s=await state(admin);const own=new Set(fixture.ids);
  for(const [kind,list] of [['guest',s.events.flatMap(e=>e.guests)],['count',s.events.flatMap(e=>e.counts)],['video',s.videos],['board',s.boards],['event',s.events]]){
   const selected=list.filter(x=>own.has(x.id));if(selected.length)await cmd(admin,kind+'.remove',{rows:selected.map(row)});
  }
  s=await state(admin);if(original)await cmd(admin,'config.save',{settings:original,revision:s.settingsRevision});
  fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/activites.json',JSON.stringify({date:new Date().toISOString(),checks},null,2));
  let previous={ids:[],cards:[],operations:[]};try{previous=JSON.parse(fs.readFileSync('.env.test-cleanup.json'))}catch{}
  fs.writeFileSync('.env.test-cleanup.json',JSON.stringify(Object.fromEntries(['ids','cards','operations'].map(k=>[k,[...new Set([...previous[k],...fixture[k]])]]))));
 }
});
