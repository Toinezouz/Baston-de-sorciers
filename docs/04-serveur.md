# Serveur temps réel et protocole

Package `packages/server` (Node.js + Socket.IO) et `packages/shared` (protocole + schémas Zod).

## 1. Architecture

```
navigateur ──Socket.IO──▶ socket.ts ──(Zod, débit, session)──▶ Room ──dispatch──▶ moteur
                                                              │
                                  minuteurs réels ◀───────────┤ (state.timers)
                                  vues filtrées  ──S2C.STATE──▶ chaque joueur
```

| Fichier | Rôle |
|---|---|
| `server.ts` | Serveur HTTP (santé, aperçu de partie, fichiers statiques du client) + Socket.IO |
| `socket.ts` | Traduction des messages : validation Zod, limitation de débit, identité issue de la session, erreurs rattrapées |
| `room.ts` | **Une partie** : état autoritaire, file séquentielle, minuteurs, sessions, réservation de siège, diffusion des vues |
| `registry.ts` | Parties en mémoire, jetons de session, nettoyage périodique |
| `config.ts` | Variables d'environnement |
| `ids.ts` | Codes de partie, jetons, graines (via `node:crypto`) |

### Sérialisation (actions concurrentes)
Chaque `Room` enchaîne toutes ses entrées dans une file de promesses : actions des joueurs, expirations de
minuteurs, connexions, déconnexions, abandons. Deux actions « simultanées » sont donc toujours appliquées
l'une après l'autre, et la seconde est revalidée par le moteur contre l'état produit par la première.

### Minuteurs
Le moteur n'a pas d'horloge : il déclare ses minuteurs (`state.timers`). Après chaque action, le salon arme
les nouveaux minuteurs et annule ceux qui ont disparu. À l'échéance, il envoie `TIMEOUT` au moteur, qui
refuse un minuteur périmé. Les échéances sont envoyées aux clients (`deadlines`, en epoch ms serveur) avec
`serverTime` pour corriger le décalage d'horloge.

### Stockage
Tout est en mémoire (`Map`). C'est un choix délibéré : une partie dure de 15 à 30 minutes et une base de
données n'apporterait rien au MVP. **Un redémarrage du serveur termine les parties en cours.**
Pour reproduire un bug, la graine de chaque partie est journalisée et `room.inputs` conserve toutes les
entrées acceptées : graine + entrées ⇒ rejeu exact.

## 2. Protocole (`packages/shared/src/protocol.ts`)

Toutes les requêtes du client utilisent un accusé de réception (ack) :
`socket.emit(evt, payload, ack)` → `{ ok: true, data } | { ok: false, reason, message? }`.
Un message sans fonction d'ack est ignoré.

| Client → serveur | Charge utile | Réponse `data` |
|---|---|---|
| `game:create` | `{ name, mode?: "standard" \| "quick", maxPlayers?: 2–6 }` | `SessionInfo` |
| `game:join` | `{ gameId, name }` (code insensible à la casse) | `SessionInfo` |
| `game:resume` | `{ token }` | `SessionInfo` |
| `game:action` | `{ clientSeq, action: PlayerAction }` | `{ version }` |
| `game:sync` | — | — (le serveur renvoie un état complet) |
| `game:leave` | — | — |
| `game:rematch` | — (partie terminée uniquement) | `SessionInfo` de la nouvelle partie |
| `game:add-bot` | `{ level: "facile" \| "normal" \| "difficile" }` (lobby, hôte) | `{ playerId }` |
| `game:remove-bot` | `{ playerId }` (lobby, hôte) | — |

`SessionInfo = { gameId, playerId, token, lastClientSeq }`. Le client conserve le `token` dans `localStorage`.

| Serveur → client | Contenu |
|---|---|
| `game:state` | `StateMessage` : `{ gameId, version, full, view: { public, private }, events, deadlines, serverTime }` |
| `game:kicked` | `{ reason: "SESSION_REPLACED" \| "GAME_CLOSED" }` |
| `game:rematch-offer` | `{ gameId, by }` : un joueur a lancé une revanche |

### Revanche
Après `GAME_OVER`, le premier `game:rematch` crée une partie **avec la même configuration**. Son auteur en
devient l'hôte, et les autres joueurs reçoivent `game:rematch-offer`. Chaque `game:rematch` suivant rejoint cette
même partie. Le joueur quitte l'ancienne partie, qui est supprimée quand elle est vide.

- `view` et `events` sont **filtrés pour le destinataire** : aucune carte adverse cachée, ni l'ordre de la pioche, ni la graine, ni l'état du hasard.
- `full: true` (connexion, reprise, `game:sync`) : le client remplace son journal par les 150 derniers événements.
- `version` est strictement croissante : un client ignore tout état de version inférieure ou égale à la sienne.

### Idempotence
Chaque action porte un `clientSeq` strictement croissant par session.
- Même `clientSeq` que la dernière action : la réponse mise en cache est renvoyée et **l'action n'est pas rejouée**. Cela couvre le renvoi après une coupure réseau.
- `clientSeq` inférieur : refus `DUPLICATE_ACTION`.
- À la reprise, `lastClientSeq` indique au client d'où repartir.

