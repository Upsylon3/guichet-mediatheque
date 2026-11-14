'use strict';
// Démonstration autonome : aucune requête réseau, données de passage en mémoire.
globalThis.guichetDirectory=(()=>{
 const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Paris'}).format(new Date());
 const ranges=['10:15–11:15','11:15–12:15','13:45–14:45','14:45–15:45','15:45–16:45','16:45–17:45'];
 const posts={ZELDA:[1,'Exploration'],PEACH:[2,'Course'],MARIO:[4,'Circuit','Rallye'],ELLIE:[2,'Aventure'],SACKBOY:[2,'Sports'],SPYRO:[1,'Voyage']};
 const settings={stations:Object.fromEntries(Object.entries(posts).map(([k,[capacity,...games]])=>[k,{capacity,games,slots:[...ranges],enabled:true}])),limit:null,count:'oui',manageEvents:false,permissions:{edit:true,cancel:true,bulk:false,export:false}};
 let state={day:today(),settings,settingsRevision:1,boards:[],videos:[],events:[],trash:[],totals:[]},people=[],operations=new Map();
 const copy=x=>structuredClone(x),fail=message=>{throw new Error(message)};
 const api={demo:true,profile:'agent',onReady:null,enableLogin:()=>{}};
 const all=()=>[...state.boards,...state.videos,...state.events,...state.events.flatMap(e=>[...e.guests,...e.counts]),...state.trash];
 const week=date=>{const d=new Date(date+'T12:00:00');d.setDate(d.getDate()-(d.getDay()+6)%7);return d.toISOString().slice(0,10)};
 function ensure(card){if(!/^ESSAI-[0-9]{1,4}$/.test(card))fail('Carte fictive de la forme ESSAI-01');if(!people.some(p=>p.carte===card))people.push({id:crypto.randomUUID(),carte:card,revision:1})}
 const dateCheck=date=>{if(!date||date<today())fail('Choisir aujourd’hui ou une date future')};
 function horizon(ev,d){const limit=new Date(today()+'T12:00:00');limit.setDate(limit.getDate()+15);if(api.profile==='agent'&&ev.date>limit.toISOString().slice(0,10)&&!d.confirmEarly)fail('Confirmer l’inscription au-delà de J+15')}
 api.state=async()=>copy(state);api.list=async()=>copy(people);api.currentProfile=async()=>api.profile;
 api.get=async card=>copy(people.find(p=>p.carte===card)||fail('Fiche absente'));
 api.save=async(card,data,create,revision)=>{const p=people.find(p=>p.carte===card);if(create&&p)fail('Carte déjà utilisée');if(p&&revision&&p.revision!==revision)fail('Fiche modifiée');ensure(card);const person=people.find(p=>p.carte===card);Object.assign(person,data,{revision:person.revision+1})};
 api.remove=async card=>{if(api.profile!=='administrateur')fail('Administration réservée');if(all().some(x=>x.card===card))fail('Activité encore liée');people=people.filter(p=>p.carte!==card)};
 function eventCheck(ev){dateCheck(ev.date);if(!['Créazone','Salle JV'].includes(ev.room)||!ev.time||!ev.endTime||ev.time>=ev.endTime)fail('Choisir une salle et deux horaires valides');if(state.events.some(x=>x.id!==ev.id&&x.date===ev.date&&x.room===ev.room&&x.time<ev.endTime&&ev.time<x.endTime))fail('La salle accueille déjà une animation sur cet horaire')}
 function booking(d,old=[]){
  dateCheck(d.date);const base=state.settings.stations[d.post],cfg={...base,...base?.weekdays?.[new Date(d.date+'T12:00:00').getDay()],...base?.exceptions?.[d.date]};
  if(!base||cfg.enabled===false||state.settings.closedDates?.includes(d.date))fail('Poste ou journée fermé');const range=cfg.slots.find(x=>x.startsWith(d.slot));if(!range||!cfg.games.includes(d.game))fail('Horaire ou jeu incompatible');
  if(new Set(d.players.map(p=>p.card)).size!==d.players.length)fail('Carte en double');
  const other=state.videos.filter(x=>!old.includes(x.id)),taken=other.filter(x=>x.date===d.date&&x.post===d.post&&x.slot===d.slot);
  if(taken.length+d.players.length>cfg.capacity)fail('Places insuffisantes');if(taken.some(x=>x.game!==d.game))fail('Rejoindre le jeu déjà choisi');
  for(const p of d.players){if(p.companions)fail('Une carte par joueur, aucun accompagnateur');if(other.some(x=>x.card===p.card&&week(x.date)===week(d.date)))fail('Une seule inscription JV par semaine');ensure(p.card)}
  return d.players.map(p=>({...p,post:d.post,date:d.date,slot:d.slot,end:range.slice(-5),game:d.game,companions:0}));
 }
 function execute(action,d,op){
  if(api.profile!=='administrateur'&&['config.save','stats','export','batch'].includes(action))fail('Administration réservée');
  if(api.profile!=='administrateur'&&action.startsWith('event.')&&!state.settings.manageEvents)fail('Gestion des séances réservée');
  const ids=[],add=(list,x)=>{x={...x,id:x.id||crypto.randomUUID(),revision:(x.revision||0)+1};list.push(x);ids.push(x.id);return x};
  if(action==='config.save'){
   if(d.revision!==state.settingsRevision)fail('Réglages modifiés');
   for(const x of [...state.videos]){const b=d.settings.stations[x.post],cfg={...b,...b?.weekdays?.[new Date(x.date+'T12:00:00').getDay()],...b?.exceptions?.[x.date]};if(cfg.enabled===false||d.settings.closedDates?.includes(x.date)){if(!d.forceClose)fail('Réservation incompatible');execute('video.remove',{rows:[x]},op)}else if(!b||cfg.capacity<state.videos.filter(v=>v.date===x.date&&v.post===x.post&&v.slot===x.slot).length||!cfg.games.includes(x.game)||!cfg.slots.includes(x.slot+'–'+x.end))fail('Réservation incompatible')}
   state.settings=copy(d.settings);state.settingsRevision++;return {revision:state.settingsRevision};
  }
  if(action==='board.save'){dateCheck(d.date);ensure(d.card);const old=state.boards.find(x=>x.id===d.id);if(old){if(old.revision!==d.revision)fail('Consultation modifiée');Object.assign(old,d,{revision:old.revision+1});ids.push(old.id)}else add(state.boards,d)}
  else if(action==='video.book'){const group=crypto.randomUUID();for(const x of booking(d))add(state.videos,{...x,group})}
  else if(action==='video.move'||action==='video.restore'){const list=d.rows.map(x=>all().find(y=>y.id===x.id)||fail('Saisie absente'));const target=action.endsWith('restore')?{...list[0],...d}:d;const values=booking({...target,players:list},list.map(x=>x.id));state.videos=state.videos.filter(x=>!list.includes(x));state.trash=state.trash.filter(x=>!list.includes(x));values.forEach((x,i)=>add(state.videos,{...list[i],...x}))}
  else if(action==='event.save'){
   const old=state.events.find(x=>x.id===d.id),scope=old?state.events.filter(x=>x.id===old.id||old.group&&x.group===old.group&&!x.exception&&(d.scope==='all'||d.scope==='following'&&x.date>=old.date)):[];
   if(old){for(const x of scope){const next={...x,...d,id:x.id};eventCheck(next);Object.assign(x,next,{revision:x.revision+1});ids.push(x.id)}}
   else{const group=crypto.randomUUID();for(let i=0;i<(d.repeat||1);i++){const date=new Date(d.date+'T12:00:00');if(d.frequency==='month')date.setMonth(date.getMonth()+i*(+d.repeatEvery||1));else date.setDate(date.getDate()+7*i*(+d.repeatEvery||1));const x={...d,date:date.toISOString().slice(0,10),guests:[],counts:[],group};eventCheck(x);add(state.events,x)}}
  }
  else if(action==='guest.book'||action==='guest.move'||action==='guest.restore'){
   const old=(d.rows||[]).map(x=>all().find(y=>y.id===x.id)||fail('Participant absent'));const ev=state.events.find(e=>e.id===(d.eventId||old[0]?.eventId))||fail('Séance absente');horizon(ev,d);
   const list=d.players||old;if(new Set(list.map(x=>x.card)).size!==list.length)fail('Une carte par participant');
   for(const p of list){if(ev.guests.some(g=>g.card===p.card&&!old.includes(g)))fail('Carte déjà inscrite');if(ev.cap&&p.companions)fail('Chaque personne doit avoir sa carte');if(p.companions!==(p.companionNames||[]).length)fail('Nommer les accompagnateurs');ensure(p.card)}
   if(ev.cap&&ev.guests.filter(x=>!old.includes(x)).length+list.length>ev.cap)fail('Plafond dépassé');for(const e of state.events)e.guests=e.guests.filter(x=>!old.includes(x));state.trash=state.trash.filter(x=>!old.includes(x));const group=crypto.randomUUID();for(const p of list)add(ev.guests,{...p,eventId:ev.id,date:ev.date,group})
  }
  else if(action==='count.add'){const ev=state.events.find(x=>x.id===d.eventId)||fail('Séance absente');horizon(ev,d);if(ev.cap&&ev.counts.reduce((n,x)=>n+x.kids+x.adults,0)+d.kids+d.adults>ev.cap)fail('Plafond dépassé');add(ev.counts,{...d,date:ev.date})}
  else if(action==='user.replace'){const p=people.find(x=>x.carte===d.source)||fail('Fiche absente');if(people.some(x=>x.carte===d.target))fail('Carte déjà utilisée');if(!/^ESSAI-[0-9]{1,4}$/.test(d.target))fail('Carte fictive requise');for(const a of all())if(a.card===d.source)a.card=d.target;p.carte=d.target;p.revision++;return {card:d.target}}
  else if(action.endsWith('.remove')||action.endsWith('.restore')){const removing=action.endsWith('.remove'),kind=action.split('.')[0];for(const selected of d.rows){const item=all().find(x=>x.id===selected.id)||fail('Saisie absente');if(item.revision!==selected.revision)fail('Saisie modifiée');let list=kind==='board'?state.boards:kind==='video'?state.videos:kind==='event'?state.events:state.events.find(e=>e.id===item.eventId)?.[kind==='guest'?'guests':'counts'];if(removing){list.splice(list.indexOf(item),1);item.kind={board:'soc',video:'vid',event:'ani',guest:'guest',count:'count'}[kind];item.revision++;state.trash.push(item)}else{if(kind==='event')eventCheck(item);state.trash=state.trash.filter(x=>x!==item);item.revision++;list.push(item)}ids.push(item.id)}}
  else if(action==='event.undo'){for(const ev of d.events){const r=execute('event.save',ev,op);ids.push(...r.ids)}}
  else if(action==='batch')return d.commands.map((c,i)=>execute(c.action,c.data,op+':'+i));
  else if(action==='export')return copy(state);
  else fail('Action indisponible dans la démonstration');return {ids};
 }
 api.command=async(action,d,operation=crypto.randomUUID())=>{if(operations.has(operation))return copy(operations.get(operation));const before=copy(state),beforePeople=copy(people);try{const result=execute(action,d,operation);operations.set(operation,result);return copy(result)}catch(e){state=before;people=beforePeople;throw e}};
 api.stats=async(debut,fin)=>{if(api.profile!=='administrateur')fail('Administration réservée');return [...state.boards.map(x=>({jour:x.date,dimensions:{activite:'Jeux de société',secteur:x.sector,boite:x.box},passages:1,personnes:x.kids+x.adults,enfants:x.kids,adultes:x.adults,accompagnateurs:0})),...state.videos.map(x=>({jour:x.date,dimensions:{activite:'Jeux vidéo',poste:x.post,jeu:x.game,heure:x.slot},passages:1,personnes:1,enfants:0,adultes:0,accompagnateurs:0})),...state.events.flatMap(e=>[...e.guests.map(g=>({jour:e.date,dimensions:{activite:'Animations',salle:e.room,type:e.eventType||'',heure:e.time,categorie:g.category||''},passages:1,personnes:1+g.companions,enfants:g.category==='Enfant'?1:0,adultes:g.category==='Adulte'?1:0,accompagnateurs:g.companions})),...e.counts.map(c=>({jour:e.date,dimensions:{activite:'Animations',salle:e.room,type:e.eventType||'',heure:e.time},passages:1,personnes:c.kids+c.adults,enfants:c.kids,adultes:c.adults,accompagnateurs:0}))])].filter(x=>x.jour>=debut&&x.jour<=fin)};
 api.accounts=async()=>[];api.setRole=async()=>fail('Les comptes de la démonstration sont simulés');api.merge=async()=>fail('Fusion disponible dans le guichet partagé');
 queueMicrotask(async()=>{document.getElementById('role').onchange=async e=>{api.profile=e.target.value==='Administrateur'?'administrateur':'agent';await api.onReady()};await api.onReady()});return api;
})();

