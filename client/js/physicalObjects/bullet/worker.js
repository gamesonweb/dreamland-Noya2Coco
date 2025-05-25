self.bullets = {}; // Stores active bullets
let lastUpdateTime = Date.now();
let emitterPosition = { x: 0, y: 0, z: 0 }; // Position of the emitter (e.g., the ship)

self.onmessage = function(event) {
    const { type, data } = event.data;

    if (type === "addBullet") {
        // Add a new bullet if it doesn't already exist
        if (!self.bullets[data.id]) {
            self.bullets[data.id] = {
                id: data.id,
                position: { ...data.position },
                velocity: { ...data.velocity },
                rotationQuaternion: { ...data.rotationQuaternion },
                spawnTime: Date.now(),
                lifeTime: 15000, // Default lifetime: 15 seconds
                visible: true // Ajout explicite de la propriété visible
            };
        }
    }

    if (type === "removeBullet") {
        // Remove a bullet by its ID
        delete self.bullets[data.id];
    }

    if (type === "updateBulletsFromServer") {
        // Sync bullets with server data
        data.bullets.forEach(serverBullet => {
            if (!self.bullets[serverBullet.id]) {
                self.bullets[serverBullet.id] = { ...serverBullet };
            }
        });
    }

    if (type === "updateEmitterPosition") {
        // Update the emitter's position
        emitterPosition = { ...data.position };
    }
};

// Update bullet positions and handle expiration
function updateBullets() {
    const currentTime = Date.now();
    const deltaTime = (currentTime - lastUpdateTime) / 1000; // Convert to seconds
    lastUpdateTime = currentTime;

    Object.values(self.bullets).forEach(bullet => {
        // Update position based on velocity
        bullet.position.x += bullet.velocity.x * deltaTime;
        bullet.position.y += bullet.velocity.y * deltaTime;
        bullet.position.z += bullet.velocity.z * deltaTime;

        // Remove expired bullets
        if (currentTime - bullet.spawnTime > bullet.lifeTime) {
            bullet.visible = false;
            delete self.bullets[bullet.id];
            return;
        }

        // Calculate distance from emitter
        const dx = bullet.position.x - emitterPosition.x;
        const dy = bullet.position.y - emitterPosition.y;
        const dz = bullet.position.z - emitterPosition.z;
        const distance = Math.sqrt(dx ** 2 + dy ** 2 + dz ** 2);

        // Remove bullets exceeding distance or coordinate limits
        if (distance >= 4000 || Math.abs(bullet.position.x) > 10000 || Math.abs(bullet.position.y) > 10000 || Math.abs(bullet.position.z) > 10000) {
            bullet.visible = false;
            delete self.bullets[bullet.id];
            return;
        }
    });

    // Send updated bullet data to the main thread
    self.postMessage({ type: "updateBullets", bullets: Object.values(self.bullets) });
}

// Start the continuous update loop
function dynamicUpdate() {
    updateBullets();
    // Utilise un intervalle fixe de 60 FPS (16.67 ms)
    setTimeout(dynamicUpdate, 1000 / 60);
}

dynamicUpdate();
