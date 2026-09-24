# Moteur de règles — guide technique

Package : `packages/engine` (TypeScript pur, aucune dépendance d'exécution, aucune I/O).

## 1. API

```ts
import { createGame, dispatch, viewFor, eventsFor, describeEvent } from "@baston/engine";

let state = createGame({ id: "KRAB42", seed: "graine-serveur" });
let r = dispatch(state, { system: { type: "JOIN", playerId: "p1", name: "Alex" } });
if (r.ok) state = r.state;           // r.events : événements produits par cette action
else console.log(r.reason);           // ex. "CARD_NOT_IN_HAND" — l'état n'a pas changé

viewFor(state, "p1");                 // { public, private } : ce que p1 a le droit de voir
eventsFor(r.events, "p2");            // événements filtrés pour p2
```

- `dispatch` ne modifie jamais l'état reçu. Il travaille sur une copie et ne la renvoie qu'en cas de succès.
- Une action illégale donne `{ ok: false, reason }`. Une exception interne donne `ENGINE_ERROR`, et l'état reste intact.
- Le moteur n'a **pas d'horloge**. Il publie des minuteurs (`state.timers` : id, type, durée). Le serveur
  les arme puis envoie `{ system: { type: "TIMEOUT", timerId } }` à l'échéance. Un minuteur périmé est refusé (`STALE_TIMER`).

### Actions joueur
`SET_READY`, `START_GAME` (hôte), `PLACE_RUNE {cardId, slot}`, `REMOVE_RUNE {slot}`, `LOCK_SPELL`,
`UNLOCK_SPELL`, `CHOOSE {requestId, optionIds}`, `LEAVE`.

### Actions système (émises par le serveur uniquement)
`JOIN {playerId, name}`, `TIMEOUT {timerId}`, `CONNECTION {playerId, status}`, `ABANDON {playerId}`.

## 2. Organisation

```
src/
├── types.ts            Tous les types sérialisables (état, cartes, effets, événements, actions)
├── constants.ts        Configuration par défaut, garde-fous, paliers de Puissance
├── rng.ts              PRNG sfc32 seedé ; l'état vit dans GameState.rng
├── dispatch.ts         Point d'entrée : copie → action → advance → version++
├── views.ts            Projections publique / privée, filtrage des événements
├── format.ts           Événement → phrase française (journal)
├── bot.ts              Bot aléatoire (simulations, tests)
├── cards/              CONTENU (données) : runes, reliques, rancunes, statuts, invocations, registre
├── state/              Création de partie, utilitaires (voisins, passifs, pioche), émission d'événements
├── effects/            Opérateurs d'effet, pipeline dégâts/soins/statuts, ciblage, montants, conditions
├── resolution/         File de résolution, déclencheurs, morts
└── machine/            Machine à états (phases.ts) et validation des actions (actions.ts)
```

> Écart assumé par rapport à `01-analyse.md` : les types partagés vivent pour l'instant dans `engine`
> (le moteur est pur et importable côté navigateur). Le package `shared` sera créé en phase 4 pour le
> protocole réseau et les schémas Zod.

## 3. Résolution

```
action joueur → validation (Rejection si illégale) → advance()
  advance : pour chaque phase automatique, entrée puis étape, jusqu'à une attente
  RESOLUTION : pour chaque sort (ordre d'initiative), pour chaque rune (Amorce → Torsion → Frappe) :
     tâches = effets de la rune
     drainQueue :
        tâche = queue.shift()
        garde-fous (profondeur ≤ 16, budget ≤ 2000 tâches/dispatch)
        opérateur (peut lever NeedChoice → suspension, AWAITING_CHOICE)
        markDeaths (morts simultanées)
        collectTriggers (sur tous les événements produits, morts comprises)
        finalizeDeaths (reliques perdues, invocations dissipées)
        queue = [...déclencheurs, ...sous-effets, ...reste]
```

**Choix en cours de résolution.** Un opérateur résout ses cibles et demande ses choix **avant** toute
mutation. S'il manque une réponse, il lève `NeedChoice` : le moteur annule les événements et tirages de
cette tâche, remet la tâche en tête de file et passe en `AWAITING_CHOICE`. La réponse est ensuite stockée
dans `task.answers`, puis la tâche est rejouée à l'identique. Si une seule option est possible, le choix est automatique.

## 4. Ajouter une carte

1. Choisir le fichier (`cards/runes.ts`, `relics.ts` ou `grudges.ts`).
2. Écrire la carte sous forme de **données** avec le DSL (`cards/dsl.ts`) :

```ts
{
  id: "rune.ombre.nouvelle", kind: "RUNE", slot: "TORSION", schools: ["OMBRE"], copies: 2,
  name: "Nom original",
  text: "Texte clair destiné au joueur.",
  effects: [drain(T.CHOSEN_FOE, 2, "OMBRE"), status(T.SELF, "rage", { stacks: 1 })],
}
```

3. `npm test`. Le test du catalogue valide la structure (statuts et invocations existants, `ECHO.max`, durées, texte non vide…).
4. `npm run cards:doc` pour régénérer `docs/02-cartes.md`.
5. `npm run sim -- 300 4` pour vérifier que la carte ne déséquilibre pas les parties.

Le texte (`text`) est rédigé à la main : il doit décrire exactement les effets.

## 5. Ajouter un nouveau type d'effet

1. Ajouter une variante à `EffectNode` dans `types.ts`, par exemple `{ op: "SWAP_HP"; target: TargetSpec }`.
2. Ajouter l'opérateur dans `effects/operators.ts`. Le compilateur signale son absence, car la table est exhaustive.
   Contrat : cibles et choix d'abord ; hasard uniquement via `state.rng` ; un événement par changement observable.
3. Si l'effet contient des sous-effets, étendre `validateEffects` (`cards/registry.ts`) et les parcours de `scripts/cards-doc.ts`.
4. Écrire un test de scénario.

Pour réagir à un événement, on n'ajoute **pas** d'opérateur : on crée un passif
`{ trigger: { on: "ON_DAMAGE_RECEIVED", filter, effects } }` sur un statut, une relique ou une invocation.
Pour un nouveau type de déclencheur, ajouter une entrée dans `TRIGGER_MAP` (`resolution/triggers.ts`).

## 6. Garde-fous

| Garde | Valeur | Effet |
|---|---|---|
| Profondeur de chaîne | 16 | tâche ignorée + `ENGINE_GUARD` |
| Tâches par dispatch | 2000 | file purgée + `ENGINE_GUARD` |
| Activations d'un même passif par sort | 3 | `TRIGGER_SUPPRESSED` |
| `maxPerTurn` d'un déclencheur | par carte | activation ignorée |
| Écho | ≤ 5 itérations | validé au chargement |
| Durée de statut | ≤ 5 tours | tronquée |
| Transitions automatiques par dispatch | 500 | `ENGINE_ERROR` (état intact) |
| Tours par manche | mort subite dès le tour 20, manche nulle au tour 40 | — |
| Manches par partie | 15 | départage D5 |

## 7. Décisions de règles prises pendant l'implémentation

Elles s'ajoutent à D1–D11 de `01-analyse.md`. Chaque décision est repérée dans le code par `[RULE Dx]`.

| # | Décision |
|---|---|
| D6 (précision) | Si le lanceur meurt pendant son sort, la rune **en cours** termine ses effets ; les runes suivantes sont annulées. Dès qu'il reste au plus un sorcier, la file en cours se vide (ses déclencheurs peuvent encore tuer le dernier, ce qui donne une manche nulle), puis aucune nouvelle rune n'est lancée. |
| D12 | Un sorcier qui meurt perd ses reliques, **sauf les éternelles**. Le vainqueur d'une manche gagne 1 relique. |
| D13 | Les effets sur la durée (Brûlure, Venin, Régénération) agissent en fin de tour, **avant** le décompte. Un statut de « 2 tours » agit donc 2 fois : au tour courant et au suivant. |
| D14 | Un sorcier contrôle au plus 3 invocations ; la plus ancienne disparaît. |
| D15 | Égalité pour « le plus robuste » ou « le plus affaibli » : premier sorcier dans l'ordre des sièges à partir de la gauche du lanceur. |
| D16 | Si la cible choisie n'est plus valide au moment de reprendre (abandon entre-temps), un candidat est tiré au sort. |
| D17 | En duel, « gauche » et « droite » désignent le même adversaire : un effet qui vise les deux s'applique deux fois. |
| D18 | Un statut agit au nom de celui qui l'a appliqué : il reçoit le crédit de l'élimination, et ses modificateurs de dégâts (Rage…) s'appliquent. Les dégâts sur la durée portent le tag `dot` et ne déclenchent pas Épines ni Miroir. |
| D19 | Un porteur mort ne déclenche plus rien, sauf ses propres déclencheurs `ON_DEATH`. |
| D20 | Un abandon n'est pas une mort au combat : aucun déclencheur, aucune rancune. Un choix en attente de l'abandonneur est résolu automatiquement. |
| D21 | Un modificateur « consommable » (Surcharge) s'applique à **tout** l'effet (toutes les cibles d'un effet de zone) et n'est consommé qu'une fois. |
| D22 | À l'expiration du temps de planification, une rune instable tirée au sort est placée dans un emplacement aléatoire. |
