let REFERENTIEL=[];
const app=document.querySelector('#application');
const dialogue=document.querySelector('#dialogueAudit');
const formulaire=document.querySelector('#formulaireAudit');
const actionsEntete=document.querySelector('#actionsEntete');
let donnees={audits:[]};
let vue={auditId:null,indicateur:1,filtre:'tous',recherche:''};

function charger(){
  try{
    const d=JSON.parse(localStorage.getItem('entreDeuxQualiopi'))||{audits:[]};
    d.audits=(d.audits||[]).map(normaliserAudit);
    return d;
  }catch{return{audits:[]}}
}
function normaliserAudit(a){
  a.responsable=a.responsable||'';
  a.statutAudit=a.statutAudit||'preparation';
  a.reviseLe=a.reviseLe||null;
  a.indicateurs=a.indicateurs||creerEtat();
  Object.values(a.indicateurs).forEach(i=>{delete i.responsable;delete i.dateRevision;i.notes=i.notes||'';i.fichiers=i.fichiers||[];i.etat=i.etat||'non_commence'});
  return a;
}
function sauver(){localStorage.setItem('entreDeuxQualiopi',JSON.stringify(donnees))}
function notifier(message){const t=document.querySelector('#toast');t.textContent=message;t.classList.add('visible');clearTimeout(t._d);t._d=setTimeout(()=>t.classList.remove('visible'),2200)}
function creerEtat(){const r={};REFERENTIEL.flatMap(c=>c.indicateurs).forEach(i=>r[i.n]={etat:'non_commence',notes:'',fichiers:[]});return r}
function auditActif(){return donnees.audits.find(a=>a.id===vue.auditId)}
function progression(a){const total=32,faits=Object.values(a.indicateurs).filter(i=>i.etat==='termine').length;return{faits,total,pct:Math.round(faits/total*100),complet:faits===total}}
function formatDate(d){if(!d)return'Non renseignée';return new Date(d+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})}
function taille(n){if(n<1024)return n+' o';if(n<1048576)return(n/1024).toFixed(1)+' Ko';return(n/1048576).toFixed(1)+' Mo'}
function echapper(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function libelleStatutAudit(a){return a.statutAudit==='termine'?'Audit terminé':a.statutAudit==='revision'?'À réviser':'En préparation'}

function slugifier(texte='audit'){
  return texte.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'audit';
}
function urlAudit(a, indicateur=1){return `#/audit/${a.id}/${slugifier(a.nom)}/indicateur/${indicateur}`}
function allerAccueil(remplacer=false){const action=remplacer?'replaceState':'pushState';history[action](null,'',location.pathname+location.search+'#/');afficherAccueil(false)}
function allerAudit(a, indicateur=1, remplacer=false){vue.auditId=a.id;vue.indicateur=indicateur;vue.filtre='tous';vue.recherche='';const action=remplacer?'replaceState':'pushState';history[action](null,'',location.pathname+location.search+urlAudit(a,indicateur));afficherAudit(false)}
function lireRoute(){
  const m=location.hash.match(/^#\/audit\/([^/]+)(?:\/[^/]+)?(?:\/indicateur\/(\d+))?/);
  if(m){const a=donnees.audits.find(x=>x.id===m[1]);if(a){vue.auditId=a.id;vue.indicateur=Math.min(32,Math.max(1,Number(m[2]||1)));afficherAudit(false);return}}
  afficherAccueil(false);
}

function configurerEnteteAccueil(){actionsEntete.innerHTML='<button class="bouton principal" id="nouvelAudit">Créer un audit</button>';document.querySelector('#nouvelAudit').onclick=ouvrirCreation}
function configurerEnteteAudit(){actionsEntete.innerHTML='<button class="bouton secondaire" id="accueilAudits">Accueil des audits</button><button class="bouton principal" id="parametresAudit">Paramètres</button>';document.querySelector('#accueilAudits').onclick=()=>allerAccueil();document.querySelector('#parametresAudit').onclick=ouvrirModification}
function ouvrirCreation(){formulaire.reset();formulaire.elements.auditId.value='';document.querySelector('#libelleDialogue').textContent='NOUVEL AUDIT';document.querySelector('#titreDialogue').textContent='Créer un audit';document.querySelector('#enregistrerAudit').textContent='Créer l’audit';dialogue.showModal()}
function ouvrirModification(){const a=auditActif();if(!a)return;formulaire.elements.auditId.value=a.id;formulaire.elements.nom.value=a.nom;formulaire.elements.date.value=a.date||'';formulaire.elements.type.value=a.type;formulaire.elements.responsable.value=a.responsable||'';document.querySelector('#libelleDialogue').textContent='PARAMÈTRES';document.querySelector('#titreDialogue').textContent='Modifier l’audit';document.querySelector('#enregistrerAudit').textContent='Enregistrer';dialogue.showModal()}

function afficherAccueil(synchroniser=true){
  vue.auditId=null;if(synchroniser && location.hash!=='#/')history.replaceState(null,'',location.pathname+location.search+'#/');configurerEnteteAccueil();
  const lignes=donnees.audits.map(a=>{const p=progression(a);return`<article class="ligne-audit" data-audit="${a.id}"><h2>${echapper(a.nom)}</h2><p>${formatDate(a.date)}</p><p>${p.pct}% — ${p.faits}/32 indicateurs</p><p>${echapper(a.type)}</p></article>`}).join('');
  app.innerHTML=`<section class="page"><div class="hero"><div class="hero-gauche"><p class="sur-titre">Suivi de qualité</p></div><div class="hero-droite"><h1>Préparation des audits Qualiopi</h1><p>Centralisez les preuves, suivez l’avancement des 32 indicateurs et gardez une trace claire pour chaque audit de Formation Entre-Deux.</p></div></div><section class="liste-audits"><div class="entete-tableau"><span>Audit</span><span>Date</span><span>Progression</span><span>Type d’audit</span></div>${lignes||`<div class="vide"><h2>Aucun audit pour le moment</h2><p>Créez votre premier audit pour commencer à rassembler les preuves.</p><button class="bouton principal" id="premierAudit">Créer un audit</button></div>`}</section></section>`;
  document.querySelectorAll('[data-audit]').forEach(el=>el.onclick=()=>{const a=donnees.audits.find(x=>x.id===el.dataset.audit);if(a)allerAudit(a)});
  document.querySelector('#premierAudit')?.addEventListener('click',ouvrirCreation)
}

function trouverIndicateur(n){for(const c of REFERENTIEL){const i=c.indicateurs.find(x=>x.n===n);if(i)return{...i,critere:c.critere,titreCritere:c.titre}}}
function indicateursFiltres(a){return REFERENTIEL.map(c=>({...c,indicateurs:c.indicateurs.filter(i=>{const e=a.indicateurs[i.n];const okEtat=vue.filtre==='tous'||e.etat===vue.filtre;const q=vue.recherche.toLowerCase();const okQ=!q||(`${i.n} ${i.texte} ${i.attendu} ${c.titre}`).toLowerCase().includes(q);return okEtat&&okQ})})).filter(c=>c.indicateurs.length)}
function afficherAudit(synchroniser=true){
  const a=auditActif();if(!a)return allerAccueil(true);if(synchroniser && location.hash!==urlAudit(a,vue.indicateur))history.replaceState(null,'',location.pathname+location.search+urlAudit(a,vue.indicateur));configurerEnteteAudit();
  const p=progression(a),info=trouverIndicateur(vue.indicateur),etat=a.indicateurs[vue.indicateur];
  const nav=indicateursFiltres(a).map(c=>`<div class="critere-nav">Critère ${c.critere} — ${c.titre}</div>${c.indicateurs.map(i=>`<div class="indicateur-nav ${i.n===vue.indicateur?'actif':''}" data-indicateur="${i.n}"><span class="pastille ${a.indicateurs[i.n].etat==='en_cours'?'encours':a.indicateurs[i.n].etat==='termine'?'termine':''}"></span><span><strong>${i.n}.</strong> ${i.texte.slice(0,70)}…</span></div>`).join('')}`).join('')||'<p class="meta">Aucun indicateur ne correspond.</p>';
  const revision=p.complet?`<section class="revision ${a.statutAudit==='termine'?'terminee':''}"><h3>Révision finale de l’audit</h3>${a.statutAudit==='termine'?`<p><strong>Audit révisé et terminé</strong>${a.reviseLe?` le ${new Date(a.reviseLe).toLocaleDateString('fr-FR')}`:''} par ${echapper(a.responsable||'le responsable')}.</p>`:`<p>Les 32 indicateurs sont terminés. <strong>${echapper(a.responsable||'Le responsable')}</strong> doit maintenant vérifier l’ensemble de l’audit avant de le considérer comme terminé.</p><button class="bouton principal" id="terminerAudit">Confirmer la révision et terminer l’audit</button>`}</section>`:'';
  app.innerHTML=`<section class="audit-page"><aside class="barre-laterale"><div class="audit-titre"><p class="sur-titre">${echapper(a.type)}</p><h1>${echapper(a.nom)}</h1><p>${formatDate(a.date)}</p><p class="responsable-audit">Responsable : ${echapper(a.responsable||'Non renseigné')}</p></div><div class="resume"><strong>${p.faits}/32 indicateurs terminés</strong><div class="progression"><span style="width:${p.pct}%"></span></div><small>${p.pct}% · ${libelleStatutAudit(a)}</small></div><div class="outils"><input class="champ-recherche" id="recherche" value="${echapper(vue.recherche)}" placeholder="Rechercher un indicateur"><div class="filtre"><button data-filtre="tous" class="${vue.filtre==='tous'?'actif':''}">Tous</button><button data-filtre="non_commence" class="${vue.filtre==='non_commence'?'actif':''}">À faire</button><button data-filtre="en_cours" class="${vue.filtre==='en_cours'?'actif':''}">En cours</button><button data-filtre="termine" class="${vue.filtre==='termine'?'actif':''}">Terminés</button></div></div><nav class="navigation-indicateurs">${nav}</nav><div class="outils-audit"><button class="bouton secondaire petit" id="modifierAudit">Modifier les paramètres</button><button class="bouton secondaire petit" id="dupliquerAudit">Dupliquer cet audit</button><button class="bouton danger petit" id="supprimerAudit">Supprimer cet audit</button></div></aside><article class="contenu-audit"><button class="retour-inline" id="retourListe">← Retour à l’accueil des audits</button><div class="en-tete-indicateur"><div><p class="sur-titre">Critère ${info.critere} — ${info.titreCritere}</p><h2>Indicateur ${info.n}</h2></div><div class="statut-indicateur"><label>Statut<select id="etatIndicateur"><option value="non_commence" ${etat.etat==='non_commence'?'selected':''}>À faire</option><option value="en_cours" ${etat.etat==='en_cours'?'selected':''}>En cours</option><option value="termine" ${etat.etat==='termine'?'selected':''}>Terminé</option></select></label></div></div><p class="texte-officiel">${info.texte}</p><section class="bloc"><h3>Ce que nous devons démontrer</h3><p>${info.attendu}</p></section><section class="bloc"><h3>Exemples de preuves à fournir</h3><div class="preuves">${info.preuves.map(x=>`<span class="preuve-exemple">${x}</span>`).join('')}</div></section><section class="bloc"><label>Notes internes<textarea id="notes" placeholder="Décisions, éléments manquants, points à vérifier…">${echapper(etat.notes)}</textarea></label></section><section class="bloc"><h3>Pièces justificatives</h3><div class="depot"><p><strong>Ajouter une ou plusieurs preuves</strong><br><span class="meta">PDF, images, documents ou feuilles de calcul</span></p><label class="bouton principal petit">Choisir des fichiers<input id="ajoutFichiers" type="file" multiple hidden></label></div><div class="liste-fichiers">${etat.fichiers.length?etat.fichiers.map((f,index)=>`<div class="fichier"><div class="fichier-nom"><strong>${echapper(f.nom)}</strong><small>${taille(f.taille)} · ajouté le ${new Date(f.date).toLocaleDateString('fr-FR')}</small></div><div><button class="bouton secondaire petit" data-telecharger="${index}">Ouvrir</button> <button class="icone-bouton" data-supprimer-fichier="${index}" title="Supprimer">×</button></div></div>`).join(''):'<p class="meta">Aucune preuve ajoutée pour cet indicateur.</p>'}</div></section>${revision}<div class="actions-bas">${vue.indicateur>1?'<button class="bouton secondaire" id="precedent">← Indicateur précédent</button>':'<span></span>'}<span class="espace"></span>${vue.indicateur<32?'<button class="bouton principal" id="suivant">Indicateur suivant →</button>':'<span></span>'}</div></article></section>`;
  brancherAudit(a,etat)
}

function brancherAudit(a,etat){
  document.querySelector('#retourListe').onclick=()=>allerAccueil();
  document.querySelector('#modifierAudit').onclick=ouvrirModification;
  document.querySelectorAll('[data-indicateur]').forEach(x=>x.onclick=()=>allerAudit(a,Number(x.dataset.indicateur)));
  document.querySelectorAll('[data-filtre]').forEach(x=>x.onclick=()=>{vue.filtre=x.dataset.filtre;afficherAudit()});
  document.querySelector('#recherche').oninput=e=>{vue.recherche=e.target.value;afficherAudit()};
  document.querySelector('#etatIndicateur').onchange=e=>{etat.etat=e.target.value;a.statutAudit='preparation';a.reviseLe=null;a.modifie=Date.now();sauver();afficherAudit();notifier('Statut mis à jour')};
  document.querySelector('#notes').onchange=e=>{etat.notes=e.target.value;a.modifie=Date.now();sauver();notifier('Notes enregistrées')};
  document.querySelector('#ajoutFichiers').onchange=async e=>{for(const f of e.target.files){const contenu=await lireFichier(f);etat.fichiers.push({nom:f.name,type:f.type,taille:f.size,date:Date.now(),contenu})}a.modifie=Date.now();sauver();afficherAudit();notifier('Preuve ajoutée')};
  document.querySelectorAll('[data-telecharger]').forEach(x=>x.onclick=()=>{const f=etat.fichiers[Number(x.dataset.telecharger)];const l=document.createElement('a');l.href=f.contenu;l.download=f.nom;l.click()});
  document.querySelectorAll('[data-supprimer-fichier]').forEach(x=>x.onclick=()=>{if(confirm('Supprimer cette preuve ?')){etat.fichiers.splice(Number(x.dataset.supprimerFichier),1);a.modifie=Date.now();sauver();afficherAudit()}});
  document.querySelector('#precedent')?.addEventListener('click',()=>allerAudit(a,vue.indicateur-1));
  document.querySelector('#suivant')?.addEventListener('click',()=>allerAudit(a,vue.indicateur+1));
  document.querySelector('#terminerAudit')?.addEventListener('click',()=>{if(confirm(`Confirmer que ${a.responsable||'le responsable'} a révisé les 32 indicateurs et que l’audit peut être considéré comme terminé ?`)){a.statutAudit='termine';a.reviseLe=Date.now();a.modifie=Date.now();sauver();afficherAudit();notifier('Audit terminé')}});
  document.querySelector('#dupliquerAudit').onclick=()=>{const copie=structuredClone(a);copie.id=crypto.randomUUID();copie.nom=a.nom+' — copie';copie.statutAudit='preparation';copie.reviseLe=null;copie.modifie=Date.now();donnees.audits.unshift(copie);sauver();allerAudit(copie);notifier('Audit dupliqué')};
  document.querySelector('#supprimerAudit').onclick=()=>{if(confirm('Supprimer définitivement cet audit et toutes ses preuves ?')){donnees.audits=donnees.audits.filter(x=>x.id!==a.id);sauver();allerAccueil();notifier('Audit supprimé')}}
}
function lireFichier(f){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f)})}

