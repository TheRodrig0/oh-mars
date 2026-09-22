import { Entity, Color, Vec3 } from "playcanvas"

export class SkyLight extends Entity {
    constructor() {
        super('SunLight')

        this.addComponent('light', {
            type: 'directional',
            color: new Color(1.0, 0.95, 0.88),
            intensity: 2.0,
            castShadows: true,
            shadowDistance: 200,
            shadowResolution: 2048,
            shadowBias: 0.05,
            normalOffsetBias: 0.1
        })
    }

    public update(sunPos: Vec3, targetPos: Vec3, color: Color, intensity: number): void {
        this.setPosition(sunPos)
        this.lookAt(targetPos)

        if (this.light) {
            this.light.color.copy(color)
            this.light.intensity = intensity
            this.light.enabled = intensity > 0.01
        }
    }
}
