# Catalogue des cartes

> Fichier généré par `npm run cards:doc` à partir de `packages/engine/src/cards/`. Ne pas éditer à la main.

**Coût** : aucune carte n'a de coût en ressource. Le coût d'une rune est son **emplacement** (1 rune par emplacement et par sort) et la **carte de main** consommée. Plus un sort compte de runes, plus il est puissant (dés) mais plus il résout tard.

## Runes (50 cartes, 102 exemplaires)

| ID | Nom | Type | Coût | Description | Cible | Effets | Conditions | Interactions |
|---|---|---|---|---|---|---|---|---|
| `rune.braise.etincelle-tetue` | Étincelle têtue | AMORCE · BRAISE ×3 | emplacement AMORCE | Inflige 1 dégât au sorcier à ta gauche. Si ton sort contient 2 runes de Braise ou plus, inflige aussi 1 dégât au sorcier à ta droite. | gauche, droite | DAMAGE, IF | RUNES_OF_SCHOOL_AT_LEAST | modifiée par Rage/Faiblesse/Surcharge, Égide, Carapace, Intangible ; déclenche Épines/Miroir |
| `rune.braise.soufflet-de-forge` | Soufflet de forge | AMORCE · BRAISE ×2 | emplacement AMORCE | Tu gagnes 1 Rage (2 tours). | soi | APPLY_STATUS | — | — |
| `rune.braise.cendres-chaudes` | Cendres chaudes | AMORCE · BRAISE ×2 | emplacement AMORCE | Chaque adversaire atteint de Brûlure subit 2 dégâts. | tous les adversaires | FOR_EACH, IF, DAMAGE | HAS_STATUS | modifiée par Rage/Faiblesse/Surcharge, Égide, Carapace, Intangible ; déclenche Épines/Miroir |
| `rune.braise.attise` | Attise | TORSION · BRAISE ×3 | emplacement TORSION | Les sorciers à ta gauche et à ta droite reçoivent 1 Brûlure (2 tours). | gauche, droite | APPLY_STATUS | — | — |
| `rune.braise.combustion` | Combustion | TORSION · BRAISE ×2 | emplacement TORSION | Tu gagnes Surcharge : tes prochains dégâts infligés sont doublés. | soi | APPLY_STATUS | — | — |
| `rune.braise.braise-vorace` | Braise vorace | TORSION · BRAISE ×2 | emplacement TORSION | Inflige au plus robuste de tes adversaires 1 dégât par rune de Braise de ton sort. | adversaire le plus robuste | DAMAGE | — | modifiée par Rage/Faiblesse/Surcharge, Égide, Carapace, Intangible ; déclenche Épines/Miroir |
| `rune.braise.pluie-de-cendres` | Pluie de cendres | FRAPPE · BRAISE · init 7 ×2 | emplacement FRAPPE | Puissance de Braise. 1–4 : 1 dégât à chaque adversaire. 5–9 : 2 dégâts à chaque adversaire. 10+ : 3 dégâts à chaque adversaire et 1 Brûlure. | tous les adversaires | POWER_ROLL, DAMAGE, APPLY_STATUS | jet de Puissance | modifiée par Rage/Faiblesse/Surcharge, Égide, Carapace, Intangible ; déclenche Épines/Miroir ; +1 dé avec Clairvoyance / Dé pipé |
| `rune.braise.lance-incandescente` | Lance incandescente | FRAPPE · BRAISE · init 12 ×2 | emplacement FRAPPE | Puissance de Braise. Choisis un adversaire ou une invocation adverse : 1–4 : 2 dégâts. 5–9 : 4 dégâts. 10+ : 6 dégâts. | au choix | POWER_ROLL, DAMAGE | jet de Puissance | modifiée par Rage/Faiblesse/Surcharge, Égide, Carapace, Intangible ; déclenche Épines/Miroir ; +1 dé avec Clairvoyance / Dé pipé |
| `rune.braise.cratere` | Cratère | FRAPPE · BRAISE · init 3 ×1 | emplacement FRAPPE | Puissance de Braise. TOUS les sorciers, toi compris : 1–4 : 2 dégâts. 5–9 : 3 dégâts. 10+ : 5 dégâts. | tous les sorciers | POWER_ROLL, DAMAGE | jet de Puissance | modifiée par Rage/Faiblesse/Surcharge, Égide, Carapace, Intangible ; déclenche Épines/Miroir ; +1 dé avec Clairvoyance / Dé pipé |
| `rune.ombre.murmure-du-caveau` | Murmure du caveau | AMORCE · OMBRE ×3 | emplacement AMORCE | Draine 2 PV à ton adversaire le plus affaibli. | adversaire le plus affaibli | DRAIN | — | modifiée par Rage/Faiblesse/Surcharge, Égide, Carapace, Intangible ; déclenche Épines/Miroir ; bloquée par Maudit |
| `rune.ombre.pacte-sanglant` | Pacte sanglant | AMORCE · OMBRE ×2 | emplacement AMORCE | Tu perds 2 PV. Tu gagnes 2 Rage (2 tours). | soi | LOSE_HP, APPLY_STATUS | — | — |
| `rune.ombre.ombre-portee` | Ombre portée | AMORCE · OMBRE ×2 | emplacement AMORCE | Le sorcier à ta droite reçoit Faiblesse (2 tours). | droite | APPLY_STATUS | — | — |
| `rune.ombre.nuee-de-mites` | Nuée de mites | TORSION · OMBRE ×3 | emplacement TORSION | Un adversaire de ton choix reçoit 2 Venin (3 tours). | au choix | APPLY_STATUS | — | — |
| `rune.ombre.deuil` | Deuil | TORSION · OMBRE ×2 | emplacement TORSION | Tu récupères 1 PV, plus 2 PV par sorcier mort cette manche. | soi | HEAL | — | bloquée par Maudit |
| `rune.ombre.malediction` | Malédiction | TORSION · OMBRE ×2 | emplacement TORSION | Ton adversaire le plus robuste est Maudit (ne peut pas récupérer de PV, 2 tours). | adversaire le plus robuste | APPLY_STATUS | — | — |
| `rune.ombre.faux-spectrale` | Faux spectrale | FRAPPE · OMBRE · init 10 ×2 | emplacement FRAPPE | Puissance d'Ombre. Draine à ton adversaire le plus affaibli : 1–4 : 1 PV. 5–9 : 3 PV. 10+ : 5 PV. | adversaire le plus affaibli | POWER_ROLL, DRAIN | jet de Puissance | modifiée par Rage/Faiblesse/Surcharge, Égide, Carapace, Intangible ; déclenche Épines/Miroir ; bloquée par Maudit ; +1 dé avec Clairvoyance / Dé pipé |
| `rune.ombre.etreinte-glacee` | Étreinte glacée | FRAPPE · OMBRE · init 5 ×2 | emplacement FRAPPE | Puissance d'Ombre. Sorcier à ta gauche : 1–4 : 2 dégâts. 5–9 : 3 dégâts. 10+ : 4 dégâts. Ensuite, s'il lui reste 5 PV ou moins, il subit 3 dégâts supplémentaires. | gauche | POWER_ROLL, DAMAGE, IF | jet de Puissance ; HP_AT_MOST | modifiée par Rage/Faiblesse/Surcharge, Égide, Carapace, Intangible ; déclenche Épines/Miroir ; +1 dé avec Clairvoyance / Dé pipé |
| `rune.ombre.hurlement-du-neant` | Hurlement du néant | FRAPPE · OMBRE · init 14 ×1 | emplacement FRAPPE | Puissance d'Ombre. Chaque adversaire : 1–4 : 1 dégât. 5–9 : 2 dégâts. 10+ : 3 dégâts et 1 Venin. | tous les adversaires | POWER_ROLL, DAMAGE, APPLY_STATUS | jet de Puissance | modifiée par Rage/Faiblesse/Surcharge, Égide, Carapace, Intangible ; déclenche Épines/Miroir ; +1 dé avec Clairvoyance / Dé pipé |
| `rune.seve.pousse-vivace` | Pousse vivace | AMORCE · SEVE ×3 | emplacement AMORCE | Tu récupères 3 PV. | soi | HEAL | — | bloquée par Maudit |
| `rune.seve.ecorce` | Écorce | AMORCE · SEVE ×2 | emplacement AMORCE | Tu gagnes 3 Égide (2 tours). | soi | APPLY_STATUS | — | — |
| `rune.seve.graine-de-ronce` | Graine de ronce | AMORCE · SEVE ×2 | emplacement AMORCE | Tu gagnes Épines (2 tours) : chaque adversaire qui te blesse subit 1 dégât. | soi | APPLY_STATUS | — | — |
| `rune.seve.seve-montante` | Sève montante | TORSION · SEVE ×2 | emplacement TORSION | Tu gagnes 2 Régénération (3 tours). | soi | APPLY_STATUS | — | — |
| `rune.seve.appel-du-bosquet` | Appel du bosquet | TORSION · SEVE ×2 | emplacement TORSION | Invoque un Golem de mousse (6 PV) qui te donne 1 Égide à chaque fin de tour. | invocation | SUMMON | — | — |
| `rune.seve.pollen-engourdissant` | Pollen engourdissant | TORSION · SEVE ×2 | emplacement TORSION | Les sorciers à ta gauche et à ta droite reçoivent Faiblesse (2 tours). | gauche, droite | APPLY_STATUS | — | — |
| `rune.seve.fouet-de-liane` | Fouet de liane | FRAPPE · SEVE · init 9 ×2 | emplacement FRAPPE | Puissance de Sève. Sorcier à ta droite : 1–4 : 1 dégât. 5–9 : 3 dégâts. 10+ : 5 dégâts. Tu récupères ensuite 1 PV (2 PV au palier 10+). | droite, soi | POWER_ROLL, DAMAGE, HEAL | jet de Puissance | modifiée par Rage/Faiblesse/Surcharge, Égide, Carapace, Intangible ; déclenche Épines/Miroir ; bloquée par Maudit ; +1 dé avec Clairvoyance / Dé pipé |
| `rune.seve.ruee-des-racines` | Ruée des racines | FRAPPE · SEVE · init 6 ×2 | emplacement FRAPPE | Puissance de Sève. Un adversaire de ton choix : 1–4 : 2 dégâts. 5–9 : 3 dégâts. 10+ : 4 dégâts. Tu gagnes autant d'Égide que le palier obtenu (1, 2 ou 3). | au choix, soi | POWER_ROLL, DAMAGE, APPLY_STATUS | jet de Puissance | modifiée par Rage/Faiblesse/Surcharge, Égide, Carapace, Intangible ; déclenche Épines/Miroir ; +1 dé avec Clairvoyance / Dé pipé |
| `rune.seve.floraison` | Floraison brutale | FRAPPE · SEVE · init 2 ×1 | emplacement FRAPPE | Tous les sorciers récupèrent 2 PV. Puis Puissance de Sève, chaque adversaire : 1–4 : 1 dégât. 5–9 : 2 dégâts. 10+ : 4 dégâts. | tous les sorciers, tous les adversaires | HEAL, POWER_ROLL, DAMAGE | jet de Puissance | modifiée par Rage/Faiblesse/Surcharge, Égide, Carapace, Intangible ; déclenche Épines/Miroir ; bloquée par Maudit ; +1 dé avec Clairvoyance / Dé pipé |
| `rune.ether.lecture-des-astres` | Lecture des astres | AMORCE · ETHER ×3 | emplacement AMORCE | Pioche 2 runes. | soi | DRAW | — | — |
| `rune.ether.prisme` | Prisme | AMORCE · ETHER ×2 | emplacement AMORCE | Tu gagnes Clairvoyance (+1 dé aux jets de Puissance, 2 tours). | soi | APPLY_STATUS | — | — |
| `rune.ether.voile-chatoyant` | Voile chatoyant | AMORCE · ETHER ×2 | emplacement AMORCE | Tu gagnes 2 Égide (2 tours) et pioches 1 rune. | soi | APPLY_STATUS, DRAW | — | — |
| `rune.ether.echo-arcanique` | Écho arcanique | TORSION · ETHER ×2 | emplacement TORSION | Inflige 1 dégât à un adversaire aléatoire. Écho : une chance sur deux de recommencer (4 fois au total maximum). | adversaire aléatoire | ECHO, DAMAGE | écho tant que CHANCE (max 4) | modifiée par Rage/Faiblesse/Surcharge, Égide, Carapace, Intangible ; déclenche Épines/Miroir |
| `rune.ether.dissipation` | Dissipation | TORSION · ETHER ×2 | emplacement TORSION | Retire tous les effets bénéfiques d'un adversaire de ton choix. | au choix | REMOVE_STATUS | — | — |
| `rune.ether.sceau-inverse` | Sceau inversé | TORSION · ETHER ×1 | emplacement TORSION | Vole une relique aléatoire à ton adversaire le plus robuste. S'il n'en a pas, pioche 1 rune. | adversaire le plus robuste, soi | IF, STEAL_RELIC, DRAW | HAS_RELIC | — |
| `rune.ether.rayon-astral` | Rayon astral | FRAPPE · ETHER · init 11 ×2 | emplacement FRAPPE | Puissance d'Éther. Ton adversaire le plus robuste : 1–4 : 2 dégâts. 5–9 : 3 dégâts. 10+ : 5 dégâts. | adversaire le plus robuste | POWER_ROLL, DAMAGE | jet de Puissance | modifiée par Rage/Faiblesse/Surcharge, Égide, Carapace, Intangible ; déclenche Épines/Miroir ; +1 dé avec Clairvoyance / Dé pipé |
| `rune.ether.belier-de-lumiere` | Bélier de lumière | FRAPPE · ETHER · init 4 ×2 | emplacement FRAPPE | Puissance d'Éther : tu gagnes 1, 2 ou 3 Égide selon le palier. Puis le sorcier à ta gauche subit autant de dégâts que ton Égide totale. | soi, gauche | POWER_ROLL, APPLY_STATUS, DAMAGE | jet de Puissance | modifiée par Rage/Faiblesse/Surcharge, Égide, Carapace, Intangible ; déclenche Épines/Miroir ; +1 dé avec Clairvoyance / Dé pipé |
| `rune.ether.paradoxe` | Paradoxe | FRAPPE · ETHER · init 13 ×1 | emplacement FRAPPE | Au choix : inflige 4 dégâts à un adversaire de ton choix ; OU récupère 4 PV et pioche 1 rune. | au choix, soi | CHOOSE_OPTION, DAMAGE, HEAL, DRAW | — | modifiée par Rage/Faiblesse/Surcharge, Égide, Carapace, Intangible ; déclenche Épines/Miroir ; bloquée par Maudit |
| `rune.chimere.pickpocket-fantome` | Pickpocket fantôme | AMORCE · CHIMERE ×3 | emplacement AMORCE | Vole 1 rune aléatoire dans la main d'un adversaire aléatoire. | adversaire aléatoire | STEAL_CARD | — | — |
| `rune.chimere.mirage` | Mirage | AMORCE · CHIMERE ×2 | emplacement AMORCE | Pile ou face : tu deviens Intangible jusqu'à la fin du tour ; OU tu perds 2 PV. | soi | RANDOM, APPLY_STATUS, LOSE_HP | — | — |
| `rune.chimere.des-fous` | Dés fous | AMORCE · CHIMERE ×2 | emplacement AMORCE | Lance 2 dés. 10+ : tu gagnes une relique. Sinon : chaque adversaire subit 1 dégât. | tous les adversaires, soi | POWER_ROLL, DAMAGE, GAIN_RELIC | 2 dés fixes | modifiée par Rage/Faiblesse/Surcharge, Égide, Carapace, Intangible ; déclenche Épines/Miroir ; +1 dé avec Clairvoyance / Dé pipé |
| `rune.chimere.confusion` | Confusion | TORSION · CHIMERE ×2 | emplacement TORSION | Un adversaire de ton choix défausse 2 runes au hasard. | au choix | DISCARD | — | — |
| `rune.chimere.kaleidoscope` | Kaléidoscope | TORSION · CHIMERE ×2 | emplacement TORSION | Un adversaire aléatoire reçoit un effet néfaste aléatoire : Brûlure, Venin, Faiblesse ou Vulnérable. | adversaire aléatoire | FOR_EACH, RANDOM, APPLY_STATUS | — | — |
| `rune.chimere.sosie-a-plumes` | Sosie à plumes | TORSION · CHIMERE ×1 | emplacement TORSION | Invoque un Corbeau charognard (2 PV) : chaque fois qu'un sorcier meurt, tu récupères 2 PV et pioches 1 rune. | invocation | SUMMON | — | — |
| `rune.chimere.tourbillon` | Tourbillon farceur | FRAPPE · CHIMERE · init 8 ×2 | emplacement FRAPPE | Puissance de Chimère, puis 3 fois : un adversaire aléatoire subit 1 dégât (1–4), 2 dégâts (5–9) ou 3 dégâts (10+). | adversaire aléatoire | POWER_ROLL, REPEAT, DAMAGE | jet de Puissance | modifiée par Rage/Faiblesse/Surcharge, Égide, Carapace, Intangible ; déclenche Épines/Miroir ; +1 dé avec Clairvoyance / Dé pipé |
| `rune.chimere.farce-cruelle` | Farce cruelle | FRAPPE · CHIMERE · init 1 ×2 | emplacement FRAPPE | Puissance de Chimère. Un adversaire de ton choix : 1–4 : 2 dégâts. 5–9 : 3 dégâts. 10+ : 4 dégâts et il défausse 1 rune au hasard. | au choix | POWER_ROLL, DAMAGE, FOR_EACH, DISCARD | jet de Puissance | modifiée par Rage/Faiblesse/Surcharge, Égide, Carapace, Intangible ; déclenche Épines/Miroir ; +1 dé avec Clairvoyance / Dé pipé |
| `rune.chimere.grand-illusionniste` | Grand illusionniste | FRAPPE · CHIMERE · init 15 ×1 | emplacement FRAPPE | Puissance de Chimère. Chaque adversaire : 1–4 : 1 dégât. 5–9 : 2 dégâts. 10+ : 3 dégâts et il défausse 1 rune au hasard. | tous les adversaires | POWER_ROLL, DAMAGE, DISCARD | jet de Puissance | modifiée par Rage/Faiblesse/Surcharge, Égide, Carapace, Intangible ; déclenche Épines/Miroir ; +1 dé avec Clairvoyance / Dé pipé |
| `rune.duo.tison-d-ombre` | Tison d'ombre | AMORCE · BRAISE+OMBRE ×2 | emplacement AMORCE | Draine 1 PV au sorcier à ta gauche et lui inflige 1 Brûlure (2 tours). | gauche | DRAIN, APPLY_STATUS | — | modifiée par Rage/Faiblesse/Surcharge, Égide, Carapace, Intangible ; déclenche Épines/Miroir ; bloquée par Maudit ; compte pour deux écoles |
| `rune.duo.epine-astrale` | Épine astrale | TORSION · SEVE+ETHER ×2 | emplacement TORSION | Tu gagnes Épines (2 tours) et pioches 1 rune. | soi | APPLY_STATUS, DRAW | — | compte pour deux écoles |
| `rune.duo.chaos-flamboyant` | Chaos flamboyant | FRAPPE · BRAISE+CHIMERE · init 16 ×1 | emplacement FRAPPE | Puissance (Braise ou Chimère, la meilleure). Un adversaire aléatoire : 1–4 : 3 dégâts. 5–9 : 4 dégâts. 10+ : 6 dégâts et 2 Brûlure. | adversaire aléatoire | POWER_ROLL, DAMAGE, FOR_EACH, APPLY_STATUS | jet de Puissance | modifiée par Rage/Faiblesse/Surcharge, Égide, Carapace, Intangible ; déclenche Épines/Miroir ; +1 dé avec Clairvoyance / Dé pipé ; compte pour deux écoles |
| `rune.duo.frappe-crepusculaire` | Frappe crépusculaire | FRAPPE · OMBRE+ETHER · init 17 ×1 | emplacement FRAPPE | Puissance (Ombre ou Éther, la meilleure). Ton adversaire le plus robuste : 1–4 : 2 dégâts. 5–9 : 3 dégâts et Vulnérable. 10+ : 5 dégâts et Vulnérable. | adversaire le plus robuste | POWER_ROLL, DAMAGE, FOR_EACH, APPLY_STATUS | jet de Puissance | modifiée par Rage/Faiblesse/Surcharge, Égide, Carapace, Intangible ; déclenche Épines/Miroir ; +1 dé avec Clairvoyance / Dé pipé ; compte pour deux écoles |
| `rune.instable` | Rune instable | Instable ×6 | 1 emplacement (libre) | Se place dans n'importe quel emplacement. Au dévoilement, elle est remplacée par la première rune de la pioche correspondant à cet emplacement. | — | — | — | remplacée au dévoilement |

