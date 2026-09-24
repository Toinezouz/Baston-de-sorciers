# Baston de Sorciers — Phase 1 : analyse et conception

> Document de référence. Chaque décision de règle prise faute d'information dans l'inventaire
> est marquée **[DÉCISION Dx]** et doit être reprise dans le code (`// RULE Dx`) et dans le README.

---

## 0. Constat sur l'inventaire fourni

L'inventaire (`epic_spell_wars_inventaire.md`) est **structurel, pas carte-par-carte** :

- il ne contient **aucun texte d'effet de carte** exploitable (seulement les noms de promos / familiers / sorciers) ;
- il décrit des **familles de mécaniques** par édition (sort en 3 composants, glyphes, types de magie,
  trésors, cartes de sorcier mort, dernier sorcier debout, réactions, créatures persistantes, ressource
  « sang », cantrips, « bad trips », trésors persistants, livraisons multi-glyphes, familiers, deck-building) ;
- les quantités ne sont connues que pour la boîte de base (128 composants, 25 trésors, 25 cartes « mort », 8 héros, 7 cartes « dernier debout »).

Conséquence : **toutes les cartes du jeu seront des créations originales**, construites pour exercer
chacune des mécaniques identifiées. Aucun nom, texte, personnage ou visuel du jeu source n'est réutilisé
(les noms de la table « promos » ne sont utilisés nulle part).

---

## 1. Analyse des mécaniques

### 1.1 Mécaniques identifiées dans l'inventaire → traduction originale

| # | Mécanique source (résumé) | Catégorie | Traduction « Baston de Sorciers » | Priorité |
|---|---|---|---|---|
| M1 | Sort assemblé de 1 à 3 composants : Source / Quality / Delivery | **Centrale** | Sort = jusqu'à 3 **Runes** dans 3 emplacements fixes : **Amorce** → **Torsion** → **Frappe** | MVP |
| M2 | Glyphes / types de magie qui modulent les dégâts | **Centrale** | 5 **Écoles** (Braise, Ombre, Sève, Éther, Chimère). Nb de runes d'une même école = **Puissance** → jet de dés à paliers | MVP |
| M3 | Ordre de résolution (sorts courts plus rapides) | **Centrale** | **Initiative** : moins de runes = plus rapide ; égalité → valeur d'initiative de la Frappe ; puis RNG serveur | MVP |
| M4 | Dernier sorcier debout (carte/jeton) | **Centrale** | **Couronne** : le survivant d'une manche gagne 1 Couronne ; 2 Couronnes = victoire du match | MVP |
| M5 | Trésors | Secondaire | **Reliques** : objets persistants attachés à un sorcier (modificateurs, triggers) | MVP |
| M6 | Cartes « sorcier mort » (retour dans la partie) | Secondaire | **Rancune d'outre-tombe** : chaque sorcier mort pendant la manche pioche un bonus au début de la manche suivante | MVP |
| M7 | Héros / sorciers surdimensionnés | Secondaire | **Sorciers** jouables : aspect cosmétique + 1 trait passif léger (optionnel, désactivable) | V1.1 |
| M8 | Joker de type « magie sauvage » (implicite série) | Secondaire | **Rune Instable** : remplacée au dévoilement par la 1ʳᵉ rune compatible de la pioche | MVP |
| M9 | Cartes de réaction (Tentakill) | Secondaire, **difficile** | **Contresorts** : jouables hors de son tour dans une fenêtre de réaction bornée | V2 (moteur prêt en MVP) |
| M10 | Créatures qui restent en jeu | Secondaire | **Invocations** : entités persistantes avec PV, ciblables, possédant des triggers | MVP |
| M11 | Ressource « Blood » | Secondaire | **Sang** : compteur gagné en infligeant/subissant des dégâts, dépensé par certaines runes | V1.1 |
| M12 | Standee donnant des avantages | Secondaire | **Trône** : un sorcier le détient (celui qui a infligé le plus de dégâts au dernier tour) → bonus d'initiative | V1.1 |
| M13 | Mode partie rapide | Mode | Match en 1 Couronne, PV réduits | MVP (option) |
| M14 | Cantrips | Secondaire | **Murmures** : petites cartes gratuites jouées en plus du sort, résolues avant lui | V2 |
| M15 | Bad Trips (résolution répétée sous condition) | Secondaire, **difficile** | Mot-clé **Écho** : l'effet est rejoué tant qu'une condition est vraie, **plafonné** | MVP (bornage) |
| M16 | Trésors persistants (Everlasting) | Secondaire | Reliques **Éternelles** : conservées entre les manches | MVP |
| M17 | Livraisons à glyphes multiples | Secondaire | Runes **bi-écoles** : comptent pour deux écoles dans le calcul de Puissance | MVP |
| M18 | Familiers | Secondaire | **Familiers** : invocation liée à un sorcier, commence la manche en jeu | V1.1 |
| M19 | Deck-building (Annihilageddon) | Mode séparé | **Hors périmètre** (autre jeu). Le modèle `CardDefinition`/`Deck` permet un mode futur | Hors scope |

### 1.2 Mécaniques d'effets nécessaires (générées par les cartes originales)

Instantanés : dégâts, soins, vol de vie, pioche, défausse, vol de carte, destruction de relique/invocation.
Différés : effet « au début de ton prochain tour », « à la fin de la manche ».
Persistants : statuts à durée (tours), reliques, invocations, modificateurs de stat.
Déclenchés : sur dégâts subis/infligés, soin, mort, sort lancé, début/fin de tour, résolution d'effet.
Choix du joueur : choisir une cible, choisir une option (A ou B), choisir une carte à défausser.
Aléatoire : jets de Puissance, cible aléatoire, pioche, carte aléatoire défaussée.
Ciblage : soi, voisin gauche/droite, adversaire au choix, le plus fort (PV max), le plus faible, tous les adversaires, tous, une invocation, aléatoire.
Protection : bouclier (absorbe N), immunité (à une école ou à tout pour 1 tour), renvoi (reflète X %).
Multiplicateurs : « double les dégâts de la Frappe », « +1 dé par rune de Braise ».

