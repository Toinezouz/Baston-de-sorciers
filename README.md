# Baston de Sorciers

Jeu de cartes de combat de sorciers, multijoueur en temps réel (2 à 6 joueurs), jouable dans le navigateur.
Chaque tour, les sorciers assemblent **en secret** un sort de 1 à 3 **runes** (Amorce → Torsion → Frappe).
Les sorts sont révélés, puis résolus du plus court au plus long. Le dernier sorcier debout gagne une
**Couronne**, et deux Couronnes remportent la partie.

> Jeu original. Il s'inspire de *mécaniques* de jeux de combat de sorciers, sans en reprendre les noms,
> textes, personnages ni visuels.

## État d'avancement

| Phase | Contenu | Documentation |
|---|---|---|
| 1 | Analyse, règles, architecture | [`docs/01-analyse.md`](docs/01-analyse.md) |
| 2–3 | Moteur de règles pur et déterministe, cartes originales, tests et fuzzing | [`docs/03-moteur.md`](docs/03-moteur.md), [`docs/02-cartes.md`](docs/02-cartes.md) |
| 4 | Serveur autoritaire temps réel : lobby, Socket.IO, reconnexion, sécurité | [`docs/04-serveur.md`](docs/04-serveur.md) |
| 5–6 | Client React connecté, jouable sur ordinateur et mobile | [`docs/05-client.md`](docs/05-client.md) |
| 7 | Rejeu animé, sons, raccourcis, revanche, équilibrage par simulation, déploiement | [`docs/06-equilibrage.md`](docs/06-equilibrage.md) |
| + | Extension « Échos du Grimoire » (**122 cartes**), **bots** (3 niveaux), **illustrations** de toutes les cartes, grimoire | [`docs/03-moteur.md`](docs/03-moteur.md) §9, [`docs/05-client.md`](docs/05-client.md) §7 |

Environ 270 tests unitaires et d'intégration, plus 4 tests de bout en bout dans un vrai navigateur (deux onglets l'un contre l'autre, partie solo contre des bots, rejeu, mobile).

## Règles en bref

- 2 à 6 sorciers, 20 PV (12 en mode rapide). Chaque tour, tous préparent **en secret** un sort de 1 à 3 runes :
  **Amorce → Torsion → Frappe**.
- Les sorts sont révélés, puis résolus du **plus court au plus long**. À égalité, l'initiative ⚡ de la Frappe départage, puis le hasard.
- **Puissance** : 1 dé par rune de la même école dans le sort (paliers 1–4 / 5–9 / 10+). **Concentration** : +2 dés pour un
  sort d'une rune, +1 pour deux runes.
- Cinq écoles : 🔥 Braise, 🌑 Ombre, 🌿 Sève, ✨ Éther, 🎭 Chimère. Il existe aussi des runes bi-écoles et des runes instables.
- Statuts (Brûlure, Venin, Égide, Épines, Rage…), reliques, invocations.
- Le dernier debout gagne une 👑 Couronne et une relique. Les morts reviennent avec une Rancune d'outre-tombe.
  **2 Couronnes** remportent la partie (1 en mode rapide).
- Toutes les décisions de règles ambiguës sont numérotées (D1–D25) dans `docs/01-analyse.md` et `docs/03-moteur.md`.

## Prérequis

- Node.js ≥ 20 (testé avec Node 22)
- npm ≥ 10

## Démarrage rapide

```bash
npm install
npm run dev
```

Ouvrez **http://localhost:5173** puis :
- **« Jouer contre des bots »** pour une partie solo immédiate (1 à 5 bots, facile / normal / difficile) ;
- ou créez une partie et ouvrez le lien d'invitation dans un **deuxième onglet** (ou sur un autre appareil du même
  réseau) : les deux onglets jouent l'un contre l'autre. L'hôte peut aussi compléter la table avec des bots.

## Commandes

```bash
npm run dev           # client (http://localhost:5173) + serveur (3001) avec rechargement automatique
npm run build         # compile le client dans packages/client/dist
npm start             # production : recompile le client puis démarre le serveur (3001), qui sert le jeu
npm test              # tests unitaires et d'intégration (moteur, serveur, client)
npm run test:e2e      # build + tests de bout en bout dans Chromium (deux onglets)
npm run test:coverage # couverture
npm run typecheck     # vérification TypeScript stricte (tous les packages)
npm run sim -- 200 4  # simule 200 parties à 4 bots (rythme)
npm run balance -- 600 # compare des stratégies de bots (équilibrage, voir docs/06)
npm run cards:doc     # régénère docs/02-cartes.md depuis le catalogue
```

## Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| Bandeau « Une nouvelle version du jeu est en service » | La page affichée est plus ancienne que le serveur (cache du navigateur, client non recompilé) | Cliquer **Recharger**. En production, `npm start` recompile désormais le client automatiquement |
| Écran « Le grimoire a pris feu… » | Erreur d'affichage inattendue | **Recharger** reprend la partie ; **Réinitialiser** revient à l'accueil. Le détail technique est dans l'écran et dans la console du navigateur (F12) |
| « Connexion perdue — reconnexion en cours » | Le serveur de jeu est arrêté ou injoignable | Vérifier que `npm run dev` (ou `npm start`) tourne toujours et que le port 3001 n'est pas occupé par un autre programme |

## Ajouter une carte ou un effet

- **Nouvelle carte** : ajoutez un objet de données dans `packages/engine/src/cards/` (runes, reliques, rancunes),
  choisissez son illustration dans `packages/client/src/art/cardArt.ts`, lancez `npm test` (catalogue et
  illustrations validés automatiquement) puis `npm run cards:doc`.
- **Nouvel effet** : ajoutez une variante à `EffectNode` (`types.ts`) et son opérateur dans `effects/operators.ts`.
  Le compilateur signale tout oubli.
- Pas à pas détaillé : [`docs/03-moteur.md`](docs/03-moteur.md) §4 et §5.

## Déploiement

Le jeu tient dans **un seul processus Node** : le serveur sert le client compilé, l'API et le WebSocket sur le même port.

```bash
npm ci
npm run build
npm prune --omit=dev      # facultatif : retire les outils de développement
PORT=3001 CORS_ORIGIN=https://mon-domaine.fr npm start
```

Avec Docker :

```bash
docker build -t baston-de-sorciers .
docker run -p 3001:3001 -e CORS_ORIGIN=https://mon-domaine.fr baston-de-sorciers
```

> Les étapes du `Dockerfile` (installation, build, élagage, démarrage) ont été vérifiées à l'identique hors
> conteneur. L'image elle-même n'a pas pu être construite dans l'environnement de développement (pas de démon Docker).

Points d'attention en production :
- **Proxy inverse** (Nginx, Caddy, Traefik) : activer le passage des WebSockets vers `/socket.io/`.
- **Une seule instance** : les parties vivent en mémoire. Pour plusieurs instances, il faudrait des sessions
  « collantes » par code de partie. Un redémarrage termine les parties en cours.
- Restreindre `CORS_ORIGIN` au domaine du jeu. Les autres variables sont listées dans [`docs/04-serveur.md`](docs/04-serveur.md) §5.
- Surveiller `GET /health`.
- Hébergeurs adaptés : toute plateforme qui exécute un conteneur ou Node ≥ 20 avec WebSockets (Fly.io, Render, Railway, un VPS…).

## Documentation

- [`docs/01-analyse.md`](docs/01-analyse.md) : mécaniques, règles reconstruites, architecture, modèle de données, machine à états, décisions D1–D11
- [`docs/02-cartes.md`](docs/02-cartes.md) : catalogue complet des cartes (généré)
- [`docs/03-moteur.md`](docs/03-moteur.md) : API du moteur, résolution, **ajout d'une carte ou d'un effet**, garde-fous, décisions D12–D24, tests
- [`docs/04-serveur.md`](docs/04-serveur.md) : serveur temps réel, **protocole**, reconnexion, sécurité, **variables d'environnement**
- [`docs/05-client.md`](docs/05-client.md) : client web, gestion de session multi-onglets, interface, finitions, tests de bout en bout
- [`docs/06-equilibrage.md`](docs/06-equilibrage.md) : simulations, stratégies, cartes fortes ou faibles, combos, garde-fous

## Structure

```
packages/
├── engine/   moteur de règles pur (TypeScript, sans I/O), cartes, tests
├── shared/   protocole client/serveur et schémas Zod
├── server/   serveur Node.js + Socket.IO (salons, sessions, minuteurs)
└── client/   interface React + Vite
docs/         analyse, catalogue des cartes, guides moteur et serveur
```
