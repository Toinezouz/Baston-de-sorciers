# Équilibrage — analyse par simulation

> Outils :
> - `npm run sim -- 300 4` : bots aléatoires ;
> - `npm run balance -- 600` : 4 stratégies face à face ;
> - `STRATS=mono,opportuniste FOCUS=2,1,0 npm run balance` : variantes.
>
> Limite importante : ce sont des **bots**, pas des humains. Ils ne bluffent pas, ne s'allient pas et ne lisent
> pas la table. Les résultats indiquent des tendances structurelles, pas un équilibre définitif.

## 1. Stratégies testées

| Bot | Comportement |
|---|---|
| `aleatoire` | 1 à 3 runes au hasard |
| `mono` | sort le plus long possible dans **une** école (maximise les dés de Puissance) |
| `duo` | deux runes de la même école |
| `eclair` | toujours **une seule** rune, la Frappe la plus rapide |
| `opportuniste` | joue comme `mono`, mais tire une Frappe seule et rapide dès qu'un adversaire a 4 PV ou moins |

Choix de cible des bots : l'adversaire le plus affaibli.

## 2. Constat initial : les sorts courts ne servaient à rien

Les mains se complètent à 8 runes à chaque tour, donc jouer 3 runes ne « coûte » rien. Or un sort d'une rune
n'infligeait en moyenne que **0,86** dégât, contre **4,10** pour un sort de trois runes. L'initiative d'un sort
court ne compensait pas cet écart.

| Sans correctif (400 parties, 4 joueurs) | Victoires |
|---|---|
| duo | 47,5 % |
| mono | 44,5 % |
| aléatoire | 7,8 % |
| éclair | 0,3 % |

La vraie valeur de la vitesse est d'**achever un adversaire avant qu'il n'agisse**. Le bot `opportuniste` la
mesure directement :

| Opportuniste contre mono | Duel | 4 joueurs (2 de chaque) |
|---|---|---|
| Sans correctif | 49,8 % / 50,2 % | **32,3 %** / 67,8 % |

En duel, frapper vite au bon moment est déjà rentable. À 4 joueurs, c'est nettement perdant : la décision
« court ou long ? » n'existait pratiquement pas.

## 3. Correctif adopté : Concentration [RULE D25]

> **Concentration** : un sort d'**une seule** rune lance **2 dés de Puissance supplémentaires**, un sort de
> **deux** runes en lance **1**, un sort de trois runes aucun. (`GameConfig.focusDice = [2, 1, 0]`)

Variantes comparées (400 parties chacune) :

| `focusDice` | Opportuniste à 4 j. | Éclair (4 stratégies) | Tours par manche |
|---|---|---|---|
| `[0, 0, 0]` | 32,3 % | 0,3 % | 11,6 |
| `[1, 0, 0]` | — | 0,8 % | 11,0 |
| **`[2, 1, 0]`** | **44,3 %** | 1,8 % | 8,7 |
| `[3, 1, 0]` | — | 3,3 % | 8,7 |

`[2, 1, 0]` rapproche nettement l'opportuniste de la parité (44 à 45 % contre 50 % visé). Les dégâts par rune
s'égalisent (1,83 / 1,68 / 1,54 selon la taille du sort), et les manches raccourcissent d'environ un quart. `[3, 1, 0]` favorise trop le
hasard : les bots aléatoires y passent de 9 % à 15 % de victoires.

Le bot `eclair` reste perdant. C'est voulu : jouer court **en permanence** ne doit pas être une bonne stratégie.
Jouer court **au bon moment** doit l'être.

**Règle affichée aux joueurs** (fenêtre « Comment jouer ») et **aperçu dans l'interface** : le constructeur de
sort affiche « 🎯 +2 dés » et le total de dés par école.

## 4. Résultats avec la règle finale

**600 parties, 4 stratégies, sièges tournants**

| Stratégie | Victoires |
|---|---|
| mono | 45,8 % |
| duo | 43,2 % |
| aléatoire | 9,3 % |
| éclair | 1,7 % |

