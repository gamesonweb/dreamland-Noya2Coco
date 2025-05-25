import { Engine, Scene, FreeCamera, Vector3, Matrix } from '@babylonjs/core';
import { Ship } from './physicalObjects/ship.js';
import { Planet } from './physicalObjects/planet.js';
import { Camera } from './physicalObjects/camera.js';
import { Particle } from './physicalObjects/particle/particle.js';
import { createPanelAxisIndicator, createSceneAxis, setAxesVisibility } from './ui/axis.js';
import { Mouse } from './controlManagers/mouse.js';
import { Keyboard } from './controlManagers/keyboard.js';
import { Bullet } from './physicalObjects/bullet/bullet.js';
import { Skydome } from './physicalObjects/skydome.js';
import { Panel } from './ui/panel.js';
import { VelocityVector } from './ui/velocityVector.js';

class SpaceBattleGame {
    constructor() {
        const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
		const port = location.protocol === 'https:' ? '' : ':22220';
		this.socket = new WebSocket(`${protocol}://${location.hostname}${port}`);
        this.socket.sendMessage = this.sendMessage.bind(this); // Bind sendMessage method
        this.ships = {};
        this.playerShip = null;
        this.projectiles = {};
        this.planets = {};
        this.particles = {};
        this.canvas = document.getElementById('renderCanvas');
        this.engine = new Engine(this.canvas, true);
        this.scene = new Scene(this.engine);
        this.defaultCamera = new FreeCamera("defaultCamera", new Vector3(0, 5, -10), this.scene);
        this.defaultCamera.setTarget(Vector3.Zero());
        this.scene.activeCamera = this.defaultCamera;
        this.defaultCamera.detachControl(this.canvas);
        this.scene.isCockpitView = false;
        this.scene.infoVisible = false;
        createSceneAxis(this.scene, 5);
        this.scene.skydome = new Skydome(this.scene);
        this.lastTime = performance.now(); // Initialize the last frame time
        this.deltaTime = this.updateDeltaTime(); // Calculate initial delta time
        this.fpsInfos = {
            fps: 0,
            data: [],
            canvas: document.getElementById('fpsCanvas'),
            context: document.getElementById('fpsCanvas').getContext('2d'),
            display: document.getElementById('fps')
        };
        this.lastMovementUpdateTime = Date.now();
        this.movementUpdateInterval = 100;
        this.panel = new Panel();
        this.lastPanelUpdateTime = Date.now();
        this.panelUpdateInterval = 100;
        this.shipCreated = false; // Flag to check if the ship is created
        this.radarCanvas = document.getElementById('radarCanvas');
        this.radarContext = this.radarCanvas.getContext('2d');
        this.recentDamageTimeout = null;

        // Ajout : musique de fond
        this.backgroundMusic = null;
        this.musicStarted = false;

        this.initializeStartScreen(); // Set up the start screen UI
        this.initializeSocket(); // Configure WebSocket event handlers
        this.updatePlayerActions(); // Start monitoring player actions
        this.engine.runRenderLoop(() => {
            if (!this.scene.activeCamera) {
                console.warn('⚠️ No active camera found. Setting default camera.');
                this.scene.activeCamera = this.defaultCamera;
                this.defaultCamera.attachControl(this.canvas, true);
            }
            this.scene.render();
        });
        window.addEventListener('resize', () => {
            this.engine.resize(); // Adjust canvas size on window resize
        });

        // Add keyboard shortcut for toggling the Inspector
        window.addEventListener('keydown', (event) => {
            if (event.key === 'i') {
                this.toggleInspector(); // Toggle Babylon.js Inspector
            }
        });
    }

    initializeStartScreen() {
        const startScreen = document.getElementById('startScreen');
        const playButton = document.getElementById('playButton');
        const deathMessage = document.getElementById('deathMessage');

        const resetHealthBar = () => {
            const healthBar = document.getElementById('healthBar');
            const recentDamageBar = document.getElementById('recentDamageBar');
            if (healthBar && recentDamageBar) {
                healthBar.style.width = '100%'; // Reset health bar to full
                recentDamageBar.style.width = '100%'; // Reset recent damage bar
            }
        };

        playButton.addEventListener('click', () => {
            startScreen.style.display = 'none'; // Hide the start screen
            startScreen.classList.remove('active'); // Remove blur effect
            if (deathMessage) {
                deathMessage.style.display = 'none'; // Hide death message
            }
            this.startGame(); // Start the game
            this.startBackgroundMusic();
        });

        // Observe changes to the start screen's class to reset the health bar
        const observer = new MutationObserver(() => {
            if (startScreen.classList.contains('active')) {
                resetHealthBar();
            }
        });

        observer.observe(startScreen, { attributes: true, attributeFilter: ['class'] });
    }

