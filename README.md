# Baston de Sorciers

Jeu de cartes de combat de sorciers, multijoueur en temps réel (2 à 6 joueurs), jouable dans le navigateur.
Chaque tour, les sorciers assemblent **en secret** un sort de 1 à 3 **runes** (Amorce → Torsion → Frappe).
Les sorts sont révélés, puis résolus du plus court au plus long. Le dernier sorcier debout gagne une
**Couronne**, et deux Couronnes remportent la partie.

> Jeu original. Il s'inspire de *mécaniques* de jeux de combat de sorciers, sans en reprendre les noms,
> textes, personnages ni visuels.

## État d'avancement

| Phase | Contenu | État |
|---|---|---|
| 1 | Analyse, règles, architecture — [`docs/01-analyse.md`](docs/01-analyse.md) | ✅ |
| 2 | Moteur de règles pur (`packages/engine`) — [`docs/03-moteur.md`](docs/03-moteur.md) | ✅ |
| 3 | Suite de tests du moteur : 177 tests, 98,5 % des lignes couvertes, fuzzing | ✅ |
| 4 | Serveur : lobby, Socket.IO, validation, reconnexion — [`docs/04-serveur.md`](docs/04-serveur.md) | ✅ |
| 5–6 | Client React connecté au serveur — [`docs/05-client.md`](docs/05-client.md) | ✅ |
| 7 | Finitions (animations de résolution, sons, équilibrage) | — |

## Prérequis

- Node.js ≥ 20 (testé avec Node 22)
- npm ≥ 10

## Démarrage rapide

```bash
npm install
npm run dev
```

Ouvrez **http://localhost:5173**, créez une partie, puis ouvrez le lien d'invitation dans un **deuxième onglet**
(ou sur un autre appareil du même réseau) : les deux onglets jouent l'un contre l'autre.

## Commandes

```bash
npm run dev           # client (http://localhost:5173) + serveur (3001) avec rechargement automatique
npm run build         # compile le client dans packages/client/dist
npm start             # production : le serveur (3001) sert le client compilé et le jeu
npm test              # tests unitaires et d'intégration (moteur, serveur, client)
npm run test:e2e      # build + tests de bout en bout dans Chromium (deux onglets)
npm run test:coverage # couverture
npm run typecheck     # vérification TypeScript stricte (tous les packages)
npm run sim -- 200 4  # simule 200 parties à 4 bots (rythme, équilibrage)
npm run cards:doc     # régénère docs/02-cartes.md depuis le catalogue
```

## Documentation

- [`docs/01-analyse.md`](docs/01-analyse.md) : mécaniques, règles reconstruites, architecture, modèle de données, machine à états, décisions D1–D11
- [`docs/02-cartes.md`](docs/02-cartes.md) : catalogue complet des cartes (généré)
- [`docs/03-moteur.md`](docs/03-moteur.md) : API du moteur, résolution, **ajout d'une carte ou d'un effet**, garde-fous, décisions D12–D24, tests
- [`docs/04-serveur.md`](docs/04-serveur.md) : serveur temps réel, **protocole**, reconnexion, sécurité, **variables d'environnement**
- [`docs/05-client.md`](docs/05-client.md) : client web, gestion de session multi-onglets, interface, tests de bout en bout

## Structure

```
packages/
├── engine/   moteur de règles pur (TypeScript, sans I/O), cartes, tests
├── shared/   protocole client/serveur et schémas Zod
├── server/   serveur Node.js + Socket.IO (salons, sessions, minuteurs)
└── client/   interface React + Vite
docs/         analyse, catalogue des cartes, guides moteur et serveur
```