**Opportuniste contre mono (600 parties à 4)** : 45,3 % contre 54,7 %.

| Indicateur | Valeur |
|---|---|
| Avantage de siège | 23,7 à 26,3 % par siège (bruit statistique ±1,8 %) : pas d'avantage structurel |
| Manches par partie | 3,0 à 3,3 |
| Tours par manche | 7,5 à 9,5 : environ 25 tours par partie, soit 12 à 20 min entre humains |
| Manches nulles | 2,7 à 3,4 % |
| Tours en mort subite | 0,0 à 0,2 % : le garde-fou existe mais ne sert presque jamais |
| Parties terminées par la limite de manches | 0 % |
| Garde-fous du moteur déclenchés | **0** sur plus de 3 000 parties simulées (boucles, profondeur, budget) |

## 5. Analyse des cartes

**Dégâts moyens infligés aux adversaires par utilisation**. Une carte de zone compte chaque adversaire touché.

| Rune | Dégâts / utilisation | Lecture |
|---|---|---|
| Cratère | 9,6 | Zone sur **tous**, lanceur compris, avec 3 dés s'il est joué seul. Très fort à 4+ joueurs, risqué en fin de manche. **À surveiller.** |
| Tourbillon farceur | 6,7 | 3 frappes aléatoires ; chaque coup profite de Rage (+1 ×3). **À surveiller** avec Rage et Surcharge. |
| Floraison brutale | 6,5 | Soigne aussi les adversaires : le chiffre surestime son intérêt réel. |
| Pluie de cendres, Hurlement du néant, Chaos flamboyant, Lance, Grand illusionniste | 5,0 à 6,0 | Frappes de zone ou lourdes : rôle attendu. |
| Frappes ciblées (Faux, Étreinte, Rayon, Fouet, Ruée, Farce, Paradoxe) | 3,2 à 4,0 | Homogènes. |
| Cendres chaudes, Tison d'ombre | ≈ 0,8 | Cartes de **préparation** (Brûlure) : leur valeur vient des tours suivants et n'est pas comptée ici. |

### Cartes potentiellement trop fortes
- **Cratère** : quand un seul adversaire survit avec peu de PV, un Cratère joué seul (3 dés) peut finir la
  manche, ou tuer son lanceur. C'est volontairement explosif. Si des parties réelles le confirment, réduire le palier 10+ de 5 à 4.
- **Tourbillon farceur + Rage/Surcharge** : les bonus s'appliquent à chacun des 3 coups. Surcharge ne s'applique qu'au
  premier effet (règle D21), ce qui limite déjà le cumul.

### Cartes faibles
- **Cendres chaudes** dépend d'une Brûlure préalable : faible en duel, correcte à 4+ joueurs avec Attise.
- **Dés fous** : 1/6 de chance de relique, sinon 1 dégât de zone. Carte « fun », assumée.

### Combos dominants repérés
| Combo | Risque | Garde-fou existant |
|---|---|---|
| Combustion (Surcharge) + Frappe de zone | ×2 sur chaque adversaire | Consommé en une fois par effet (D21), 1 à 2 cumuls max |
| Épines contre Épines, Miroir contre Miroir | boucle de renvois | Tag `reflected` non renvoyable ; 3 activations max par sort |
| Soins à répétition (Régénération + Gourde + Pousse) | parties longues | Maudit, mort subite dès le tour 20, limite de 40 tours par manche |
| Égide cumulée (Écorce + Golem + Linceul) | invulnérabilité prolongée | Égide limitée à 10 cumuls et 2 tours, Dissipation, perte de PV directe (Pacte) |

### Effets impossibles à contrer
- **Perte de PV directe** (Pacte sanglant, mort subite) : ignore Égide et Intangible, par conception. Elle ne concerne
  que le lanceur ou la mort subite, donc aucun joueur ne peut l'infliger à un autre de façon incontrôlable.