    startGame() {
        const waitForSocketOpen = () => {
            if (this.socket.readyState === WebSocket.OPEN) {
                if (this.playerShip) {
                    this.playerShip.kills = 0; // Reset kill count
                    this.playerShip.health = 30; // Reset health to maximum
                    this.updateKillCount(this.playerShip); // Update kill count display
                    this.updateHealthBar(this.playerShip); // Update health bar
                }
                this.socket.send(JSON.stringify({ type: 'newShip' })); // Request a new ship from the server
                console.log('✅ WebSocket is open. Starting the game.');
            } else {
                console.warn('⏳ Waiting for WebSocket to open...');
                setTimeout(waitForSocketOpen, 100); // Retry after 100ms
            }
        };

        waitForSocketOpen();
    }

    handlePlayerDeath() {
        console.log('⚠️ Player has been killed.');

        const startScreen = document.getElementById('startScreen');
        const deathMessage = document.getElementById('deathMessage');

        if (!startScreen) {
            console.error('❌ Start screen element not found!');
            return;
        }

        if (this.playerShip) {
            this.playerShip.kills = 0; // Reset kill count
            this.updateKillCount(this.playerShip); // Update kill count display
            this.playerShip.health = 0; // Set health to zero
            this.updateHealthBar(this.playerShip); // Update health bar
        }

        if (deathMessage) {
            deathMessage.style.display = 'block'; // Show death message
        }
        startScreen.style.display = 'flex'; // Show start screen
        startScreen.classList.add('active'); // Add blur effect

        if (this.defaultCamera) {
            this.scene.activeCamera = this.defaultCamera; // Reset to default camera
            this.defaultCamera.attachControl(this.canvas, true);
        } else {
            console.error('❌ No default camera available!');
        }

        if (this.playerShip) {
            this.playerShip.dispose(); // Dispose of the player's ship
            this.playerShip = null;
        }
    }

