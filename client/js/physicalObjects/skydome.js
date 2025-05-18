import { MeshBuilder, StandardMaterial, Texture, Color3 } from "@babylonjs/core";
import skydomeTexture from "/images/skydome.jpg";

export class Skydome {
    constructor(scene) {
        this.scene = scene;

        // Create the skydome mesh
        const skydome = MeshBuilder.CreateSphere("skyDome", { segments: 64, diameter: 10000 }, this.scene);

        // Configure the skydome material
        const skydomeMaterial = new StandardMaterial("skyDomeMaterial", this.scene);
        skydomeMaterial.backFaceCulling = false;

        // Load and apply the skydome texture
        const texture = new Texture(skydomeTexture, this.scene);
        skydomeMaterial.diffuseTexture = texture;
        skydomeMaterial.emissiveColor = new Color3(0.5, 0.5, 0.5); // Dim the brightness

        // Assign material and properties to the skydome
        this.skydome = skydome;
        this.skydome.material = skydomeMaterial;
        this.skydome.infiniteDistance = true;
    }
}