### Motifs de refus
Refus du moteur (`CARD_NOT_IN_HAND`, `WRONG_PHASE`, `SPELL_LOCKED`, `NOT_YOUR_CHOICE`…), plus ceux du serveur :
`INVALID_PAYLOAD`, `GAME_NOT_FOUND`, `SESSION_INVALID`, `NOT_IN_A_GAME`, `ALREADY_IN_A_GAME`,
`RATE_LIMITED`, `SERVER_FULL`, `DUPLICATE_ACTION`, `SERVER_ERROR`.

## 3. Connexion, déconnexion, reconnexion

1. **Création / jonction** : le serveur génère un `playerId` et un jeton de 256 bits, puis lie la socket à la session.
2. **Coupure** (onglet fermé, réseau) : Socket.IO la détecte (ping 10 s, délai 20 s). Le joueur passe
   `DISCONNECTED`, ce que tout le monde voit, et son siège est réservé `SEAT_RESERVATION_MS` (120 s par défaut).
   La partie continue : s'il doit jouer, son minuteur expire normalement (verrouillage ou choix automatique).
3. **Retour** : `game:resume { token }`. La session est rattachée, le joueur repasse `CONNECTED` et reçoit un état complet (sa main, son sort, un choix en attente…).
4. **Réservation expirée** : dans le lobby, le joueur est retiré. En partie, il **abandonne** : il est éliminé de la manche et des suivantes (règle D20). S'il ne reste qu'un joueur actif, celui-ci gagne par forfait.
5. **Deuxième appareil** : une reprise avec le même jeton déconnecte l'ancien appareil (`game:kicked SESSION_REPLACED`).

## 4. Sécurité

- Le client n'envoie que des **intentions avec identifiants**. Toute clé en trop est refusée (schémas `.strict()`).
- L'identité vient **exclusivement** de la session liée à la socket, jamais de la charge utile.
- Le moteur revalide tout : appartenance à la partie, phase, carte en main, emplacement, cible, choix, doublons.
- Pseudos nettoyés : caractères de contrôle, zéro-largeur et de direction du texte retirés, 1 à 20 caractères.
- Limitation de débit par socket (30 messages en rafale, puis 15/s). Messages limités à 16 Ko.
- Codes de partie : 6 caractères aléatoires sans ambiguïté. Jetons : 32 octets aléatoires (`crypto.randomBytes`).
- Fichiers statiques protégés contre la traversée de répertoire.
- Une exception dans un gestionnaire donne `SERVER_ERROR` ; une exception du moteur laisse l'état intact.

## 5. Variables d'environnement

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | `3001` | Port HTTP / WebSocket |
| `HOST` | `0.0.0.0` | Interface d'écoute |
| `CORS_ORIGIN` | `*` | Origines autorisées, séparées par des virgules (à restreindre en production) |
| `SEAT_RESERVATION_MS` | `120000` | Réservation du siège d'un joueur déconnecté |
| `PLANNING_MS` | selon le mode (60 s / 30 s) | Temps de planification d'un sort |
| `CHOICE_MS` | selon le mode (20 s / 15 s) | Temps pour un choix de cible ou d'option |
| `FINISHED_GAME_TTL_MS` | `600000` | Conservation d'une partie terminée |
| `IDLE_GAME_TTL_MS` | `7200000` | Suppression d'une partie inactive |
| `MAX_GAMES` | `500` | Parties simultanées maximum |
| `RATE_LIMIT_BURST` / `RATE_LIMIT_PER_SECOND` | `30` / `15` | Limitation de débit par socket |
| `STATIC_DIR` | — | Dossier du client compilé à servir (production) |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error`, `silent` |
| `BOT_DELAY_MIN_MS` / `BOT_DELAY_MAX_MS` | `1200` / `3500` | Temps de « réflexion » des bots (la moitié pour un choix de cible) |

## 6. Tests

`packages/server/test/server.test.ts` démarre un vrai serveur sur un port aléatoire et pilote de vrais clients
Socket.IO (`test/harness.ts`). Les tests couvrent :
- création, jonction et lobby ;
- l'API HTTP ;
- les charges utiles forgées et la limitation de débit ;
- l'absence de fuite de cartes sur le réseau ;
- l'idempotence ;
- les actions simultanées ;
- les minuteurs réels ;
- la déconnexion, la reprise, la réservation expirée (en lobby et en partie) et le second appareil ;
- une partie complète entre deux clients.

## 7. Bots

Un bot est un joueur **sans connexion**, piloté par son salon (`Room.bots`) :
- ajouté par l'hôte dans le lobby (`game:add-bot`) ; il est prêt d'office et reçoit un nom de sorcier original ;
- après chaque changement d'état, le salon regarde si un bot doit agir (sort à préparer, choix à faire) et
  programme sa décision après un délai aléatoire « humain » ;
- la décision (`botDecide` du moteur) passe par la **même file** et la **même validation** que les actions humaines.
  Une action refusée est journalisée (`warn`) et le bot laisse le minuteur faire ;
- en cas de revanche, les bots suivent la table avec le même niveau ;
- une partie sans aucun humain est supprimée : les bots ne jouent jamais seuls.
