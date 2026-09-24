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

## 5. Tests

- `packages/client/test/store.test.ts` : logique pure (versions, synchro complète, horloge, sélecteurs).
- `packages/client/e2e/two-tabs.e2e.ts` (`npm run test:e2e`) : **deux onglets d'un vrai Chromium**. Ils créent,
  rejoignent par lien d'invitation, jouent, rafraîchissent, ferment et rouvrent un onglet (reprise), puis vont jusqu'à la fin de
  partie. Le test vérifie aussi qu'il n'y a pas de défilement horizontal en affichage mobile (390 × 844).
  Chromium est cherché dans `CHROMIUM_PATH` ou `/opt/pw-browsers/chromium`. `E2E_SCREENSHOTS=dossier`
  enregistre des captures d'écran.
