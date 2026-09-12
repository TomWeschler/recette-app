// Service worker — rend l'app installable et consultable hors ligne.
//
// Même forme que celui du kanban, sans son exception : ici aucun appel ne sort
// du domaine, il n'y a donc rien à laisser passer. Tout est local, et tout est
// caché — y compris les polices, qui sont dans ce dossier précisément pour
// être dans la portée de ce service worker.
const VERSION = 'v1.3.0';
const SHELL   = 'recette-shell-' + VERSION;
const ASSETS  = 'recette-assets-' + VERSION;

const SHELL_FILES = [
  './', './index.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-maskable.png',
  './fonts/syne-400-latin.woff2', './fonts/syne-600-latin.woff2',
  './fonts/syne-700-latin.woff2', './fonts/syne-800-latin.woff2',
  './fonts/space-mono-400-latin.woff2', './fonts/space-mono-700-latin.woff2'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL)
      // addAll échoue en bloc si un seul fichier manque : on tolère les absents.
      .then(c => Promise.all(SHELL_FILES.map(f => c.add(f).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== ASSETS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return;

  // Sonde de version : toujours réseau, sinon l'app ne saurait jamais qu'elle
  // est périmée — c'est précisément le fichier qui sert à le détecter.
  if (url.pathname.endsWith('/version.json')) return;

  // La page : réseau d'abord, pour qu'une nouvelle version arrive dès qu'on
  // est en ligne. Le cache ne sert que de filet hors connexion.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(r => {
        const copie = r.clone();
        caches.open(SHELL).then(c => c.put('./index.html', copie));
        return r;
      }).catch(() => caches.match('./index.html').then(hit => hit || caches.match('./')))
    );
    return;
  }

  // Le reste (polices, icônes) : cache d'abord, il ne change qu'avec la version.
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r && r.ok) {
        const copie = r.clone();
        caches.open(ASSETS).then(c => c.put(req, copie));
      }
      return r;
    }))
  );
});
