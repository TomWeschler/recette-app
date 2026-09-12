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

chk('Aucune erreur JS',errs.length===0,errs.join(' | '));

await b.close();
const ko=R.filter(x=>!x[1]);
R.forEach(([n,ok,d])=>console.log((ok?'  ✓ ':'  ✗ ')+n+(ok?'':' → '+d)));
console.log(`\n${R.length-ko.length}/${R.length}`);
process.exit(ko.length?1:0);
})();
