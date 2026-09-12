// ── La synchronisation à deux ─────────────────────────────────────────────
// Ce qu'on éprouve ici n'est pas Google : c'est la FUSION, qui est l'endroit où
// les vraies erreurs se cachent. Un classeur de mensonge vit côté Node, partagé
// par deux pages — deux appareils, donc — et les quatre fonctions de transport
// de l'app sont détournées vers lui. Tout le reste est le vrai code.
//
// Le défaut qu'on cherche : l'article supprimé sur un téléphone et ressuscité
// par l'autre à la synchro suivante, la coche perdue parce que l'autre appareil
// avait encore l'ancienne version, et la liste écrasée d'un bloc par le dernier
// qui ouvre l'app.
const {chromium}=require('playwright');
const NAVIGATEUR=process.env.PW_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE=process.env.BASE||'http://127.0.0.1:8899/index.html';
const R=[];const chk=(n,ok,d='')=>R.push([n,ok,d]);

// Le classeur de mensonge : un objet, trois onglets, rien de plus.
const feuille={courses:[],archives:[],etat:[]};
const razFeuille=()=>{ feuille.courses=[];feuille.archives=[];feuille.etat=[]; };
const lignes=o=>feuille[o].filter(l=>l[0]&&l[0]!=='id'&&l[0]!=='cle');

