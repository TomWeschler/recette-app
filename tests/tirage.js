// ── Le tirage des recettes ────────────────────────────────────────────────
// Le but de la fonctionnalité n'est pas « rendre une recette au hasard » : un
// tirage uniforme redonne les pâtes trois fois en dix jours, et on aurait aussi
// bien fait de piocher soi-même. Le but est de VARIER. On éprouve donc ce qui
// distingue les deux : l'écart aux derniers tirages, le poids de l'ancienneté,
// le menu sans doublon, et le fait qu'aucune recette ne disparaisse jamais.
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
await p.waitForFunction(()=>typeof tire==='function');

// Un aléa reproductible : sans lui on n'éprouverait que la chance du jour.
await p.evaluate(()=>{
  let s=12345;
  window.grainePoser=v=>{s=v;};
  alea=()=>{ s=(s*1103515245+12345)&0x7fffffff; return s/0x7fffffff; };
});

console.log('=== 1. ON NE REDONNE PAS CE QU\'ON VIENT DE DONNER ===');
const suite=await p.evaluate(()=>{
  histo=[]; recettes.forEach(r=>{r.dernier=null;r.faites=0;});
  const out=[];
  for(let i=0;i<60;i++){ const r=tire(null,null); out.push(r.id); noteTirage(r.id); }
  return {out,total:recettes.length};
});
const s=suite.out;
chk('Soixante tirages, jamais deux fois de suite la même',
    s.every((id,i)=>i===0||id!==s[i-1]));
const fenetre=Math.min(6,Math.floor(suite.total/2));
let collision=0;
s.forEach((id,i)=>{ if(s.slice(Math.max(0,i-fenetre),i).includes(id))collision++; });
chk(`Aucune répétition dans les ${fenetre} derniers tirages`,collision===0,String(collision));
chk('Et pourtant tout le répertoire sort',new Set(s).size===suite.total,
    `${new Set(s).size}/${suite.total}`);

console.log('=== 2. UN PETIT RÉPERTOIRE NE SE BLOQUE JAMAIS ===');
// Deux recettes, une mémoire de six : écarter les récentes rendrait le tirage
// impossible. La règle plafonne l'écart à la moitié du répertoire.
const petit=await p.evaluate(()=>{
  const sauve=recettes;
  recettes=[{id:'a',nom:'A',tags:[],ingredients:[],dernier:null,faites:0},
            {id:'b',nom:'B',tags:[],ingredients:[],dernier:null,faites:0}];
  histo=['a','b','a','b','a','b'];
  const out=[];
  for(let i=0;i<10;i++){ const r=tire(null,null); out.push(r?r.id:null); noteTirage(r.id); }
  recettes=sauve;
  return out;
});
chk('Avec deux recettes, le tirage rend toujours quelque chose',
    petit.every(x=>x==='a'||x==='b'),JSON.stringify(petit));
chk('…et il alterne au lieu de se figer',new Set(petit).size===2,JSON.stringify(petit));

const seule=await p.evaluate(()=>{
  const sauve=recettes;
  recettes=[{id:'x',nom:'X',tags:[],ingredients:[],dernier:null,faites:0}];
  histo=['x','x','x'];
  const r=tire(null,null);
  recettes=sauve;
  return r?r.id:null;
});
chk('Une seule recette au répertoire : c\'est elle, forcément',seule==='x',String(seule));

console.log('=== 3. L\'ANCIENNETÉ PÈSE ===');
const poids=await p.evaluate(()=>{
  const ilya=n=>{const d=new Date();d.setDate(d.getDate()-n);return jour(d);};
  const f=d=>poids({dernier:d});
  return {jamais:f(null),aujourdhui:f(jour()),semaine:f(ilya(7)),deuxmois:f(ilya(60)),
          tresvieux:f(ilya(400))};
});
chk('Jamais faite pèse plus qu\'une faite du jour',poids.jamais>poids.aujourdhui,JSON.stringify(poids));
chk('Une semaine pèse plus qu\'aujourd\'hui',poids.semaine>poids.aujourdhui,JSON.stringify(poids));
chk('Deux mois pèsent plus qu\'une semaine',poids.deuxmois>poids.semaine,JSON.stringify(poids));
chk('Au-delà, le poids est plafonné — rien ne devient certain',
    poids.tresvieux===poids.deuxmois,JSON.stringify(poids));
