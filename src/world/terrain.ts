import { ADDRESS_REPEAT, Color, Entity, StandardMaterial, Vec2, Vec3 } from 'playcanvas'
import type { Texture } from 'playcanvas'

import type { Game } from '../core/game'

export default class Terrain extends Entity {
    private static readonly SIZE = 200
    private static readonly COLOR = new Color(0.92, 0.42, 0.32)
    private static readonly GLOSS = 0.1
    private static readonly TEXTURE_URL = '/textures/terrain/mars_diffuse.jpg'
    private static readonly TILING = 32

    private appInstance: Game

    constructor(app: Game) {
        super('terrain', app)
        this.appInstance = app

        this.build()

        app.root.addChild(this)
    }

    private build(): void {
        const size = Terrain.SIZE

        const material = new StandardMaterial()
        material.diffuse = Terrain.COLOR
        material.gloss = Terrain.GLOSS

        this.appInstance.assets.loadFromUrl(Terrain.TEXTURE_URL, 'texture', (err, asset) => {
            if (!err && asset?.resource) {
                const texture = asset.resource as Texture
                texture.addressU = ADDRESS_REPEAT
                texture.addressV = ADDRESS_REPEAT
                texture.anisotropy = this.appInstance.graphicsDevice.maxAnisotropy
                material.diffuseMap = texture
                material.diffuseMapTiling = new Vec2(Terrain.TILING, Terrain.TILING)
                material.update()
            }
        })

        material.update()

        const flatTerrain = new Entity('FlatTerrain')

        flatTerrain.addComponent('render', {
            type: 'plane',
            material: material,
            castShadows: false,
            receiveShadows: true
        })

        flatTerrain.setLocalScale(size, 1, size)
        flatTerrain.setPosition(0, 0, 0)

        this.addChild(flatTerrain)

        const groundCollider = new Entity('GroundCollider', this.appInstance)
        groundCollider.setPosition(0, -10, 0)
        groundCollider.addComponent('collision', {
            type: 'box',
            halfExtents: new Vec3(size / 2, 10, size / 2)
        })
        groundCollider.addComponent('rigidbody', {
            type: 'static',
            friction: 0.9,
            restitution: 0.0
        })
        this.appInstance.root.addChild(groundCollider)
    }
}