### 1.3 Doublons détectés
- « Trésor » (M5) et « Trésor persistant » (M16) → **un seul concept** `Relic` avec flag `persistsBetweenRounds`.
- « Créature » (M10) et « Familier » (M18) → **un seul concept** `Summon` avec `boundTo?: PlayerId`.
- « Carte de sorcier mort » (M6) → une `Relic` ou une carte one-shot tirée d'un **deck dédié**. Même moteur.
- « Glyphe » et « type de magie » → fusionnés dans **École**.

### 1.4 Effets difficiles à implémenter
Voir §7.

---

## 2. Règles du jeu reconstruites (version originale)

### 2.1 Matériel virtuel
- **Grimoire commun** (pioche) : ~120 Runes (40 Amorces, 40 Torsions, 40 Frappes), chacune d'une École (ou bi-école / Instable).
- **Coffre** : ~25 Reliques.
- **Outre-tombe** : ~20 cartes Rancune.
- Défausse commune par pile.

### 2.2 Paramètres (configurables)
| Paramètre | Défaut | Rapide |
|---|---|---|
| Joueurs | 2–6 | 2–6 |
| PV de départ / max | 20 / 25 | 12 / 15 |
| Taille de main | 8 | 6 |
| Couronnes pour gagner | 2 | 1 |
| Timer de planification | 60 s | 30 s |
| Timer de choix | 20 s | 15 s |
| Délai de réservation de siège | 120 s | 120 s |

### 2.3 Boucle complète
```
MATCH
 └─ MANCHE (jusqu'à ce qu'il reste ≤ 1 sorcier vivant)
     ├─ Mise en place : PV remis au max de départ, statuts/invocations/reliques non éternelles retirés,
     │   pioche mélangée (seed), chaque joueur complète à 8 cartes,
     │   chaque sorcier mort lors de la manche précédente reçoit 1 Rancune.
     └─ TOUR (répété)
         1. Début de tour     : triggers ON_TURN_START, statuts « au début du tour » (poison…), tick de durée.
         2. Planification     : chaque vivant pose SIMULTANÉMENT, face cachée, 1 à 3 runes
                                 (max 1 par emplacement Amorce/Torsion/Frappe). Verrouillage ou timer.
         3. Dévoilement       : tous les sorts sont révélés ; Runes Instables remplacées ;
                                 ordre d'initiative calculé.
         4. Résolution        : chaque sort, dans l'ordre d'initiative, résout ses runes dans l'ordre
                                 Amorce → Torsion → Frappe. Chaque rune résout sa liste d'effets.
                                 Un lanceur mort avant la résolution de son sort → sort annulé.
                                 Un lanceur tué pendant son propre sort → les runes restantes sont annulées.
         5. Contrôle des morts : après CHAQUE effet atomique (pas seulement en fin de sort).
         6. Fin de tour       : triggers ON_TURN_END, runes jouées → défausse, chaque vivant repioche à 8.
         7. Si ≤ 1 vivant     : fin de manche.
 └─ Fin de manche : le survivant éventuel gagne 1 Couronne (+1 Relique).
 └─ Fin de match  : un joueur atteint le nombre de Couronnes requis.
```

### 2.4 Puissance (jet de dés)
Une rune dotée d'un effet `powerRoll` lance **N d6** où N = nombre de runes du sort appartenant à
l'École de la rune (bi-école : compte pour les deux ; Instable remplacée compte pour l'école révélée).
Paliers : **1–4 / 5–9 / 10+**. Les dés sont tirés par le RNG serveur et publiés dans le journal.

### 2.5 Initiative
1. Moins de runes = résout en premier.
2. Égalité → valeur d'initiative imprimée sur la Frappe (plus haute d'abord). Sort sans Frappe = 0.
3. Égalité → détenteur du Trône (V1.1), puis tirage RNG serveur (publié). **[DÉCISION D1]**

### 2.6 Victoire / mort
- PV ≤ 0 → **mort** immédiate (le contrôle se fait après chaque effet atomique). **[DÉCISION D2]**
- Morts simultanées (même effet de zone) : toutes les morts sont appliquées ensemble, puis les triggers ON_DEATH sont mis en file dans l'ordre des sièges à partir du lanceur. **[DÉCISION D3]**
- Si tous les derniers vivants meurent simultanément : **manche nulle**, aucune Couronne, tous reçoivent une Rancune. **[DÉCISION D4]**
- Si le match n'a pas de vainqueur après 15 manches (garde-fou) : victoire au plus de Couronnes, puis dégâts totaux infligés, puis égalité déclarée. **[DÉCISION D5]**

---

## 3. Architecture technique proposée

### 3.1 Stack
| Couche | Choix | Justification |
|---|---|---|
| Monorepo | **npm workspaces** | `npm install && npm run dev` sans outil supplémentaire |
| Langage | **TypeScript strict** partout | Types partagés client/serveur |
| Moteur | Package **`engine`** pur (aucune I/O, aucun `Date.now`, aucun `Math.random`) | Testable sans navigateur ni réseau, déterministe |
| Serveur | **Node 20 + Socket.IO** (+ serveur HTTP natif / Express minimal) | Heartbeat, reconnexion, rooms, fallback transport intégrés ; évite de réécrire ce que `ws` ne fait pas |
| Validation | **Zod** (messages entrants) | Rejet contrôlé de tout payload mal formé |
| Client | **React 18 + Vite** + CSS modules / CSS custom properties | Simple, rapide, pas besoin de Tailwind pour une UI de jeu très spécifique |
| Tests | **Vitest** (moteur + serveur via clients socket.io en mémoire) | Même outil partout |
| Stockage | **Mémoire** (Map de parties) + **journal d'événements**. Snapshot JSON optionnel sur disque | Une partie dure < 30 min ; une DB n'apporte rien au MVP. SQLite/Postgres seulement si comptes/historique |
| Dev | `concurrently` : Vite (5173) + serveur (3001), proxy Vite → WS | Un seul `npm run dev` |
| Prod | Build Vite servi statiquement par le serveur Node → **un seul process / un seul port** | Déploiement trivial (Render, Fly, VPS, Docker) |

