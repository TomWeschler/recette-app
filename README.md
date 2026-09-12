# Recette App

Deux besoins d'une même semaine : **ce qu'on achète** et **ce qu'on mange**.

Une page, du JavaScript nu, aucune dépendance, aucun appel sortant :
`index.html` porte tout, `sw.js` rend l'app installable et consultable hors
ligne, `version.json` sert de sonde de mise à jour. Rien à construire, rien à
installer — le dépôt *est* le site.

**En ligne** : https://tomweschler.github.io/recette-app/ — à ouvrir sur le
téléphone, puis « Ajouter à l'écran d'accueil ».

## La liste de courses

- On ajoute à la main ; le **rayon se devine** (récurrents d'abord, puis
  ingrédients des recettes), et reste corrigeable.
- Un article n'apparaît **jamais deux fois** : casse, accents et espaces sont
  ignorés pour la comparaison, la quantité monte à la place.
- La liste est groupée **dans l'ordre du magasin**, pas par ordre alphabétique,
  et ce qui reste à prendre remonte au-dessus de ce qui est coché.
- **Courses de la semaine** : les récurrents hebdomadaires. Un article repris
  il y a six jours ou plus est proposé ; « Tout prendre » verse tous les dus.
- **Le quotidien — restock** : ce qu'on rachète quand le placard est vide, sans
  calendrier. Un appui ajoute, un deuxième retire.
- Ces deux blocs sont **rangés en colonnes par rayon**, dans l'ordre du magasin
  et avec les intitulés de la liste — mêlés, trente articles ne se lisaient
  plus. Dans un rayon, ce qui est dû remonte en tête.
- « Vider les cochés » reste rattrapable pendant six secondes.
- **Une seule liste courante.** « Course faite » la classe entière dans
  l'historique — cochés et non cochés, avec quantités et rayons — et en ouvre
  une vide. Les non cochés se remettent d'un geste dans la nouvelle liste, et
  l'archive, elle, garde la course telle qu'elle a été. Chaque course classée
  se relit (« Voir ») et se reprend (« Reprendre » ajoute ce qui manque à la
  liste courante, sans rien remplacer). Les cinquante dernières sont gardées.
- **Ajout éclair** : un « + » au-dessus de la liste ouvre un champ unique, rien
  à choisir — le rayon se devine comme partout ailleurs, « Autre » n'étant que
  le point de chute des inconnus — et il reste ouvert, on enchaîne.
  Le **raccourci de l'icône du téléphone** (appui long sur l'app → « Ajouter »)
  ouvre directement ce champ ; `./?ajout=Bougies` ajoute l'article tel quel,
  puis nettoie l'URL pour qu'un rafraîchissement ne le rejoue pas.
- **Idées de repas** : « Propose-moi 3 repas » tire trois plats au hasard —
  mêmes règles de variété que le tirage —, chacun avec son propre bouton pour
  verser ses ingrédients, et son ↻ pour changer celui-là seulement. Redemander
  rend trois autres plats. Une idée dont tout est déjà dans la liste se marque
  « aux courses » : c'est une lecture de la liste, donc retirer un article
  redonne le bouton.

Sur un écran large, la liste occupe la colonne de gauche avec son historique en
dessous, et tout ce qui la remplit la colonne de droite, qui reste en place
quand la liste défile. Sur un téléphone, une seule colonne et **la liste en
tout premier** — c'est elle qu'on ouvre en magasin, elle doit être là sans un
geste — puis de quoi la remplir, l'historique en dernier.

## Le tirage

Le but n'est pas de rendre une recette au hasard — un tirage uniforme redonne
les pâtes trois fois en dix jours. Le but est de **varier** :

1. les dernières tirées sont écartées, tant qu'il reste assez de candidates
   (au plus la moitié du répertoire, pour qu'un petit répertoire ne se bloque
   jamais) ;
2. parmi celles qui restent, plus une recette est ancienne, plus elle est
   lourde — jamais nulle, donc aucune ne disparaît.

« Je la fais » date la recette, ce qui la fait reculer dans les tirages
suivants. « Aux courses » verse ses ingrédients dans la liste sans écraser ce
qui y était déjà. « Menu de la semaine » tire cinq repas distincts, chaque case
étant relançable seule.

## Les thèmes

