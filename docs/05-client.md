# Client web

Package `packages/client` : React 18 + TypeScript + Vite, sans framework CSS ni bibliothèque d'état.

## 1. Organisation

```
src/
├── main.tsx              point d'entrée : crée le GameClient et le fournit via un contexte React
├── App.tsx               choix de l'écran selon la session et la phase ; URL /partie/CODE
├── net/
│   ├── client.ts         connexion Socket.IO, reprise de session, actions, notifications
│   ├── store.ts          état client (PUR) : intégration des messages, versions, horloge
│   └── messages.ts       motifs de refus → messages en français
├── game/helpers.ts       sélecteurs d'affichage (adversaires, noms, puissance, derniers sorts)
├── hooks/useGame.ts      useClientState (useSyncExternalStore), useNow (comptes à rebours)
├── screens/              Home, Lobby, Game, GameOver
├── components/           RuneCard, PlayerPanel, SpellBuilder, Hand, Timer, EventLog, ChoiceDialog, Modal…
└── styles/app.css        thème, mise en page responsive, animations
```

## 2. Principes

- **Le client n'invente aucun état de jeu.** Il affiche la dernière vue reçue du serveur, et chaque clic
  envoie une *intention* (`PLACE_RUNE`, `LOCK_SPELL`, `CHOOSE`…). Un refus du serveur s'affiche en notification.
- **Versions** : un état de version inférieure ou égale au dernier reçu est ignoré (`applyStateMessage`).
  Une synchronisation complète remplace le journal.
- **Minuteurs** : les échéances sont en heure serveur. Le client les corrige du décalage d'horloge
  (`serverTime − Date.now()` à la réception).
- **Animations** : nombres flottants de dégâts et de soins, secousse, apparition des sorts et des statuts. Elles
  sont purement décoratives et l'état réel est toujours affiché immédiatement. Elles sont désactivées par
  `prefers-reduced-motion`.
- **Cartes** : le texte, l'école, l'emplacement et l'initiative viennent directement du catalogue du moteur
  (`@baston/engine`), sans duplication.

## 3. Session et reconnexion

| Stockage | Contenu | Usage |
|---|---|---|
| `sessionStorage` | session de l'onglet | un rafraîchissement reprend la partie |
| `localStorage` | dernière session + battement de cœur (toutes les 2 s) | onglet fermé par erreur : un nouvel onglet reprend la partie si le battement a plus de 6 s |

Cette séparation permet à **deux onglets du même navigateur de jouer l'un contre l'autre** : le second onglet
ne vole pas la session du premier tant que celui-ci est ouvert.

Socket.IO se reconnecte seul (délais de 0,4 à 4 s) ; à chaque connexion, le client envoie `game:resume`.
Pendant une coupure, un bandeau « reconnexion en cours » s'affiche et les actions sont refusées localement.

## 4. Interface de jeu

- **En-tête** : manche et tour, message de phase, compte à rebours, boutons Règles, Journal (mobile) et Quitter.
- **Adversaires** : PV, Couronnes, statuts avec leur durée, reliques, invocations, connexion, taille de main,
  état du sort (nombre de runes et « prêt » avant la révélation, runes visibles ensuite).
- **Zone de jeu** : sorts du dernier tour dans l'ordre de résolution.
- **Mon sorcier** : fiche, et les 3 emplacements du sort avec l'aperçu des dés de Puissance et de l'initiative.
- **Main** : un clic place la rune dans son emplacement ; une rune instable demande de choisir l'emplacement.
  Un clic sur une rune du sort la retire.
- **Choix** (cible, option, défausse) : fenêtre modale avec son propre compte à rebours.
- **Journal** : colonne à droite sur ordinateur, tiroir sur mobile, annoncé aux lecteurs d'écran (`aria-live`).

Accessibilité :
- cibles tactiles de 44 px minimum ;
- focus visible ;
- libellés ARIA sur les cartes et les jauges de PV ;
- modales avec focus initial, fermeture avec Échap.