### 3.2 Structure
```
baston-de-sorciers/
├── package.json                  # workspaces + scripts dev/test/build
├── packages/
│   ├── shared/                   # types publics, schémas Zod, constantes, protocole
│   │   └── src/{types,schemas,protocol,constants}/
│   ├── engine/                   # moteur de règles PUR
│   │   └── src/
│   │       ├── state/            # GameState, création, clone, vues filtrées
│   │       ├── machine/          # machine à états, transitions
│   │       ├── actions/          # validation + application des actions joueurs
│   │       ├── resolution/       # file de résolution, tâches, garde-fous
│   │       ├── effects/          # registre d'opérateurs d'effet (1 fichier / opérateur)
│   │       ├── targeting/        # sélecteurs de cible
│   │       ├── triggers/         # index des triggers, abonnement aux GameEvents
│   │       ├── modifiers/        # pipeline de modification (bouclier, immunité, renvoi, multiplicateurs)
│   │       ├── cards/            # définitions de cartes (données) + registre
│   │       ├── rng/              # PRNG seedé (sfc32) sérialisable
│   │       └── views/            # projection PublicGameState / PrivatePlayerState
│   │   └── test/                 # tests unitaires + scénarios
│   ├── server/
│   │   └── src/{rooms,sessions,socket,http,timers}/
│   └── client/
│       └── src/{screens,components,game,hooks,net,styles,audio}/
├── docs/
└── README.md
```

### 3.3 Flux d'une action
```
Client ──intent (Zod)──▶ Socket handler ──▶ Room (mutex séquentiel)
                                              │ validate(state, playerId, action)
                                              │   └─ rejet → ACTION_REJECTED {reason, clientSeq}
                                              │ apply(state, action) → {state', events[]}
                                              │   └─ file de résolution (triggers, morts, guards)
                                              │ state.version++
                                              ▼
                              pour chaque joueur : view(state', playerId) + events filtrés
                                              ▼
                               STATE_SYNC {version, view, events}
```

### 3.4 Serveur autoritaire
- Le moteur expose une seule entrée : `dispatch(state, playerId, action) → Result<{state, events}, Rejection>`.
- Les **timers** (planification, choix, réservation) sont détenus par le serveur ; à expiration il injecte
  une action système (`TIMEOUT`) dans le moteur → même chemin que les actions joueurs, donc testable.
- **Sérialisation par partie** : chaque `Room` traite ses messages dans une file FIFO (promesse chaînée) ;
  deux actions simultanées sont donc ordonnées, la seconde est revalidée contre le nouvel état.
