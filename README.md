# Starfall - Jeu Spatial Multijoueur en Ligne 🚀

### Participant : **Noah Rousseau**
### Vidéo de présentation du jeu : https://youtu.be/Wn2A5LNvlaQ

**Starfall** est un jeu multijoueur en 3D temps réel dans l'espace, développé en JavaScript avec Babylon.js. Il propose des combats de vaisseaux fluides, un système de gravité dynamique, et une interface immersive.

---

## 🎮 Description

Dans *Starfall*, chaque joueur pilote un vaisseau spatial dans une arène galactique remplie de planètes et d'étoiles. Le but est simple : survivre, éliminer les autres joueurs, et dominer la galaxie.

---

## 🚀 Fonctionnalités

- **Multijoueur en ligne** : chaque joueur a son propre vaisseau connecté via WebSocket.
- **Gravité réaliste** : influence des planètes et des étoiles sur les déplacements. Attention, ne vous approchez pas trop des étoiles 😉 !
- **Contrôles Clavier/Souris (Azerty et Qwerty)** :
  - `E` : accélérer (ajout de particules d’échappement)
  - `Espace` : tirer
  - `X` : afficher/masquer les axes & vecteurs
  - `I` : ouvrir l'inspecteur Babylon.js
  - `V` : basculer entre vue cockpit et troisième personne
  - `Souris` : rotation libre du vaisseau (mode immersif)
- **Radar** : vision stratégique des vaisseaux ennemis autour de vous
- **Effets spéciaux** :
  - Particules dynamiques
  - Glow pour les projectiles
  - Système d’alerte de gravité
- **Système de score** :
  - Nombre de kills visible à l’écran
  - Score envoyé au serveur à la mort
- **Planètes & Étoiles** :
  - Générées aléatoirement avec textures réalistes
  - Les étoiles détruisent les vaisseaux au contact
- **Canvas d'information (FPS, vitesse, gravité, etc.)**

---

## 🛠️ Technologies Utilisées

- JavaScript (ES6+)
- Babylon.js (3D WebGL engine)
- WebSockets (`ws`)
- Express.js (serveur HTTP)
- HTML5 / CSS3
- Node.js

---

## 🎯 Règles du Jeu

- Chaque joueur dispose de **30 points de vie**.
- Tirez pour éliminer les autres joueurs.
- La gravité des étoiles peut vous tuer.
- Quand votre vaisseau est détruit :
  - Il disparaît du monde
  - Votre score est envoyé à l’API serveur (`/newScore`)
- Le joueur avec le plus de kills domine !

---

## 📁 Structure du Projet

```
├── client/js/
│   ├── controlManagers/
│   │   ├── keyboard.js             # Gestion des touches
│   │   └── mouse.js                # Rotation via souris
│   ├── physicalObjects/
│   │   ├── bullet/
│   │   │   ├── bullet.js           # Projectiles 
│   │   │   └── worker.js           # Worker parallèle
│   │   ├── particle/
│   │   │   ├── particle.js         # Particules 
│   │   │   ├── particleLight.js    # Lumière des particules 
│   │   │   ├── particleSys.js      # Système physique des particules 
│   │   │   └── worker.js           # Worker parallèle 
│   │   ├── camera.js               # Camera
│   │   ├── planet.js               # Planètes et étoiles
│   │   ├── ship.js                 # Vaisseaux
│   │   └── skydome.js              # Dôme du monde
│   ├── ui/
│   │   ├── axis.js                 # Axes visuels
│   │   ├── panel.js                # Interface d'information
│   │   ├── utils.js                # Utilitaires de l'interface
│   │   └── velocityVector.js       # Vecteur de vitesse
│   ├── client.js                   # Initialisation du jeu côté client
└── server/
    ├── physicalObjects/
    │   ├── bullet.js               # Projectiles 
    │   ├── particle.js             # Particules 
    │   ├── planet.js               # Planètes et étoiles
    │   └── ship.js                 # Vaisseaux
    ├── game.js                     # Logique de jeu (WebSocket)
    └── server.js                   # Serveur HTTP + WebSocket
```

---

## 🎮 Comment Jouer

### Option 1 :
Accédez à https://starfall.onrender.com pour jouer au jeu avec le monde entier !

### Option 2 :
1. Copiez de dépot :
  ```bash
  git clone https://github.com/gamesonweb/dreamland-Noya2Coco
  ```

2. Déplacez-vous dans le dossier `dreamland-Noya2Coco` et installez les dépendances :
  ```bash
  npm install
  ```

3. Lancez le serveur :
   ```bash
   npm run dev
   ```

4. Ouvrez `http://localhost:5173` dans un navigateur.

3. Cliquez sur **Jouer**.

4. Utilisez :
   - `E` pour avancer
   - `Espace` pour tirer
   - `X` et `V` pour l’interface
   - Bougez la souris pour diriger le vaisseau

5. Évitez les étoiles, visez juste, survivez !

---

## 🎯 Objectifs de Développement

- [✓] Moteur multijoueur en WebSocket
- [✓] Mouvement libre en 3D avec inertie
- [✓] Radar spatial
- [✓] Gravité dynamique des planètes
- [✓] Vue cockpit immersive
- [✓] Indicateur de danger gravitationnel
- [✓] Particules d’échappement & étoiles brillantes
- [✓] Gestion des collisions avec les projectiles
- [✓] Score synchronisé avec API

---

Développé avec ❤️ pour les passionnés de combats spatiaux.