## Reliques (12 cartes, 20 exemplaires)

| ID | Nom | Type | Coût | Description | Cible | Effets | Conditions | Interactions |
|---|---|---|---|---|---|---|---|---|
| `relic.anneau-de-braises` | Anneau de braises | Relique ×2 | — | Tes dégâts de Braise sont augmentés de 1. | — | modificateur DAMAGE_OUT ADD | — | — |
| `relic.crane-bavard` | Crâne bavard | Relique ×2 | — | Quand tu élimines un sorcier, tu récupères 3 PV. | porteur | déclencheur ON_KILL | — | — |
| `relic.de-pipe` | Dé pipé | Relique ×2 | — | +1 dé à tes jets de Puissance. | — | modificateur DICE ADD | — | — |
| `relic.miroir-fele` | Miroir fêlé | Relique ×2 | — | Une fois par tour, quand un adversaire te blesse, il subit 2 dégâts. | source de l'événement | déclencheur ON_DAMAGE_RECEIVED | — | — |
| `relic.gourde-de-seve` | Gourde de sève | Relique ×2 | — | À la fin de chaque tour, tu récupères 1 PV. | porteur | déclencheur ON_TURN_END | — | — |
| `relic.plastron-runique` | Plastron runique | Relique ×2 | — | Les dégâts que tu subis sont réduits de 1. | — | modificateur DAMAGE_IN ADD | — | — |
| `relic.sablier-voleur` | Sablier voleur | Relique ×2 | — | +3 à l'initiative de ton sort. | — | modificateur INITIATIVE ADD | — | — |
| `relic.sacoche-sans-fond` | Sacoche sans fond | Relique éternelle ×1 | — | Éternelle. Ta main contient 1 rune de plus. | — | modificateur HAND_SIZE ADD | — | — |
| `relic.coeur-de-golem` | Cœur de golem | Relique éternelle ×1 | — | Éternelle. +4 PV maximum. | — | modificateur MAX_HP ADD | — | — |
| `relic.couronne-de-ronces` | Couronne de ronces | Relique éternelle ×1 | — | Éternelle. Au début de chaque manche, tu gagnes Épines (2 tours). | porteur | déclencheur ON_ROUND_START | — | — |
| `relic.sac-a-malices` | Sac à malices | Relique ×2 | — | Quand tu lances un sort, une chance sur quatre de piocher 1 rune. | porteur | déclencheur ON_SPELL_CAST | — | — |
| `relic.lanterne-des-morts` | Lanterne des morts | Relique ×1 | — | Quand un autre sorcier meurt, tu gagnes 2 Égide. | porteur | déclencheur ON_ANY_DEATH | — | — |

