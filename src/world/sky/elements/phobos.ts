import { Entity, Color, StandardMaterial, Vec3 } from "playcanvas"

export class PhobosElement extends Entity {
    private material: StandardMaterial
    public orbitalSpeed: number

    constructor(orbitalSpeed: number = 1.25) {
        super('PhobosElement')
        this.orbitalSpeed = orbitalSpeed

        this.material = new StandardMaterial()
        this.material.diffuse = new Color(0.65, 0.62, 0.60)
        this.material.emissive = new Color(0.15, 0.16, 0.20)
        this.material.emissiveIntensity = 0.5
        this.material.gloss = 0.1
        this.material.update()

        this.addComponent('render', {
            type: 'sphere',
            material: this.material,
            castShadows: false,
            receiveShadows: false
        })

        this.setLocalScale(5.5, 3.8, 5.0)
    }

    public update(totalDays: number, camPos: Vec3, sunWorldPos: Vec3): void {
        const phobosRad = (totalDays * Math.PI * 2 * this.orbitalSpeed) + 0.6
        const phobosRadius = 175
        const tilt = 0.44

        const phobosX = -Math.cos(phobosRad) * phobosRadius
        const phobosY = Math.sin(phobosRad) * phobosRadius * Math.cos(tilt)
        const phobosZ = -Math.sin(phobosRad) * phobosRadius * Math.sin(tilt)

        const worldX = camPos.x + phobosX
        const worldY = camPos.y + phobosY
        const worldZ = camPos.z + phobosZ

        const fade = Math.max(0, Math.min(1, (worldY + 15) / 30))
        this.enabled = fade > 0.001

        if (this.enabled) {
            this.setPosition(worldX, worldY, worldZ)
            this.rotateLocal(0.05, 0.08, 0.02)

            const toSunX = sunWorldPos.x - camPos.x
            const toSunY = sunWorldPos.y - camPos.y
            const toSunZ = sunWorldPos.z - camPos.z
            const sunLen = Math.sqrt(toSunX * toSunX + toSunY * toSunY + toSunZ * toSunZ)

            const dot = (toSunX * phobosX + toSunY * phobosY + toSunZ * phobosZ) / (sunLen * phobosRadius)
            const silhouette = Math.max(0, (dot - 0.5) / 0.5)

            const nightGlow = Math.max(0, -sunWorldPos.y / 190)
            const emissiveValue = (1.0 - silhouette) * (0.1 + nightGlow * 1.8)

            this.material.emissiveIntensity = fade * emissiveValue
            this.material.diffuse.set(
                0.65 * (1.0 - silhouette * 0.85),
                0.62 * (1.0 - silhouette * 0.85),
                0.60 * (1.0 - silhouette * 0.85)
            )
            this.material.update()
        }
    }
}
