'use strict';
// L'application connectée utilise les mêmes trois onglets ; la démonstration
// autonome ne charge pas ce module et ne reçoit aucune configuration distante.
const $=id=>document.getElementById(id),api=globalThis.guichetDirectory;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const opts=(items,selected)=>items.map(x=>`<option ${x===selected?'selected':''} value="${esc(x)}">${esc(x)}</option>`).join('');
const field=(label,name,value='',type='text',extra='')=>`<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
const select=(label,name,items,value)=>{const labels=name==='scope'?{one:'Cette séance',following:'Celle-ci et les suivantes',all:'Toute la série'}:name==='mode'?{inscription:'Sur inscription',libre:'Entrée libre'}:name==='frequency'?{week:'Semaine(s)',month:'Mois'}:{};return `<label>${label}<select name="${name}">${items.map(x=>`<option value="${esc(x)}" ${x===value?'selected':''}>${esc(labels[x]||x)}</option>`).join('')}</select></label>`};
const admin=()=>api.profile==='administrateur';
let state={boards:[],videos:[],events:[],trash:[],totals:[],settings:{stations:{}}},people={},poll,refreshPromise,personRequest=0,initialized=false;
let month=new Date(),lastVideo={},lastUndo,tableFilters={},selectedEvent=null;
const selectedRows={};
const drafts=new Map(),pending=new Set();
const day=()=>state.day||new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Paris'}).format(new Date());
const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const labelDate=d=>new Date(d+'T12:00:00').toLocaleDateString('fr-FR');
const nameOf=card=>[people[card]?.prenom,people[card]?.nom].filter(Boolean).join(' ');
const cardLabel=card=>[card,nameOf(card)].filter(Boolean).join(' · ');
const may=right=>admin()||(right==='events'?state.settings.manageEvents:state.settings.permissions?.[right]??['edit','cancel'].includes(right));
const record=id=>[...state.boards,...state.videos,...state.events,...state.events.flatMap(e=>[...e.guests,...e.counts]),...state.trash].find(x=>x.id===id);
const rows=items=>items.map(x=>({id:x.id,revision:x.revision}));
const notice=text=>$('notice').textContent=text;
const cardPattern='required pattern="[0-9]{7}" title="Saisir les 7 chiffres imprimés sous le code-barres" placeholder="0000001"';
document.querySelector('header .muted').textContent='Développement partagé · données fictives uniquement';
$('role').closest('label').hidden=true;
for(const input of document.querySelectorAll('input[name=card]')){input.pattern='[0-9]{7}';input.placeholder='0000001';input.title='Saisir les 7 chiffres imprimés sous le code-barres'}
for(const label of document.querySelectorAll('label'))if(label.firstChild?.nodeType===Node.TEXT_NODE&&label.firstChild.textContent==='Carte fictive')label.firstChild.textContent='Carte (7 chiffres)';
$('lookup').placeholder='0000001';
$('board').querySelector('.fields').insertAdjacentHTML('beforeend',field('Date','date',day(),'date','required')+'<output name="boxTitle"></output>');
$('board').insertAdjacentHTML('afterend','<div class="actions"><label>Filtrer les consultations<input id="filter-soc"></label><button id="export-soc">Exporter la sélection</button><button id="paste-soc">Coller des lignes</button></div>');
$('videos').insertAdjacentHTML('beforebegin','<div class="actions"><label>Filtrer les inscriptions<input id="filter-vid"></label><button id="export-vid">Exporter la sélection</button><button id="paste-vid">Coller des lignes</button></div>');
$('paste-soc').insertAdjacentHTML('afterend','<button id="bulkBoard">Corriger la sélection</button>');
$('paste-vid').insertAdjacentHTML('afterend','<button id="bulkVideo">Déplacer la sélection</button>');
$('calendar').insertAdjacentHTML('afterend','<h3>Tableau des séances</h3><label>Filtrer les séances<input id="filter-ani"></label><button id="export-ani">Exporter la sélection</button><div id="eventsTable"></div>');
$('openAdmin').insertAdjacentHTML('afterend','<button id="openTrash">Corbeille</button><button id="undo" disabled>Annuler la dernière opération</button>');
$('settings').insertAdjacentHTML('beforeend','<h3>Comptes attribués par le service</h3><button id="manageRoles">Gérer les habilitations</button><p>Les comptes sont créés par l’administration Auth du service, sans inscription publique.</p>');
$('deleteUser').insertAdjacentHTML('afterend','<button type="button" id="mergeUser" hidden>Remplacer / fusionner la carte</button><button type="button" id="undoMerge" hidden>Annuler la fusion du jour</button>');
$('pending').insertAdjacentHTML('afterend','<section id="trash" hidden><h2>Corbeille du jour et des réservations futures</h2><div id="trashList"></div></section>');
$('config').insertAdjacentHTML('beforeend',`<h3>Disponibilité du poste</h3><label><span><input name="enabled" type="checkbox" checked> Poste ouvert</span></label>${field('Consigne affichée','instruction')}
<h3>Exception pour une date</h3><div class="fields">${field('Date de l’exception','exceptionDate','','date')}<label><span><input type="checkbox" name="exceptionClosed"> Fermer le poste ce jour</span></label></div>
<label>Créneaux exceptionnels (un par ligne)<textarea name="exceptionSlots" rows="3"></textarea></label><label>Jeux exceptionnels (un par ligne)<textarea name="exceptionGames" rows="3"></textarea></label><p>Une date et des horaires vides conservent la grille habituelle. Les réservations incompatibles bloquent l’enregistrement.</p>
<h3>Journées fermées</h3><label>Dates AAAA-MM-JJ (une par ligne)<textarea name="closedDates" rows="3"></textarea></label>
<h3>Actions déléguées aux agents</h3>${['edit','cancel','bulk','export'].map((k,i)=>`<label><span><input type="checkbox" name="permission-${k}"> ${['Corriger et déplacer','Annuler des inscriptions','Importer et corriger en lot','Exporter une sélection nominative'][i]}</span></label>`).join('')}
<h3>Raccourcis du service</h3>${field('Catalogue','catalogue','','url')}${field('V-smart (facultatif)','vsmart','','url')}${field('Sélections du réseau (facultatif)','selections','','url')}
<h3>Boîtes de jeux de société</h3><div class="fields">${field('Numéro de boîte','boxCode')}${field('Titre','boxTitle')}${select('Secteur de la boîte','boxSector',['Jeunesse','Pop Zone'],'Jeunesse')}</div><p>Pour ajouter ou corriger une boîte, renseigner ces champs puis enregistrer les réglages.</p>`);
$('config').elements.games.closest('label').insertAdjacentHTML('beforebegin',`<label>Grille concernée<select name="weekday"><option value="default">Grille habituelle</option>${['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'].map((d,i)=>`<option value="${i}">${d}</option>`).join('')}</select></label>`);
$('config').insertAdjacentHTML('beforeend','<h3>Types d’animation</h3><label>Types proposés (un par ligne)<textarea name="eventTypes" rows="3"></textarea></label><label><span><input name="askAge" type="checkbox" checked> Proposer le champ âge dans les animations</span></label>');
$('config').append($('config').querySelector('.actions'),$('configMsg'));

async function refresh(force=false){
 if(refreshPromise){await refreshPromise;if(!force)return}
 refreshPromise=(async()=>{try{
  const [next,list,profile]=await Promise.all([api.state(),api.list(),api.currentProfile()]);
  const changed=api.profile!==profile||JSON.stringify(state)!==JSON.stringify(next)||JSON.stringify(Object.values(people))!==JSON.stringify(list);
  api.profile=profile;
  state=next;people=Object.fromEntries(list.map(p=>[p.carte,p]));
  if(changed)render();
  for(const input of document.querySelectorAll('input[name=card]'))updateKnown(input);
  $('syncStatus').textContent='Données partagées synchronisées · '+new Date().toLocaleTimeString('fr-FR');
 }catch(error){$('syncStatus').textContent='Non synchronisé : '+error.message;throw error}
 finally{refreshPromise=null}})();
 return refreshPromise;
}
api.onReady=async()=>{
 clearInterval(poll);await refresh(true);
 if(!initialized){month=new Date(day().slice(0,7)+'-01T12:00:00');$('board').elements.date.value=day();initialized=true}
 $('board').elements.date.min=day();render();
 poll=setInterval(()=>refresh().catch(()=>{}),2000);
};
function updateKnown(input){const output=input.closest('.player')?.querySelector('output')||input.form?.querySelector('[name=known]');if(output)output.value=nameOf(input.value.trim())}
document.addEventListener('input',e=>{
 if(e.target.name==='card'){e.target.value=e.target.value.trim();e.target.setCustomValidity('');updateKnown(e.target)}
});
document.addEventListener('invalid',e=>{if(e.target.name==='card')e.target.setCustomValidity('Saisir les 7 chiffres imprimés sous le code-barres')},true);
function modal(title,html){$('heading').textContent=title;$('body').innerHTML=html;if(!$('modal').open)$('modal').showModal()}
$('close').onclick=()=>$('modal').close();
function conflict(error,form){
 if(!['40001','PT409'].includes(error.code)||!error.details)return;
 let current;try{current=JSON.parse(error.details)}catch{return}
 const existing=form.querySelector('.conflict');existing?.remove();
 const section=document.createElement('details');section.className='conflict';section.open=true;
 const summary=document.createElement('summary');summary.textContent='Comparer avec la version du serveur';
 const text=document.createElement('p');
 const labels={date:'Date',card:'Carte',kids:'Enfants',adults:'Adultes',box:'Boîte',sector:'Secteur',slot:'Début',end:'Fin',post:'Poste',game:'Jeu',title:'Titre',time:'Heure',cap:'Plafond',prenom:'Prénom',nom:'Nom',date_naissance:'Naissance',note_interne:'Note'};
 text.textContent=current.stations?Object.entries(current.stations).map(([name,p])=>`${name} : ${p.capacity} place(s), ${p.games.join(', ')}, ${p.slots.join(', ')}`).join(' | '):Object.entries(labels).filter(([k])=>current[k]!==undefined).map(([k,label])=>label+' : '+(current[k]??'')).join(' · ');
 const p=document.createElement('p');p.textContent='Votre brouillon reste dans le formulaire. Fermer puis rouvrir la fiche charge la version du serveur.';
 section.append(summary,p,text);form.append(section);
}
async function submit(form,msg,action,data,onSuccess,undo){
 if(form.dataset.saving)return;
 const controls=[...form.querySelectorAll('input,select,textarea,button')].filter(x=>!x.disabled);
 form.dataset.saving='1';controls.forEach(x=>x.disabled=true);
 const operation=form.dataset.operation||crypto.randomUUID();form.dataset.operation=operation;
 let focus;
 try{
  const result=typeof action==='function'?await action():await api.command(action,data,operation);
  await refresh(true);
  if(undo){lastUndo=undo(result);$('undo').disabled=false}
  else if(typeof action==='string'){lastUndo=null;$('undo').disabled=true}
  focus=await onSuccess?.(result);
  delete form.dataset.operation;
  return true;
 }catch(error){$(msg).textContent='Écriture non confirmée. Saisie conservée. '+error.message;conflict(error,form)}
 finally{delete form.dataset.saving;controls.forEach(x=>x.disabled=false);focus?.focus()}
}
async function command(action,data,message='Modification enregistrée.',undo){
 return submit(document.createElement('form'),'notice',action,data,()=>{notice(message)},undo);
}
const inverseAdd=(kind,result)=>({action:kind+'.remove',data:{rows:rows(result.ids.map(record).filter(Boolean))}});
async function remove(kind,items){
 if(!confirm(`Retirer ${items.length} saisie(s) ? Elles resteront dans la corbeille jusqu’à la clôture.`))return;
 await command(kind+'.remove',{rows:rows(items)},'Saisie retirée.',result=>({action:kind+'.restore',data:{rows:rows(result.ids.map(record).filter(Boolean))}}));
}
$('undo').onclick=async()=>{
 if(!lastUndo)return;const undo=lastUndo;
 if(await command(undo.action,undo.data,'Dernière opération annulée.')){lastUndo=null;$('undo').disabled=true}
};
$('openTrash').onclick=()=>{$('trash').hidden=!$('trash').hidden;renderTrash()};
function renderTrash(){
 $('trashList').replaceChildren();
 for(const item of state.trash){
  const row=document.createElement('div');row.className='row';const text=document.createElement('span');
  text.textContent=[labelDate(item.date),({soc:'Consultation',vid:'Jeux vidéo',ani:'Animation',guest:'Participant',count:'Comptage'})[item.kind],item.title||cardLabel(item.card)].join(' · ');
  const b=document.createElement('button');b.textContent='Restaurer';b.onclick=()=>command(({soc:'board',vid:'video',ani:'event',guest:'guest',count:'count'})[item.kind]+'.restore',{rows:rows([item])},'Saisie restaurée.');row.append(text,b);$('trashList').append(row);
 }
 if(!state.trash.length)$('trashList').textContent='Corbeille vide.';
}

// Annuaire et compléments : aucun rafraîchissement ne remplace un brouillon.
function userList(){
 const search=$('filterUsers').value.trim().toLocaleLowerCase('fr');$('userList').replaceChildren();
 for(const p of Object.values(people).sort((a,b)=>a.carte.localeCompare(b.carte))){
  const label=cardLabel(p.carte);if(!label.toLocaleLowerCase('fr').includes(search))continue;
  const button=document.createElement('button');button.textContent=label;button.onclick=()=>openPerson(p.carte);$('userList').append(button);
 }
}
$('openUsers').onclick=()=>{$('users').hidden=!$('users').hidden;$('settings').hidden=true;userList()};
$('filterUsers').oninput=userList;$('createUser').onclick=()=>openPerson();
async function openPerson(card=''){
 if($('personForm').dataset.saving)return;
 const request=++personRequest;let p={};
 const loadingForm=$('personForm');for(const input of loadingForm.elements)input.disabled=true;
 try{if(card)p=await api.get(card)}catch(error){notice(error.message);return}
 finally{if(request===personRequest)for(const input of loadingForm.elements)input.disabled=false}
 if(request!==personRequest)return;
 const form=$('personForm'),f=form.elements;form.reset();form.hidden=false;delete form.dataset.operation;
 f.card.value=card;f.card.readOnly=!!card;f.first.value=p.prenom||'';f.last.value=p.nom||'';f.birth.value=p.date_naissance||'';f.birth.max=day();f.note.value=p.note_interne||'';
 form.dataset.revision=p.revision||'';
 $('personTitle').textContent=card?'Fiche usager':'Nouvel usager';$('noteDetails').hidden=!card;$('noteDetails').open=false;
 $('deleteUser').hidden=!card||!admin();$('personMsg').textContent='';
 $('mergeUser').hidden=!card||!admin();
}
$('personForm').onsubmit=e=>{
 e.preventDefault();const f=e.target.elements,card=f.card.value.trim();
 submit(e.target,'personMsg',()=>api.save(card,{prenom:f.first.value.trim()||null,nom:f.last.value.trim()||null,date_naissance:f.birth.value||null,note_interne:f.note.value.trim()||null},!f.card.readOnly,+e.target.dataset.revision||undefined),null,()=>{
  e.target.dataset.revision=people[card]?.revision||'';
  f.card.readOnly=true;$('noteDetails').hidden=false;$('deleteUser').hidden=!admin();pending.delete(card);drafts.delete(card);renderPending();notice('Fiche enregistrée.');
 });
};
$('deleteUser').onclick=()=>{
 if(!admin()||!confirm('Supprimer cette fiche usager ? Les activités encore liées bloqueront la suppression.'))return;
 const card=$('personForm').elements.card.value;
 submit($('personForm'),'personMsg',()=>api.remove(card),null,()=>{$('personForm').hidden=true;pending.delete(card);drafts.delete(card);notice('Fiche supprimée.')});
};
function queue(cards){for(const card of cards)if(people[card]&&!people[card].prenom&&!people[card].nom&&!people[card].date_naissance)pending.add(card);renderPending()}
function renderPending(){
 const f=$('identity').elements,selected=f.reader.value;
 for(const card of pending)if(!people[card]||!drafts.has(card)&&(people[card].prenom||people[card].nom||people[card].date_naissance))pending.delete(card);
 f.reader.replaceChildren(...[...pending].map(card=>new Option(cardLabel(card),card)));
 if(pending.has(selected))f.reader.value=selected;
 $('pending').hidden=pending.size===0;
 if(f.reader.value!==selected)readDraft();
}
function readDraft(){const f=$('identity').elements,d=drafts.get(f.reader.value)||{};for(const k of ['first','last','birth'])f[k].value=d[k]||'';f.birth.max=day();$('identity').dataset.revision=d.revision||people[f.reader.value]?.revision||''}
$('identity').elements.reader.onchange=readDraft;
$('identity').oninput=()=>{const f=$('identity').elements;drafts.set(f.reader.value,{first:f.first.value,last:f.last.value,birth:f.birth.value,revision:$('identity').dataset.revision||people[f.reader.value]?.revision})};
$('identity').onsubmit=e=>{
 e.preventDefault();const f=e.target.elements,card=f.reader.value;
 submit(e.target,'notice',()=>api.save(card,{prenom:f.first.value.trim()||null,nom:f.last.value.trim()||null,date_naissance:f.birth.value||null},false,+e.target.dataset.revision||undefined),null,()=>{pending.delete(card);drafts.delete(card);renderPending();notice('Fiche enregistrée.')});
};

function search(){
 const card=$('lookup').value.trim(),list=$('results');list.replaceChildren();if(!card)return;
 const lines=[cardLabel(card),...state.boards.filter(x=>x.card===card&&x.date===day()).map(x=>`${x.sector} · boîte ${x.box} · ${x.kids+x.adults} personnes`),...state.videos.filter(x=>x.card===card).map(x=>`${labelDate(x.date)} · ${x.slot}–${x.end} · ${x.post} · ${x.game}`),...state.events.filter(x=>x.guests.some(g=>g.card===card)).map(x=>`${labelDate(x.date)} · ${x.time} · ${x.title} · ${x.info||''}`)];
 for(const line of lines){const p=document.createElement('p');p.textContent=line;list.append(p)}
 if(lines.length===1){const p=document.createElement('p');p.textContent='Aucune consultation du jour ni inscription à venir.';list.append(p)}
}
$('lookup').oninput=search;
for(const b of document.querySelectorAll('[data-tab]'))b.onclick=()=>{for(const x of document.querySelectorAll('[data-tab]')){$(x.dataset.tab).hidden=x!==b;x.setAttribute('aria-current',String(x===b))}notice('')};
try{$('sector').value=localStorage.getItem('guichet-secteur')||'Jeunesse'}catch{}
$('sector').onchange=()=>{try{localStorage.setItem('guichet-secteur',$('sector').value)}catch{}renderBoards()};
$('board').elements.box.oninput=()=>{$('board').elements.boxTitle.value=state.settings.boxes?.[$('board').elements.box.value.trim()]?.title||'Boîte à compléter'};
$('board').onsubmit=e=>{
 e.preventDefault();const f=e.target.elements,card=f.card.value.trim(),date=f.date.value;
 submit(e.target,'notice','board.save',{card,date,sector:$('sector').value,box:f.box.value.trim(),kids:+f.kids.value,adults:+f.adults.value},()=>{
  queue([card]);e.target.reset();f.date.value=day();notice('Consultation enregistrée.');return f.card;
 },result=>inverseAdd('board',result));
};
function table(container,items,kind,description,edit){
 const search=(tableFilters[kind]||'').toLocaleLowerCase('fr');$(container).replaceChildren();
 const wrap=document.createElement('div');wrap.className='tableWrap';const table=document.createElement('table');table.innerHTML='<thead><tr><th>Sélection</th><th>Saisie</th><th>Actions</th></tr></thead>';const tbody=document.createElement('tbody');table.append(tbody);wrap.append(table);
 for(const item of items){
  const label=description(item);if(!label.toLocaleLowerCase('fr').includes(search))continue;
  const row=document.createElement('tr'),checkCell=document.createElement('td'),textCell=document.createElement('td'),actionCell=document.createElement('td');
  const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.value=item.id;checkbox.dataset.kind=kind;checkbox.setAttribute('aria-label','Sélectionner '+label);
  selectedRows[kind]??=new Set();checkbox.checked=selectedRows[kind].has(item.id);checkbox.onchange=()=>checkbox.checked?selectedRows[kind].add(item.id):selectedRows[kind].delete(item.id);
  checkCell.append(checkbox);textCell.textContent=label;
  if(edit&&may('edit')){const b=document.createElement('button');b.textContent='Modifier / déplacer';b.onclick=()=>edit(item);actionCell.append(b)}
  if(may('cancel')&&(kind!=='event'||may('events'))){const b=document.createElement('button');b.textContent='Retirer';b.onclick=()=>remove(kind,[item]);actionCell.append(b)}
  row.append(checkCell,textCell,actionCell);tbody.append(row);
 }
 if(tbody.children.length)$(container).append(wrap);else $(container).textContent='Aucune saisie.';
}
function renderBoards(){table('boards',state.boards.filter(x=>x.sector===$('sector').value),'board',x=>`${labelDate(x.date)} · ${cardLabel(x.card)} · ${state.settings.boxes?.[x.box]?.title||'Boîte '+x.box} · ${x.kids} enf. + ${x.adults} ad. = ${x.kids+x.adults}`,editBoard)}
function editBoard(item){
 modal('Corriger la consultation',`<form id="editBoard"><div class="fields">${field('Carte','card',item.card,'text',cardPattern)}${field('Boîte','box',item.box,'text','required')}${field('Date','date',item.date,'date',`required min="${day()}"`)}${select('Secteur','sector',['Jeunesse','Pop Zone'],item.sector)}${field('Enfants','kids',item.kids,'number','min="0" required')}${field('Adultes','adults',item.adults,'number','min="0" required')}</div><p role="status" id="editMsg"></p><button>Enregistrer</button></form>`);
 $('editBoard').onsubmit=e=>{e.preventDefault();const f=e.target.elements,data={...item,card:f.card.value.trim(),box:f.box.value.trim(),date:f.date.value,sector:f.sector.value,kids:+f.kids.value,adults:+f.adults.value};
  submit(e.target,'editMsg','board.save',data,()=>{$('modal').close();queue([data.card]);notice('Consultation corrigée.')},result=>({action:'board.save',data:{...item,revision:record(result.ids[0]).revision}}));
 };
}

// Jeux vidéo : tous les joueurs sont confirmés dans une seule transaction.
function station(post,date){const p=state.settings.stations[post];return p?{...p,...p.weekdays?.[new Date(date+'T12:00:00').getDay()],...p.exceptions?.[date]}:null}
function playerRow({card='',companions=0,age='',ageUnit='ans',category='Enfant'}={},ageFields=false){return `<div class="player fields">${field('Carte','card',card,'text',cardPattern)}<output name="known">${esc(nameOf(card))}</output>${field('Accompagnateurs','companions',companions,'number','min="0" max="100" required')}${ageFields?select('Participant','category',['Enfant','Adulte'],category)+field('Âge facultatif','age',age,'number','min="0" step="0.1"')+select('Unité','ageUnit',['ans','mois'],ageUnit):''}<button type="button" class="removePlayer">Retirer ce joueur</button></div>`}
function bindPlayers(form,ageFields=false){
 form.querySelector('.addPlayer').onclick=()=>{form.querySelector('.players').insertAdjacentHTML('beforeend',playerRow({},ageFields));bindRemovals(form)};bindRemovals(form);
}
function bindRemovals(form){for(const b of form.querySelectorAll('.removePlayer'))b.onclick=()=>{if(form.querySelectorAll('.player').length>1)b.closest('.player').remove()}}
function players(form){return [...form.querySelectorAll('.player')].map(row=>({card:row.querySelector('[name=card]').value.trim(),companions:+row.querySelector('[name=companions]').value,...(row.querySelector('[name=age]')?{age:row.querySelector('[name=age]').value,ageUnit:row.querySelector('[name=ageUnit]').value,category:row.querySelector('[name=category]').value}:{})}))}
function videoForm(moving=[]){
 const initial=moving[0]||lastVideo,date=initial.date||day(),post=initial.post||Object.keys(state.settings.stations)[0];
 modal(moving.length?'Déplacer les joueurs':'Inscrire aux jeux vidéo',`<form id="vf"><div class="fields">${field('Jour','date',date,'date',`required min="${day()}"`)}${select('Poste','post',Object.keys(state.settings.stations),post)}<label>Créneau<select name="slot"></select></label><label>Jeu<select name="game" required></select></label></div><p id="videoInstruction"></p><div class="players">${(moving.length?moving:[{}]).map(p=>playerRow(p)).join('')}</div><button type="button" class="addPlayer">Ajouter un joueur</button><p id="vfmsg" role="status"></p><div id="alternatives"></div><button class="primary">${moving.length?'Déplacer':'Inscrire'}</button></form>`);
 const form=$('vf'),f=form.elements;bindPlayers(form);
 if(moving.length){for(const input of form.querySelectorAll('.players input'))input.readOnly=true;form.querySelector('.addPlayer').hidden=true;for(const b of form.querySelectorAll('.removePlayer'))b.hidden=true}
 function availability(reset=false){
  const cfg=station(f.post.value,f.date.value);const current=f.slot.value;
  if(reset){f.slot.innerHTML=opts((cfg?.slots||[]).map(s=>s.slice(0,5)),initial.slot||current)}
  const bookings=state.videos.filter(x=>x.date===f.date.value&&x.post===f.post.value&&x.slot===f.slot.value&&!moving.some(m=>m.id===x.id));
  const remaining=(cfg?.enabled===false||state.settings.closedDates?.includes(f.date.value))?0:(cfg?.capacity||0)-bookings.reduce((n,x)=>n+1+x.companions,0);
  const shared=bookings[0]?.game,game=f.game.value||initial.game||'';
  f.game.innerHTML='<option value="">Choisir un jeu</option>'+opts(shared?[shared]:cfg?.games||[],shared||game);
  $('vfmsg').textContent=remaining+' place(s) disponible(s). '+(shared?'Jeu en cours : '+shared:'');
  $('videoInstruction').textContent=[(cfg?.slots||[]).find(x=>x.startsWith(f.slot.value))||'Aucun créneau',cfg?.instruction||''].filter(Boolean).join(' · ');
  alternatives(form,moving);return remaining;
 }
 f.post.onchange=f.date.onchange=()=>availability(true);f.slot.onchange=f.game.onchange=()=>availability();
 form.addEventListener('input',()=>alternatives(form,moving));availability(true);
 form.onsubmit=e=>{
  e.preventDefault();const group=players(form),data={date:f.date.value,post:f.post.value,slot:f.slot.value,game:f.game.value,...(moving.length?{rows:rows(moving)}:{players:group})};
  submit(form,'vfmsg',moving.length?'video.move':'video.book',data,result=>{
   queue(group.map(p=>p.card));lastVideo={date:data.date,post:data.post,slot:data.slot,game:data.game};
   if(moving.length){$('modal').close();notice('Joueurs déplacés.');return}
   form.querySelector('.players').innerHTML=playerRow();bindRemovals(form);availability();$('vfmsg').textContent='Inscription enregistrée. '+$('vfmsg').textContent;return form.querySelector('[name=card]');
  },result=>moving.length?{action:'video.move',data:{date:moving[0].date,post:moving[0].post,slot:moving[0].slot,game:moving[0].game,rows:rows(result.ids.map(record).filter(Boolean))}}:inverseAdd('video',result));
 };
}
function alternatives(form,moving=[]){
 const f=form.elements,group=players(form),need=group.reduce((n,p)=>n+1+p.companions,0),target=$('alternatives');target.replaceChildren();if(!f.game.value)return;
 let count=0;
 for(const [post] of Object.entries(state.settings.stations))for(const range of station(post,f.date.value)?.slots||[]){
  const cfg=station(post,f.date.value),slot=range.slice(0,5),bookings=state.videos.filter(x=>x.date===f.date.value&&x.post===post&&x.slot===slot&&!moving.some(m=>m.id===x.id));
  if(post===f.post.value&&slot===f.slot.value||slot<f.slot.value||cfg.enabled===false||!cfg.games.includes(f.game.value)||bookings.some(x=>x.game!==f.game.value)||bookings.reduce((n,x)=>n+1+x.companions,0)+need>cfg.capacity)continue;
  if(count++>=5)break;
  const b=document.createElement('button');b.type='button';b.textContent=`Autre possibilité : ${post} ${range}`;b.onclick=()=>{f.post.value=post;f.post.onchange();f.slot.value=slot;f.slot.onchange()};target.append(b);
 }
}
$('addvideo').onclick=()=>videoForm();
function editVideo(item){
 const group=state.videos.filter(x=>x.group===item.group);
 modal('Déplacer une inscription',`<p>${esc(cardLabel(item.card))} · ${esc(item.post)} · ${esc(item.slot)}</p><button id="moveOne">Cette personne</button><button id="moveGroup">Tout le groupe (${group.length})</button>`);
 $('moveOne').onclick=()=>videoForm([item]);$('moveGroup').onclick=()=>videoForm(group);
}

// Calendrier mensuel et séances récurrentes.
function calendar(){
 $('month').textContent=month.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});const grid=$('calendar');grid.innerHTML=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d=>'<b>'+d+'</b>').join('');
 for(let i=0;i<(month.getDay()+6)%7;i++)grid.append(document.createElement('span'));
 for(let n=1;n<=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();n++){
  const date=iso(new Date(month.getFullYear(),month.getMonth(),n)),events=state.events.filter(e=>e.date===date),b=document.createElement('button');b.className='day'+(date===day()?' today':'')+(events.length?' busy':'');b.dataset.date=date;b.textContent=n;b.setAttribute('aria-label',labelDate(date));
  for(const ev of events){const s=document.createElement('small');s.textContent=ev.title;b.append(s)}b.onclick=()=>openDay(date);
  b.onkeydown=e=>{const step={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[e.key];if(step){e.preventDefault();const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+step);month=new Date(d.getFullYear(),d.getMonth(),1);calendar();document.querySelector(`[data-date="${iso(d)}"]`)?.focus()}};grid.append(b);
 }
}
$('prev').onclick=()=>{month.setMonth(month.getMonth()-1);calendar()};$('next').onclick=()=>{month.setMonth(month.getMonth()+1);calendar()};$('now').onclick=()=>{month=new Date(day().slice(0,7)+'-01T12:00:00');calendar()};
function openDay(date){
 modal(labelDate(date),'<div id="agenda"></div><button id="new">Ajouter une animation</button>');
 for(const ev of state.events.filter(e=>e.date===date)){const b=document.createElement('button');b.textContent=ev.time+' · '+ev.title;b.onclick=()=>detailEvent(ev.id);$('agenda').append(b)}
 $('new').hidden=!may('events')||date<day();$('new').onclick=()=>editEvent({date});
}
function editEvent(ev={},duplicate=false){
 const previous=state.events.filter(x=>x.id===ev.id||ev.group&&x.group===ev.group&&!x.exception);
 const defaults=state.settings;modal(duplicate?'Dupliquer la séance':ev.id?'Modifier la séance':'Nouvelle animation',`<form id="af"><div class="fields">
 ${field('Titre','title',ev.title||'','text','required')}${select('Type','eventType',['',...(defaults.eventTypes||[])],ev.eventType||'')}${field('Jour','date',ev.date||day(),'date',`required min="${day()}"`)}${field('Heure de début','time',ev.time||'14:00','time','required')}${field('Heure de fin','endTime',ev.endTime||'','time')}${field('Lieu et renseignements','info',ev.info||'')}${field('Intervenant ou référent','referent',ev.referent||'')}${field('Public','audience',ev.audience||'')}${field('Âge minimum (ans)','minAge',ev.minAge??'','number','min="0" step="0.1"')}${field('Âge maximum (ans)','maxAge',ev.maxAge??'','number','min="0" step="0.1"')}${field('Ouverture des inscriptions','openDate',ev.openDate||'','date')}${select('Mode','mode',['inscription','libre'],ev.mode||'inscription')}${field('Plafond strict facultatif','cap',ev.cap??defaults.limit??'','number','min="1"')}${select('Accompagnateurs','count',['oui','non'],ev.id?(ev.count?'oui':'non'):defaults.count||'oui')}</div><label>Texte d’annonce<textarea name="announcement" rows="3">${esc(ev.announcement||'')}</textarea></label>${field('Lien vers un visuel facultatif','image',ev.image||'','url')}
 ${ev.id&&!duplicate?select('Portée de la modification','scope',['one','following','all'],'one'):field('Nombre de séances (1 à 52)','repeat',1,'number','required min="1" max="52"')+select('Récurrence','frequency',['week','month'],'week')+field('Tous les','repeatEvery',1,'number','required min="1" max="12"')}
 <p id="seriesPreview"></p><p id="afmsg" role="status"></p><button class="primary">Enregistrer</button></form>`);
 const form=$('af'),f=form.elements;
 if(!ev.id){
  form.insertAdjacentHTML('afterbegin',select('Modèle facultatif','template',['',...Object.keys(state.settings.eventTemplates||{})],''));
  f.template.onchange=()=>{const model=state.settings.eventTemplates?.[f.template.value];if(model){for(const [k,v] of Object.entries(model))if(f[k])f[k].value=k==='count'?(v?'oui':'non'):(v??'')}};
 }
 function preview(){const scope=f.scope?.value||'one',affected=state.events.filter(x=>x.id===ev.id||(ev.group&&x.group===ev.group&&!x.exception&&(scope==='all'||scope==='following'&&x.date>=ev.date)));$('seriesPreview').textContent=ev.id&&!duplicate?`${affected.length} séance(s) et ${affected.reduce((n,e)=>n+e.guests.length,0)} inscription(s) concernées. Les exceptions sont préservées.`:''}
 if(f.scope)f.scope.onchange=preview;preview();
 form.onsubmit=e=>{
  e.preventDefault();const data=Object.fromEntries(new FormData(form));data.count=f.count.value==='oui';for(const k of ['cap','minAge','maxAge'])data[k]=data[k]===''?null:+data[k];if(ev.id&&!duplicate){data.id=ev.id;data.revision=ev.revision}else data.repeat=+f.repeat.value;
  if(ev.id&&!duplicate&&!confirm($('seriesPreview').textContent+' Enregistrer ?'))return;
  submit(form,'afmsg','event.save',data,result=>{month=new Date(data.date.slice(0,7)+'-01T12:00:00');calendar();detailEvent(result.ids[0]);notice('Séance enregistrée.')},result=>ev.id&&!duplicate?{action:'event.undo',data:{events:previous.filter(x=>result.ids.includes(x.id)).map(x=>({...x,revision:record(x.id).revision,scope:'one',restoreException:!!x.exception}))}}:inverseAdd('event',result));
 };
}
function occupied(ev){return ev.mode==='libre'?ev.counts.reduce((n,c)=>n+c.kids+c.adults,0):ev.guests.reduce((n,g)=>n+1+(ev.count?g.companions:0),0)}
function detailEvent(id){
 const ev=state.events.find(x=>x.id===id);if(!ev){notice('Séance absente ou supprimée.');return}selectedEvent=id;
 modal(ev.title,`<p>${esc(labelDate(ev.date)+' · '+ev.time+(ev.endTime?'–'+ev.endTime:'')+' · '+(ev.info||''))}</p><p>${esc([ev.referent,ev.audience,ev.minAge!=null?'À partir de '+ev.minAge+' ans':'',ev.maxAge!=null?'Jusqu’à '+ev.maxAge+' ans':''].filter(Boolean).join(' · '))}</p><p>${esc(ev.announcement||'')}</p>${safeLink(ev.image)?`<p><a href="${esc(safeLink(ev.image))}" target="_blank" rel="noopener noreferrer">Voir le visuel ↗</a></p>`:''}<p id="eventPlaces">${occupied(ev)}${ev.cap?' / '+ev.cap:''} place(s) · accompagnateurs ${ev.count?'inclus':'hors jauge'}</p><div id="guests"></div>
 ${ev.mode==='libre'?`<form id="freeCount"><div class="fields">${field('Enfants','kids',0,'number','min="0" required')}${field('Adultes','adults',0,'number','min="0" required')}</div><p id="guestmsg" role="status"></p><button>Ajouter le comptage</button></form>`:`<form id="guest"><div class="players">${playerRow({},true)}</div><button type="button" class="addPlayer">Ajouter une personne</button><p id="guestmsg" role="status"></p><button class="primary">Inscrire le groupe</button></form>`}
 <div class="actions"><button id="change">Modifier</button><button id="duplicate">Dupliquer</button><button id="saveTemplate">Enregistrer comme modèle</button><button id="remove">Supprimer la séance</button><button id="exportGuests">Exporter la sélection</button><button id="pasteGuests">Coller des lignes</button></div>`);
 renderGuests(ev);
 for(const id of ['change','duplicate','remove','saveTemplate'])$(id).hidden=!may('events');
 $('saveTemplate').hidden=!admin();
 $('saveTemplate').onclick=async()=>{
  const label=prompt('Nom du modèle réutilisable',ev.title);if(!label?.trim())return;
  const keys=['title','time','endTime','info','referent','audience','minAge','maxAge','mode','cap','count','announcement','image','eventType'];
  const cfg=structuredClone(state.settings);cfg.eventTemplates={...cfg.eventTemplates,[label.trim()]:Object.fromEntries(keys.map(k=>[k,ev[k]??null]))};
  await command('config.save',{settings:cfg,revision:state.settingsRevision},'Modèle enregistré.');
 };
 $('change').onclick=()=>editEvent(ev);$('duplicate').onclick=()=>editEvent(ev,true);$('remove').onclick=()=>removeSeries(ev);
 $('exportGuests').hidden=!may('export');$('pasteGuests').hidden=!may('bulk');$('exportGuests').onclick=()=>exportRows('guest',ev.guests);$('pasteGuests').onclick=()=>pasteRows('guest',ev.id);
 if(ev.mode==='libre'){$('freeCount').onsubmit=e=>{e.preventDefault();const f=e.target.elements;submit(e.target,'guestmsg','count.add',{eventId:id,kids:+f.kids.value,adults:+f.adults.value},()=>{detailEvent(id);notice('Comptage enregistré.')},result=>inverseAdd('count',result))};return}
 const form=$('guest');bindPlayers(form,true);
 if(state.settings.askAge===false&&ev.minAge==null&&ev.maxAge==null){for(const input of form.querySelectorAll('[name=age],[name=ageUnit]'))input.closest('label').hidden=true}
 form.onsubmit=e=>{e.preventDefault();const group=players(form);submit(form,'guestmsg','guest.book',{eventId:id,players:group},()=>{queue(group.map(p=>p.card));detailEvent(id);notice('Personne inscrite.')},result=>inverseAdd('guest',result))};
}
function renderGuests(ev){
 table('guests',ev.mode==='libre'?ev.counts:ev.guests,ev.mode==='libre'?'count':'guest',g=>ev.mode==='libre'?`${g.kids} enfants + ${g.adults} adultes`:cardLabel(g.card)+(g.category?' · '+g.category:'')+(g.age?` · ${g.age} ${g.ageUnit||'ans'}`:'')+(g.companions?` · ${g.companions} accompagnateur(s)`:''),ev.mode==='libre'?null:moveGuest);
}
function moveGuest(item){
 const group=state.events.flatMap(e=>e.guests).filter(g=>g.group===item.group);
 modal('Déplacer des participants',`<form id="moveGuest"><label>Séance de destination<select name="eventId">${state.events.filter(e=>e.mode!=='libre').map(e=>`<option value="${esc(e.id)}" ${e.id===item.eventId?'selected':''}>${esc(labelDate(e.date)+' · '+e.time+' · '+e.title)}</option>`).join('')}</select></label>${select('Participants','scope',['Cette personne','Tout le groupe'],'Cette personne')}<p id="moveMsg" role="status"></p><button>Déplacer</button></form>`);
 $('moveGuest').onsubmit=e=>{e.preventDefault();const f=e.target.elements,selected=f.scope.value==='Tout le groupe'?group:[item];submit(e.target,'moveMsg','guest.move',{eventId:f.eventId.value,rows:rows(selected)},()=>detailEvent(f.eventId.value))};
}

// Administration partagée, avec contrôle de révision et protection des réservations.
function configList(post){$('editPost').innerHTML=opts(Object.keys(state.settings.stations),post)+'<option value="">Ajouter un poste</option>';readConfig()}
$('openAdmin').onclick=()=>{if(!admin())return;$('settings').hidden=!$('settings').hidden;$('users').hidden=true;configList(Object.keys(state.settings.stations)[0])};
$('editPost').onchange=readConfig;
function readConfig(){
 const form=$('config'),f=form.elements,key=$('editPost').value,p=state.settings.stations[key],cfg=state.settings;
 form.dataset.revision=state.settingsRevision;delete form.dataset.operation;f.postName.value=key;f.postName.readOnly=!!p;f.capacity.value=p?.capacity||1;
 f.weekday.value='default';f.weekday.disabled=!p;
 f.games.value=p?.games.join('\n')||'';f.slots.value=p?.slots.join('\n')||'';f.limit.value=cfg.limit??'';f.count.value=cfg.count||'oui';f.manageEvents.checked=!!cfg.manageEvents;f.enabled.checked=p?.enabled!==false;f.instruction.value=p?.instruction||'';
 f.exceptionDate.value='';f.exceptionClosed.checked=false;f.exceptionSlots.value='';f.exceptionGames.value='';f.closedDates.value=(cfg.closedDates||[]).join('\n');
 for(const k of ['edit','cancel','bulk','export'])f['permission-'+k].checked=cfg.permissions?.[k]??['edit','cancel'].includes(k);
 for(const k of ['catalogue','vsmart','selections'])f[k].value=cfg.links?.[k]||'';$('configMsg').textContent='';
 f.eventTypes.value=(cfg.eventTypes||[]).join('\n');f.askAge.checked=cfg.askAge!==false;
 f.weekday.onchange=()=>{const grid={...p,...p?.weekdays?.[f.weekday.value]};f.capacity.value=grid.capacity;f.games.value=grid.games.join('\n');f.slots.value=grid.slots.join('\n');f.enabled.checked=grid.enabled!==false;f.instruction.value=grid.instruction||''};
 f.exceptionDate.onchange=()=>{const ex=p?.exceptions?.[f.exceptionDate.value]||{};f.exceptionClosed.checked=ex.enabled===false;f.exceptionSlots.value=ex.slots?.join('\n')||'';f.exceptionGames.value=ex.games?.join('\n')||''};
}
const lines=text=>[...new Set(text.split('\n').map(x=>x.trim()).filter(Boolean))];
$('config').onsubmit=e=>{
 e.preventDefault();if(!admin())return;const f=e.target.elements,cfg=structuredClone(state.settings),key=f.postName.value.trim();
 if(['__proto__','constructor','prototype'].includes(key)){$('configMsg').textContent='Choisir un autre nom de poste.';return}
 let p={...cfg.stations[key],capacity:+f.capacity.value,games:lines(f.games.value),slots:lines(f.slots.value).map(s=>s.replace(/\s*[-–]\s*/g,'–')).sort(),enabled:f.enabled.checked,instruction:f.instruction.value.trim()};
 if(f.weekday.value!=='default'){const base=cfg.stations[key];p={...base,weekdays:{...base.weekdays,[f.weekday.value]:{capacity:p.capacity,games:p.games,slots:p.slots,enabled:p.enabled,instruction:p.instruction}}}}
 if(f.exceptionDate.value){p.exceptions={...p.exceptions};p.exceptions[f.exceptionDate.value]={enabled:!f.exceptionClosed.checked,...(f.exceptionSlots.value.trim()?{slots:lines(f.exceptionSlots.value).map(s=>s.replace(/\s*[-–]\s*/g,'–')).sort()}:{}),...(f.exceptionGames.value.trim()?{games:lines(f.exceptionGames.value)}:{})}}
 cfg.stations[key]=p;cfg.limit=f.limit.value===''?null:+f.limit.value;cfg.count=f.count.value;cfg.manageEvents=f.manageEvents.checked;cfg.closedDates=lines(f.closedDates.value);
 cfg.permissions=Object.fromEntries(['edit','cancel','bulk','export'].map(k=>[k,f['permission-'+k].checked]));cfg.links=Object.fromEntries(['catalogue','vsmart','selections'].map(k=>[k,f[k].value.trim()]));
 cfg.eventTypes=lines(f.eventTypes.value);cfg.askAge=f.askAge.checked;
 if(f.boxCode.value.trim())cfg.boxes={...cfg.boxes,[f.boxCode.value.trim()]:{title:f.boxTitle.value.trim(),sector:f.boxSector.value}};
 submit(e.target,'configMsg','config.save',{settings:cfg,revision:+e.target.dataset.revision},()=>{configList(key);notice('Réglages partagés enregistrés.');$('configMsg').textContent='Réglages appliqués à tous les postes.'});
};

$('manageRoles').onclick=async()=>{
 try{
  const accounts=await api.accounts();
  modal('Habilitations du guichet',`<form id="roles"><label>Compte attribué<select name="account">${accounts.map(a=>`<option value="${esc(a.id)}">${esc(a.email)} · ${esc(a.profil||'sans accès')}</option>`).join('')}</select></label>${select('Profil','profile',['agent','administrateur','sans accès'],'agent')}<p>Une révocation prend effet côté serveur sans attendre le renouvellement du jeton. Le dernier administrateur est protégé.</p><p id="roleMsg" role="status"></p><button>Appliquer</button></form>`);
  $('roles').onsubmit=e=>{e.preventDefault();const f=e.target.elements;if(!confirm('Appliquer cette habilitation au compte sélectionné ?'))return;submit(e.target,'roleMsg',()=>api.setRole(f.account.value,f.profile.value==='sans accès'?null:f.profile.value),null,()=>{$('modal').close();notice('Habilitation appliquée.')})};
 }catch(error){notice(error.message)}
};
$('mergeUser').onclick=()=>{
 const source=$('personForm').elements.card.value;
 modal('Remplacement de carte — aperçu',`<form id="merge"><p>Fiche source : ${esc(cardLabel(source))}. L’identité de la fiche cible est conservée. Aucun rapprochement automatique sur le nom.</p><label>Carte cible<select name="target">${Object.values(people).filter(p=>p.carte!==source).map(p=>`<option value="${esc(p.carte)}">${esc(cardLabel(p.carte))}</option>`).join('')}</select></label><div id="mergePreview"></div><p>L’ancienne carte sera désactivée. L’annulation est possible aujourd’hui tant que les fiches et les activités transférées n’ont pas été modifiées.</p><p id="mergeMsg" role="status"></p><button>Confirmer la fusion</button></form>`);
 const form=$('merge'),f=form.elements;
 function preview(){const sourceRows=[...state.boards,...state.videos,...state.events.flatMap(e=>e.guests)].filter(x=>x.card===source);const targetRows=[...state.boards,...state.videos,...state.events.flatMap(e=>e.guests)].filter(x=>x.card===f.target.value);$('mergePreview').textContent=`${sourceRows.length} activité(s) source à transférer ; ${targetRows.length} activité(s) déjà liées à la cible. `+sourceRows.map(x=>labelDate(x.date)+' · '+(x.post||x.box||'Animation')).join(' / ')}
 f.target.onchange=preview;preview();
 form.onsubmit=e=>{e.preventDefault();if(!f.target.value||!confirm($('mergePreview').textContent+' Fusionner ces deux fiches ?'))return;const operation=form.dataset.operation||crypto.randomUUID();form.dataset.operation=operation;
  submit(form,'mergeMsg',()=>api.merge(source,f.target.value,operation),null,async()=>{$('modal').close();await openPerson(f.target.value);$('undoMerge').hidden=false;$('undoMerge').dataset.operation=operation;$('undoMerge').dataset.source=source;$('undoMerge').dataset.target=f.target.value;notice('Fusion effectuée.');})};
};
$('undoMerge').onclick=async()=>{
 const b=$('undoMerge'),source=b.dataset.source;
 if(await submit($('personForm'),'personMsg',()=>api.merge(source,b.dataset.target,b.dataset.operation,true),null,()=>{b.hidden=true;notice('Fusion annulée.')}))await openPerson(source);
};

// Sélections, exports et collage avec aperçu puis transaction de tout le lot.
function selected(kind,list){const ids=[...document.querySelectorAll(`input[data-kind="${kind}"]:checked`)].map(x=>x.value);return list.filter(x=>ids.includes(x.id))}
async function exportRows(kind,list){
 if(!may('export'))return;const selection=selected(kind,list);if(!selection.length){notice('Sélectionner les lignes à exporter.');return}
 try{await api.command('export',{});const cols=['date','card','name','box','sector','kids','adults','post','slot','end','game','companions','age','ageUnit','category','title','time','info','eventType','referent','mode','cap'];
  const csv=[cols,...selection.map(x=>({...x,name:nameOf(x.card)})).map(x=>cols.map(k=>x[k]??''))].map(row=>row.map(v=>{let cell=String(v);if(/^[=+@-]/.test(cell))cell="'"+cell;return '"'+cell.replace(/"/g,'""')+'"'}).join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='guichet-'+kind+'-'+day()+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(error){notice(error.message)}
}
function pasteRows(kind,eventId){
 modal('Coller des lignes',`<form id="paste"><p>Colonnes séparées par des tabulations, sans en-tête : ${kind==='board'?'carte, boîte, enfants, adultes, date, secteur':kind==='video'?'carte, accompagnateurs, date, poste, heure de début, jeu':'carte, accompagnateurs, âge facultatif, unité (ans/mois)'}. Aucun historique passé n’est accepté.</p><label>Lignes à préparer<textarea name="text" rows="8" required></textarea></label><button type="button" id="previewPaste">Afficher l’aperçu</button><div id="pastePreview"></div><p id="pasteMsg" role="status"></p><button id="confirmPaste" hidden>Confirmer tout le lot</button></form>`);
 let commands=[];const form=$('paste');form.elements.text.oninput=()=>{$('confirmPaste').hidden=true;commands=[]};
 $('previewPaste').onclick=()=>{try{
  commands=form.elements.text.value.trim().split(/\r?\n/).filter(Boolean).map(line=>{const c=line.split('\t').map(s=>s.trim());return {action:kind==='board'?'board.save':kind==='video'?'video.book':'guest.book',data:kind==='board'?{card:c[0],box:c[1],kids:+c[2],adults:+c[3],date:c[4]||day(),sector:c[5]||$('sector').value}:kind==='video'?{date:c[2],post:c[3],slot:c[4],game:c[5],players:[{card:c[0],companions:+c[1]}]}:{eventId,players:[{card:c[0],companions:+c[1],age:c[2]||'',ageUnit:c[3]||'ans'}]}}});
  const pre=document.createElement('pre');pre.textContent=commands.map((x,i)=>{const d=x.data;return `${i+1}. ${d.card||d.players.map(p=>p.card+' ('+(1+p.companions)+' personne(s))').join(', ')} · ${d.date||'séance sélectionnée'} · ${d.box||d.post||'Animation'} · ${d.sector||d.slot||''} · ${d.game||''}`}).join('\n');pre.style.whiteSpace='pre-wrap';$('pastePreview').replaceChildren(pre);$('confirmPaste').hidden=false;
 }catch(error){$('pasteMsg').textContent='Vérifier les colonnes : '+error.message}};
 form.onsubmit=e=>{e.preventDefault();if(!commands.length)return;submit(form,'pasteMsg','batch',{commands},()=>{$('modal').close();notice('Lot enregistré en entier.');queue(commands.flatMap(c=>c.data.players?.map(p=>p.card)||[c.data.card]))},result=>({action:kind+'.remove',data:{rows:rows(result.flatMap(x=>x.ids).map(record).filter(Boolean))}}))};
}
for(const [suffix,kind,list] of [['soc','board',()=>state.boards],['vid','video',()=>state.videos]]){
 $('filter-'+suffix).oninput=e=>{tableFilters[kind]=e.target.value;render()};$('export-'+suffix).onclick=()=>exportRows(kind,list());$('paste-'+suffix).onclick=()=>pasteRows(kind);
}
function safeLink(url){try{const parsed=new URL(url);return ['https:','http:'].includes(parsed.protocol)?url:null}catch{return null}}
function renderLinks(){
 const header=document.querySelector('header');let links=$('serviceLinks');if(!links){links=document.createElement('div');links.id='serviceLinks';header.append(links)}links.replaceChildren();
 for(const [key,label] of [['vsmart','V-smart ↗'],['selections','Sélections du réseau ↗']]){const url=safeLink(state.settings.links?.[key]);if(url){const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=label;links.append(a)}}
 const catalogue=safeLink(state.settings.links?.catalogue);if(catalogue)header.querySelector('a').href=catalogue;
}
function render(){
 userList();renderBoards();table('videos',state.videos,'video',x=>`${labelDate(x.date)} · ${x.slot}–${x.end} · ${x.post} · ${cardLabel(x.card)} · ${x.game} · ${1+x.companions} personne(s)`,editVideo);
 calendar();renderTrash();renderPending();search();renderLinks();$('openAdmin').hidden=!admin();
 table('eventsTable',state.events,'event',e=>`${labelDate(e.date)} · ${e.time} · ${e.title} · ${e.info||''} · ${occupied(e)} place(s)`,may('events')?editEvent:null);
 $('export-ani').hidden=!may('export');
 $('bulkBoard').hidden=!may('bulk');$('bulkVideo').hidden=!may('edit');$('mergeUser').hidden=!admin()||!$('personForm').elements.card.readOnly;
 $('totals').textContent=state.totals.map(t=>`${labelDate(t.jour)} · ${t.activite} ${t.secteur} : ${t.passages} passage(s), ${t.personnes} personnes`).join(' | ')||'Aucun jour clôturé.';
 for(const suffix of ['soc','vid']){$('export-'+suffix).hidden=!may('export');$('paste-'+suffix).hidden=!may('bulk')}
 if($('modal').open&&$('guests')&&selectedEvent){const ev=state.events.find(x=>x.id===selectedEvent);if(ev){renderGuests(ev);$('eventPlaces').textContent=`${occupied(ev)}${ev.cap?' / '+ev.cap:''} place(s)`}}
}
$('filter-ani').oninput=e=>{tableFilters.event=e.target.value;render()};
$('export-ani').onclick=()=>exportRows('event',state.events);

$('bulkVideo').onclick=()=>{const items=selected('video',state.videos);if(!items.length){notice('Sélectionner des inscriptions.');return}videoForm(items)};
$('bulkBoard').onclick=()=>{
 const items=selected('board',state.boards);if(!items.length){notice('Sélectionner des consultations.');return}
 modal('Corriger la sélection',`<form id="bulk"><p>${items.length} consultation(s). Les champs vides conservent la valeur actuelle.</p><div class="fields">${field('Nouvelle date','date','','date',`min="${day()}"`)}${select('Nouveau secteur','sector',['','Jeunesse','Pop Zone'],'')}${field('Enfants','kids','','number','min="0"')}${field('Adultes','adults','','number','min="0"')}</div><p id="bulkMsg" role="status"></p><button>Confirmer tout le lot</button></form>`);
 $('bulk').onsubmit=e=>{e.preventDefault();const f=e.target.elements;const commands=items.map(x=>({action:'board.save',data:{...x,...Object.fromEntries(['date','sector','kids','adults'].filter(k=>f[k].value!=='').map(k=>[k,['kids','adults'].includes(k)?+f[k].value:f[k].value]))}}));if(!confirm('Confirmer la correction de '+items.length+' consultation(s) ?'))return;
  submit(e.target,'bulkMsg','batch',{commands},()=>{$('modal').close();notice('Sélection corrigée en entier.')},()=>({action:'batch',data:{commands:items.map(x=>({action:'board.save',data:{...x,revision:record(x.id)?.revision||x.revision+1}}))}}));
 };
};
function removeSeries(ev){
 modal('Supprimer une séance ou une série',`<form id="removeSeries">${select('Portée','scope',['one','following','all'],'one')}<p id="removePreview"></p><p id="removeMsg" role="status"></p><button>Mettre à la corbeille</button></form>`);
 const form=$('removeSeries');let affected=[];
 function preview(){const scope=form.elements.scope.value;affected=state.events.filter(x=>x.id===ev.id||ev.group&&x.group===ev.group&&(scope==='all'||scope==='following'&&x.date>=ev.date));$('removePreview').textContent=affected.length+' séance(s) et '+affected.reduce((n,e)=>n+e.guests.length,0)+' inscription(s) concernées.'}
 form.elements.scope.onchange=preview;preview();
 form.onsubmit=e=>{e.preventDefault();if(!confirm($('removePreview').textContent+' Continuer ?'))return;submit(form,'removeMsg','event.remove',{rows:rows(affected)},result=>{$('modal').close();notice('Séances placées dans la corbeille.')},result=>({action:'event.restore',data:{rows:rows(result.ids.map(record))}}))};
}
api.enableLogin();