(async()=>{
const b=await chromium.launch({executablePath:NAVIGATEUR});
const ctx=await b.newContext({viewport:{width:430,height:930},locale:'fr-FR'});
await ctx.exposeFunction('nodeLire',o=>feuille[o]||[]);
await ctx.exposeFunction('nodeEcrire',(o,l)=>{ feuille[o]=l; return true; });

// Un appareil : une page, son propre localStorage n'étant pas partagé avec
// l'autre puisqu'on efface avant chaque branchement.
async function appareil(nom){
  const p=await ctx.newPage();
  const errs=[];p.on('pageerror',e=>errs.push(nom+': '+String(e).split('\n')[0]));
  await p.goto(BASE,{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>typeof synchronise==='function');
  await p.evaluate(()=>{
    // On détourne le transport, et seulement lui.
    ssLire=async o=>await nodeLire(o);
    ssEcrire=async(o,l)=>{ await nodeEcrire(o,l); };
    ssOnglets=async()=>{};
    ssCreer=async()=>'classeur-test';
    jeton='jeton-test';
    sync={clientId:'test.apps.googleusercontent.com',classeur:'classeur-test',compte:''};
    sauveSync();
    courses=[]; archives=[]; ecrire('tombes_courses',[]); ecrire('tombes_archives',[]);
    ecrire('maj_etat',{}); sauveCourses(); sauveArchives(); rendTout();
  });
  p.errs=errs;
  return p;
}

// Deux passes ne se chevauchent jamais : une demande arrivée pendant une passe
// est notée et rejouée un peu plus tard. C'est voulu — mais une épreuve qui
// mesure juste après mesurerait l'état d'avant. On attend donc le calme.
const calme=async p=>p.evaluate(async()=>{
  const patiente=async()=>{ for(let i=0;i<60&&(syncEnCours||syncSale);i++)
                              await new Promise(r=>setTimeout(r,50)); };
  await patiente(); await synchronise(true); await patiente();
});

const A=await appareil('A');

console.log('=== 1. SANS RÉGLAGE, RIEN NE PART ===');
const nu=await A.evaluate(async()=>{
  const garde=JSON.parse(JSON.stringify(sync));
  sync={clientId:'',classeur:'',compte:''};
  const ok=await synchronise(true);
  const pastille=document.getElementById('etatSync').textContent;
  sync=garde; sauveSync();                 // on remet le réglage, sans faute
  return {ok,pastille,rendu:JSON.parse(JSON.stringify(sync))};
});
chk('Sans classeur réglé, la synchro ne fait rien',nu.ok===false,JSON.stringify(nu));
chk('…et la pastille dit « LOCAL »',/LOCAL/.test(nu.pastille),nu.pastille);
chk('…et le réglage est bien revenu pour la suite',!!nu.rendu.classeur,JSON.stringify(nu.rendu));

console.log('=== 2. LE PREMIER ENVOI ===');
razFeuille();
await A.evaluate(async()=>{
  courses=[]; ajoute('Pain','epicerie','libre'); ajoute('Lait','frais','libre');
  courses[1].qte=2; courses[0].coche=true;
  sauveCourses(); await synchronise(true);
});
const envoi={entete:feuille.courses[0],n:lignes('courses').length,
             pain:lignes('courses').find(l=>l[1]==='Pain'),
             lait:lignes('courses').find(l=>l[1]==='Lait')};
chk('Le classeur reçoit la liste',envoi.n===2,JSON.stringify(envoi));
chk('…avec une ligne d\'en-tête lisible par un humain',
    (envoi.entete||[]).join()==='id,nom,rayon,qte,coche,src,le,maj,suppr',JSON.stringify(envoi.entete));
chk('…quantités et coches comprises',
    envoi.lait[3]==='2'&&envoi.pain[4]==='1'&&envoi.lait[4]==='',JSON.stringify([envoi.pain,envoi.lait]));
chk('…et chaque ligne est datée',lignes('courses').every(l=>+l[7]>0),JSON.stringify(lignes('courses')));

console.log('=== 3. CE QUE L\'AUTRE A ÉCRIT REVIENT ===');
feuille.courses.push(['dist-1','Beurre','frais','1','','libre','2026-09-12',String(Date.now()),'']);
await A.evaluate(()=>synchronise(true));
const revenu=await A.evaluate(()=>({noms:courses.map(i=>i.nom).sort(),
  affiche:[...document.querySelectorAll('#listeCourses .item-nom')].map(e=>e.textContent).sort()}));
chk('Un article venu du classeur arrive dans la liste',
    revenu.noms.join()==='Beurre,Lait,Pain',JSON.stringify(revenu.noms));
chk('…et il est affiché, pas seulement en mémoire',
    revenu.affiche.join()==='Beurre,Lait,Pain',JSON.stringify(revenu.affiche));

console.log('=== 4. LE CONFLIT : LA PLUS RÉCENTE GAGNE ===');
// L'autre appareil a coché « Lait » après nous.
const idLait=lignes('courses').find(l=>l[1]==='Lait')[0];
feuille.courses=feuille.courses.map(l=>l[0]===idLait?[l[0],l[1],l[2],l[3],'1',l[5],l[6],String(Date.now()+5000),'']:l);
await A.evaluate(()=>synchronise(true));
chk('La version distante plus récente l\'emporte',
    await A.evaluate(()=>courses.find(i=>i.nom==='Lait').coche===true));
// Puis c'est nous qui décochons, donc plus tard.
await A.evaluate(async()=>{
  const i=courses.find(x=>x.nom==='Lait'); i.coche=false; estampille(i); i.maj=Date.now()+60000;
  sauveCourses(); await synchronise(true);
});
chk('…et la nôtre l\'emporte quand c\'est nous les derniers',
    lignes('courses').find(l=>l[0]===idLait)[4]==='',JSON.stringify(lignes('courses').find(l=>l[0]===idLait)));

console.log('=== 5. SUPPRIMER NE RESSUSCITE PAS ===');
await A.evaluate(async()=>{
  oteCourses([courses.find(i=>i.nom==='Beurre')]);
  sauveCourses(); await synchronise(true);
});
const tombe=lignes('courses').find(l=>l[1]==='Beurre');
chk('La suppression part comme pierre tombale',tombe&&tombe[8]==='1',JSON.stringify(tombe));
await A.evaluate(()=>synchronise(true));
chk('…et l\'article ne revient pas à la synchro suivante',
    await A.evaluate(()=>!courses.some(i=>i.nom==='Beurre')),
    await A.evaluate(()=>JSON.stringify(courses.map(i=>i.nom))));

// Une suppression venue d'en face doit retirer l'article ici aussi.
const idPain=lignes('courses').find(l=>l[1]==='Pain')[0];
feuille.courses=feuille.courses.map(l=>l[0]===idPain?[l[0],l[1],l[2],l[3],l[4],l[5],l[6],String(Date.now()+9000),'1']:l);
await A.evaluate(()=>synchronise(true));
chk('Une suppression venue de l\'autre appareil retire l\'article',
    await A.evaluate(()=>!courses.some(i=>i.nom==='Pain')),
    await A.evaluate(()=>JSON.stringify(courses.map(i=>i.nom))));

console.log('=== 6. DEUX APPAREILS, LE MÊME CLASSEUR ===');
razFeuille();
const B=await appareil('B');
await A.evaluate(async()=>{ courses=[]; ajoute('Tomates','legumes','libre'); sauveCourses(); await synchronise(true); });
await B.evaluate(()=>synchronise(true));
chk('Ce que A ajoute, B le voit',
    await B.evaluate(()=>courses.length===1&&courses[0].nom==='Tomates'),
    await B.evaluate(()=>JSON.stringify(courses.map(i=>i.nom))));
await B.evaluate(async()=>{ const i=courses[0]; i.coche=true; estampille(i); sauveCourses(); await synchronise(true); });
await A.evaluate(()=>synchronise(true));
chk('Ce que B coche, A le voit coché',
    await A.evaluate(()=>courses[0]&&courses[0].coche===true),
    await A.evaluate(()=>JSON.stringify(courses)));
// Chacun ajoute de son côté avant toute synchro : rien ne doit être écrasé.
await A.evaluate(()=>{ ajoute('Café','epicerie','libre'); sauveCourses(); });
await B.evaluate(()=>{ ajoute('Riz','epicerie','libre'); sauveCourses(); });
await A.evaluate(()=>synchronise(true));
await B.evaluate(()=>synchronise(true));
await A.evaluate(()=>synchronise(true));
const croise={a:await A.evaluate(()=>courses.map(i=>i.nom).sort()),
              b:await B.evaluate(()=>courses.map(i=>i.nom).sort())};
chk('Deux ajouts simultanés se retrouvent tous les deux',
    croise.a.join()==='Café,Riz,Tomates'&&croise.b.join()==='Café,Riz,Tomates',JSON.stringify(croise));

console.log('=== 7. HORS LIGNE, RIEN N\'EST PERDU ===');
await ctx.setOffline(true);
const horsLigne=await A.evaluate(async()=>{
  ajoute('Sel','epicerie','libre'); sauveCourses();
  const ok=await synchronise(true);
  return {ok,pastille:document.getElementById('etatSync').textContent,local:courses.length};
});
chk('Hors ligne, la synchro renonce proprement',horsLigne.ok===false,JSON.stringify(horsLigne));
chk('…le dit',/HORS LIGNE/.test(horsLigne.pastille),horsLigne.pastille);
chk('…et garde la saisie',horsLigne.local===4,String(horsLigne.local));
await ctx.setOffline(false);
await A.evaluate(()=>synchronise(true));
chk('Au retour du réseau, la saisie part',
    !!lignes('courses').find(l=>l[1]==='Sel'),JSON.stringify(lignes('courses').map(l=>l[1])));

console.log('=== 8. LES COLLECTIONS QUI VOYAGENT EN BLOC ===');
razFeuille();
await A.evaluate(()=>{
  recettes=[{id:'r1',nom:'Test A',tags:[],ingredients:[],dernier:null,faites:0}];
  sauveRecettes();
});
await calme(A);
chk('Les recettes partent dans l\'onglet « etat »',
    !!lignes('etat').find(l=>l[0]==='recettes'&&/Test A/.test(l[1])),JSON.stringify(lignes('etat').map(l=>l[0])));
// L'autre appareil en pose une plus récente : elle doit gagner.
feuille.etat=feuille.etat.map(l=>l[0]==='recettes'
  ?['recettes',JSON.stringify([{id:'r2',nom:'Test B',tags:[],ingredients:[],dernier:null,faites:0}]),String(Date.now()+60000)]:l);
await calme(A);
chk('Une version distante plus récente remplace la locale',
    await A.evaluate(()=>recettes.length===1&&recettes[0].nom==='Test B'),
    await A.evaluate(()=>JSON.stringify(recettes.map(r=>r.nom))));
chk('…et elle est affichée',
    await A.evaluate(()=>[...document.querySelectorAll('#listeRecettes .rec-nom')].some(e=>e.textContent==='Test B')));

console.log('=== 9. DEUX PASSES NE SE CHEVAUCHENT PAS ===');
const double=await A.evaluate(async()=>{
  let appels=0; const vrai=ssEcrire;
  ssEcrire=async(o,l)=>{ appels++; await new Promise(r=>setTimeout(r,60)); return vrai(o,l); };
  ajoute('Poivre','epicerie','libre'); sauveCourses();
  const [un,deux]=await Promise.all([synchronise(true),synchronise(true)]);
  ssEcrire=vrai;
  return {un,deux,appels};
});
chk('Une seconde passe lancée pendant la première ne part pas',
    double.un===true&&double.deux===false,JSON.stringify(double));

const errs=[...A.errs,...B.errs];
chk('Aucune erreur JS',errs.length===0,errs.join(' | '));

await b.close();
const ko=R.filter(x=>!x[1]);
R.forEach(([n,ok,d])=>console.log((ok?'  ✓ ':'  ✗ ')+n+(ok?'':' → '+d)));
console.log(`\n${R.length-ko.length}/${R.length}`);
process.exit(ko.length?1:0);
})();
