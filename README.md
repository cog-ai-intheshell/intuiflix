# Intuiflix

**Intuiflix** est un jeu d’intuition probabiliste au style cinématographique.
Pendant une session, le joueur prend 30 décisions rapides à partir
d’informations incomplètes. Le jeu révèle ensuite les issues et construit un
portrait de la manière dont le joueur réagit au hasard, aux fréquences, aux
proportions et au risque.

L’expérience est réalisée sans framework : HTML, CSS et JavaScript natifs côté
navigateur, avec un petit serveur Python pour les profils et l’historique.

## Fonctionnalités

- landing page inspirée des catalogues de streaming ;
- dix mini-jeux génératifs ;
- 30 décisions par session, avec un chrono de 10 secondes ;
- animation complète de la révélation avant l’affichage du résultat ;
- difficulté adaptée aux décisions récentes ;
- score, série et bonus de rapidité ;
- connexion locale par profil ;
- sauvegarde des sessions côté serveur et dans le navigateur ;
- bilan détaillé après chaque partie ;
- historique des scores ;
- interface responsive ;
- consignes du catalogue entièrement pilotées par JSON ;
- design system local avec tokens et audit automatique.

## Les dix épreuves

| Épreuve | Principe |
| --- | --- |
| Cartes cachées | Choisir une carte à partir d’une proportion annoncée. |
| Somme invisible | Anticiper la position de la somme de plusieurs dés. |
| Sac de couleurs | Lire une fréquence sans confondre probable et certain. |
| La meilleure boîte | Comparer des proportions plutôt que des quantités. |
| Nuage de points | Estimer rapidement une quantité sans compter. |
| Les lucioles | Détecter la direction d’un mouvement collectif. |
| Quelle main ? | Apprendre une habitude comportementale imparfaite. |
| Les trois portes | Identifier progressivement une option plus généreuse. |
| Le chemin vivant | Anticiper un flux à partir de chemins inégaux. |
| Continuer ou partir | Trouver un seuil entre gain sécurisé et risque. |

## Lancement

### Prérequis

- Python 3.10 ou plus récent ;
- un navigateur moderne.

Aucun paquet Python ou JavaScript supplémentaire n’est nécessaire.

### Démarrer le serveur

```bash
python3 server.py
```

L’application est ensuite disponible sur :

```text
http://127.0.0.1:8080
```

Pour utiliser un autre port ou accepter les connexions du réseau local :

```bash
python3 server.py --host 0.0.0.0 --port 9000
```

## Profils

Les profils autorisés sont définis dans :

```text
data/users.json
```

Pour ajouter un joueur :

```json
{
  "username": "nouveau-joueur",
  "displayName": "Nouveau joueur"
}
```

La connexion est volontairement légère et sans mot de passe. Elle sert à
séparer les historiques sur un appareil local ; elle ne constitue pas un
système d’authentification destiné à la production.

## Modifier les consignes

Les informations affichées dans le catalogue et dans les fenêtres descriptives
proviennent exclusivement de :

```text
public/data/games.json
```

Chaque épreuve possède la structure suivante :

```json
{
  "id": "cards",
  "number": "01",
  "title": "Cartes cachées",
  "eyebrow": "Probabilité simple",
  "tagline": "Choisir sans inventer un motif.",
  "description": "Description détaillée de l’épreuve.",
  "instructions": [
    "Première étape.",
    "Deuxième étape.",
    "Troisième étape."
  ],
  "measures": "Intuition probabiliste",
  "duration": "10 s",
  "illustration": "cards"
}
```

Les textes peuvent donc évoluer sans modifier le HTML ou le moteur du jeu.
L’identifiant et le type d’illustration doivent correspondre à une épreuve prise
en charge par `public/js/app.js`.

## Organisation du projet

```text
intuiflix/
├── .design-system/          Tokens, composants et rapports générés
├── data/
│   ├── history.json         Sessions enregistrées
│   └── users.json           Profils autorisés
├── public/
│   ├── data/
│   │   └── games.json       Catalogue et consignes
│   ├── js/
│   │   ├── analysis.js      Analyse comportementale
│   │   ├── app.js           Interface et orchestration
│   │   └── game.js          Générateurs et score
│   ├── index.html           Structure des écrans
│   └── styles.css           Design responsive et animations
├── AGENTS.md                Règles locales du projet
├── README.md
└── server.py                Serveur HTTP et API locale
```

## Fonctionnement d’une partie

1. Le moteur mélange les dix formats dans chacun des trois actes.
2. Une épreuve est générée avec ses données et son issue cachée.
3. Le joueur dispose de 10 secondes pour répondre.
4. L’animation révèle entièrement l’issue.
5. Le résultat, la qualité de la stratégie et les points apparaissent.
6. Après 30 décisions, le jeu produit le bilan de la session.

Une bonne décision probabiliste peut mener à une mauvaise issue. Intuiflix
distingue donc la justesse du résultat et la qualité du choix.

## Analyse finale

Le bilan utilise uniquement les décisions de la partie en cours et présente
notamment :

- l’intuition probabiliste ;
- l’estimation numérique ;
- la décision sous incertitude ;
- la comparaison de proportions ;
- l’adaptation ;
- la gestion du risque ;
- la vitesse de décision ;
- les performances par épreuve ;
- l’évolution par rapport aux sessions précédentes.

Les résultats décrivent une session de jeu. Ils ne constituent ni un diagnostic
psychologique ni une mesure stable de la personnalité.

## Stockage

- `data/history.json` conserve les sessions enregistrées par le serveur ;
- `localStorage` fournit une copie locale lorsque le serveur est indisponible ;
- un cookie signé identifie le profil actif pendant l’exécution du serveur.

Le serveur expose les routes locales suivantes :

| Méthode | Route | Usage |
| --- | --- | --- |
| `GET` | `/api/health` | Vérification du serveur |
| `GET` | `/api/me` | Profil actif |
| `GET` | `/api/history` | Historique du profil |
| `POST` | `/api/login` | Connexion à un profil autorisé |
| `POST` | `/api/logout` | Déconnexion |
| `POST` | `/api/sessions` | Enregistrement d’une session |

## Design system

Les sources du design system se trouvent dans `.design-system/`. Les couleurs,
rayons, ombres et composants partagés doivent réutiliser les tokens existants.

Après une modification visuelle :

```bash
node /chemin/vers/design-system-governor/scripts/dsg.mjs generate --repo .
node /chemin/vers/design-system-governor/scripts/dsg.mjs audit --repo .
```

Les fichiers contenus dans `.design-system/generated/` sont générés
automatiquement et ne doivent pas être modifiés manuellement.

## Vérifications rapides

```bash
node --check public/js/app.js
node --check public/js/game.js
node --check public/js/analysis.js
python3 -m py_compile server.py
```

Pour tester l’expérience complète, démarrer une nouvelle partie et vérifier la
révélation des dix formats, la sauvegarde de la session puis l’écran d’analyse.