    initializeSocket() {
        this.socket.onopen = () => {
            console.log('✅ Connected to server');
        };

        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'init' || data.type === 'updateGameState') {
                this.updateGameState(data); // Update game state
            } else if (data.type === 'updateShip') {
                const ship = this.ships[data.ship.id];
                if (ship) {
                    ship.update(data.ship); // Update ship data
                }
            } else if (data.type === 'updateShipHealth') {
                const ship = this.ships[data.id];
                if (ship) {
                    ship.health = data.health;
                    if (ship.health <= 0 && ship.isPlayer) {
                        console.log(`💀 Player's ship destroyed: ${ship.id}`);
                        this.handlePlayerDeath(); // Handle player death
                    }
                    if (ship.isPlayer) {
                        this.updateHealthBar(ship);
                        // Ajout : alerte visuelle/sonore si on se fait toucher
                        if (data.lastHitBy && data.id === this.playerShip.id) {
                            this.showDamageAlert();
                        }
                    }
                    // Ajout : effet visuel si on touche un ennemi
                    if (this.playerShip && data.id !== this.playerShip.id && data.lastHitBy === this.playerShip.id) {
                        this.showHitMarker();
                    }
                }
            } else if (data.type === 'teleportShip') {
                const ship = this.ships[data.ship.id];
                if (ship) {
                    ship.update(data.ship, true); // Force update for teleportation
                }
            } else if (data.type === 'newProjectile') {
                // Correction : ne crée le bullet que si ce n'est PAS le joueur local qui l'a tiré
                if (!this.projectiles[data.projectile.id]) {
                    const isLocalPlayerBullet = this.playerShip && data.projectile && data.projectile.shipId === this.playerShip.id;
                    if (!isLocalPlayerBullet) {
                        console.log('🚀 New projectile received:', data.projectile);
                        this.projectiles[data.projectile.id] = new Bullet(this.scene, this.playerShip, data.projectile);
                    } else {
                        console.log(`[BULLET] Projectile ${data.projectile.id} ignoré côté client (déjà créé localement)`);
                    }
                }
            } else if (data.type === 'newShip') {
                console.log('🚀 New ship received:', data.ship);
                if (!this.ships[data.ship.id]) {
                    const newShip = new Ship(this.scene, data.ship.id, data.ship);
                    if (!newShip.mesh) {
                        console.error("❌ ERROR: The received ship has no mesh!");
                    } else {
                        console.log("✅ Activating received ship:");
                    }
                    this.ships[newShip.id] = newShip;
                    this.ships[newShip.id].socket = this.socket;
                    this.ships[newShip.id].update(data.ship); // Update with received data
                }
            } else if (data.type === 'updateKillerKills') {
                const ship = this.ships[data.id];
                if (ship && ship.isPlayer && ship.id === this.playerShip.id) {
                    ship.kills = data.kills; // Update the kill count
                    this.updateKillCount(ship); // Update the display
                }
            }
        };

        this.socket.onclose = () => {
            console.log('❌ Disconnected from server');
            this.cleanup(); // Clean up resources
        };

        this.socket.onerror = (error) => {
            console.error('❌ WebSocket error:', error);
            this.cleanup(); // Ensure proper cleanup on error
            this.socket.close();
        };
    }

    sendMessage(data) {
        if (this.socket.readyState === WebSocket.OPEN) {
            try {
                this.socket.send(JSON.stringify(data));
            } catch (error) {
                console.error('❌ Error sending WebSocket message:', error);
            }
        }
    }

    cleanup() {
        Object.values(this.ships).forEach(ship => ship.dispose());
        this.ships = {};
        Object.values(this.projectiles).forEach(projectile => projectile.dispose());
        this.projectiles = {};
        Object.values(this.planets).forEach(planet => planet.dispose());
        this.planets = {};
        Object.values(this.particles).forEach(particle => particle.dispose());
        this.particles = {};
        if (this.playerShip) {
            this.playerShip.dispose();
            this.playerShip = null;
        }
        if (this.socket) {
            this.socket.close(); // Ensure WebSocket connection is closed
            this.socket = null;
        }
    }

    updateGameState(data) {
        this.updateDeltaTime();

        data.ships.forEach(shipData => {
            if (!this.ships[shipData.id]) {
                console.log('✅ New ship created:', shipData);
                const isPlayer = data.playerId === shipData.id;
                this.ships[shipData.id] = new Ship(this.scene, shipData.id, shipData, isPlayer);
                this.ships[shipData.id].socket = this.socket;
                if (isPlayer) {
                    this.playerShip = this.ships[shipData.id];
                    this.shipCreated = true;
                    if (this.defaultCamera instanceof FreeCamera) {
                        this.defaultCamera.dispose();
                        this.playerShip.cockpitCamera = new Camera('cockpitCamera', [0, 0.2, 0], this.scene, this.playerShip.mesh, 1.4, 1.8);
                        this.playerShip.thirdPersonCamera = new Camera('thirdPersonCamera', [0, 10, -20], this.scene, this.playerShip.mesh, 1.0, 1.4, Math.PI / 12);
                        this.scene.activeCamera = this.playerShip.thirdPersonCamera;
                    }
                    this.playerShip.mouse = new Mouse(this.canvas, document, this.playerShip);
                    this.playerShip.keyboard = new Keyboard(this.canvas, this.scene, this.playerShip, this.projectiles, this.socket);
                    setAxesVisibility(this.playerShip.mesh.axes, false);
                }
            }
            this.ships[shipData.id].update(shipData);
        });

        Object.keys(this.ships).forEach(id => {
            if (!data.ships.some(s => s.id === id)) {
                console.log(`🛑 Removing ship ${id}`);
                this.ships[id].dispose();
                delete this.ships[id];
            }
        });

        Object.keys(this.projectiles).forEach(id => {
            if (this.projectiles[id].isDisposed) {
                Bullet.worker.postMessage({
                    type: "removeBullet",
                    data: { id: id }
                });
                delete this.projectiles[id];
            }
        });

        if (this.playerShip) {
            data.planets.forEach(planetData => {
                if (!this.planets[planetData.id]) {
                    this.planets[planetData.id] = new Planet(this.scene, planetData);
                }
                this.planets[planetData.id].applyGravitationalForce(this.playerShip);
            });
            this.updateObjects(data);
            this.playerShip.keyboard.checkPressedKeys();
            this.updatePanel();
            this.playerShip.updatePlayer(this.planets);
            this.playerShip.velocityVector.update(
                this.playerShip.mesh.position,
                this.playerShip.mesh.position.add(this.playerShip.mesh.velocity.scale(100))
            );
            this.playerShip.adjustVectorLine(this.planets);
        }
    }

    updatePlayerActions() {
        if (this.playerShip) {
            const currentTime = Date.now();
            const hasMoved = this.playerShip.mesh.velocity.lengthSquared() > 0.0001;
            const hasRotated = this.playerShip.mesh.rotationQuaternion.lengthSquared() > 0.999;
            if ((hasMoved || hasRotated) && (currentTime - this.lastMovementUpdateTime > this.movementUpdateInterval)) {
                this.sendMessage({
                    type: 'updateShip',
                    id: this.playerShip.id,
                    position: {
                        x: this.playerShip.mesh.position.x,
                        y: this.playerShip.mesh.position.y,
                        z: this.playerShip.mesh.position.z
                    },
                    rotationQuaternion: {
                        x: this.playerShip.mesh.rotationQuaternion.x,
                        y: this.playerShip.mesh.rotationQuaternion.y,
                        z: this.playerShip.mesh.rotationQuaternion.z,
                        w: this.playerShip.mesh.rotationQuaternion.w,
                    }
                });
                this.lastMovementUpdateTime = currentTime;
            }
            if (this.playerShip.mouse) {
                this.playerShip.mouse.applyRotationForce();
            }
            this.playerShip.updatePlayer(this.planets);
        }
        requestAnimationFrame(() => this.updatePlayerActions());
    }

    async updateObjects(data) {
        this.updateDeltaTime();

        if (!data || !data.ships) return;

        await Promise.all(Object.values(this.ships).map(async (ship) => {
            const shipData = data.ships.find(s => s.id === ship.id);
            if (shipData && this.playerShip && ship.id !== this.playerShip.id) {
                ship.update(shipData);
            }
        }));

        await Promise.all(Object.values(this.particles).map(async (particle) => {
            particle.update(this.deltaTime);
            if (particle.isDisposed) {
                delete this.particles[particle.id];
            }
        }));

        this.panel.updateElementCountDisplay({
            ships: Object.keys(this.ships).length,
            projectiles: Object.keys(this.projectiles).length,
            planets: Object.keys(this.planets).length,
            particles: Object.keys(this.particles).length
        });
    }

    updatePanel() {
        const currentTime = Date.now();
        if (currentTime - this.lastPanelUpdateTime > this.panelUpdateInterval) {
            this.panel.fpsInfos.fps = Math.round(1000 / this.engine.getDeltaTime());
            this.panel.drawFpsGraph();
            this.lastPanelUpdateTime = currentTime;
        }
        this.panel.updatePositionsDisplays(this.playerShip);
        createPanelAxisIndicator(this.panel.positionsInfos.axes, this.playerShip.mesh.rotationQuaternion);
        this.updateRadar();
    }

    updateRadar() {
        const ctx = this.radarContext;
        const radarRadius = this.radarCanvas.width / 2;
        const playerPos = this.playerShip.mesh.position;
        const playerRotation = this.playerShip.mesh.rotationQuaternion;

        ctx.clearRect(0, 0, this.radarCanvas.width, this.radarCanvas.height);

        // --- Effet de grille radar ---
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = "#00fff7";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(radarRadius, radarRadius, radarRadius - 2, 0, 2 * Math.PI);
        ctx.shadowColor = "#00fff7";
        ctx.shadowBlur = 16;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        // Cercles concentriques
        ctx.strokeStyle = "#00fff7";
        ctx.lineWidth = 1;
        for (let i = 1; i <= 3; i++) {
            ctx.globalAlpha = 0.12;
            ctx.beginPath();
            ctx.arc(radarRadius, radarRadius, (radarRadius - 8) * (i / 3), 0, 2 * Math.PI);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Lignes croisées
        ctx.strokeStyle = "#00fff7";
        ctx.globalAlpha = 0.10;
        ctx.beginPath();
        ctx.moveTo(radarRadius, 8);
        ctx.lineTo(radarRadius, radarRadius * 2 - 8);
        ctx.moveTo(8, radarRadius);
        ctx.lineTo(radarRadius * 2 - 8, radarRadius);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.restore();

        // --- Affichage des autres vaisseaux ---
        // Transform player rotation into a matrix for local axes
        const rotationMatrix = new Matrix();
        playerRotation.toRotationMatrix(rotationMatrix);

        Object.values(this.ships).forEach(ship => {
            if (ship.id !== this.playerShip.id) {
                const shipPos = ship.mesh.position;
                const relativePos = shipPos.subtract(playerPos);
                const localPos = Vector3.TransformCoordinates(relativePos, rotationMatrix.invert());
                const maxRadarDistance = 500; // Maximum radar range
                const scaleFactor = (radarRadius - 12) / maxRadarDistance;

                let x = radarRadius + (localPos.x * scaleFactor);
                let y = radarRadius - (localPos.y * scaleFactor);

                const distance = Math.sqrt(localPos.x * localPos.x + localPos.y * localPos.y);
                if (distance > maxRadarDistance) {
                    x = radarRadius - (localPos.x / distance) * (radarRadius - 12);
                    y = radarRadius - (localPos.y / distance) * (radarRadius - 12);
                }

                // Effet lumineux pour les vaisseaux ennemis
                ctx.save();
                ctx.beginPath();
                ctx.arc(x, y, 8, 0, 2 * Math.PI);
                ctx.shadowColor = "#ff5555";
                ctx.shadowBlur = 16;
                ctx.fillStyle = "#ff5555";
                ctx.globalAlpha = 0.85;
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.globalAlpha = 1;
                ctx.strokeStyle = "#fff";
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.restore();
            }
        });

        // --- Affichage du joueur au centre ---
        ctx.save();
        ctx.beginPath();
        ctx.arc(radarRadius, radarRadius, 10, 0, 2 * Math.PI);
        ctx.shadowColor = "#00fff7";
        ctx.shadowBlur = 18;
        ctx.fillStyle = "#00fff7";
        ctx.globalAlpha = 0.95;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();

        // Check proximity to planets and adjust gravity warning
        const gravityWarning = document.getElementById('gravityWarning');
        const maxWarningDistance = 500;
        const minWarningDistance = 100;
        const nearestPlanetDistance = Math.min(
            ...Object.values(this.planets).map(planet => Vector3.Distance(playerPos, planet.mesh.position))
        );

        if (nearestPlanetDistance <= maxWarningDistance) {
            const normalizedDistance = Math.max(0, (nearestPlanetDistance - minWarningDistance) / (maxWarningDistance - minWarningDistance));
            const scale = 1 + normalizedDistance * 2;
            const opacity = normalizedDistance;
            const blinkSpeed = 1 + normalizedDistance * 2;

            gravityWarning.style.display = 'block';
            gravityWarning.style.transform = `scale(${scale})`;
            gravityWarning.style.opacity = opacity.toFixed(2);

            // Reset animation to ensure it applies
            gravityWarning.style.animation = 'none';
            void gravityWarning.offsetWidth; // Trigger reflow
            gravityWarning.style.animation = `blink ${blinkSpeed}s infinite`;
        } else {
            gravityWarning.style.display = 'none';
        }
    }

    updateDeltaTime() {
        const currentTime = performance.now();
        this.deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
    }

    updateHealthBar(ship) {
        const healthBar = document.getElementById('healthBar');
        const recentDamageBar = document.getElementById('recentDamageBar');
        if (healthBar && recentDamageBar) {
            const maxHealth = 30;
            const healthPercentage = Math.max(0, (ship.health / maxHealth) * 100);
            healthBar.style.width = `${healthPercentage}%`;

            recentDamageBar.style.width = `${healthPercentage}%`;
            if (this.recentDamageTimeout) clearTimeout(this.recentDamageTimeout);
            this.recentDamageTimeout = setTimeout(() => {
                recentDamageBar.style.width = `${healthPercentage}%`;
            }, 2000);
        }
    }

    updateKillCount(ship) {
        const killCountElement = document.getElementById('killCount');
        if (killCountElement) {
            killCountElement.textContent = `Kills: ${ship.kills}`;
        }
    }

    toggleInspector() {
        const radarContainer = document.getElementById('radarContainer');
        if (this.scene.debugLayer.isVisible()) {
            this.scene.debugLayer.hide();
            radarContainer.style.display = 'block';
        } else {
            this.scene.debugLayer.show();
            radarContainer.style.display = 'none';
        }
    }

    // Ajout : méthode pour afficher un hit marker visuel amélioré + son
    showHitMarker() {
        let marker = document.getElementById('hitMarker');
        if (!marker) {
            marker = document.createElement('div');
            marker.id = 'hitMarker';
            marker.style.position = 'fixed';
            marker.style.top = '50%';
            marker.style.left = '50%';
            marker.style.transform = 'translate(-50%, -50%) scale(1)';
            marker.style.width = '220px'; // plus grand
            marker.style.height = '220px';
            marker.style.borderRadius = '50%';
            marker.style.background = 'rgba(255,0,0,0.18)';
            marker.style.border = '10px solid #fff';
            marker.style.boxShadow = '0 0 120px 40px rgba(255,0,0,0.8), 0 0 0 32px rgba(255,255,255,0.4)';
            marker.style.pointerEvents = 'none';
            marker.style.zIndex = '9999';
            marker.style.display = 'none';
            marker.style.opacity = '0';
            marker.style.transition = 'none';

            // Ajoute l'animation CSS
            const style = document.createElement('style');
            style.id = 'hitMarkerStyle';
            style.innerHTML = `
                @keyframes hitMarkerFlash {
                    0% {
                        opacity: 1;
                        transform: translate(-50%, -50%) scale(1.4);
                        border-width: 18px;
                        box-shadow: 0 0 180px 80px rgba(255,0,0,1), 0 0 0 48px rgba(255,255,255,0.7);
                    }
                    60% {
                        opacity: 0.8;
                        transform: translate(-50%, -50%) scale(1.0);
                        border-width: 10px;
                        box-shadow: 0 0 60px 20px rgba(255,0,0,0.5), 0 0 0 16px rgba(255,255,255,0.3);
                    }
                    100% {
                        opacity: 0;
                        transform: translate(-50%, -50%) scale(0.7);
                        border-width: 0px;
                        box-shadow: none;
                    }
                }
            `;
            document.head.appendChild(style);

            document.body.appendChild(marker);
        }
        marker.style.display = 'block';
        marker.style.opacity = '1';
        marker.style.animation = 'hitMarkerFlash 0.55s cubic-bezier(0.4,0,0.2,1)';
        marker.onanimationend = () => {
            marker.style.display = 'none';
            marker.style.animation = '';
        };

        // Joue un son de hit (création dynamique si besoin)
        if (!this.hitSound) {
            this.hitSound = new Audio('/sounds/hitmarker.mp3');
            this.hitSound.volume = 0.7;
        }
        this.hitSound.currentTime = 0;
        this.hitSound.play();
    }

    // Ajout : méthode pour afficher une alerte visuelle/sonore quand on se fait toucher
    showDamageAlert() {
        let alert = document.getElementById('damageAlert');
        if (!alert) {
            alert = document.createElement('div');
            alert.id = 'damageAlert';
            alert.style.position = 'fixed';
            alert.style.top = '0';
            alert.style.left = '0';
            alert.style.width = '100vw';
            alert.style.height = '100vh';
            alert.style.background = 'rgba(255,0,0,0.18)';
            alert.style.pointerEvents = 'none';
            alert.style.zIndex = '9998';
            alert.style.display = 'none';
            alert.style.opacity = '0';
            alert.style.transition = 'opacity 0.2s';
            document.body.appendChild(alert);
        }
        alert.style.display = 'block';
        alert.style.opacity = '1';
        setTimeout(() => {
            alert.style.opacity = '0';
            setTimeout(() => { alert.style.display = 'none'; }, 200);
        }, 180);

        // Joue un son d'alerte (création dynamique si besoin)
        if (!this.damageSound) {
            this.damageSound = new Audio('/sounds/damage_alert.mp3');
            this.damageSound.volume = 0.7;
        }
        this.damageSound.currentTime = 0;
        this.damageSound.play();
    }

    // Ajout : méthode pour lancer la musique de fond en boucle
    startBackgroundMusic() {
        if (this.musicStarted) return;
        this.musicStarted = true;
        if (!this.backgroundMusic) {
            this.backgroundMusic = new Audio('/sounds/music.mp3'); // Mets ton fichier ici
            this.backgroundMusic.loop = true;
            this.backgroundMusic.volume = 0.5; // Ajuste le volume si besoin
            this.backgroundMusic.addEventListener('ended', () => {
                this.backgroundMusic.currentTime = 0;
                this.backgroundMusic.play();
            });
        }
        this.backgroundMusic.play().catch(e => {
            console.warn('Impossible de jouer la musique de fond:', e);
        });
    }
}

if (typeof Bullet.worker === 'undefined') {
    Bullet.worker = new Worker(new URL('./physicalObjects/bullet/worker.js', import.meta.url));
}

if (typeof Particle.worker === 'undefined') {
    Particle.worker = new Worker(new URL('./physicalObjects/particle/worker.js', import.meta.url));
}

export const game = new SpaceBattleGame();
