// ── La liste de courses ───────────────────────────────────────────────────
// Ce qu'on éprouve : qu'un article ne se dédouble jamais (c'est ainsi qu'on
// repart avec trois paquets de pâtes), que les propositions hebdomadaires
// s'éteignent une fois prises, que le quotidien s'ajoute et se retire du même
// geste, et que vider les cochés reste rattrapable.
const {chromium}=require('playwright');
const NAVIGATEUR=process.env.PW_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE=process.env.BASE||'http://127.0.0.1:8899/index.html';
const R=[];const chk=(n,ok,d='')=>R.push([n,ok,d]);

(async()=>{
const b=await chromium.launch({executablePath:NAVIGATEUR});
const ctx=await b.newContext({viewport:{width:430,height:930},locale:'fr-FR'});
const p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push(String(e).split('\n')[0]));
await p.goto(BASE,{waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>typeof ajoute==='function');

console.log('=== 1. LE FONDS DE DÉPART ===');
const dep=await p.evaluate(()=>({rec:recurrents.length,recettes:recettes.length,
  hebdo:recurrents.filter(r=>r.cadence==='hebdo').length,
  quot:recurrents.filter(r=>r.cadence==='quotidien').length,courses:courses.length}));
chk('Le répertoire est semé au premier lancement',dep.recettes>=15,JSON.stringify(dep));
chk('Les récurrents aussi, dans les deux cadences',dep.hebdo>5&&dep.quot>5,JSON.stringify(dep));
chk('Mais la liste de courses, elle, est vide',dep.courses===0,String(dep.courses));

// On recharge : la semence ne doit pas repasser, sinon tout se dédoublerait.
await p.reload({waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>typeof ajoute==='function');
const apres=await p.evaluate(()=>({rec:recurrents.length,recettes:recettes.length}));
chk('Un rechargement ne resème pas',apres.rec===dep.rec&&apres.recettes===dep.recettes,JSON.stringify(apres));

console.log('=== 2. UN ARTICLE, UNE SEULE LIGNE ===');
const dbl=await p.evaluate(()=>{
  courses=[];
  ajoute('Tomates',null,'libre');
  ajoute('  tomates ',null,'libre');     // casse et espaces : le même article
  ajoute('TOMATES',null,'libre');
  return {n:courses.length,qte:courses[0].qte,nom:courses[0].nom};
});
chk('Trois ajouts du même article ne font qu\'une ligne',dbl.n===1,JSON.stringify(dbl));
chk('…dont la quantité monte à 3',dbl.qte===3,String(dbl.qte));
chk('…et qui garde le libellé d\'origine',dbl.nom==='Tomates',dbl.nom);

const rep=await p.evaluate(()=>{
  courses=[]; ajoute('Lait',null,'libre'); courses[0].coche=true; courses[0].qte=4;
  const r=ajoute('lait',null,'libre');
  return {n:courses.length,coche:courses[0].coche,qte:courses[0].qte,etat:r.etat};
});
chk('Ré-ajouter un article coché le remet à prendre',
    rep.n===1&&rep.coche===false&&rep.etat==='repris',JSON.stringify(rep));
chk('…avec une quantité repartie à 1',rep.qte===1,String(rep.qte));

console.log('=== 3. LE RAYON SE DEVINE ===');
const ray=await p.evaluate(()=>{
  courses=[];
  ajoute('Poulet',null,'libre');                 // connu des récurrents
  ajoute('Mozzarella',null,'libre');             // connu d'une recette seulement
  ajoute('Machin truc',null,'libre');            // inconnu
  ajoute('Chose',  'boisson','libre');           // rayon imposé à la main
  return courses.map(i=>[i.nom,i.rayon]);
});
chk('Un récurrent apporte son rayon',ray[0][1]==='viande',JSON.stringify(ray[0]));
chk('Un ingrédient de recette aussi',ray[1][1]==='frais',JSON.stringify(ray[1]));
chk('Un inconnu tombe dans « Autre »',ray[2][1]==='autre',JSON.stringify(ray[2]));
chk('Un rayon choisi à la main est respecté',ray[3][1]==='boisson',JSON.stringify(ray[3]));

console.log('=== 4. LA SAISIE, PAR L\'INTERFACE ===');
await p.evaluate(()=>{ courses=[]; sauveCourses(); rendCourses(); });
await p.fill('#chAjout','Gingembre');
await p.press('#chAjout','Enter');
const saisie=await p.evaluate(()=>({n:courses.length,champ:document.getElementById('chAjout').value,
                                    lignes:document.querySelectorAll('#listeCourses .item').length}));
chk('Entrée ajoute l\'article et vide le champ',
    saisie.n===1&&saisie.champ==='',JSON.stringify(saisie));
chk('…et la ligne apparaît dans la liste',saisie.lignes===1,String(saisie.lignes));

// Cocher par le bouton, puis la quantité, puis la suppression.
await p.click('#listeCourses .case');
chk('Un appui sur la case coche',await p.evaluate(()=>courses[0].coche===true));
await p.click('#listeCourses [data-act=plus]');
chk('Le + monte la quantité',await p.evaluate(()=>courses[0].qte===2));
await p.click('#listeCourses [data-act=moins]');
await p.click('#listeCourses [data-act=moins]');
chk('Descendre sous 1 retire la ligne',await p.evaluate(()=>courses.length===0));

console.log('=== 5. LES PROPOSITIONS HEBDOMADAIRES ===');
const heb=await p.evaluate(()=>{
  courses=[];
  recurrents.filter(r=>r.cadence==='hebdo').forEach(r=>r.dernier=null);  // jamais pris
  rendCourses();
  const dus=document.querySelectorAll('#puceHebdo .puce.due').length;
  document.getElementById('btnToutHebdo').click();
  const apres={liste:courses.length,dus:document.querySelectorAll('#puceHebdo .puce.due').length,
               cpt:document.getElementById('cptHebdo').textContent.trim(),
               bouton:document.getElementById('btnToutHebdo').disabled};
  return {dus,apres,dates:recurrents.filter(r=>r.cadence==='hebdo').every(r=>r.dernier===jour())};
});
chk('Jamais pris = proposé',heb.dus>5,String(heb.dus));
chk('« Tout prendre » verse tous les dus dans la liste',heb.apres.liste===heb.dus,JSON.stringify(heb.apres));
chk('…et il n\'en reste plus aucun de dû',heb.apres.dus===0&&heb.apres.bouton===true,JSON.stringify(heb.apres));
chk('…parce que chacun est daté d\'aujourd\'hui',heb.dates===true);
chk('Le compteur le dit',heb.apres.cpt==='à jour',heb.apres.cpt);

const vieux=await p.evaluate(()=>{
  const r=recurrents.find(x=>x.cadence==='hebdo');
  courses=[];
  const il_y_a=n=>{const d=new Date();d.setDate(d.getDate()-n);return jour(d);};
  r.dernier=il_y_a(5); const a5=estDu(r);
  r.dernier=il_y_a(6); const a6=estDu(r);
  rendCourses();
  return {a5,a6};
});
chk('Pris il y a cinq jours : pas encore proposé',vieux.a5===false);
chk('Six jours : de nouveau proposé',vieux.a6===true);

console.log('=== 5bis. LES PROPOSITIONS SONT RANGÉES PAR RAYON ===');
const rang=await p.evaluate(()=>{
  courses=[]; sauveCourses(); rendCourses();
  const lis=bloc=>[...document.querySelectorAll('#'+bloc+' .grp')].map(g=>({
    rayon:g.dataset.rayon,
    titre:g.querySelector('.rayon-tit').textContent.trim().split('\n')[0].trim(),
    puces:[...g.querySelectorAll('.puce')].map(b=>recurrents.find(r=>r.id===b.dataset.rec))
  }));
  const h=lis('puceHebdo'), q=lis('puceQuot');
  const ordre=RAYONS.map(([k])=>k);
  const trie=g=>g.map(x=>ordre.indexOf(x.rayon)).every((v,i,a)=>i===0||a[i-1]<v);
  return {
    hGroupes:h.length, qGroupes:q.length,
    hPur:h.every(g=>g.puces.every(r=>r.rayon===g.rayon)),
    qPur:q.every(g=>g.puces.every(r=>r.rayon===g.rayon)),
    hVide:h.some(g=>!g.puces.length), qVide:q.some(g=>!g.puces.length),
    hOrdre:trie(h), qOrdre:trie(q),
    titres:h.map(g=>g.titre),
    total:h.reduce((n,g)=>n+g.puces.length,0),
    attendu:recurrents.filter(r=>r.cadence==='hebdo').length,
    cadences:q.every(g=>g.puces.every(r=>r.cadence==='quotidien'))
  };
});
chk('Les deux blocs sont découpés en groupes',rang.hGroupes>1&&rang.qGroupes>1,JSON.stringify(rang));
chk('Chaque groupe ne contient que son rayon',rang.hPur&&rang.qPur,JSON.stringify(rang));
chk('Aucun groupe vide n\'est affiché',!rang.hVide&&!rang.qVide,JSON.stringify(rang));
chk('Les rayons se suivent dans l\'ordre du magasin',rang.hOrdre&&rang.qOrdre,JSON.stringify(rang.titres));
chk('Aucun article ne se perd au découpage',rang.total===rang.attendu,JSON.stringify(rang));
chk('Les deux cadences ne se mélangent pas',rang.cadences===true);

// Dans un rayon, ce qui est dû remonte au-dessus de ce qui ne l'est pas.
const dedans=await p.evaluate(()=>{
  const ilya=n=>{const d=new Date();d.setDate(d.getDate()-n);return jour(d);};
  const g=recurrents.filter(r=>r.cadence==='hebdo'&&rayonOk(r.rayon)==='legumes');
  g.forEach((r,i)=>r.dernier=i%2?null:jour());     // un sur deux est dû
  rendCourses();
  const col=document.querySelector('#puceHebdo .grp[data-rayon=legumes]');
  const etats=[...col.querySelectorAll('.puce')].map(b=>b.classList.contains('due'));
  return {etats,n:g.length};
});
chk('Dans un rayon, les dus sont en tête',
    dedans.etats.slice().sort((a,b)=>b-a).join()===dedans.etats.join(),JSON.stringify(dedans));

// Le délai n'a de sens que pour l'hebdo : le quotidien n'a pas de calendrier.
const delais=await p.evaluate(()=>({
  hebdo:document.querySelectorAll('#puceHebdo .puce .jrs').length,
  quot:document.querySelectorAll('#puceQuot .puce .jrs').length,
  puces:document.querySelectorAll('#puceHebdo .puce').length}));
chk('L\'hebdo affiche son délai, le quotidien non',
    delais.hebdo===delais.puces&&delais.quot===0,JSON.stringify(delais));

console.log('=== 6. LE QUOTIDIEN, UN APPUI DANS CHAQUE SENS ===');
await p.evaluate(()=>{ courses=[]; sauveCourses(); rendCourses(); });
await p.click('#puceQuot .puce');
const q1=await p.evaluate(()=>({n:courses.length,src:courses[0]&&courses[0].src,nom:courses[0]&&courses[0].nom}));
chk('Un appui sur une puce du quotidien l\'ajoute',q1.n===1,JSON.stringify(q1));
await p.click('#puceQuot .puce');
chk('Le deuxième appui la retire, plutôt que d\'empiler',
    await p.evaluate(()=>courses.length===0));

console.log('=== 7. VIDER LES COCHÉS RESTE RATTRAPABLE ===');
const vid=await p.evaluate(()=>{
  courses=[]; ajoute('A'); ajoute('B'); ajoute('C');
  courses[0].coche=true; courses[2].coche=true;
  sauveCourses(); rendCourses();
  document.getElementById('btnViderCoches').click();
  const apres=courses.map(i=>i.nom);
  const bouton=document.querySelector('#toasts .toast button');
  return {apres,annulable:!!bouton};
});
chk('Seuls les cochés partent',vid.apres.length===1&&vid.apres[0]==='B',JSON.stringify(vid.apres));
chk('…et un « Annuler » est proposé',vid.annulable===true);
await p.click('#toasts .toast button');
chk('Annuler les ramène',await p.evaluate(()=>courses.length===3),
    await p.evaluate(()=>JSON.stringify(courses.map(i=>i.nom))));

console.log('=== 8. CE QUI EST ÉCRIT SURVIT AU RECHARGEMENT ===');
await p.evaluate(()=>{
  courses=[]; ajoute('Cassoulet en boîte','epicerie','libre'); courses[0].qte=3;
  sauveCourses();
});
await p.reload({waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>typeof ajoute==='function');
const survie=await p.evaluate(()=>({n:courses.length,nom:courses[0]&&courses[0].nom,
                                    qte:courses[0]&&courses[0].qte,rayon:courses[0]&&courses[0].rayon}));
chk('L\'article, sa quantité et son rayon sont toujours là',
    survie.n===1&&survie.qte===3&&survie.rayon==='epicerie',JSON.stringify(survie));

console.log('=== 9. LA DISPOSITION : LA LISTE D\'ABORD ===');
await p.setViewportSize({width:1280,height:900});
const geo=await p.evaluate((()=>{
  const b=s=>{const r=document.querySelector(s).getBoundingClientRect();
              return {x:Math.round(r.x),y:Math.round(r.y+scrollY),bas:Math.round(r.bottom+scrollY),droite:Math.round(r.right)};};
  const l=b('.col-liste'), sa=b('.col-saisie'), h=b('.col-histo');
  return {l,sa,h};
}));
chk('Sur un écran large, la liste est à gauche des saisies',geo.l.x<geo.sa.x,JSON.stringify(geo));
chk('…les deux colonnes ne se chevauchent pas',geo.l.droite<=geo.sa.x+1,JSON.stringify(geo));
chk('…et l\'historique se range sous la liste, dans la même colonne',
    geo.h.x===geo.l.x&&geo.h.y>=geo.l.bas,JSON.stringify(geo));

await p.setViewportSize({width:430,height:930});
const etroit=await p.evaluate(()=>{
  const b=s=>{const r=document.querySelector(s).getBoundingClientRect();
              return {x:Math.round(r.x),y:Math.round(r.y+scrollY),bas:Math.round(r.bottom+scrollY)};};
  const l=b('.col-liste'), sa=b('.col-saisie'), h=b('.col-histo');
  return {memeX:l.x===sa.x&&sa.x===h.x,ordre:[l.y,sa.y,h.y],
          listeEnHaut:l.y<sa.y&&l.y<h.y,
          sansChevauchement:sa.y>=l.bas&&h.y>=sa.bas,
          debord:document.documentElement.scrollWidth<=430};
});
chk('Sur un téléphone, une seule colonne',etroit.memeX===true,JSON.stringify(etroit));
chk('…la liste vient en tout premier',etroit.listeEnHaut===true,JSON.stringify(etroit));
chk('…puis les saisies, puis l\'historique',
    etroit.ordre[0]<etroit.ordre[1]&&etroit.ordre[1]<etroit.ordre[2]&&etroit.sansChevauchement,
    JSON.stringify(etroit));
chk('…et rien ne déborde en largeur',etroit.debord===true,JSON.stringify(etroit));

console.log('=== 10. « PROPOSE-MOI 3 REPAS » ===');
await p.evaluate(()=>{ courses=[]; propos=[]; histo=[]; sauveCourses(); rendTout(); });
const vide=await p.evaluate(()=>document.querySelector('#listePropos .vide')!==null);
chk('Sans idée, la section le dit plutôt que de rester vide',vide===true);

await p.click('#btnPropos');
const trois=await p.evaluate(()=>({n:propos.length,distincts:new Set(propos).size,
  lignes:document.querySelectorAll('#listePropos .propos-ligne').length,
  connues:propos.every(id=>recettes.some(r=>r.id===id)),
  boutons:document.querySelectorAll('#listePropos [data-ajout]').length}));
chk('Trois repas sont proposés',trois.n===3,JSON.stringify(trois));
chk('…tous différents, et tous du répertoire',trois.distincts===3&&trois.connues,JSON.stringify(trois));
chk('…affichés, chacun avec son bouton d\'ajout',
    trois.lignes===3&&trois.boutons===3,JSON.stringify(trois));

const trio1=await p.evaluate(()=>propos.slice());
await p.click('#btnPropos');
const trio2=await p.evaluate(()=>propos.slice());
chk('Redemander rend trois autres repas',
    trio2.every(id=>!trio1.includes(id)),JSON.stringify({trio1,trio2}));

// Le bouton individuel : il ne verse QUE cette recette-là.
const un=await p.evaluate(()=>{
  courses=[]; sauveCourses(); rendTout();
  const cible=recettes.find(r=>r.id===propos[0]);
  document.querySelector('#listePropos .propos-ligne [data-ajout]').click();
  return {liste:courses.length,attendu:cible.ingredients.length,nom:cible.nom,
          autres:propos.slice(1).map(id=>recettes.find(r=>r.id===id).nom)};
});
chk('Le bouton d\'une idée verse ses ingrédients',un.liste===un.attendu,JSON.stringify(un));
const seul=await p.evaluate(()=>{
  const autres=propos.slice(1).map(id=>recettes.find(r=>r.id===id));
  return autres.every(r=>r.ingredients.some(i=>!dansListe(i.nom)));
});
chk('…et seulement les siens',seul===true);

const etat=await p.evaluate(()=>({
  dedans:document.querySelectorAll('#listePropos .propos-ligne.dedans').length,
  restants:document.querySelectorAll('#listePropos [data-ajout]').length}));
chk('La ligne versée passe en « aux courses »',etat.dedans===1,JSON.stringify(etat));
chk('…et les deux autres gardent leur bouton',etat.restants===2,JSON.stringify(etat));

// L'état se lit dans la liste : la vider redonne le bouton.
await p.evaluate(()=>{ courses=[]; sauveCourses(); rendCourses(); });
chk('Vider la liste redonne son bouton à l\'idée',
    await p.evaluate(()=>document.querySelectorAll('#listePropos [data-ajout]').length===3));

// Relancer une seule idée.
const rel=await p.evaluate(()=>{
  const avant=propos.slice();
  document.querySelectorAll('#listePropos [data-relance]')[1].click();
  return {avant,apres:propos.slice()};
});
chk('Relancer une idée ne touche pas les deux autres',
    rel.apres[0]===rel.avant[0]&&rel.apres[2]===rel.avant[2],JSON.stringify(rel));
chk('…et ne recopie pas une idée déjà proposée',new Set(rel.apres).size===3,JSON.stringify(rel.apres));

// Les idées survivent au rechargement, et un répertoire vidé ne laisse pas de trous.
await p.reload({waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>typeof proposer==='function');
chk('Les idées sont toujours là au rechargement',
    await p.evaluate(()=>propos.length===3&&document.querySelectorAll('#listePropos .propos-ligne').length===3));
const trou=await p.evaluate(()=>{
  recettes=recettes.filter(r=>r.id!==propos[0]);
  rendPropos();
  return {n:propos.length,lignes:document.querySelectorAll('#listePropos .propos-ligne').length};
});
chk('Une recette supprimée quitte les idées, sans ligne vide',
    trou.n===2&&trou.lignes===2,JSON.stringify(trou));

console.log('=== 11. UNE SEULE LISTE COURANTE, ET L\'HISTORIQUE DERRIÈRE ===');
const rien=await p.evaluate(()=>{
  courses=[]; archives=[]; sauveCourses(); sauveArchives(); rendTout();
  document.getElementById('toasts').innerHTML='';
  const desactive=document.getElementById('btnCourseFaite').disabled;
  document.getElementById('btnCourseFaite').click();   // sans effet : désactivé
  const apresClic=archives.length;
  courseFaite();      // et si on force le passage, ça refuse en le disant
  return {archives:archives.length,apresClic,desactive,
          dit:(document.querySelector('#toasts .toast')||{}).textContent||''};
});
chk('Liste vide : rien n\'est classé',rien.archives===0,JSON.stringify(rien));
chk('…le bouton est désactivé',rien.desactive===true&&rien.apresClic===0,JSON.stringify(rien));
chk('…et forcer le passage refuse en le disant',
    rien.archives===0&&/vide/i.test(rien.dit),JSON.stringify(rien));

const classe=await p.evaluate(()=>{
  courses=[]; archives=[];
  ajoute('Pain','epicerie','libre'); ajoute('Lait','frais','libre'); ajoute('Poulet','viande','libre');
  courses[0].coche=true; courses[1].qte=3;
  sauveCourses(); rendCourses();
  const avant=courses.map(i=>i.nom);
  document.getElementById('toasts').innerHTML='';
  document.getElementById('btnCourseFaite').click();
  const a=archives[0];
  return {avant,courante:courses.length,n:archives.length,
          items:a.items.map(i=>[i.nom,i.qte,i.coche,i.rayon]),
          date:Math.abs(Date.parse(a.le)-Date.now())<10000,
          lignes:document.querySelectorAll('#listeHisto .histo-ligne').length,
          cpt:document.getElementById('cptHisto').textContent.trim()};
});
chk('« Course faite » ouvre une liste vide',classe.courante===0,JSON.stringify(classe));
chk('…et classe la course entière, cochés ET non cochés',
    classe.n===1&&classe.items.length===3,JSON.stringify(classe));
chk('…en gardant quantités, rayons et ce qui était coché',
    classe.items.some(i=>i[0]==='Lait'&&i[1]===3)&&classe.items.some(i=>i[0]==='Pain'&&i[2]===true)
    &&classe.items.some(i=>i[0]==='Poulet'&&i[3]==='viande'),JSON.stringify(classe.items));
chk('…datée de maintenant',classe.date===true);
chk('…et l\'historique l\'affiche',classe.lignes===1&&classe.cpt==='1',JSON.stringify(classe));

// Les non cochés : classés quand même, mais remis d'un geste.
await p.click('#toasts .toast button');
const remis=await p.evaluate(()=>({
  courante:courses.map(i=>i.nom).sort(),
  archive:archives[0].items.length}));
chk('« Remettre les non cochés » ne remet que ceux-là',
    remis.courante.join()==='Lait,Poulet',JSON.stringify(remis));
chk('…et l\'archive garde la course complète',remis.archive===3,JSON.stringify(remis));

// Tout coché : l'action proposée est l'annulation pure et simple.
const annule=await p.evaluate(()=>{
  courses=[]; archives=[];
  ajoute('Riz','epicerie','libre'); ajoute('Sel','epicerie','libre');
  courses.forEach(i=>i.coche=true);
  sauveCourses(); rendCourses();
  document.getElementById('toasts').innerHTML='';
  document.getElementById('btnCourseFaite').click();
  return {texte:document.querySelector('#toasts .toast button').textContent,
          apres:archives.length,courante:courses.length};
});
chk('Tout coché : la course est classée',annule.apres===1&&annule.courante===0,JSON.stringify(annule));
chk('…et c\'est « Annuler » qu\'on propose',annule.texte==='Annuler',annule.texte);
await p.click('#toasts .toast button');
const revenu=await p.evaluate(()=>({courante:courses.length,archives:archives.length}));
chk('Annuler ramène la liste et retire l\'archive',
    revenu.courante===2&&revenu.archives===0,JSON.stringify(revenu));

// Reprendre : on ajoute à la liste courante, on ne la remplace pas.
const repris=await p.evaluate(()=>{
  courses=[]; archives=[];
  ajoute('Farine','epicerie','libre'); ajoute('Sucre','epicerie','libre');
  sauveCourses(); rendCourses();
  document.getElementById('btnCourseFaite').click();
  courses=[]; ajoute('Farine','epicerie','libre'); ajoute('Beurre','frais','libre');
  sauveCourses(); rendCourses();
  document.querySelector('#listeHisto [data-reprendre]').click();
  return {noms:courses.map(i=>i.nom).sort(),qtes:courses.map(i=>i.qte),
          archives:archives.length};
});
chk('« Reprendre » ajoute à la liste courante sans la remplacer',
    repris.noms.join()==='Beurre,Farine,Sucre',JSON.stringify(repris));
chk('…sans dédoubler ce qui y était déjà',repris.qtes.every(q=>q===1),JSON.stringify(repris));
chk('…et l\'archive reste en place',repris.archives===1,String(repris.archives));

// Voir : le détail, en lecture seule.
await p.evaluate(()=>{ document.getElementById('toasts').innerHTML=''; });
await p.click('#listeHisto [data-voir]');
const detail=await p.evaluate(()=>({
  ouverte:document.getElementById('modalBg').classList.contains('open'),
  items:document.querySelectorAll('#modal .arch-item').length,
  cases:document.querySelectorAll('#modal .case').length}));
chk('« Voir » ouvre le détail de la course',detail.ouverte&&detail.items===2,JSON.stringify(detail));
chk('…en lecture seule, rien à recocher',detail.cases===0,JSON.stringify(detail));
await p.click('#arFerme');

// Supprimer une entrée, et le regretter.
const supp=await p.evaluate(()=>{
  document.getElementById('toasts').innerHTML='';
  document.querySelector('#listeHisto [data-sup]').click();
  return {apres:archives.length,annulable:!!document.querySelector('#toasts .toast button')};
});
chk('Une course se supprime de l\'historique',supp.apres===0,JSON.stringify(supp));
await p.click('#toasts .toast button');
chk('…et la suppression s\'annule',await p.evaluate(()=>archives.length===1));

// Le plafond : l'historique ne grossit pas sans fin.
const plafond=await p.evaluate(()=>{
  archives=[]; courses=[];
  for(let i=0;i<MAX_ARCHIVES+5;i++){
    ajoute('Article '+i,'autre','libre'); rendCourses();
    document.getElementById('btnCourseFaite').click();
  }
  return {n:archives.length,max:MAX_ARCHIVES,
          premier:archives[0].items[0].nom,dernier:archives[archives.length-1].items[0].nom};
});
chk('L\'historique est plafonné',plafond.n===plafond.max,JSON.stringify(plafond));
chk('…et ce sont les plus anciennes qui tombent',
    plafond.premier==='Article '+(plafond.max+4)&&plafond.dernier==='Article 5',JSON.stringify(plafond));

// Il survit au rechargement, et part dans la sauvegarde.
const paq=await p.evaluate(()=>{
  archives=archives.slice(0,2); sauveArchives();
  const j=paquet();
  return {dans:Array.isArray(j.archives)&&j.archives.length===2};
});
chk('L\'historique part dans la sauvegarde JSON',paq.dans===true);
await p.reload({waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>typeof courseFaite==='function');
const apresRech=await p.evaluate(()=>({n:archives.length,
  lignes:document.querySelectorAll('#listeHisto .histo-ligne').length}));
chk('…et il est toujours là au rechargement',
    apresRech.n===2&&apresRech.lignes===2,JSON.stringify(apresRech));

console.log('=== 12. L\'AJOUT ÉCLAIR, ET LE RACCOURCI DU TÉLÉPHONE ===');
const ecl=await p.evaluate(()=>{
  courses=[]; sauveCourses(); rendCourses(); fermeEclair();
  const ferme=document.getElementById('formEclair').hidden;
  document.getElementById('btnPlus').click();
  return {ferme,ouvert:!document.getElementById('formEclair').hidden,
          focus:document.activeElement.id};
});
chk('Le champ éclair est fermé tant qu\'on ne le demande pas',ecl.ferme===true,JSON.stringify(ecl));
chk('Le « + » l\'ouvre, curseur dedans',ecl.ouvert&&ecl.focus==='chEclair',JSON.stringify(ecl));

await p.fill('#chEclair','Piles AA');
await p.press('#chEclair','Enter');
await p.fill('#chEclair','Bougies');
await p.press('#chEclair','Enter');
const deux=await p.evaluate(()=>({
  n:courses.length,rayons:courses.map(i=>i.rayon),noms:courses.map(i=>i.nom).sort(),
  ouvert:!document.getElementById('formEclair').hidden,
  champ:document.getElementById('chEclair').value,
  focus:document.activeElement.id}));
chk('Entrée ajoute, toujours dans « Autre »',
    deux.n===2&&deux.rayons.every(r=>r==='autre'),JSON.stringify(deux));
chk('…même pour un article que l\'app saurait classer',
    (await p.evaluate(()=>{ document.getElementById('chEclair').value='Poulet';
      document.getElementById('formEclair').dispatchEvent(new Event('submit',{cancelable:true}));
      return courses.find(i=>i.nom==='Poulet').rayon==='autre'; })),'Poulet');
chk('…et le champ reste ouvert et vide pour le suivant',
    deux.ouvert&&deux.champ===''&&deux.focus==='chEclair',JSON.stringify(deux));

const aVide=await p.evaluate(()=>{
  const avant=courses.length;
  document.getElementById('chEclair').value='   ';
  document.getElementById('formEclair').dispatchEvent(new Event('submit',{cancelable:true}));
  return {avant,apres:courses.length,ferme:document.getElementById('formEclair').hidden};
});
chk('Valider à vide n\'ajoute rien et referme',
    aVide.apres===aVide.avant&&aVide.ferme===true,JSON.stringify(aVide));

// Échap referme sans rien perdre ; « Fini » aussi.
await p.click('#btnPlus');
await p.fill('#chEclair','Brouillon');
await p.press('#chEclair','Escape');
const echap=await p.evaluate(()=>({ferme:document.getElementById('formEclair').hidden,
  modale:document.getElementById('modalBg').classList.contains('open'),
  n:courses.filter(i=>i.nom==='Brouillon').length}));
chk('Échap referme le champ sans rien ajouter',
    echap.ferme===true&&echap.n===0,JSON.stringify(echap));
chk('…et ne touche à rien d\'autre',echap.modale===false);

// Le raccourci de l'icône : ?ajout= vide ouvre le champ, sans rien ajouter.
await p.goto(BASE+'?ajout=',{waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>typeof litIntention==='function');
const raccourci=await p.evaluate(()=>({
  page:page,ouvert:!document.getElementById('formEclair').hidden,
  focus:document.activeElement.id,url:location.search}));
chk('Le raccourci ouvre la page des courses, champ prêt',
    raccourci.page==='courses'&&raccourci.ouvert&&raccourci.focus==='chEclair',JSON.stringify(raccourci));
chk('…et l\'URL est nettoyée aussitôt',raccourci.url==='',raccourci.url);

// Un texte derrière le signe égal est ajouté tel quel.
await p.evaluate(()=>{ courses=[]; sauveCourses(); });
await p.goto(BASE+'?ajout=Sacs%20cong%C3%A9lation',{waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>typeof litIntention==='function');
const avecTexte=await p.evaluate(()=>({n:courses.length,
  nom:courses[0]&&courses[0].nom,rayon:courses[0]&&courses[0].rayon,url:location.search}));
chk('Un texte dans l\'URL est ajouté dans « Autre »',
    avecTexte.n===1&&avecTexte.nom==='Sacs congélation'&&avecTexte.rayon==='autre',JSON.stringify(avecTexte));
// Le nettoyage de l'URL n'est pas cosmétique : c'est ce qui empêche un
// rafraîchissement de rejouer l'ajout.
await p.reload({waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>typeof litIntention==='function');
chk('…et un rafraîchissement ne le rejoue pas',
    await p.evaluate(()=>courses.length===1),
    await p.evaluate(()=>JSON.stringify(courses.map(i=>i.nom))));

// Le manifeste déclare bien ce raccourci, et son icône existe.
const man=await p.evaluate(async()=>{
  const m=await (await fetch('manifest.webmanifest')).json();
  const s=(m.shortcuts||[])[0]||{};
  const ico=s.icons&&s.icons[0]?await fetch(s.icons[0].src.replace('./','')):{ok:false};
  return {n:(m.shortcuts||[]).length,url:s.url,nom:s.name,icone:ico.ok};
});
chk('Le manifeste déclare le raccourci « Ajouter »',
    man.n===1&&man.url==='./?ajout='&&/Ajouter/.test(man.nom||''),JSON.stringify(man));
chk('…et son icône est bien servie',man.icone===true,JSON.stringify(man));

chk('Aucune erreur JS',errs.length===0,errs.join(' | '));

await b.close();
const ko=R.filter(x=>!x[1]);
R.forEach(([n,ok,d])=>console.log((ok?'  ✓ ':'  ✗ ')+n+(ok?'':' → '+d)));
console.log(`\n${R.length-ko.length}/${R.length}`);
process.exit(ko.length?1:0);
})();
