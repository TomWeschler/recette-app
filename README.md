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
- « Vider les cochés » reste rattrapable pendant six secondes.
- **Idées de repas** : « Propose-moi 3 repas » tire trois plats au hasard —
  mêmes règles de variété que le tirage —, chacun avec son propre bouton pour
  verser ses ingrédients, et son ↻ pour changer celui-là seulement. Redemander
  rend trois autres plats. Une idée dont tout est déjà dans la liste se marque
  « aux courses » : c'est une lecture de la liste, donc retirer un article
  redonne le bouton.

Sur un écran large, la liste occupe la colonne de gauche et tout ce qui la
remplit la colonne de droite, qui reste en place quand la liste défile. Sur un
téléphone, une seule colonne, la saisie au-dessus.

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

## Sauvegarde

Tout vit dans `localStorage`, et nulle part ailleurs : il n'y a pas de serveur.
Vider les données du site efface la liste et les recettes. Le menu « ··· »
exporte et réimporte un fichier JSON — c'est la seule copie.

## Les épreuves

```bash
python3 -m http.server 8899 --bind 127.0.0.1 &   # depuis la racine du dépôt
npm install playwright --no-audit --no-fund      # une fois
node tests/courses.js
node tests/tirage.js
```

| Fichier | Sujet |
|---|---|
| `tests/courses.js` | Le fonds de départ, le dédoublonnage, les rayons devinés, les propositions hebdo, le restock, l'annulation, la persistance. |
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
