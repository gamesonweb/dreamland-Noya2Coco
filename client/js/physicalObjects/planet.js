import {
    MeshBuilder, PBRMaterial, Color3, Vector3, PointLight,
    Texture, Scalar, ParticleSystem, Space
} from '@babylonjs/core';

// Imports d'images via Vite pour résolution correcte
import sunTextureUrl from '/images/sun.jpg';
import flareTextureUrl from '/images/flare.jpg';

// Imports des textures de planètes
import planet1Albedo from '/images/planets/planet_1/Color.jpg';
import planet1Normal from '/images/planets/planet_1/NormalGL.jpg';
import planet1Parallax from '/images/planets/planet_1/Displacement.jpg';
import planet1Roughness from '/images/planets/planet_1/Roughness.jpg';

import planet2Albedo from '/images/planets/planet_2/Color.jpg';
import planet2Normal from '/images/planets/planet_2/NormalGL.jpg';
import planet2Parallax from '/images/planets/planet_2/Displacement.jpg';
import planet2Roughness from '/images/planets/planet_2/Roughness.jpg';

import planet3Albedo from '/images/planets/planet_3/Color.jpg';
import planet3Normal from '/images/planets/planet_3/NormalGL.jpg';
import planet3Parallax from '/images/planets/planet_3/Displacement.jpg';
import planet3Roughness from '/images/planets/planet_3/Roughness.jpg';

// Textures de planètes
const textureSets = [
    {
        albedo: planet1Albedo,
        normal: planet1Normal,
        parallax: planet1Parallax,
        roughness: planet1Roughness,
    },
    {
        albedo: planet2Albedo,
        normal: planet2Normal,
        parallax: planet2Parallax,
        roughness: planet2Roughness,
    },
    {
        albedo: planet3Albedo,
        normal: planet3Normal,
        parallax: planet3Parallax,
        roughness: planet3Roughness,
    },
];

export class Planet {
    constructor(scene, data) {
        this.scene = scene;
        this.isStar = data.isStar;

        this._createMesh(data);
        this._configureMaterial(data);

        if (!this.isStar) {
            this._addRandomRotation();
        } else {
            this._addStarLight();
            this._addStarFlares();
        }
    }

    _createMesh(data) {
        const sizeCoeff = this.isStar ? 2 : 1;
        this.mesh = MeshBuilder.CreateSphere('planet', { diameter: data.size * sizeCoeff }, this.scene);
        this.mesh.size = data.size;
        this.mesh.position.set(data.position.x, data.position.y, data.position.z);
        this.mesh.renderingGroupId = 1;

        this.gravitationalRange = this.isStar ? this.mesh.size * 6 : this.mesh.size * 3;
        const baseG = this.mesh.size * 0.005;
        this.gravitationalConstant = this.isStar ? baseG * 2 : baseG * 0.75;
    }

    _configureMaterial(data) {
        const material = new PBRMaterial('planetMaterial', this.scene);

        if (this.isStar) {
            material.emissiveColor = Color3.FromHexString("#7e3300");
            material.disableLighting = true;
            material.emissiveTexture = new Texture(sunTextureUrl, this.scene);
        } else {
            const textures = textureSets[Math.floor(Math.random() * textureSets.length)];
            material.albedoTexture = new Texture(textures.albedo, this.scene);
            material.bumpTexture = new Texture(textures.normal, this.scene);
            material.parallaxTexture = new Texture(textures.parallax, this.scene);
            material.metallicTexture = new Texture(textures.roughness, this.scene);
            material.useParallax = true;
            material.useParallaxOcclusion = true;
            material.parallaxScaleBias = 0.03;
            material.roughness = 1.0;

            // Offsets aléatoires
            for (let tex of [material.albedoTexture, material.bumpTexture, material.parallaxTexture, material.metallicTexture]) {
                tex.uOffset = Math.random();
                tex.vOffset = Math.random();
            }
        }

        this.mesh.material = material;
    }

    _addRandomRotation() {
        const speed = Scalar.RandomRange(0.001, 0.01);
        const axis = new Vector3(Math.random(), Math.random(), Math.random()).normalize();
        this.scene.onBeforeRenderObservable.add(() => {
            this.mesh.rotate(axis, speed, Space.LOCAL);
        });
    }

    _addStarLight() {
        const light = new PointLight('starLight', this.mesh.position, this.scene);
        light.intensity = 20;
        light.range = this.mesh.size * 40;
        light.diffuse = Color3.FromHexString("#7e3300");
        light.specular = new Color3(0.1, 0.1, 0.1);
        light.attachedMesh = this.mesh;
        light.falloffType = PointLight.FALLOFF_PHYSICAL;
        light.radius = this.mesh.size * 20;
        light.attenuation0 = 0.05;
        light.attenuation1 = 0.05;
        light.attenuation2 = 0.05;
        this.mesh.light = light;
    }

    _addStarFlares() {
        const ps = new ParticleSystem("starFlares", 2000, this.scene);
        ps.particleTexture = new Texture(flareTextureUrl, this.scene);
        ps.emitter = this.mesh;

        const halfSize = this.mesh.size / 2;
        ps.minEmitBox = new Vector3(-halfSize, -halfSize, -halfSize);
        ps.maxEmitBox = new Vector3(halfSize, halfSize, halfSize);

        ps.color1 = new Color3(1, 0.5, 0);
        ps.color2 = new Color3(1, 0, 0);
        ps.colorDead = new Color3(0.2, 0.2, 0.2);
        ps.minSize = 0.5;
        ps.maxSize = 2.0;
        ps.minLifeTime = 0.2;
        ps.maxLifeTime = 1.0;
        ps.emitRate = 500;
        ps.direction1 = new Vector3(-1, 1, -1);
        ps.direction2 = new Vector3(1, 1, 1);
        ps.minEmitPower = 2;
        ps.maxEmitPower = 5;
        ps.updateSpeed = 0.01;

        ps.start();
        this.particleSystem = ps;
    }

    toggleGravityWarning(show) {
        const el = document.getElementById('gravityWarning');
        if (el) el.style.display = show ? 'block' : 'none';
    }

    applyGravitationalForce(ship) {
        const dir = this.mesh.position.subtract(ship.mesh.position);
        const distSq = dir.lengthSquared();
        const inRange = distSq <= this.gravitationalRange ** 2;
        this.toggleGravityWarning(inRange);

        if (!inRange) return;

        const forceMag = (this.gravitationalConstant * this.mesh.size) / distSq;
        if (forceMag < 0.001) return;

        const force = dir.normalize().scale(forceMag);
        ship.mesh.velocity.addInPlace(force);
    }

    dispose() {
        if (this.mesh) this.mesh.dispose();
        if (this.mesh.light) this.mesh.light.dispose();
        if (this.particleSystem) this.particleSystem.dispose();
    }
}