## 5. Finitions (phase 7)

- **Rejeu animé de la résolution** (`components/ResolutionReplay.tsx`, `game/replay.ts`). Les événements d'un
  tour sont découpés en étapes : révélation, sort lancé, puis chaque rune avec sa carte, ses dés et ses effets
  ligne par ligne, puis la fin du tour. Le rejeu occupe la zone centrale, le bouton « Passer ⏭ » l'interrompt, et il est
  désactivé si `prefers-reduced-motion` est actif. **L'état final est affiché dès réception** : le rejeu ne fait que
  raconter.
- **Sons synthétisés** (`audio.ts`, Web Audio, aucun fichier). Ils accompagnent la pose de rune, le lancement,
  la révélation, les dés, les dégâts, les soins, les effets, la mort, le début de tour, le tic des 5 dernières
  secondes, la victoire et la défaite. Bouton 🔊/🔇 ou touche **M**, préférence mémorisée.
- **Raccourcis clavier** : **1–9** jouer la n-ième rune (numéro affiché sur la carte), **Entrée** lancer le sort,
  **⌫** le modifier, **J** journal, **M** son, **?** règles, **Échap** annuler la sélection d'une rune instable.
- **Revanche** en un clic depuis l'écran de fin. Les autres joueurs voient « Rejoindre la revanche de X ».
- **Concentration** affichée dans l'aperçu du sort (« 🎯 +2 dés ») et expliquée dans les règles.
- Vibration légère au début de chaque tour, sur les appareils qui la gèrent.

## 6. Tests

- `packages/client/test/store.test.ts` : logique pure (versions, synchro complète, horloge, sélecteurs).
- `packages/client/e2e/two-tabs.e2e.ts` (`npm run test:e2e`) : **deux onglets d'un vrai Chromium**. Ils :
  - créent une partie et la rejoignent par le lien d'invitation ;
  - jouent, rafraîchissent un onglet, ferment et rouvrent un onglet (reprise) ;
  - vont jusqu'à la fin de partie, puis **lancent une revanche** ensemble.

  Deux autres tests vérifient le rejeu animé, le bouton « Passer » et les raccourcis clavier, ainsi que l'affichage mobile
  (390 × 844, sans défilement horizontal, journal en tiroir).
  Chromium est cherché dans `CHROMIUM_PATH` ou `/opt/pw-browsers/chromium`. `E2E_SCREENSHOTS=dossier`
  enregistre des captures d'écran.

## 7. Bots, grimoire et illustrations

- **Jouer contre des bots** (accueil) : choix du nombre (1 à 5), du niveau et du mode. Le client crée la partie,
  ajoute les bots et la lance. Dans un lobby ordinaire, l'hôte peut aussi ajouter ou retirer des bots. Les bots
  sont signalés par 🤖.
- **Grimoire** (accueil) : les 122 cartes, illustrées, filtrables par type et par école.
- **Illustrations** (`src/art/`) : chaque carte est une scène SVG originale, sans image externe.
  - `emblems.tsx` : environ 65 emblèmes vectoriels dessinés pour le jeu, dans une boîte de 100 × 100, colorés par `--e1/--e2/--e3`.
  - `cardArt.ts` : l'emblème principal et l'emblème secondaire **de chaque carte**.
  - `CardArt.tsx` : compose la scène. Le fond reprend la couleur de l'école (doré pour les reliques, spectral pour
    les rancunes). Le motif (rayons, cercles, étincelles, ondes, runes) et l'inclinaison sont tirés d'une graine
    propre à la carte. Le cadre dépend de l'emplacement : cercle pour l'Amorce, losange pour la Torsion, étoile
    pour la Frappe, hexagone pour une relique, stèle pour une rancune.
- **Ajouter une carte** : ajoutez aussi son entrée dans `cardArt.ts`. Le test `packages/client/test/art.test.ts`
  échoue si une carte n'a pas d'illustration, si un emblème n'existe pas ou si deux illustrations sont identiques.