formulaire.addEventListener('submit',e=>{
  e.preventDefault();if(e.submitter?.value!=='enregistrer')return dialogue.close();
  const fd=new FormData(formulaire),id=fd.get('auditId');
  if(id){const a=donnees.audits.find(x=>x.id===id);if(a){a.nom=fd.get('nom');a.date=fd.get('date');a.type=fd.get('type');a.responsable=fd.get('responsable');a.modifie=Date.now();sauver();dialogue.close();afficherAudit();notifier('Paramètres enregistrés')}}
  else{const a={id:crypto.randomUUID(),nom:fd.get('nom'),date:fd.get('date'),type:fd.get('type'),responsable:fd.get('responsable'),statutAudit:'preparation',reviseLe:null,cree:Date.now(),modifie:Date.now(),indicateurs:creerEtat()};donnees.audits.unshift(a);sauver();dialogue.close();allerAudit(a);notifier('Audit créé')}
});
document.querySelector('#retourAccueil').onclick=()=>allerAccueil();
window.addEventListener('popstate',lireRoute);
window.addEventListener('hashchange',lireRoute);

async function initialiser(){
  try{const r=await fetch('./data/qualiopi.json',{cache:'no-store'});if(!r.ok)throw new Error('Référentiel indisponible');REFERENTIEL=await r.json();}
  catch(e){app.innerHTML='<section class=\"erreur-chargement\"><h1>Impossible de charger le référentiel Qualiopi</h1><p>Rechargez la page ou vérifiez que le dossier <strong>data</strong> a bien été déposé sur GitHub.</p></section>';console.error(e);return}
  donnees=charger();lireRoute();
}
initialiser();
