import { Entity, Color, StandardMaterial, Vec3 } from "playcanvas"

export class DeimosElement extends Entity {
    private material: StandardMaterial
    public orbitalSpeed: number

    constructor(orbitalSpeed: number = 0.38) {
        super('DeimosElement')
        this.orbitalSpeed = orbitalSpeed

        this.material = new StandardMaterial()
        this.material.diffuse = new Color(0.85, 0.82, 0.80)
        this.material.emissive = new Color(0.20, 0.22, 0.28)
        this.material.emissiveIntensity = 0.5
        this.material.gloss = 0.1
        this.material.update()

        this.addComponent('render', {
            type: 'sphere',
            material: this.material,
            castShadows: false,
            receiveShadows: false
        })

        this.setLocalScale(1.6, 1.4, 1.6)
    }

    public update(totalDays: number, camPos: Vec3, sunWorldPos: Vec3): void {
        const deimosRad = (totalDays * Math.PI * 2 * this.orbitalSpeed) + 2.5
        const deimosRadius = 182
        const tilt = 0.41

        const deimosX = Math.cos(deimosRad) * deimosRadius
        const deimosY = Math.sin(deimosRad) * deimosRadius * Math.cos(tilt)
        const deimosZ = -Math.sin(deimosRad) * deimosRadius * Math.sin(tilt)

        const worldX = camPos.x + deimosX
        const worldY = camPos.y + deimosY
        const worldZ = camPos.z + deimosZ

        const fade = Math.max(0, Math.min(1, (worldY + 15) / 30))
        this.enabled = fade > 0.001

        if (this.enabled) {
            this.setPosition(worldX, worldY, worldZ)
            this.rotateLocal(0.02, 0.04, 0.01)

            const toSunX = sunWorldPos.x - camPos.x
            const toSunY = sunWorldPos.y - camPos.y
            const toSunZ = sunWorldPos.z - camPos.z
            const sunLen = Math.sqrt(toSunX * toSunX + toSunY * toSunY + toSunZ * toSunZ)

            const dot = (toSunX * deimosX + toSunY * deimosY + toSunZ * deimosZ) / (sunLen * deimosRadius)
            const silhouette = Math.max(0, (dot - 0.5) / 0.5)

            const nightGlow = Math.max(0, -sunWorldPos.y / 190)
            const emissiveValue = (1.0 - silhouette) * (0.1 + nightGlow * 2.2)

            this.material.emissiveIntensity = fade * emissiveValue
            this.material.diffuse.set(
                0.85 * (1.0 - silhouette * 0.85),
                0.82 * (1.0 - silhouette * 0.85),
                0.80 * (1.0 - silhouette * 0.85)
            )
            this.material.update()
        }
    }
}