## Rancunes (8 cartes, 20 exemplaires)

| ID | Nom | Type | Coût | Description | Cible | Effets | Conditions | Interactions |
|---|---|---|---|---|---|---|---|---|
| `grudge.revanche` | Revanche | Rancune ×3 | — | Le sorcier qui t'a éliminé subit 3 dégâts. | ton meurtrier | DAMAGE | — | modifiée par Rage/Faiblesse/Surcharge, Égide, Carapace, Intangible ; déclenche Épines/Miroir |
| `grudge.linceul` | Linceul | Rancune ×3 | — | Tu gagnes 5 Égide (2 tours). | soi | APPLY_STATUS | — | — |
| `grudge.os-a-ronger` | Os à ronger | Rancune ×2 | — | Tu gagnes une relique. | soi | GAIN_RELIC | — | — |
| `grudge.chuchotements` | Chuchotements d'outre-tombe | Rancune ×3 | — | Pioche 2 runes. | soi | DRAW | — | — |
| `grudge.vigueur-spectrale` | Vigueur spectrale | Rancune ×3 | — | +4 PV maximum pour cette manche, et tu récupères 4 PV. | soi | APPLY_STATUS, HEAL | — | bloquée par Maudit |
| `grudge.malediction-posthume` | Malédiction posthume | Rancune ×2 | — | Ton adversaire le plus robuste reçoit Faiblesse et Maudit (2 tours). | adversaire le plus robuste | APPLY_STATUS | — | — |
| `grudge.feu-follet` | Feu follet vengeur | Rancune ×2 | — | Invoque un Feu follet (3 PV) qui inflige 1 dégât à un adversaire aléatoire à chaque fin de tour. | invocation | SUMMON | — | — |
| `grudge.rancoeur` | Rancœur | Rancune ×2 | — | Tu gagnes 2 Rage (2 tours). | soi | APPLY_STATUS | — | — |

