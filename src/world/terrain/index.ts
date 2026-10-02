import { Entity, Vec3 } from 'playcanvas'

import type { Game } from '../../core/game'

import { VoxelTerrain } from './voxel-terrain'

export default class Terrain extends Entity {
    private appInstance: Game
    private voxelTerrain: VoxelTerrain

    constructor(app: Game) {
        super('terrain', app)
        this.appInstance = app

        // Terreno 3D volumétrico destrutível
        this.voxelTerrain = new VoxelTerrain(app)
        this.addChild(this.voxelTerrain)

        this.buildBaseCatchNet()
        app.root.addChild(this)
    }

    private buildBaseCatchNet(): void {
        const catchNet = new Entity('VoidCatchNet', this.appInstance)
        catchNet.setPosition(0, -58, 0)
        catchNet.addComponent('collision', {
            type: 'box',
            halfExtents: new Vec3(200, 2, 200)
        })
        catchNet.addComponent('rigidbody', {
            type: 'static',
            friction: 0.9,
            restitution: 0.0
        })
        this.appInstance.root.addChild(catchNet)
    }

    public getHeightAt(worldX: number, worldZ: number, referenceY?: number): number {
        return this.voxelTerrain.getHeightAt(worldX, worldZ, referenceY)
    }

    public getDensityAt(worldX: number, worldY: number, worldZ: number): number {
        return this.voxelTerrain.getDensityAt(worldX, worldY, worldZ)
    }

    public carve(center: Vec3, radius = 2.4, strength = 1.0): boolean {
        return this.voxelTerrain.carve(center, radius, strength)
    }
}
