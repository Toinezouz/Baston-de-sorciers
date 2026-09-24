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
| 3 | Suite de tests complète du moteur | ⏳ (35 tests de fumée et de scénarios déjà en place) |
| 4 | Serveur (lobby, WebSocket, reconnexion) | — |
| 5–7 | Client React, intégration, finitions | — |

## Prérequis

- Node.js ≥ 20 (testé avec Node 22)
- npm ≥ 10

## Commandes

```bash
npm install          # installe les dépendances de développement
npm test             # lance tous les tests (Vitest)
npm run typecheck    # vérification TypeScript stricte
npm run sim -- 200 4 # simule 200 parties à 4 bots et affiche des statistiques de rythme et d'équilibrage
npm run cards:doc    # régénère docs/02-cartes.md depuis le catalogue
```

## Documentation

- [`docs/01-analyse.md`](docs/01-analyse.md) : mécaniques, règles reconstruites, architecture, modèle de données, machine à états, décisions D1–D11
- [`docs/02-cartes.md`](docs/02-cartes.md) : catalogue complet des cartes (généré)
- [`docs/03-moteur.md`](docs/03-moteur.md) : API du moteur, résolution, **ajout d'une carte ou d'un effet**, garde-fous, décisions D12–D22