- **Idempotence** : chaque intent porte `clientSeq` (monotone par joueur) et `expectedVersion` ;
  un `clientSeq` déjà vu est ignoré (réponse renvoyée à l'identique), un `expectedVersion` périmé
  sur une action sensible → `STALE_STATE` + resynchronisation.
- Le client **n'envoie jamais de valeur** : seulement des identifiants (instanceId de carte, slot, cible, option).

### 3.5 Sessions et reconnexion
- À la jonction : le serveur émet un `sessionToken` (128 bits aléatoires) lié à `(gameId, playerId)`,
  stocké en `localStorage` côté client.
- Socket.IO gère ping/pong (`pingInterval 10s`, `pingTimeout 20s`).
- Déconnexion → `player.connection = "DISCONNECTED"`, `disconnectedAt`, broadcast ; le siège reste réservé
  `SEAT_RESERVATION_MS`. Pendant ce temps, les timers de jeu continuent : un joueur absent qui doit planifier
  subit la règle de timeout (§5).
- Au-delà du délai : le sorcier est **abandonné** (considéré mort à la prochaine vérification, ne gagne plus de Couronne). En lobby, il est simplement retiré.
- Reconnexion : `RESUME {sessionToken}` → rebinding du socket → `STATE_SYNC` complet (vue privée + 50 derniers événements).

### 3.6 Journal
- Tout changement d'état passe par des `GameEvent` typés (source unique de vérité pour UI, logs, tests, replay).
- Chaque événement a une **visibilité** (`public` | `private: PlayerId[]`) ; le serveur filtre avant envoi.
- Le client transforme les événements en phrases FR via un formatter pur (testable).
- Replay possible : `seed + config + liste d'actions` ⇒ état identique.

---

## 4. Modèle de données

```ts
// ---------- Identifiants ----------
type PlayerId = string;        // uuid serveur, jamais choisi par le client
type GameId = string;          // code court "KRAB-42" (alphabet sans ambiguïtés)
type CardDefId = string;       // "rune.braise.amorce.etincelle"
type CardInstanceId = string;  // "c_0042" (généré par le moteur, séquentiel → déterministe)
type EntityId = PlayerId | SummonId;
type SummonId = string;

// ---------- Cartes ----------
type School = "BRAISE" | "OMBRE" | "SEVE" | "ETHER" | "CHIMERE";
type RuneSlot = "AMORCE" | "TORSION" | "FRAPPE";
type CardKind = "RUNE" | "RELIC" | "GRUDGE" /* Rancune */ | "COUNTER" /* V2 */ | "WHISPER" /* V2 */;

interface CardDefinition {
  id: CardDefId;
  kind: CardKind;
  name: string;
  flavor?: string;
  text: string;                    // texte joueur (généré/validé à partir des effets)
  slot?: RuneSlot;                 // runes seulement
  schools: School[];               // [] pour Instable, 2 pour bi-école
  unstable?: boolean;
  initiative?: number;             // Frappes seulement
  effects: EffectNode[];           // effets à la résolution
  passives?: PassiveDefinition[];  // reliques / invocations / statuts : triggers & modifiers
  copies: number;                  // nombre d'exemplaires dans le grimoire
  tags?: string[];
}

interface CardInstance {
  instanceId: CardInstanceId;
  defId: CardDefId;
  ownerId: PlayerId | null;        // null = dans une pile commune
  zone: Zone;
}
type Zone =
  | { type: "DECK"; pile: PileId }
  | { type: "HAND"; playerId: PlayerId }
  | { type: "SPELL"; playerId: PlayerId; slot: RuneSlot }
  | { type: "RELICS"; playerId: PlayerId }
  | { type: "DISCARD"; pile: PileId };
type PileId = "GRIMOIRE" | "COFFRE" | "OUTRE_TOMBE";

interface Pile { id: PileId; drawOrder: CardInstanceId[]; discard: CardInstanceId[]; }  // Deck

// ---------- Joueurs ----------
interface Player {
  id: PlayerId;
  name: string;
  seat: number;                    // ordre de table (gauche = seat+1)
  hp: number;
  maxHp: number;
  alive: boolean;
  crowns: number;
  blood: number;                   // V1.1
  hand: CardInstanceId[];          // Hand
  spell: Spell | null;
  relics: CardInstanceId[];
  statuses: StatusInstance[];
  stats: StatBlock;                // valeurs de base ; valeurs effectives = base + modifiers
  connection: "CONNECTED" | "DISCONNECTED" | "ABANDONED";
  disconnectedAt?: number;
  ready: boolean;                  // lobby
  diedThisRound: boolean;
  lastClientSeq: number;
  roundStats: { damageDealt: number; kills: number };
}
interface StatBlock { handSize: number; bonusDice: number; damageDealtMod: number; damageTakenMod: number; }

// ---------- Sorts ----------
interface Spell {
  casterId: PlayerId;
  runes: Partial<Record<RuneSlot, CardInstanceId>>;
  locked: boolean;
  revealed: boolean;
  initiativeKey?: [number, number, number]; // (nbRunes, -initiative, tiebreakRoll)
  state: "PLANNED" | "PENDING" | "RESOLVING" | "RESOLVED" | "FIZZLED";
}

// ---------- Effets (données) ----------
type EffectNode =
  | { op: "DAMAGE"; target: TargetSpec; amount: Amount; school?: School; tags?: string[] }
  | { op: "HEAL"; target: TargetSpec; amount: Amount }
  | { op: "DRAIN"; target: TargetSpec; amount: Amount; ratio: number }
  | { op: "APPLY_STATUS"; target: TargetSpec; status: StatusDefId; stacks?: Amount; duration?: number }
  | { op: "REMOVE_STATUS"; target: TargetSpec; filter: StatusFilter }
  | { op: "MODIFY_STAT"; target: TargetSpec; stat: keyof StatBlock; delta: Amount; duration?: number }
  | { op: "DRAW"; target: TargetSpec; pile: PileId; count: Amount }
  | { op: "DISCARD"; target: TargetSpec; count: Amount; mode: "CHOICE" | "RANDOM" }
  | { op: "STEAL_CARD"; from: TargetSpec; to: TargetSpec; mode: "RANDOM" | "CHOICE" }
  | { op: "GAIN_RELIC"; target: TargetSpec; count: Amount }
  | { op: "DESTROY"; target: TargetSpec /* relique ou invocation */ }
  | { op: "SUMMON"; summon: SummonDefId; controller: TargetSpec }
  | { op: "SHIELD"; target: TargetSpec; amount: Amount; duration?: number }
  | { op: "POWER_ROLL"; school: School | "SELF"; tiers: [EffectNode[], EffectNode[], EffectNode[]] }
  | { op: "IF"; cond: Condition; then: EffectNode[]; else?: EffectNode[] }
  | { op: "FOR_EACH"; target: TargetSpec; do: EffectNode[] }      // "$it" lié dans le contexte
  | { op: "CHOOSE"; chooser: TargetSpec; options: { label: string; effects: EffectNode[] }[] }
  | { op: "RANDOM"; weights: number[]; branches: EffectNode[][] }
  | { op: "REPEAT"; times: Amount; do: EffectNode[] }
  | { op: "ECHO"; while: Condition; do: EffectNode[]; max: number } // Bad Trip borné
  | { op: "DELAY"; when: TriggerType; do: EffectNode[] }           // effet différé
  | { op: "MULTIPLY_NEXT"; filter: EventFilter; factor: number };   // multiplicateur ponctuel

type Amount =
  | number
  | { from: "ROLL_TOTAL" | "RUNES_OF_SCHOOL" | "TARGET_HP" | "MISSING_HP" | "BLOOD" | "LAST_DAMAGE"; mul?: number; add?: number };

type TargetSpec =
  | { sel: "SELF" | "LEFT" | "RIGHT" | "ALL_FOES" | "ALL" | "STRONGEST_FOE" | "WEAKEST_FOE"
          | "RANDOM_FOE" | "EVENT_SOURCE" | "EVENT_TARGET" | "IT" }
  | { sel: "CHOSEN"; among: "FOES" | "ANY" | "SUMMONS" | "FOE_SUMMONS"; count?: number };

type Condition =
  | { c: "HP_BELOW"; who: TargetSpec; value: number }
  | { c: "HAS_STATUS"; who: TargetSpec; status: StatusDefId }
  | { c: "ROLL_AT_LEAST"; value: number }
  | { c: "RUNES_OF_SCHOOL_AT_LEAST"; school: School; value: number }
  | { c: "TARGET_DIED" }
  | { c: "AND" | "OR"; of: Condition[] } | { c: "NOT"; of: Condition };

// ---------- Passifs : triggers + modificateurs ----------
type TriggerType =
  | "ON_TURN_START" | "ON_TURN_END" | "ON_ROUND_START" | "ON_ROUND_END"
  | "ON_SPELL_REVEALED" | "ON_SPELL_CAST" | "ON_RUNE_RESOLVED"
  | "ON_DAMAGE_DEALT" | "ON_DAMAGE_RECEIVED" | "ON_HEAL" | "ON_STATUS_APPLIED"
  | "ON_DEATH" | "ON_KILL" | "ON_CARD_DRAWN" | "ON_CARD_DISCARDED" | "ON_TARGETED"
  | "ON_EFFECT_RESOLVED" | "ON_SUMMON_ENTER" | "ON_SUMMON_LEAVE";

interface PassiveDefinition {
  trigger?: { on: TriggerType; filter?: EventFilter; effects: EffectNode[]; maxPerTurn?: number };
  modifier?: ModifierDefinition;   // s'applique pendant le pipeline d'un effet (voir §6)
}
interface ModifierDefinition {
  hook: "DAMAGE_OUT" | "DAMAGE_IN" | "HEAL_IN" | "DICE_COUNT" | "INITIATIVE" | "TARGETING";
  layer: number;                   // ordre d'application (voir §6.4)
  kind: "ADD" | "MUL" | "SET" | "PREVENT" | "REDIRECT" | "REFLECT" | "ABSORB" | "IMMUNE";
  value?: number;
  filter?: EventFilter;
}

// ---------- Statuts ----------
interface StatusDefinition {
  id: StatusDefId; name: string; polarity: "BUFF" | "DEBUFF";
  stacking: "REFRESH" | "STACK" | "IGNORE"; maxStacks: number; maxDuration: number;
  passives: PassiveDefinition[];
}
interface StatusInstance {
  id: string; defId: StatusDefId; sourceId: EntityId;
  stacks: number; remainingTurns: number | "PERMANENT"; appliedAt: number; // horodatage logique
}

// ---------- Invocations ----------
interface Summon {
  id: SummonId; defId: SummonDefId; controllerId: PlayerId; boundTo?: PlayerId;
  hp: number; maxHp: number; statuses: StatusInstance[]; enteredAt: number;
}

// ---------- Actions (intents) ----------
type Action =
  | { type: "SET_READY"; ready: boolean }
  | { type: "START_GAME" }
  | { type: "PLACE_RUNE"; cardId: CardInstanceId; slot: RuneSlot }
  | { type: "REMOVE_RUNE"; slot: RuneSlot }
  | { type: "LOCK_SPELL" }
  | { type: "UNLOCK_SPELL" }
  | { type: "CHOOSE_TARGET"; requestId: string; targetIds: EntityId[] }
  | { type: "CHOOSE_OPTION"; requestId: string; optionIndex: number }
  | { type: "CHOOSE_CARDS"; requestId: string; cardIds: CardInstanceId[] }
  | { type: "PLAY_COUNTER"; cardId: CardInstanceId; windowId: string }   // V2
  | { type: "PASS_WINDOW"; windowId: string }                            // V2
  | { type: "LEAVE" };
type SystemAction =
  | { type: "TIMEOUT"; timerId: string }
  | { type: "PLAYER_DISCONNECTED" | "PLAYER_RECONNECTED" | "PLAYER_ABANDONED"; playerId: PlayerId };

interface ActionEnvelope { gameId: GameId; clientSeq: number; expectedVersion: number; action: Action; }

// ---------- Choix en attente ----------
interface PendingChoice {
  requestId: string; playerId: PlayerId; kind: "TARGET" | "OPTION" | "CARDS";
  legal: string[]; min: number; max: number; timerId: string;
  defaultPolicy: "RANDOM" | "FIRST";      // appliquée au timeout (RNG serveur)
  resume: ResolutionTask;                 // continuation
}

// ---------- Résolution ----------
interface ResolutionTask {
  id: number; depth: number; node: EffectNode;
  ctx: EffectContext; originSpell?: CardInstanceId; originPassive?: string;
}
interface EffectContext {
  casterId: EntityId; sourceCardId?: CardInstanceId; spellOwnerId?: PlayerId;
  it?: EntityId; event?: GameEvent; lastRoll?: number[]; vars: Record<string, number>;
}

// ---------- Tour / manche ----------
interface Turn { number: number; initiativeOrder: PlayerId[]; activeSpellIndex: number; currentSlot?: RuneSlot; }
interface Round { number: number; turn: Turn; deaths: PlayerId[]; }

// ---------- Événements ----------
interface GameEvent {
  seq: number; version: number; turn: number; round: number;
  visibility: "PUBLIC" | { private: PlayerId[] };
  causeId?: number;                    // événement parent (chaîne de causalité → UI « stack »)
  depth: number;
  type: GameEventType;
  data: Record<string, unknown>;       // union discriminée typée dans le code
}
type GameEventType =
  | "PLAYER_JOINED" | "PLAYER_LEFT" | "PLAYER_READY" | "CONNECTION_CHANGED"
  | "GAME_STARTED" | "ROUND_STARTED" | "TURN_STARTED" | "PHASE_CHANGED"
  | "CARDS_DRAWN" | "CARD_DISCARDED" | "SPELL_LOCKED" | "SPELLS_REVEALED" | "RUNE_REPLACED"
  | "INITIATIVE_SET" | "SPELL_CAST" | "SPELL_FIZZLED" | "RUNE_RESOLVED"
  | "DICE_ROLLED" | "DAMAGE" | "DAMAGE_PREVENTED" | "HEAL" | "STATUS_APPLIED" | "STATUS_EXPIRED"
  | "STAT_MODIFIED" | "RELIC_GAINED" | "RELIC_DESTROYED" | "SUMMON_ENTERED" | "SUMMON_DIED"
  | "TRIGGER_FIRED" | "TRIGGER_SUPPRESSED" | "CHOICE_REQUESTED" | "CHOICE_MADE"
  | "PLAYER_DIED" | "ROUND_ENDED" | "CROWN_AWARDED" | "GAME_OVER" | "ENGINE_GUARD";

// ---------- Partie ----------
interface GameConfig {
  minPlayers: number; maxPlayers: number; startingHp: number; maxHp: number; handSize: number;
  crownsToWin: number; planningMs: number; choiceMs: number; seatReservationMs: number;
  maxRounds: number; enabledSets: string[];
}
interface GameState {                      // = Game (état complet, SERVEUR UNIQUEMENT)
  id: GameId; version: number; config: GameConfig; phase: Phase;
  players: Record<PlayerId, Player>; seatOrder: PlayerId[]; hostId: PlayerId;
  cards: Record<CardInstanceId, CardInstance>; piles: Record<PileId, Pile>;
  summons: Record<SummonId, Summon>;
  round: Round | null;
  queue: ResolutionTask[]; pendingChoice: PendingChoice | null;
  timers: Record<string, { deadline: number; kind: string }>;
  rng: RngState; seed: string;
  counters: { nextCardId: number; nextEventSeq: number; nextTaskId: number; logicalClock: number };
  guards: GuardCounters;
  eventLog: GameEvent[];
  winnerId: PlayerId | null; endReason?: string;
}

// ---------- Vues ----------
interface PublicPlayerState {
  id; name; seat; hp; maxHp; alive; crowns; blood; handCount: number;
  spell: { slotsFilled: RuneSlot[]; locked: boolean; revealed?: { slot: RuneSlot; card: CardView }[] } | null;
  relics: CardView[]; statuses: StatusInstance[]; connection; ready;
}
interface PublicGameState {
  id; version; phase; config; players: PublicPlayerState[]; summons: Summon[];
  round?: { number; turn: { number; initiativeOrder; activeSpellIndex; currentSlot } };
  pileCounts: Record<PileId, { draw: number; discard: number }>;
  pendingChoice?: { playerId; kind; deadline };  // sans les options si privé
  timers: { kind: string; deadline: number }[];
  winnerId: PlayerId | null;
}
interface PrivatePlayerState {
  playerId: PlayerId; hand: CardView[]; spellDraft: Spell | null;
  pendingChoice?: PendingChoice /* sans `resume` */; legalActions: LegalActionHint[];
}
```

Remarques :
- `GameState` ne quitte **jamais** le serveur. Le client ne reçoit que `PublicGameState + PrivatePlayerState`.
- La pioche est un tableau ordonné **non transmis** (seulement le compteur) → impossible de connaître un tirage futur.
- L'état RNG n'est jamais transmis.
- Les définitions de cartes (`CardDefinition`) sont publiques (code partagé) : ce ne sont pas des secrets.

---

## 5. Machine à états

```
             START_GAME (hôte, ≥ minPlayers, tous prêts)
LOBBY ─────────────────────────────────────────────▶ ROUND_SETUP
                                                        │ (auto)
                                                        ▼
                                                   TURN_START ◀─────────────────────────┐
                                                        │ résolution triggers/ticks       │
                                                        │ (morts possibles → ROUND_CHECK) │
                                                        ▼                                 │
                                                    PLANNING                              │
                          tous vivants LOCK_SPELL ou TIMEOUT │                             │
                                                        ▼                                 │
                                                     REVEAL (auto : instables, initiative)│
                                                        ▼                                 │
                                                   RESOLUTION ◀──────┐                    │
                                  file vide ? ─ non ─▶ step()        │                    │
                                        │           │ CHOICE requis   │                    │
                                        │           ▼                 │                    │
                                        │     AWAITING_CHOICE ── CHOOSE_* / TIMEOUT ──────┘(retour RESOLUTION)
                                        │     (V2) REACTION_WINDOW ── PLAY_COUNTER / PASS / TIMEOUT
                                        ▼ oui, sort suivant ou fin
                                     TURN_END (triggers, défausse, repioche)
                                        ▼
                                   ROUND_CHECK ── > 1 vivant ──────────────────────────────┘
                                        │ ≤ 1 vivant
                                        ▼
                                   ROUND_END (Couronne, reliques)
                                        │ crowns < crownsToWin  ──────▶ ROUND_SETUP
                                        ▼ sinon (ou maxRounds, ou < 2 joueurs présents)
                                    GAME_OVER (terminal)
```

Note : le contrôle des morts (**DEATH_CHECK**) n'est **pas une phase** : c'est une étape exécutée
par la file de résolution après chaque effet atomique. `ROUND_CHECK` court-circuite la suite du tour
dès qu'il ne reste qu'un vivant (les sorts restants sont annulés). **[DÉCISION D6]**

| Phase | Actions joueur acceptées | Actions système | Sortie |
|---|---|---|---|
| LOBBY | SET_READY, START_GAME (hôte), LEAVE | DISCONNECTED (retrait après délai) | ROUND_SETUP |
| ROUND_SETUP | — | — | TURN_START |
| TURN_START | — | — | PLANNING / ROUND_CHECK |
| PLANNING | PLACE_RUNE, REMOVE_RUNE, LOCK_SPELL, UNLOCK_SPELL | TIMEOUT | REVEAL |
| REVEAL | — | — | RESOLUTION |
| RESOLUTION | — (moteur autonome) | — | AWAITING_CHOICE / TURN_END / ROUND_CHECK |
| AWAITING_CHOICE | CHOOSE_* (seul le joueur désigné, bon `requestId`) | TIMEOUT | RESOLUTION |
| TURN_END | — | — | ROUND_CHECK |
| ROUND_CHECK | — | — | TURN_START / ROUND_END |
| ROUND_END | — | — | ROUND_SETUP / GAME_OVER |
| GAME_OVER | LEAVE | — | — |

Règles de timeout **[DÉCISION D7]** :
- PLANNING : un joueur non verrouillé à l'échéance lance les runes déjà posées ; s'il n'en a posé aucune,
  le serveur pose 1 rune choisie par RNG parmi les runes légales de sa main (un sort doit contenir ≥ 1 rune).
  Main sans aucune rune posable (impossible avec une main de 8 mais géré) → pas de sort.
- AWAITING_CHOICE : `defaultPolicy` (cible/option aléatoire via RNG serveur), journalisé.
- Joueur déconnecté : **aucun** traitement spécial dans le moteur ; il subit les timeouts comme les autres.

Les phases « auto » sont enchaînées par le moteur dans le même `dispatch` (boucle `advance()` jusqu'à
une phase qui attend une entrée), avec un plafond d'itérations (garde-fou).

---

## 6. Système d'effets

### 6.1 Principes
1. **Les cartes sont des données** (`EffectNode[]`), jamais du code. Aucune carte n'a de `switch` dédié.
2. Chaque `op` a un **opérateur** enregistré dans un registre : `registry.register("DAMAGE", damageOp)`.
   Un opérateur : `(state, task) → { events, spawn: ResolutionTask[] }`. Ajouter une mécanique = ajouter un opérateur.
3. Les **combinateurs** (`IF`, `FOR_EACH`, `REPEAT`, `CHOOSE`, `RANDOM`, `POWER_ROLL`, `ECHO`, `DELAY`) ne modifient
   pas l'état : ils produisent des sous-tâches. La composabilité vient de là.
4. Les **passifs** (statuts, reliques, invocations) ne sont que deux choses : des **triggers** (réagissent à un
   `GameEvent`) et des **modificateurs** (interviennent dans le pipeline d'un effet atomique).

### 6.2 File de résolution (déterministe)
```
dispatch(action)
  → validate → apply (ex : REVEAL → push des tâches "CAST_SPELL" dans l'ordre d'initiative)
  → loop:
       task = queue.shift()                     # FIFO pour le sort courant
       guards.check(task)                       # profondeur, budget, anti-rejeu
       result = registry[task.node.op](state, task)
       emit(result.events)                      # horodatés, causeId = task.cause
       triggers = collectTriggers(result.events)   # index par TriggerType
       queue.unshiftAll(result.spawn)           # sous-effets : profondeur-d'abord
       queue.unshiftAll(ordered(triggers))      # triggers placés DEVANT (voir 6.3)
       deathCheck()                             # morts → events PLAYER_DIED → triggers ON_DEATH
       if pendingChoice: break                  # suspension, continuation stockée
       if aliveCount ≤ 1: purge(queue, spells) ; break
```

### 6.3 Ordre de résolution des triggers **[DÉCISION D8]**
- Un effet atomique termine **entièrement** (y compris ses modificateurs) avant tout trigger.
- Les triggers provoqués par un effet atomique résolvent **immédiatement après** cet effet
  (pile, profondeur-d'abord), **avant** l'effet suivant de la rune. Motif : lisibilité (« Marie subit 4 → son Épine renvoie 1 » puis la suite).
- Plusieurs triggers sur le même événement : ordre = (1) propriétaire en partant du **lanceur actif**
  dans l'ordre des sièges, (2) type de source : statut < relique < invocation, (3) `appliedAt` croissant.
  Pas de choix manuel d'ordre (évite une fenêtre de choix supplémentaire).
- Un trigger dont la source a disparu au moment de résoudre est **annulé** (« fizzle »).

### 6.4 Pipeline des effets atomiques (modificateurs par couches)
Exemple `DAMAGE` :
```
montant de base (Amount résolu)
 L10 multiplicateurs de l'émetteur (MUL)       ex. « Frappe ×2 »
 L20 bonus/malus additifs émetteur (ADD)       ex. +1 dégât Braise
 L30 immunité de la cible (IMMUNE) → 0, événement DAMAGE_PREVENTED
 L40 réductions additives cible (ADD négatif)  plancher 0
 L50 renvoi (REFLECT) → crée une tâche DAMAGE vers l'émetteur, tag "reflected" (non renvoyable)
 L60 bouclier (ABSORB) consommé
 → application PV (plancher arithmétique : PV peut descendre sous 0, borné à 0 à l'affichage)
 → événement DAMAGE {amount, prevented, absorbed, overkill}
```
Arrondis : toujours **vers le bas**, appliqués une seule fois à la fin de L10–L20. **[DÉCISION D9]**
Soin : plafonné à `maxHp` effectif ; le surplus est perdu (sauf modificateur explicite). **[DÉCISION D10]**

### 6.5 Correspondance besoin → primitive
| Besoin | Représentation |
|---|---|
| Dégâts / soin / vol de vie | `DAMAGE` / `HEAL` / `DRAIN` (DAMAGE puis HEAL du montant **réellement infligé** × ratio) |
| Modif. de stat, buff, debuff | `MODIFY_STAT` avec durée, ou `APPLY_STATUS` (statut porteur de modificateurs) |
| Temporaire / permanent | `remainingTurns: n | "PERMANENT"` ; décrément à `ON_TURN_END` du porteur |
| Conditionnel | `IF` + `Condition` |
| Déclenché | `PassiveDefinition.trigger` |
| Retardé | `DELAY` → crée un trigger à usage unique |
| Ciblage | `TargetSpec` résolu par `targeting/` ; `CHOSEN` → `PendingChoice` |
| Choix du joueur | `CHOOSE` / `CHOSEN` / `DISCARD mode:CHOICE` |
| Hasard | `POWER_ROLL`, `RANDOM`, `RANDOM_FOE`, `DISCARD mode:RANDOM` — tous via `ctx.rng` |
| Main / pioche / défausse | `DRAW`, `DISCARD`, `STEAL_CARD` |
| Destruction | `DESTROY` (relique ou invocation) |
| Protection / immunité / renvoi | modificateurs `ABSORB` / `IMMUNE` / `REFLECT` (via `SHIELD` ou statut) |
| Multiplicateurs | modificateur `MUL`, ou `MULTIPLY_NEXT` (consommé par le prochain événement filtré) |
| Dépendant d'un événement | `Amount.from: "LAST_DAMAGE"`, `TargetSpec EVENT_SOURCE/EVENT_TARGET` |
| Répétition (Écho) | `ECHO` avec `max` obligatoire |

### 6.6 Exemple de carte (donnée pure)
```ts
{
  id: "rune.braise.frappe.pluie-de-cendres", kind: "RUNE", slot: "FRAPPE", schools: ["BRAISE"],
  name: "Pluie de cendres", initiative: 7, copies: 2,
  text: "Puissance Braise. 1–4 : 1 dégât à chaque adversaire. 5–9 : 2 dégâts à chaque adversaire. 10+ : 3 dégâts à chaque adversaire et ils subissent Brûlure (2 tours).",
  effects: [{ op: "POWER_ROLL", school: "SELF", tiers: [
    [{ op: "DAMAGE", target: { sel: "ALL_FOES" }, amount: 1, school: "BRAISE" }],
    [{ op: "DAMAGE", target: { sel: "ALL_FOES" }, amount: 2, school: "BRAISE" }],
    [{ op: "DAMAGE", target: { sel: "ALL_FOES" }, amount: 3, school: "BRAISE" },
     { op: "APPLY_STATUS", target: { sel: "ALL_FOES" }, status: "brulure", duration: 2 }],
  ]}],
}
```
Un test automatique vérifie que chaque carte : référence des statuts/invocations existants, a un `ECHO.max`,
a un texte non vide, respecte les bornes (dégâts ≤ 10, durée ≤ 5…).

---

## 7. Difficultés identifiées

| Difficulté | Risque | Traitement |
|---|---|---|
| **Planification simultanée + informations cachées** | Fuite des runes posées avant le dévoilement | Seul `slotsFilled` est public avant REVEAL ; contenu privé |
| **Choix au milieu d'une résolution** | Bloque la partie, continuation complexe | `PendingChoice` avec `resume` sérialisable + timeout serveur + politique par défaut |
| **Lanceur tué avant/pendant son sort** | Ambiguïté | D6 : sort annulé ; runes restantes annulées |
| **Cible morte entre deux effets** | Effets sur un mort | Les sélecteurs n'incluent que les vivants ; une cible `IT` morte → effet annulé sauf `includeDead` explicite (Rancune) |
| **Morts simultanées / match nul** | Pas de vainqueur | D3, D4 |
| **Triggers en chaîne / boucles** (Épine ↔ Épine, soin qui déclenche soin) | Boucle infinie | Garde-fous §7.1 + tag `reflected` non renvoyable |
| **Écho (résolution répétée)** | Boucle infinie | `max` obligatoire (≤ 5) + budget global |
| **Runes Instables** | Pioche vide, chaîne d'instables | Retourne jusqu'à une rune compatible non instable ; limite 10 retournées ; sinon rune ignorée |
| **Pioche vide** | Blocage | Remélange de la défausse (RNG) ; si toujours vide → on pioche moins, événement journalisé |
| **Réactions (V2)** | Fenêtres temporisées multi-joueurs, latence | Fenêtre unique par sort, simultanée, timer court, 1 contresort max par joueur et par tour |
| **Déconnexion pendant un choix** | Partie bloquée | Le timer n'est jamais suspendu ; politique par défaut |
| **Actions concurrentes** | Double paiement / double application | File FIFO par room, `clientSeq`, `expectedVersion`, `requestId` à usage unique |
| **Équilibrage en multi (kingmaking, focus)** | Joueur éliminé tôt s'ennuie | Manches courtes, Rancune pour les morts, ciblage majoritairement voisins/zone |
| **Sérialisation/replay** | Non-déterminisme | Pas de `Date`/`Math.random` dans `engine` (lint rule + test de replay) |

### 7.1 Garde-fous techniques
| Garde | Valeur | Comportement au dépassement |
|---|---|---|
| Profondeur de résolution | 16 | Tâche ignorée + événement `ENGINE_GUARD` |
| Tâches par action joueur | 500 | Purge de la file, fin du sort courant, `ENGINE_GUARD` |
| Activations d'un même trigger (source × trigger) par sort | 3 | `TRIGGER_SUPPRESSED` |
| Activations d'un trigger `maxPerTurn` | défini par carte | idem |
| `ECHO.max` | ≤ 5 | validé au chargement des cartes |
| Durée de statut | ≤ 5 tours (`maxDuration`) | tronquée |
| Stacks | `maxStacks` par statut | plafonnés |
| Transitions auto enchaînées | 50 | erreur contrôlée → partie mise en `GAME_OVER` "ENGINE_ERROR" avec journal |
| Manches par match | 15 | D5 |
| Tours par manche | 30 | Mort Subite : à partir du tour 20, chaque vivant perd 1 PV/tour (+1 par tour) **[DÉCISION D11]** |

Toute exception levée par un opérateur est **attrapée par la room** : l'état **n'est pas muté** (le moteur
travaille sur un brouillon `structuredClone` / immer-like et ne commit qu'en cas de succès), la partie
reçoit `ENGINE_ERROR`, l'action est rejetée, les joueurs peuvent continuer.

---

## 8. Plan d'implémentation

| Étape | Contenu | Critère de sortie |
|---|---|---|
| **P2.1** Fondations | Monorepo, workspaces, tsconfig strict, Vitest, ESLint (interdiction `Math.random`/`Date` dans engine), `shared` types + Zod | `npm test` vert à vide |
| **P2.2** Noyau moteur | RNG seedé, création d'état, piles, pioche/mélange, vues filtrées | Tests : mêmes seed ⇒ même état ; aucune fuite dans les vues |
| **P2.3** Machine à états | Lobby → planification → dévoilement → initiative → fin de tour → manche → match | Partie complète simulée avec runes « no-op » |
| **P2.4** Résolution & effets | File, registre d'opérateurs, pipeline de modificateurs, triggers, statuts, choix, garde-fous | Tests de chaque opérateur |
| **P2.5** Contenu | ~40 définitions de runes (5 écoles × 3 emplacements + instables + bi-écoles), 15 statuts, 12 reliques, 8 Rancunes, 4 invocations ; fiche carte (ID, nom, type, coût, cible, effets, conditions, interactions) | Test de validation du catalogue |
| **P3** Tests | Scénarios : dégâts, soin, mort, victoire, buffs/debuffs, temporaires, triggers, ciblage, invalides, chaînes, hasard seedé, égalités, morts simultanées, boucle A↔B, fin de partie ; bot aléatoire jouant 1000 parties sans crash | Couverture moteur > 85 % |
| **P4** Serveur | Rooms, codes, sessions, Socket.IO, Zod, file par room, timers, reconnexion, heartbeat, rejet contrôlé | Tests d'intégration avec 2–3 clients socket.io : scénarios 1→15 |
| **P5** Client | Écrans Accueil / Lobby / Table / Fin ; plateau, main, emplacements de sort, journal, timers, choix | Jouable à la souris et au toucher |
| **P6** Intégration | Hook `useGame`, resync par version, reprise de session, gestion d'erreurs réseau | 2 onglets jouent une partie complète |
| **P7** Polish | Animations (CSS/Web Animations pilotées par événements), sons optionnels, responsive, accessibilité (clavier, contrastes, `aria-live` sur le journal) | Test manuel mobile + desktop |
| **P8** Équilibrage & doc | Simulation massive par bots → stats de win-rate par carte ; README complet ; Dockerfile | Rapport d'équilibrage |
| V1.1 / V2 | Sang, Trône, Familiers, Sorciers ; Contresorts, Murmures | — |

---

## 9. Hypothèses (pas de question bloquante)

| # | Hypothèse | Modifiable |
|---|---|---|
| H1 | Le jeu est **100 % original** : noms, écoles, textes, visuels. L'inventaire ne sert que de liste de mécaniques | — |
| H2 | 2 à 6 joueurs, match en 2 Couronnes, 20 PV | `GameConfig` |
| H3 | Pas de comptes utilisateurs : pseudo + jeton de session local | — |
| H4 | Pas de base de données au MVP (parties en mémoire) | Snapshot JSON / SQLite plus tard |
| H5 | Interface en français (textes centralisés pour i18n future) | — |
| H6 | Réactions et Murmures reportés en V2, mais machine à états et moteur prévus pour | — |
| H7 | Illustrations : pictogrammes SVG/CSS générés (couleur + symbole d'école), pas d'images externes | — |
| H8 | Pas de joueurs IA dans l'UI au MVP ; un bot aléatoire existe pour les tests (peut être exposé ensuite) | — |
