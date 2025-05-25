import { Vector3, MeshBuilder, StandardMaterial, Color3, Quaternion, Sound, GlowLayer } from '@babylonjs/core';
import { game } from '../../client.js';

export class Bullet {
    constructor(scene, ship, data) {
        this.scene = scene;
        this.ship = ship;
        this.id = data ? data.id : `bullet-${Math.random().toString(36).substr(2, 9)}`;

        const isLocal = ship && ship.isPlayer;
        let soundReady = false;
        this.sound = new Sound(
            "bulletSound",
            "/sounds/laser1.mp3",
            this.scene,
            () => {
                soundReady = true;
                // Augmente la vitesse de lecture et désactive l'atténuation spatiale
                this.sound.setPlaybackRate(1.5);
                this.sound.setVolume(5);
                this.sound.spatialSound = false;
                this.sound.play();
            },
            {
                volume: 5,
                spatialSound: false,
                onerror: () => {}
            }
        );

        if (this.sound.isReady()) {
            soundReady = true;
        }

        setTimeout(() => {
        }, 2000);

        setTimeout(() => {
        }, 10000);

        this.sound.onended = () => {};
        this.sound.onplay = () => {};

        // Create bullet mesh (visual representation)
        this.mesh = MeshBuilder.CreateTube('bullet', { path: [new Vector3(0, 0, 0), new Vector3(0, 0, 4)], radius: 0.1 }, this.scene);
        this.mesh.material = new StandardMaterial('bulletMaterial', this.scene);
        this.mesh.material.emissiveColor = new Color3(0.5, 0, 0.5); // Purple color
        this.mesh.material.emissiveIntensity = 1000; // High emissive intensity for visibility
        this.mesh.material.maxSimultaneousLights = 0; // Disable lighting dependency
        this.mesh.material.disableLighting = true;

        // Add glow effect
        if (!scene.glowLayer) {
            scene.glowLayer = new GlowLayer("glow", this.scene);
            scene.glowLayer.intensity = 5;
        }
        scene.glowLayer.addIncludedOnlyMesh(this.mesh);

        this.mesh.renderingGroupId = 1;

        // Set initial position and velocity
        if (data && data.position && data.position._x !== undefined) {
            this.mesh.position = new Vector3(data.position._x, data.position._y, data.position._z);
        } else {
            this.mesh.position = data ? new Vector3(data.position.x, data.position.y, data.position.z) : 
                Vector3.TransformCoordinates(new Vector3(0, 0, 0), ship.mesh.getWorldMatrix());
        }

        this.mesh.rotationQuaternion = data && data.rotationQuaternion ? 
            new Quaternion(data.rotationQuaternion.x, data.rotationQuaternion.y,
                           data.rotationQuaternion.z, data.rotationQuaternion.w)
            : ship.mesh.rotationQuaternion.clone();

        if (data && data.velocity && data.velocity._x !== undefined) {
            this.mesh.velocity = new Vector3(data.velocity._x, data.velocity._y, data.velocity._z);
        } else {
            // Augmente la vitesse initiale des bullets (facteur 2)
            this.mesh.velocity = data ? new Vector3(data.velocity.x, data.velocity.y, data.velocity.z) :
                Vector3.TransformNormal(new Vector3(0, 0, 1), ship.mesh.getWorldMatrix()).normalize().scale(200);
        }

        // Send bullet data to the worker for management
        Bullet.worker.postMessage({
            type: "addBullet",
            data: this.toJSON()
        });
    }

    static updateShipData(ship) {
        Bullet.worker.postMessage({
            type: "updateShip",
            data: {
                id: ship.id,
                position: { x: ship.mesh.position.x, y: ship.mesh.position.y, z: ship.mesh.position.z }
            }
        });
    }

    dispose() {
        if (this.mesh) {
            this.mesh.dispose();
        }
        if (this.sound) {
            try {
                this.sound.dispose();
            } catch (e) {}
        }
        Bullet.worker.postMessage({ type: "removeBullet", data: { id: this.id } });
    }

    toJSON() {
        return {
            id: this.id,
            position: { x: this.mesh.position.x, y: this.mesh.position.y, z: this.mesh.position.z },
            rotationQuaternion: this.mesh.rotationQuaternion ? {
                x: this.mesh.rotationQuaternion.x, y: this.mesh.rotationQuaternion.y,
                z: this.mesh.rotationQuaternion.z, w: this.mesh.rotationQuaternion.w
            } : { x: 0, y: 0, z: 0, w: 1 },
            velocity: { x: this.mesh.velocity.x, y: this.mesh.velocity.y, z: this.mesh.velocity.z },
            visible: this.mesh.isVisible // Include visibility in JSON
        };
    }
}

// Ensure the WebWorker is initialized
if (typeof Bullet.worker === 'undefined') {
    Bullet.worker = new Worker(new URL('./worker.js', import.meta.url));
}

Bullet.worker.onmessage = function (event) {
    if (event.data.type === "updateBullets") {
        // Synchronise les bullets côté client avec celles du worker
        const updatedIds = new Set();
        event.data.bullets.forEach(updatedBullet => {
            updatedIds.add(updatedBullet.id);
            const projectile = game.projectiles[updatedBullet.id];
            if (projectile) {
                const mesh = projectile.mesh;
                mesh.position.set(updatedBullet.position.x, updatedBullet.position.y, updatedBullet.position.z);
                // Correction : la visibilité doit être gérée ici
                mesh.isVisible = updatedBullet.visible !== false;
            }
        });

        // Supprime les bullets côté client qui n'existent plus côté worker
        Object.keys(game.projectiles).forEach(id => {
            if (!updatedIds.has(id)) {
                game.projectiles[id].dispose();
                delete game.projectiles[id];
            }
        });
    }
};
