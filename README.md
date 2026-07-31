# Intuiflix

> Un jeu cinématographique pour observer la manière dont nous décidons quand
> toutes les informations ne sont pas disponibles.

Intuiflix est une expérience web d’intuition probabiliste. Une partie enchaîne
30 décisions courtes à travers dix mini-jeux génératifs. Le joueur dispose de
10 secondes pour répondre, observe ensuite la révélation complète de l’issue,
puis reçoit un retour distinguant le résultat obtenu de la qualité de la
stratégie choisie.

L’application adopte une direction artistique sombre inspirée des plateformes
de streaming. Elle fonctionne sans framework côté client : HTML, CSS et
JavaScript natifs, accompagnés d’un serveur Python standard pour les profils et
la persistance.

## Sommaire

- [Objectifs](#objectifs)
- [Fonctionnalités](#fonctionnalités)
- [Démarrage rapide](#démarrage-rapide)
- [Déroulement d’une partie](#déroulement-dune-partie)
- [Les dix épreuves](#les-dix-épreuves)
- [Score et difficulté](#score-et-difficulté)
- [Analyse finale](#analyse-finale)
- [Personnaliser le catalogue](#personnaliser-le-catalogue)
- [Profils et sauvegarde](#profils-et-sauvegarde)
- [Architecture](#architecture)
- [API locale](#api-locale)
- [Design system](#design-system)
- [Vérifications](#vérifications)
- [Dépannage](#dépannage)
- [Sécurité et confidentialité](#sécurité-et-confidentialité)
- [Limites actuelles](#limites-actuelles)

## Objectifs

Intuiflix ne cherche pas à enseigner des formules de probabilité pendant la
partie. L’expérience cherche plutôt à faire émerger des comportements :

- repérer un signal dans une information bruitée ;
- estimer sans pouvoir compter précisément ;
- distinguer une bonne décision d’une issue favorable ;
- apprendre une tendance cachée au fil des essais ;
- ajuster son comportement lorsque la règle évolue ;
- trouver son seuil face au risque et à l’incertitude.

Les résultats décrivent uniquement la session observée. Ils ne constituent ni
un diagnostic psychologique ni une mesure stable de la personnalité.

## Fonctionnalités

- landing page responsive inspirée des catalogues de streaming ;
- collection de dix épreuves organisée en rangées ;
- fiche illustrée et consigne détaillée pour chaque épreuve ;
- contenus du catalogue chargés depuis un fichier JSON ;
- 30 décisions par partie, soit trois passages par format ;
- chrono fixe de 10 secondes ;
- difficulté progressive et adaptative ;
- animations de révélation propres à chaque mini-jeu ;
- résultat affiché uniquement après la fin de la révélation ;
- distinction entre issue exacte et choix probabilistiquement optimal ;
- score, bonus de rapidité, difficulté et série ;
- profils locaux sans mot de passe ;
- sauvegarde serveur avec repli dans le navigateur ;
- bilan comportemental et historique des scores ;
- interface clavier, souris et tactile ;
- design system local auditable.

## Démarrage rapide

### Prérequis

- Python 3.10 ou une version plus récente ;
- un navigateur moderne prenant en charge les modules JavaScript ;
- aucune dépendance Python ou JavaScript externe.

### Lancer Intuiflix

Depuis la racine du projet :

```bash
python3 server.py
```

Ouvrir ensuite :

```text
http://127.0.0.1:8080
```

Le serveur accepte également un hôte et un port personnalisés :

```bash
python3 server.py --host 0.0.0.0 --port 9000
```

L’option `0.0.0.0` rend le serveur accessible sur le réseau local. Elle ne
transforme pas l’application en service de production sécurisé.

### Arrêter le serveur

Dans le terminal où il est lancé :

```text
Ctrl+C
```

## Déroulement d’une partie

1. Le joueur sélectionne ou crée localement un profil autorisé.
2. Le moteur mélange les dix formats pour constituer le premier acte.
3. Une épreuve est générée avec ses données et son issue cachée.
4. Le joueur dispose de 10 secondes pour prendre une décision.
5. Les contrôles sont désactivés dès la réponse ou à la fin du chrono.
6. L’animation révèle entièrement l’issue.
7. Une courte pause laisse le résultat visuel lisible.
8. La fenêtre de retour explique l’issue et attribue les points.
9. Les dix formats sont remélangés pour les deuxième et troisième actes.
10. Après 30 décisions, la partie produit un bilan et sauvegarde la session.

Chaque lot de dix décisions contient exactement une apparition de chaque
épreuve. Le moteur empêche également qu’un même format apparaisse deux fois de
suite à la frontière entre deux lots.

## Les dix épreuves

| Épreuve | Signal présenté | Décision demandée | Dimension observée |
| --- | --- | --- | --- |
| Cartes cachées | Proportion de cartes rouges | Choisir une carte | Intuition probabiliste |
| Somme invisible | Nombre de dés et référence | Inférieur, égal ou supérieur | Lecture d’une distribution |
| Sac de couleurs | Composition visible du sac | Prédire une couleur | Sens des fréquences |
| La meilleure boîte | Gains et tailles différentes | Choisir la meilleure proportion | Comparaison de ratios |
| Nuage de points | Quantité affichée brièvement | Estimer le total | Estimation numérique |
| Les lucioles | Mouvement bruité d’un essaim | Prédire la sortie | Détection de tendance |
| Quelle main ? | Historique comportemental | Gauche ou droite | Apprentissage implicite |
| Les trois portes | Résultats récents par porte | Choisir une porte | Adaptation aux fréquences |
| Le chemin vivant | Largeur de trois branches | Prédire l’arrivée | Intuition des flux |
| Continuer ou partir | Gain et stabilité d’une tour | Sécuriser ou continuer | Gestion du risque |

### Épreuves avec mémoire

Certaines épreuves conservent un état pendant la partie :

- **Quelle main ?** utilise une habitude dominante modérée, puis change de
  comportement à la troisième apparition ;
- **Les trois portes** fait évoluer les observations associées aux portes ;
- **Continuer ou partir** conserve la progression et les issues récentes.

Cet état est recréé au début de chaque nouvelle partie.

## Score et difficulté

### Deux notions différentes

Une décision stocke deux informations :

- `isCorrect` : le choix correspond à l’issue réellement obtenue ;
- `isOptimal` : le choix était le plus favorable compte tenu des informations.

Une stratégie rationnelle peut donc perdre à cause du hasard. Dans ce cas, le
jeu le signale et attribue des points de stratégie.

### Calcul du score

Une issue correcte peut rapporter :

| Composant | Valeur maximale |
| --- | ---: |
| Base de réussite | 100 points |
| Bonus de rapidité | 90 points |
| Bonus de difficulté | 110 points |
| Bonus de série | 120 points |

Un choix optimal suivi d’une issue défavorable rapporte 35 points de stratégie.
Une décision manquée à la fin du chrono rapporte 0 point.

### Difficulté adaptative

La difficulté de base progresse du début à la fin de la partie. Le moteur
analyse également les cinq dernières décisions :

- au moins 80 % de choix optimaux et des réponses rapides : `+0,1` ;
- 40 % de choix optimaux ou moins : `−0,1` ;
- sinon : aucun ajustement.

La difficulté finale reste toujours comprise entre 0 et 1.

## Analyse finale

L’analyse utilise uniquement les décisions enregistrées pendant la partie. Elle
produit :

- un profil de session ;
- le taux d’issues exactes ;
- le taux de choix optimaux ;
- le temps de réaction moyen ;
- la plus longue série ;
- des observations sur les cas ambigus ;
- une comparaison entre la première et la seconde moitié ;
- une ventilation par mini-jeu ;
- une comparaison avec les sessions précédentes.

### Métriques affichées

- intuition probabiliste ;
- estimation numérique ;
- décision sous incertitude ;
- comparaison de proportions ;
- adaptation ;
- gestion du risque ;
- vitesse de décision.

Les métriques sont calculées sur 100 et indiquent également le nombre de
décisions réellement observées.

## Personnaliser le catalogue

La landing page et les fenêtres de présentation sont alimentées par :

```text
public/data/games.json
```

Modifier ce fichier suffit pour faire évoluer les titres, descriptions et
consignes sans toucher au HTML.

### Structure d’une entrée

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

### Champs

| Champ | Rôle |
| --- | --- |
| `id` | Identifiant stable de l’épreuve |
| `number` | Numéro affiché dans le catalogue |
| `title` | Nom public |
| `eyebrow` | Catégorie courte affichée au-dessus du titre |
| `tagline` | Résumé visible sur la carte |
| `description` | Présentation développée dans la fenêtre |
| `instructions` | Étapes ordonnées de la consigne |
| `measures` | Dimension annoncée dans l’illustration |
| `duration` | Durée affichée dans la fiche |
| `illustration` | Type d’illustration pris en charge par l’interface |

Les valeurs `id` et `illustration` doivent correspondre à un type géré dans
`public/js/app.js`. Le moteur des épreuves reste défini dans
`public/js/game.js`.

## Profils et sauvegarde

### Ajouter un profil

Les profils autorisés sont définis dans :

```text
data/users.json
```

Ajouter une entrée dans le tableau `users` :

```json
{
  "username": "nouveau-joueur",
  "displayName": "Nouveau joueur"
}
```

Le `username` est normalisé en minuscules lors de la connexion.

### Historique

- le serveur conserve au maximum 80 sessions par profil ;
- les données sont écrites dans `data/history.json` ;
- ce fichier est ignoré par Git pour ne pas publier les parties locales ;
- `data/history.example.json` fournit un exemple vide ;
- le navigateur conserve également une copie dans `localStorage`.

Si le serveur devient indisponible après le chargement de la page, la session
terminée reste consultable localement.

## Architecture

```text
intuiflix/
├── .design-system/
│   ├── components/              Contrats des composants
│   ├── generated/               Catalogue et graphes générés
│   ├── reports/                 Rapports d’audit
│   └── tokens/                  Tokens primitifs et sémantiques
├── data/
│   ├── history.example.json     Exemple d’historique vide
│   ├── history.json             Historique local, ignoré par Git
│   └── users.json               Profils autorisés
├── public/
│   ├── data/
│   │   └── games.json           Catalogue et consignes
│   ├── js/
│   │   ├── analysis.js          Métriques et profils de session
│   │   ├── app.js               Écrans, interactions et animations
│   │   └── game.js              Génération, difficulté et score
│   ├── index.html               Structure de l’application
│   └── styles.css               Design responsive
├── .gitignore
├── AGENTS.md                    Règles locales de contribution
├── README.md
└── server.py                    Serveur HTTP et API JSON
```

### Côté navigateur

`public/js/game.js`

- construit l’ordre des manches ;
- génère les données et l’issue de chaque épreuve ;
- maintient les états propres à la session ;
- calcule la difficulté et le score.

`public/js/app.js`

- charge le catalogue JSON ;
- gère les profils et la navigation ;
- rend les dix épreuves ;
- orchestre le chrono, la révélation et le retour ;
- sauvegarde la partie.

`public/js/analysis.js`

- agrège les décisions ;
- calcule les métriques ;
- génère les observations et le profil de session.

### Côté serveur

`server.py` repose uniquement sur la bibliothèque standard Python :

- `ThreadingHTTPServer` pour servir plusieurs requêtes ;
- fichiers statiques depuis `public/` ;
- API JSON pour les profils et les sessions ;
- cookie signé avec HMAC ;
- écriture de l’historique protégée par un verrou.

## API locale

| Méthode | Route | Authentification | Usage |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Non | État du serveur |
| `GET` | `/api/me` | Non | Profil actif ou `null` |
| `GET` | `/api/history` | Oui | Historique du profil |
| `POST` | `/api/login` | Non | Connexion à un profil autorisé |
| `POST` | `/api/logout` | Non | Suppression du cookie |
| `POST` | `/api/sessions` | Oui | Enregistrement d’une session |

### Vérifier le serveur

```bash
curl http://127.0.0.1:8080/api/health
```

Réponse attendue :

```json
{
  "status": "ok",
  "service": "intuiflix"
}
```

### Se connecter depuis la ligne de commande

```bash
curl \
  -c cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"username":"augustin"}' \
  http://127.0.0.1:8080/api/login
```

Puis lire l’historique :

```bash
curl -b cookies.txt http://127.0.0.1:8080/api/history
```

## Design system

Le dépôt possède un design system local dans `.design-system/`.

Règles principales :

- consulter le design system avant toute modification visuelle ;
- réutiliser les tokens avant d’ajouter une valeur ;
- enregistrer les nouveaux composants partagés ;
- ne jamais modifier `.design-system/generated/` manuellement ;
- régénérer le catalogue et le graphe d’impact après une modification UI.

### Regénérer et auditer

```bash
node /chemin/vers/design-system-governor/scripts/dsg.mjs generate --repo .
node /chemin/vers/design-system-governor/scripts/dsg.mjs audit --repo .
```

Le rapport humain se trouve dans :

```text
.design-system/reports/audit.md
```

## Vérifications

### Syntaxe

```bash
node --check public/js/app.js
node --check public/js/game.js
node --check public/js/analysis.js
python3 -m py_compile server.py
```

### Validation du catalogue JSON

```bash
python3 -m json.tool public/data/games.json > /dev/null
```

### Test manuel recommandé

1. ouvrir la landing page ;
2. vérifier les dix cartes et leurs fiches ;
3. démarrer une nouvelle partie ;
4. jouer une occurrence de chacun des dix formats ;
5. vérifier que la révélation se termine avant le retour ;
6. laisser volontairement expirer une manche ;
7. terminer la session ;
8. vérifier le bilan et l’historique ;
9. recharger la page et restaurer le même profil ;
10. contrôler l’affichage sur mobile.

## Dépannage

### Le port 8080 est déjà utilisé

```bash
python3 server.py --port 8081
```

Puis ouvrir `http://127.0.0.1:8081`.

### Le profil est refusé

Vérifier que le `username` existe dans `data/users.json`. Le nom affiché ne sert
pas d’identifiant de connexion.

### Le catalogue ne se charge pas

- lancer l’application avec `server.py` plutôt qu’en ouvrant directement le
  fichier `public/index.html` ;
- valider `public/data/games.json` ;
- vérifier que chaque entrée possède un tableau `instructions`.

### L’historique serveur reste vide

- vérifier que le joueur est connecté ;
- terminer entièrement la partie ;
- vérifier les droits d’écriture du dossier `data/`.

### Une modification JavaScript n’apparaît pas

Actualiser complètement la page. Le serveur désactive le cache pour les fichiers
HTML, CSS et JavaScript pendant le développement local.

## Sécurité et confidentialité

Le système de profils est adapté à une démonstration locale :

- aucun mot de passe n’est demandé ;
- le cookie est signé, `HttpOnly` et `SameSite=Lax` ;
- la clé de signature est recréée au lancement du serveur ;
- redémarrer le serveur invalide donc les cookies précédents ;
- aucune donnée n’est envoyée vers un service tiers ;
- l’historique contient les décisions détaillées d’une partie.

Avant une mise en production publique, il faudrait notamment ajouter :

- une authentification réelle ;
- HTTPS et l’attribut `Secure` sur le cookie ;
- une clé de session persistante et protégée ;
- une base de données ;
- une politique de conservation et de suppression ;
- une validation serveur plus stricte des décisions ;
- des protections contre les abus et la limitation de débit.

## Limites actuelles

- l’application est conçue pour un usage local ou une démonstration ;
- les données sont stockées dans des fichiers JSON ;
- plusieurs processus serveur ne doivent pas écrire simultanément le même
  historique ;
- aucune suite de tests automatisés n’est encore incluse dans le dépôt ;
- le choix du profil ne constitue pas une authentification sécurisée ;
- les résultats ne doivent pas être interprétés comme une évaluation clinique.

## Contribution

Pour une modification fonctionnelle :

1. conserver les API publiques de `game.js` lorsque possible ;
2. vérifier les dix générateurs ;
3. tester les chronos et les expirations ;
4. contrôler la sauvegarde et l’analyse.

Pour une modification visuelle :

1. consulter `.design-system/` ;
2. réutiliser les tokens et composants ;
3. vérifier les formats desktop et mobile ;
4. régénérer les fichiers d’observabilité ;
5. lancer l’audit.

Les fichiers de parties, caches Python, fichiers `.env`, `.DS_Store` et le
projet de référence `split-second-main/` sont exclus du dépôt Git.