## Statuts

| ID | Nom | Polarité | Cumul | Durée par défaut | Effet |
|---|---|---|---|---|---|
| `brulure` | Brûlure | DEBUFF | STACK (max 3) | 2 | En fin de tour, subit 1 dégât par cumul. |
| `venin` | Venin | DEBUFF | STACK (max 5) | 3 | En fin de tour, subit 1 dégât par cumul. |
| `egide` | Égide | BUFF | STACK (max 10) | 2 | Absorbe les dégâts reçus (1 point par cumul). |
| `epines` | Épines | BUFF | REFRESH (max 1) | 2 | Quand un adversaire lui inflige des dégâts, il subit 1 dégât en retour. |
| `rage` | Rage | BUFF | STACK (max 3) | 2 | +1 aux dégâts infligés par cumul. |
| `faiblesse` | Faiblesse | DEBUFF | REFRESH (max 1) | 2 | −1 aux dégâts infligés. |
| `vulnerable` | Vulnérable | DEBUFF | REFRESH (max 1) | 1 | Subit 50 % de dégâts en plus (arrondi inférieur). |
| `surcharge` | Surcharge | BUFF | STACK (max 2) | 2 | Les prochains dégâts infligés sont doublés (consommé à l'usage). |
| `regeneration` | Régénération | BUFF | STACK (max 3) | 3 | En fin de tour, récupère 1 PV par cumul. |
| `intangible` | Intangible | BUFF | REFRESH (max 1) | 1 | Immunisé contre tous les dégâts. |
| `clairvoyance` | Clairvoyance | BUFF | REFRESH (max 1) | 2 | +1 dé aux jets de Puissance. |
| `maudit` | Maudit | DEBUFF | REFRESH (max 1) | 2 | Ne peut pas récupérer de PV. |
| `carapace` | Carapace | BUFF | STACK (max 3) | 2 | −1 aux dégâts subis par cumul. |
| `vigueur-spectrale` | Vigueur spectrale | BUFF | IGNORE (max 1) | PERMANENT | +4 PV maximum pour la manche. |

## Invocations

| ID | Nom | PV | Effet |
|---|---|---|---|
| `feu-follet` | Feu follet | 3 | En fin de tour, inflige 1 dégât à un adversaire aléatoire. |
| `golem-de-mousse` | Golem de mousse | 6 | En fin de tour, donne 1 Égide à son maître. |
| `corbeau-charognard` | Corbeau charognard | 2 | Quand un sorcier meurt, son maître récupère 2 PV et pioche 1 rune. |