- **Intangible** (Mirage, 50 % de chance) : un tour d'immunité totale. Il se contre par la perte de PV directe et le
  temps (1 tour).

## 6. Risques de parties trop longues ou de boucles

| Risque | Mesure |
|---|---|
| Manche interminable (soins, boucliers) | Mort subite à partir du tour 20 (perte croissante), manche nulle au tour 40 |
| Partie interminable (manches nulles répétées) | 15 manches max, puis départage aux Couronnes et aux dégâts (D5). Jamais atteint en simulation |
| Boucle de déclencheurs A ↔ B | 3 activations max d'un même passif par sort ; testé (`triggers.test.ts`) |
| Récursion excessive | Profondeur maximale de 16 |
| Explosion combinatoire | 2 000 tâches max par action, puis purge avec journalisation |
| Écho (résolution répétée) | 5 itérations max, validé au chargement des cartes |
| Joueur absent | Minuteurs serveur : verrouillage ou choix automatique, abandon après la réservation du siège |

## 7. Pistes pour la suite (non appliquées)

À valider sur des parties humaines avant de toucher aux cartes :
1. Mesurer le taux de victoire réel par carte : journaliser `RUNE_RESOLVING` et le vainqueur côté serveur.
2. Si Cratère domine, réduire son palier 10+ de 5 à 4 dégâts.
3. Envisager un léger avantage pour les sorts à trois runes (tirer 1 relique au troisième sort d'une manche ?) si
   la Concentration rend les sorts courts trop attractifs entre humains.

## 8. Extension « Échos du Grimoire » (122 cartes) et bots

Résultats après l'ajout de 52 cartes (600 parties, 4 stratégies) :

| Indicateur | Avant | Après |
|---|---|---|
| mono / duo / aléatoire / éclair | 45,8 / 43,2 / 9,3 / 1,7 % | 44,2 / 41,0 / 13,2 / 1,7 % |
| Tours par manche | 8,6 | 7,7 |
| Avantage de siège | 23,7 à 26,3 % | 23,3 à 25,8 % |
| Garde-fous déclenchés | 0 | **0** |

La hiérarchie des stratégies est inchangée et les nouvelles synergies n'introduisent pas de boucle. Le hasard
pèse un peu plus (le bot aléatoire passe de 9 à 13 %), ce qui reste raisonnable pour un jeu d'ambiance.

**Niveaux de bots** (sièges tournants) :
- difficile contre facile : 85,5 % ;
- difficile contre la meilleure stratégie simple (`mono`) : 52,8 % à 4 joueurs, 54 % en duel.

Le niveau difficile n'achève qu'en fin de manche. Plus tôt, éliminer un adversaire profite surtout aux autres, puisque
seul le dernier debout gagne : la simulation le montre (achever tôt coûtait 26 % de victoires contre 33 %).

### Nouveaux combos à surveiller
| Combo | Pourquoi | Garde-fou |
|---|---|---|
| Braises dormantes + Forge vive (+ Aura ardente) | Les Brûlures agissent au nom du lanceur (D18) : sa Rage s'ajoute à chaque tick, sur chaque adversaire | Rage limitée à 3 cumuls pendant 2 tours ; Dissipation ; Rosée du matin |
| Braises / Attise, puis Embrasement | Encaisse toutes les Brûlures d'un coup (2 par cumul) | Brûlure limitée à 3 cumuls, donc 6 dégâts au plus par adversaire |
| Peste noire, puis Sentence du venin | Venin répandu puis exécuté | Venin limité à 5 cumuls ; la Sentence exige un bon jet pour doubler |
| Transfert des maux / Tour de passe-passe | Retournements soudains | Un seul transfert par rune ; les statuts gardent leur durée |
| Invocations + Symbiose / Charge du bosquet | Montée en puissance si on laisse vivre les invocations | 3 invocations max par sorcier ; elles disparaissent en fin de manche et sont ciblables |
