import {
    AppBase,
    Entity,
    StandardMaterial,
    Color
} from "playcanvas";

export default class Terrain extends Entity {
    constructor(app: AppBase) {
        super('terrain', app)

        this.build()

        app.root.addChild(this)
    }

    private build(): void {
        const material = new StandardMaterial();
        material.diffuse = new Color(0.76, 0.35, 0.20);
        material.gloss = 0.2;
        material.update();

        const flatTerrain = new Entity('FlatTerrain');

        flatTerrain.addComponent('render', {
            type: 'plane',
            material: material
        });

        flatTerrain.setLocalScale(200, 1, 200);
        flatTerrain.setPosition(0, 0, 0);

        this.addChild(flatTerrain)
    }
}