chk('Et aucun poids n\'est nul : rien ne disparaît du répertoire',
    Object.values(poids).every(v=>v>0),JSON.stringify(poids));

// Sur un grand nombre de tirages, la vieille doit passer devant la récente.
const penchant=await p.evaluate(()=>{
  const sauve=recettes, sh=histo;
  const ilya=n=>{const d=new Date();d.setDate(d.getDate()-n);return jour(d);};
  recettes=[{id:'vieille',nom:'V',tags:[],ingredients:[],dernier:ilya(90),faites:1},
            {id:'hier',nom:'H',tags:[],ingredients:[],dernier:ilya(1),faites:1},
            {id:'tiers',nom:'T',tags:[],ingredients:[],dernier:ilya(30),faites:1}];
  let v=0,h=0;
  for(let i=0;i<600;i++){ histo=[]; const r=tire(null,null); if(r.id==='vieille')v++; if(r.id==='hier')h++; }
  recettes=sauve; histo=sh;
  return {v,h};
});
chk('Sur 600 tirages, la vieille sort plus souvent que celle d\'hier',
    penchant.v>penchant.h*1.5,JSON.stringify(penchant));

console.log('=== 4. LE FILTRE PAR ÉTIQUETTE ===');
const filtre=await p.evaluate(()=>{
  histo=[];
  const out=[];
  for(let i=0;i<30;i++){ const r=tire(['végé'],null); out.push(r); noteTirage(r.id); }
  return out.every(r=>r.tags.includes('végé'));
});
chk('Filtré sur « végé », seules les végé sortent',filtre===true);

console.log('=== 5. LE MENU DE LA SEMAINE ===');
const menu5=await p.evaluate(()=>{
  histo=[]; filtreTag=null;
  document.getElementById('btnMenu5').click();
  return {n:menu.length,distincts:new Set(menu).size,
          lignes:document.querySelectorAll('#listeMenu .menu-ligne').length,
          visible:document.getElementById('blocMenu').style.display!=='none'};
});
chk('Cinq repas sont tirés',menu5.n===5,JSON.stringify(menu5));
chk('…tous différents',menu5.distincts===5,JSON.stringify(menu5));
chk('…et affichés',menu5.lignes===5&&menu5.visible,JSON.stringify(menu5));

const relance=await p.evaluate(()=>{
  const avant=menu.slice();
  document.querySelector('#listeMenu [data-relance="2"]').click();
  return {avant,apres:menu.slice()};
});
chk('Relancer une case ne touche pas les autres',
    relance.apres.filter((id,i)=>i!==2).join()===relance.avant.filter((id,i)=>i!==2).join(),
    JSON.stringify(relance));
chk('…et ne recopie pas un plat déjà au menu',new Set(relance.apres).size===5,JSON.stringify(relance.apres));

const court=await p.evaluate(()=>{
  const sauve=recettes;
  recettes=[{id:'u',nom:'U',tags:[],ingredients:[],dernier:null,faites:0},
            {id:'d',nom:'D',tags:[],ingredients:[],dernier:null,faites:0}];
  histo=[]; tireMenu();
  const out={n:menu.length,distincts:new Set(menu).size};
  recettes=sauve; menu=[];
  return out;
});
chk('Répertoire plus court que la semaine : on s\'arrête, on ne répète pas',
    court.n===2&&court.distincts===2,JSON.stringify(court));

console.log('=== 6. DES INGRÉDIENTS VERS LA LISTE ===');
const vers=await p.evaluate(()=>{
  courses=[]; menu=[];
  const r=recettes.find(x=>x.ingredients.length>=4);
  versCourses([r]);
  const premier=courses.length;
  const rayons=courses.every(i=>!!RAYON[i.rayon]);
  const src=courses.every(i=>i.src==='recette');
  // Deuxième passage : rien ne doit se dédoubler.
  versCourses([r]);
  return {premier,second:courses.length,rayons,src,
          ing:r.ingredients.length,nom:r.nom};
});
chk('Les ingrédients tombent dans la liste',vers.premier===vers.ing,JSON.stringify(vers));
chk('…avec un rayon valide chacun',vers.rayons===true);
chk('…marqués comme venant d\'une recette',vers.src===true);
chk('Y verser deux fois la même recette ne dédouble rien',
    vers.second===vers.premier,JSON.stringify(vers));

