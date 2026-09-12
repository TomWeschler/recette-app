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
const ONGLETS=['courses','archives','recurrents','recettes','etat'];
const feuille={};
const razFeuille=()=>ONGLETS.forEach(o=>feuille[o]=[]);
razFeuille();
const lignes=o=>feuille[o].filter(l=>l[0]&&l[0]!=='id'&&l[0]!=='cle');

(async()=>{
const b=await chromium.launch({executablePath:NAVIGATEUR});

// Un appareil = un CONTEXTE, pas seulement une page. Deux pages d'un même
// contexte partagent le localStorage : elles simuleraient deux fenêtres du même
// téléphone, pas deux téléphones, et l'épreuve croirait éprouver une
// synchronisation là où les deux « appareils » lisent la même mémoire.
async function appareil(nom,opts){
  const ctx=await b.newContext({viewport:{width:430,height:930},locale:'fr-FR'});
  await ctx.exposeFunction('nodeLire',o=>feuille[o]||[]);
  await ctx.exposeFunction('nodeEcrire',(o,l)=>{ feuille[o]=l; return true; });
  const p=await ctx.newPage();
  p.ctx=ctx;
  const errs=[];p.on('pageerror',e=>errs.push(nom+': '+String(e).split('\n')[0]));
  await p.goto(BASE,{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>typeof synchronise==='function');
  await p.evaluate(garderSemence=>{
    // On détourne le transport, et seulement lui.
    ssLire=async o=>await nodeLire(o);
    ssEcrire=async(o,l)=>{ await nodeEcrire(o,l); };
    ssOnglets=async()=>{};
    ssCreer=async()=>'classeur-test';
    jeton='jeton-test';
    sync={clientId:'test.apps.googleusercontent.com',classeur:'classeur-test',compte:''};
    sauveSync();
    courses=[]; archives=[];
    ['courses','archives','recurrents','recettes'].forEach(c=>ecrire('tombes_'+c,[]));
    ecrire('maj_etat',{});
    // Par défaut on part d'un appareil nu : la plupart des épreuves posent
    // elles-mêmes leurs recettes. `semer` garde au contraire la vingtaine
    // d'articles du premier lancement, pour éprouver ce qu'elle devient.
    if(!garderSemence){ recettes=[]; recurrents=[];
                        ecrire('recettes',[]); ecrire('recurrents',[]); }
    sauveCourses(); sauveArchives(); rendTout();
  },!!(opts&&opts.semer));
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
await A.ctx.setOffline(true);
const horsLigne=await A.evaluate(async()=>{
  ajoute('Sel','epicerie','libre'); sauveCourses();
  const ok=await synchronise(true);
  return {ok,pastille:document.getElementById('etatSync').textContent,local:courses.length};
});
chk('Hors ligne, la synchro renonce proprement',horsLigne.ok===false,JSON.stringify(horsLigne));
chk('…le dit',/HORS LIGNE/.test(horsLigne.pastille),horsLigne.pastille);
chk('…et garde la saisie',horsLigne.local===4,String(horsLigne.local));
await A.ctx.setOffline(false);
await calme(A);   // le retour du réseau ne se voit pas dans la page à l'instant même
chk('Au retour du réseau, la saisie part',
    !!lignes('courses').find(l=>l[1]==='Sel'),JSON.stringify(lignes('courses').map(l=>l[1])));

console.log('=== 8. LES RECETTES ET LES RÉCURRENTS, LIGNE À LIGNE ===');
razFeuille();
await A.evaluate(()=>{
  recettes=[{id:'rA',nom:'Recette de A',tags:['rapide'],duree:20,
             ingredients:[{nom:'Riz',rayon:'epicerie'}],notes:'',dernier:null,faites:0,maj:Date.now()}];
  recurrents=[{id:'uA',nom:'Vinaigre',rayon:'epicerie',cadence:'quotidien',dernier:null,maj:Date.now()}];
  sauveRecettes(); sauveRecurrents();
});
await calme(A);
const parLigne={rec:lignes('recettes'),ur:lignes('recurrents')};
chk('Chaque recette a sa ligne, en clair',
    parLigne.rec.length===1&&parLigne.rec[0][1]==='Recette de A'&&parLigne.rec[0][2]==='rapide',
    JSON.stringify(parLigne.rec));
chk('…ses ingrédients tiennent dans leur colonne',
    /Riz/.test(parLigne.rec[0][4]),JSON.stringify(parLigne.rec[0]));
chk('Chaque récurrent aussi, avec sa cadence',
    parLigne.ur.length===1&&parLigne.ur[0][3]==='quotidien',JSON.stringify(parLigne.ur));

// Le défaut que le format en bloc avait : deux personnes ajoutent chacune une
// recette, et l'une des deux disparaît. Ligne à ligne, les deux survivent.
await B.evaluate(()=>{ recettes=[]; recurrents=[]; sauveRecettes(); sauveRecurrents(); });
await calme(B);
await A.evaluate(()=>{ recettes.push({id:'rA2',nom:'Ajout de A',tags:[],duree:10,
  ingredients:[],notes:'',dernier:null,faites:0,maj:Date.now()}); sauveRecettes(); });
await B.evaluate(()=>{ recettes.push({id:'rB2',nom:'Ajout de B',tags:[],duree:10,
  ingredients:[],notes:'',dernier:null,faites:0,maj:Date.now()}); sauveRecettes(); });
await calme(A); await calme(B); await calme(A);
const deuxAjouts={a:await A.evaluate(()=>recettes.map(r=>r.nom).sort()),
                  b:await B.evaluate(()=>recettes.map(r=>r.nom).sort())};
chk('Deux recettes ajoutées en même temps survivent toutes les deux',
    deuxAjouts.a.join()==='Ajout de A,Ajout de B,Recette de A'
    &&deuxAjouts.b.join()==='Ajout de A,Ajout de B,Recette de A',JSON.stringify(deuxAjouts));

// Supprimer une recette doit tenir, là aussi.
await A.evaluate(()=>{
  const r=recettes.find(x=>x.id==='rB2');
  recettes=recettes.filter(x=>x.id!=='rB2'); poseTombes('recettes',[r]); sauveRecettes();
});
await calme(A); await calme(B);
chk('Une recette supprimée disparaît des deux côtés',
    await B.evaluate(()=>!recettes.some(r=>r.id==='rB2')),
    await B.evaluate(()=>JSON.stringify(recettes.map(r=>r.nom))));

// Une recette modifiée d'un côté remplace l'ancienne de l'autre, sans doublon.
await B.evaluate(()=>{ const r=recettes.find(x=>x.id==='rA'); r.nom='Recette renommée';
                       r.tags=['mijoté']; estampille(r); sauveRecettes(); });
await calme(B); await calme(A);
const renom=await A.evaluate(()=>recettes.filter(r=>r.id==='rA').map(r=>[r.nom,r.tags.join()]));
chk('Une recette renommée arrive renommée, en un seul exemplaire',
    renom.length===1&&renom[0][0]==='Recette renommée'&&renom[0][1]==='mijoté',JSON.stringify(renom));

console.log('=== 8bis. LA SEMENCE EST PROVISOIRE ===');
// Le piège : un téléphone qu'on relie versait ses vingt recettes par-dessus
// celles du classeur, toutes en double. Tant qu'on n'y a pas touché, la
// semence s'efface devant le classeur.
const C=await appareil('C',{semer:true});
const avantC=await C.evaluate(()=>({r:recettes.length,semence:recettes.every(x=>x.semence)}));
chk('Un appareil neuf est semé, même sans réseau',avantC.r>15&&avantC.semence,JSON.stringify(avantC));
await calme(C);
const apresC={c:await C.evaluate(()=>recettes.map(r=>r.nom).sort()),
              vivantes:lignes('recettes').filter(l=>l[9]!=='1').length};
chk('…mais devant un classeur servi, sa semence s\'efface',
    apresC.c.join()==='Ajout de A,Recette renommée',JSON.stringify(apresC.c));
chk('…et rien n\'est versé en double dans le classeur',apresC.vivantes===2,JSON.stringify(apresC));

// En revanche, ce à quoi on a touché ne se jette pas.
const E=await appareil('E',{semer:true});
await E.evaluate(()=>{ const r=recettes[0]; r.nom='Ma version à moi'; estampille(r); sauveRecettes(); });
await calme(E);
const garde=await E.evaluate(()=>recettes.some(r=>r.nom==='Ma version à moi'));
chk('Une semence à laquelle on a touché n\'est pas jetée',garde===true,
    await E.evaluate(()=>String(recettes.length)));

console.log('=== 8ter. CLASSEUR VIDE : LA SEMENCE LE REMPLIT ===');
razFeuille();
const D=await appareil('D',{semer:true});
await calme(D);
const seme={local:await D.evaluate(()=>({r:recettes.length,u:recurrents.length})),
            classeur:{r:lignes('recettes').length,u:lignes('recurrents').length}};
chk('Classeur vide : la semence part dedans',
    seme.local.r>15&&seme.classeur.r===seme.local.r,JSON.stringify(seme));
chk('…récurrents compris',seme.local.u>20&&seme.classeur.u===seme.local.u,JSON.stringify(seme));
await calme(D); await calme(D);
chk('…et elle ne se rejoue pas à chaque synchro',
    lignes('recettes').length===seme.classeur.r,String(lignes('recettes').length));

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

console.log('=== 9bis. LE DOUBLON QUI EST ARRIVÉ EN VRAI ===');
// Le défaut constaté : un téléphone semé AVANT que la marque « semence »
// existe. Rien ne distinguait ses vingt-six récurrents d'un travail personnel,
// il les a donc versés à côté de ceux du classeur, et tout est apparu en double.
// Les appareils des sections précédentes sont fermés : laissés ouverts, leurs
// synchros de fond continuent de verser leur état dans le classeur qu'on vient
// de vider, et l'épreuve mesurerait leurs restes.
await A.ctx.close(); await B.ctx.close();
razFeuille();
const G=await appareil('G',{semer:true});
const H=await appareil('H',{semer:true});
// On leur retire la marque : les voilà tels qu'ils étaient avant la correction.
const dévêt=()=>{ recurrents.forEach(r=>{ delete r.semence; }); recettes.forEach(r=>{ delete r.semence; });
                  ecrire('semence_marquee',false); ecrire('recurrents',recurrents); ecrire('recettes',recettes); };
await G.evaluate(dévêt); await H.evaluate(dévêt);
const avant=await G.evaluate(()=>recurrents.length);
await calme(G); await calme(H); await calme(G);
const apres={g:await G.evaluate(()=>recurrents.length),
             h:await H.evaluate(()=>recurrents.length),
             noms:await G.evaluate(()=>recurrents.map(r=>r.nom)),
             recettesG:await G.evaluate(()=>recettes.map(r=>r.nom).sort()),
             recettesH:await H.evaluate(()=>recettes.map(r=>r.nom).sort())};
const doublons=await G.evaluate(()=>{
  const c={}; recurrents.forEach(r=>{ const k=norm(r.nom); c[k]=(c[k]||0)+1; });
  return Object.entries(c).filter(([,n])=>n>1);
});
chk('Deux appareils semés à l\'ancienne ne font pas double',
    apres.g===avant&&apres.h===avant,
    JSON.stringify({avant,g:apres.g,h:apres.h,doublons,noms:apres.noms}));
chk('…aucun nom n\'apparaît deux fois',
    new Set(apres.noms.map(n=>n.toLowerCase())).size===apres.noms.length,JSON.stringify(apres.noms));
chk('…et les deux appareils gardent exactement la même liste de recettes',
    apres.recettesG.join()===apres.recettesH.join()
    &&new Set(apres.recettesG).size===apres.recettesG.length,
    JSON.stringify({g:apres.recettesG.length,h:apres.recettesH.length}));

// Ce à quoi on a touché survit au ménage, et c'est LUI qui reste.
await G.evaluate(()=>{ const r=recurrents.find(x=>x.nom==='Café'); r.dernier='2026-09-01';
                       estampille(r); sauveRecurrents(); });
await calme(G);
await H.evaluate(()=>{ recurrents.push(estampille({id:'faux-cafe',nom:'café',rayon:'autre',
                       cadence:'hebdo',dernier:null})); sauveRecurrents(); });
await calme(H); await calme(G);
const survie={g:await G.evaluate(()=>recurrents.filter(r=>norm(r.nom)==='cafe')),
              h:await H.evaluate(()=>recurrents.filter(r=>norm(r.nom)==='cafe'))};
chk('Un homonyme ajouté ailleurs est réduit, pas empilé',
    survie.g.length===1&&survie.h.length===1,JSON.stringify(survie));
chk('…et c\'est celui qui a servi qui reste, des deux côtés',
    survie.g[0].dernier==='2026-09-01'&&survie.h[0].dernier==='2026-09-01',JSON.stringify(survie));
chk('…le même exactement, pas un chacun',survie.g[0].id===survie.h[0].id,
    JSON.stringify([survie.g[0].id,survie.h[0].id]));

// Deux recettes de même nom mais différentes ne sont PAS réunies.
// Un nom absent de la semence, pour que l'épreuve ne porte que sur la règle.
await G.evaluate(()=>{
  recettes.push({id:'p1',nom:'Tarte du dimanche',tags:[],duree:30,
                 ingredients:[{nom:'Pommes',rayon:'legumes'}],notes:'',dernier:null,faites:1,maj:Date.now()});
  recettes.push({id:'p2',nom:'Tarte du dimanche',tags:[],duree:30,
                 ingredients:[{nom:'Poireaux',rayon:'legumes'}],notes:'',dernier:null,faites:2,maj:Date.now()});
  sauveRecettes();
});
await calme(G); await calme(H);
const homonymes={g:await G.evaluate(()=>recettes.filter(r=>r.nom==='Tarte du dimanche').length),
                 h:await H.evaluate(()=>recettes.filter(r=>r.nom==='Tarte du dimanche').length)};
chk('Deux recettes de même nom aux ingrédients différents restent deux',
    homonymes.g===2&&homonymes.h===2,JSON.stringify(homonymes));

// Deux fois le même article dans la liste, posé de chaque côté : un seul reste,
// avec la plus grande quantité — deux briques de lait, pas une.
await G.evaluate(()=>{ courses=[]; ajoute('Lait','frais','libre'); courses[0].qte=2;
                       sauveCourses(); });
await calme(G);
await H.evaluate(()=>{ ajoute('lait','frais','libre'); sauveCourses(); });
await calme(H); await calme(G);
const lait={g:await G.evaluate(()=>courses.filter(i=>norm(i.nom)==='lait')),
            h:await H.evaluate(()=>courses.filter(i=>norm(i.nom)==='lait'))};
chk('Le même article ajouté des deux côtés ne fait qu\'une ligne',
    lait.g.length===1&&lait.h.length===1,JSON.stringify(lait));
chk('…et il garde la plus grande quantité',lait.g[0].qte===2&&lait.h[0].qte===2,JSON.stringify(lait));

console.log('=== 10. LA CONNEXION SE FAIT À L\'OUVERTURE ===');
// Une page fraîche, telle qu'elle s'ouvre vraiment : rien n'est détourné avant
// de regarder ce qu'elle a tenté toute seule.
const F=await b.newContext({viewport:{width:430,height:930},locale:'fr-FR'});
const f=await F.newPage();
const errsF=[];f.on('pageerror',e=>errsF.push('F: '+String(e).split('\n')[0]));
await f.goto(BASE,{waitUntil:'domcontentloaded'});
await f.waitForFunction(()=>typeof synchronise==='function');
const ouverture=await f.evaluate(()=>({
  configure:syncConfigure(),
  client:/apps\.googleusercontent\.com$/.test(sync.clientId),
  classeur:!!sync.classeur,
  script:!!document.querySelector('script[src*="accounts.google.com"]'),
  pastille:document.getElementById('etatSync').textContent}));
chk('Un appareil neuf est configuré sans qu\'on règle rien',
    ouverture.configure&&ouverture.client&&ouverture.classeur,JSON.stringify(ouverture));
chk('…et la connexion à Google est demandée dès l\'ouverture',
    ouverture.script===true,JSON.stringify(ouverture));
chk('…la pastille le dit',/SYNC|HORS LIGNE|CONNEXION|À JOUR/.test(ouverture.pastille),ouverture.pastille);

// Le jeton arrive : on vérifie ce que l'app en fait, en se mettant à la place
// de Google plutôt qu'en l'appelant.
const jetonRecu=await f.evaluate(async()=>{
  window.DEMANDES=[];
  window.google={accounts:{oauth2:{initTokenClient:o=>{ window.OPTS=o;
    return {requestAccessToken:p=>window.DEMANDES.push(p&&p.prompt)}; }}}};
  gisPret=true; initJeton();
  ssOnglets=async()=>{}; ssLire=async()=>[]; ssEcrire=async()=>{};
  OPTS.callback({access_token:'jeton-abc',expires_in:3600});
  await new Promise(r=>setTimeout(r,300));
  return {jeton,pastille:document.getElementById('etatSync').textContent,
          portee:OPTS.scope,client:OPTS.client_id===sync.clientId};
});
chk('Le jeton reçu est gardé et la synchro part',
    jetonRecu.jeton==='jeton-abc'&&/À JOUR/.test(jetonRecu.pastille),JSON.stringify(jetonRecu));
chk('…avec la portée la plus étroite qui suffise',
    /spreadsheets/.test(jetonRecu.portee)&&/drive\.file/.test(jetonRecu.portee)
    &&!/drive['"\s]|drive$/.test(jetonRecu.portee.replace('drive.file','')),jetonRecu.portee);

// Sans jeton, chaque déclencheur redemande la connexion au lieu de renoncer.
const relance=await f.evaluate(async()=>{
  jeton=null; DEMANDES.length=0;
  const s1=await synchronise(true);
  reprend();
  window.dispatchEvent(new Event('online'));
  document.dispatchEvent(new Event('visibilitychange'));
  return {s1,demandes:DEMANDES.length,muettes:DEMANDES.every(p=>p==='')};
});
chk('Sans jeton, la synchro redemande la connexion au lieu de renoncer',
    relance.s1===false&&relance.demandes>=3,JSON.stringify(relance));
chk('…en silence, sans fenêtre qui surgit',relance.muettes===true,JSON.stringify(relance));

// Le refus de Google se dit une fois, et l'appui sur la pastille réessaie
// avec le consentement — c'est le geste que le navigateur attend.
const refus=await f.evaluate(async()=>{
  DEMANDES.length=0; document.getElementById('toasts').innerHTML='';
  OPTS.callback({error:'consent_required'});
  const dit=(document.querySelector('#toasts .toast')||{}).textContent||'';
  const pastille=document.getElementById('etatSync').textContent;
  OPTS.callback({error:'consent_required'});   // deuxième refus : pas de nouveau message
  const toasts=document.querySelectorAll('#toasts .toast').length;
  document.getElementById('etatSync').click();
  return {dit,pastille,toasts,prompt:DEMANDES[DEMANDES.length-1]};
});
chk('Un refus de Google est dit, une seule fois',
    /[Cc]onnexion/.test(refus.dit)&&refus.toasts===1,JSON.stringify(refus));
chk('…la pastille invite à toucher',/CONNEXION/.test(refus.pastille),refus.pastille);
chk('…et l\'appui redemande avec consentement',refus.prompt==='consent',JSON.stringify(refus));

// Un jeton périmé (401) est remplacé sans qu'on s'en aperçoive.
const perime=await f.evaluate(async()=>{
  jeton='vieux'; DEMANDES.length=0;
  const vraiFetch=window.fetch;
  window.fetch=async()=>({status:401,ok:false,json:async()=>({})});
  let attrape=null;
  try{ await ssAppel('https://exemple.test/x'); }catch(e){ attrape=e.message; }
  window.fetch=vraiFetch;
  return {attrape,jeton,demandes:DEMANDES.length};
});
chk('Un jeton périmé est jeté et redemandé aussitôt',
    perime.attrape==='jeton'&&perime.jeton===null&&perime.demandes===1,JSON.stringify(perime));

const errs=[...A.errs,...B.errs,...G.errs,...H.errs,...errsF];
chk('Aucune erreur JS',errs.length===0,errs.join(' | '));

await b.close();
const ko=R.filter(x=>!x[1]);
R.forEach(([n,ok,d])=>console.log((ok?'  ✓ ':'  ✗ ')+n+(ok?'':' → '+d)));
console.log(`\n${R.length-ko.length}/${R.length}`);
process.exit(ko.length?1:0);
})();
