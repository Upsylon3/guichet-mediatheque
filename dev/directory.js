'use strict';
// Chargé uniquement par l'entrée locale /dev.html. Aucun SDK distant.
globalThis.guichetDirectory = (() => {
 let base='';
 let token='',apiKey='';
 const directory={profile:'',onReady:null};
 async function request(path,{method='GET',body,prefer}={}){
  const response=await fetch(base+path,{
   method,headers:{apikey:apiKey,...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},
   ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(8000)
  });
  const data=await response.text();
  if(!response.ok){
   if(response.status===401){
    document.getElementById('login').hidden=false;
    throw new Error('Session expirée. Reconnectez-vous en haut de page ; votre saisie reste affichée.');
   }
   if(response.status===403)throw new Error('Action refusée par le serveur.');
   if(response.status===409)throw new Error('Cette carte existe déjà. Ouvrez sa fiche dans l’annuaire.');
   throw new Error('Le serveur a refusé la saisie ('+response.status+').');
  }
  return data?JSON.parse(data):null;
 }
 const path=card=>'/rest/v1/usagers?carte=eq.'+encodeURIComponent(card);
 directory.list=async()=>{
  const result=[];
  for(let offset=0;;offset+=500){
   const page=await request('/rest/v1/usagers?select=carte,prenom,nom,date_naissance&order=carte&limit=500&offset='+offset);
   result.push(...page);if(page.length<500)return result;
  }
 };
 directory.get=async card=>{
  const rows=await request(path(card)+'&select=carte,prenom,nom,date_naissance,note_interne');
  if(rows.length!==1)throw new Error('Fiche absente ou supprimée.');
  return rows[0];
 };
 directory.ensure=async card=>{
  // La clé primaire arbitre les scans concurrents, sans écraser les identités.
  await request('/rest/v1/usagers?on_conflict=carte',{method:'POST',body:{carte:card},prefer:'resolution=ignore-duplicates,return=minimal'});
  // Pas de note dans les formulaires de passage ni dans le cache de l'annuaire.
  const rows=await request(path(card)+'&select=carte,prenom,nom,date_naissance');
  if(rows.length!==1)throw new Error('Fiche non confirmée. Réessayez.');
  return rows[0];
 };
 directory.save=async(card,person,create=false)=>{
  const rows=await request(create?'/rest/v1/usagers?select=carte':path(card)+'&select=carte',{
   method:create?'POST':'PATCH',body:create?{carte:card,...person}:person,prefer:'return=representation'
  });
  if(rows.length!==1)throw new Error('Fiche non enregistrée, elle a peut-être été supprimée.');
 };
 directory.remove=numero=>request('/rest/v1/rpc/supprimer_usager',{method:'POST',body:{numero}});
 document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('login').onsubmit=async event=>{
   event.preventDefault();const form=event.target,f=form.elements,msg=document.getElementById('loginMsg');
   f.submit.disabled=true;
   try{
    const config=await fetch('/dev/config').then(r=>{if(!r.ok)throw new Error('Configuration locale absente.');return r.json()});
    apiKey=config.anonKey;base=config.url;token='';
    const session=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email:f.email.value.trim(),password:f.password.value}});
    token=session.access_token;
    directory.profile=await request('/rest/v1/rpc/mon_profil',{method:'POST',body:{}});
    if(!['agent','administrateur'].includes(directory.profile))throw new Error('Compte sans habilitation.');
    await directory.onReady();
    for(const message of document.querySelectorAll('#personMsg,#notice,#vfmsg,#guestmsg')){
     if(message.textContent.includes('Session expirée'))message.textContent='Session rétablie. Saisie conservée, à enregistrer.';
    }
    f.password.value='';form.hidden=true;document.querySelector('main').hidden=false;
    document.getElementById('sessionProfile').textContent='Session : '+directory.profile+' · recharger la page pour se déconnecter';
    document.getElementById('sessionProfile').hidden=false;
   }catch(error){token='';directory.profile='';msg.textContent='Connexion impossible. '+error.message}
   finally{f.submit.disabled=false}
  };
 });
 return directory;
})();