const garde=await p.evaluate(()=>{
  courses=[]; const r=recettes.find(x=>x.ingredients.length>=3);
  const n=r.ingredients[0].nom;
  ajoute(n,'autre','libre'); courses[0].qte=5;     // posé à la main, quantité 5
  versCourses([r]);
  const i=courses.find(x=>norm(x.nom)===norm(n));
  return {qte:i.qte,src:i.src,n:courses.length,attendu:r.ingredients.length};
});
chk('Un article déjà posé à la main garde sa quantité',garde.qte===5,JSON.stringify(garde));
chk('…et son origine',garde.src==='libre',JSON.stringify(garde));
chk('…les autres ingrédients s\'ajoutent quand même',garde.n===garde.attendu,JSON.stringify(garde));

console.log('=== 7. « JE LA FAIS » ===');
await p.evaluate(()=>{ histo=[]; filtreTag=null; alea=()=>0.5; });
await p.click('[data-page=recettes]');
await p.click('#btnTirer');
await p.waitForTimeout(800);
const faite=await p.evaluate(()=>{
  const id=sortieId, avant=recettes.find(r=>r.id===id).faites|0;
  document.getElementById('btnFaite').click();
  const r=recettes.find(x=>x.id===id);
  return {date:r.dernier,jour:jour(),faites:r.faites,avant,nom:document.getElementById('sortieNom').textContent};
});
chk('La recette est datée d\'aujourd\'hui',faite.date===faite.jour,JSON.stringify(faite));
chk('…et son compteur monte',faite.faites===faite.avant+1,JSON.stringify(faite));
chk('…et l\'affichage reste sur elle',!!faite.nom,faite.nom);

console.log('=== 8. SUPPRIMER UNE RECETTE NE LAISSE PAS DE TROU ===');
// On passe par le vrai chemin : la modale et son bouton « Supprimer ».
// Refaire la suppression à la main dans l'épreuve n'éprouverait que l'épreuve.
await p.evaluate(()=>{
  document.getElementById('toasts').innerHTML='';   // sinon un « Annuler » plus
  const r=recettes[0];                              // ancien traînerait à l'écran
  histo=[r.id,recettes[1].id]; menu=[r.id,recettes[1].id]; rendMenu();
  window.CIBLE={id:r.id,nom:r.nom,total:recettes.length};
  editeRecette(r);
});
await p.click('#reSup');
const sup=await p.evaluate(()=>({
  reste:recettes.some(r=>r.id===CIBLE.id),
  total:recettes.length,attendu:CIBLE.total-1,
  menu:menu.includes(CIBLE.id),histo:histo.includes(CIBLE.id),
  lignes:document.querySelectorAll('#listeMenu .menu-ligne').length,
  modale:document.getElementById('modalBg').classList.contains('open'),
  annulable:!!document.querySelector('#toasts .toast button')
}));
chk('La recette quitte le répertoire',!sup.reste&&sup.total===sup.attendu,JSON.stringify(sup));
chk('…et le menu, et l\'historique',!sup.menu&&!sup.histo,JSON.stringify(sup));
chk('…sans laisser de ligne vide au menu',sup.lignes===1,JSON.stringify(sup));
chk('…la modale se referme',sup.modale===false);
chk('…et un « Annuler » est proposé',sup.annulable===true);
await p.click('#toasts .toast button');
const rendue=await p.evaluate(()=>({total:recettes.length,la:recettes.some(r=>r.id===CIBLE.id)}));
chk('Annuler la remet au répertoire',rendue.la&&rendue.total===sup.attendu+1,JSON.stringify(rendue));

chk('Aucune erreur JS',errs.length===0,errs.join(' | '));

await b.close();
const ko=R.filter(x=>!x[1]);
R.forEach(([n,ok,d])=>console.log((ok?'  ✓ ':'  ✗ ')+n+(ok?'':' → '+d)));
console.log(`\n${R.length-ko.length}/${R.length}`);
process.exit(ko.length?1:0);
})();