Dix palettes sombres — Ardoise, Brume, Forêt, Prune, Océan, Argile, Sable,
Nuit, Bois de rose, Charbon — dans le menu « ··· ». Toutes construites pareil :
un fond très peu saturé, trois surfaces qui montent doucement, un accent
tempéré, et **aucun blanc pur sur aucun noir pur** — c'est ce contraste-là qui
fatigue les yeux. Le thème est posé sur `<html data-theme>` : en changer ne
reconstruit rien, le navigateur recalcule les variables. Il est relu avant la
feuille de style, donc aucun clignotement au lancement, et il survit à
« Tout effacer ».

## Synchronisation — un classeur Google partagé

Sans réglage, l'app vit dans le seul `localStorage` : chaque appareil a sa
liste. Reliée à un classeur Google, elle devient partageable à plusieurs — le
classeur est la vérité commune, le `localStorage` un cache qui reste seul maître
quand le réseau manque.

**Réglage, une fois :** menu « ··· » → Synchronisation. Coller un identifiant
client OAuth (Google Cloud → API et services → Identifiants → ID client OAuth
pour application Web, avec `https://<compte>.github.io` en origine autorisée),
puis « Connecter », puis « Créer un classeur ». Sur le deuxième appareil : même
identifiant client, et l'identifiant du classeur, que l'on lit dans son URL.
Rien de tout cela n'est dans le dépôt : les deux identifiants sont saisis dans
l'app et gardés localement.

**Qui peut lire :** le classeur est un fichier Drive ordinaire. Seuls les
comptes avec qui il est partagé y accèdent — ni le code public, ni
l'identifiant client ne donnent le moindre accès aux données. Laisser l'écran
de consentement en mode « Test » ferme la porte une seconde fois : seuls les
comptes listés comme testeurs peuvent autoriser l'app.

**Comment les conflits sont tranchés :**

1. chaque ligne porte sa date de modification ; entre deux versions d'une même
   ligne, la plus récente gagne ;
2. supprimer ne retire pas la ligne, ça pose une **pierre tombale** — sans
   elle, l'autre appareil, qui a encore l'article, le ressusciterait à la
   synchro suivante. Elles sont balayées au bout d'un mois ;
3. on ne pousse **jamais** sans avoir relu et fusionné juste avant : une
   écriture est toujours « l'état commun + mes changements », jamais « mon état
   à la place du tien ».

La liste de courses et l'historique voyagent ligne à ligne — c'est ce qu'on
touche à deux. Les récurrents, les recettes, les tirages et les idées voyagent
en bloc : ils changent rarement, une fusion ligne à ligne n'y apporterait rien.

La synchro part à l'ouverture, au retour sur l'app, au retour du réseau, toutes
les 45 secondes tant que l'app est visible, et une seconde et demie après chaque
modification. Un appui sur la pastille de l'en-tête la force.

## Sauvegarde

Le menu « ··· » exporte et réimporte un fichier JSON. C'est la seule copie
tant qu'aucun classeur n'est relié — et une copie indépendante de Google
ensuite, qu'il reste sage de garder.

## Les épreuves

```bash
python3 -m http.server 8899 --bind 127.0.0.1 &   # depuis la racine du dépôt
npm install playwright --no-audit --no-fund      # une fois
node tests/courses.js
node tests/tirage.js
node tests/synchro.js
```

| Fichier | Sujet |
|---|---|
| `tests/courses.js` | Le fonds de départ, le dédoublonnage, les rayons devinés, les propositions hebdo, le restock, l'annulation, la persistance. |
| `tests/synchro.js` | La synchronisation à deux : premier envoi, retour du classeur, conflits, pierres tombales, hors ligne, deux appareils sur le même classeur. |
| `tests/tirage.js` | L'écart aux derniers tirages, le poids de l'ancienneté, les petits répertoires, le filtre, le menu, les ingrédients versés, la suppression. |

Le navigateur est cherché dans `/opt/pw-browsers/chromium-1194/…` ; sur une
autre machine, indiquer le sien : `PW_CHROME=/chemin/vers/chrome node …`.
Une autre adresse se donne avec `BASE=…`.

## Les polices

Syne et Space Mono sont dans `fonts/`, servies par le dépôt lui-même. Aucune
requête ne part vers un tiers, et le service worker les pré-charge — l'app a
exactement la même tête hors ligne.

## Publier une version

Les trois numéros doivent bouger ensemble, sinon la sonde croit l'app périmée
en boucle : `APP_VERSION` dans `index.html`, `VERSION` dans `sw.js`, et
`version.json`. GitHub Pages sert la nouvelle version dans la minute ; les
appareils déjà installés la prennent au retour au premier plan.
