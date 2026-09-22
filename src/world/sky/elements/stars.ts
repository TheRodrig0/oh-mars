import {
    AppBase,
    Entity,
    Color,
    StandardMaterial,
    Vec3,
    Mesh,
    MeshInstance,
    Texture,
    PIXELFORMAT_RGBA8,
    FILTER_LINEAR_MIPMAP_LINEAR,
    FILTER_LINEAR,
    BLEND_ADDITIVE,
    CULLFACE_NONE
} from "playcanvas"

export class StarsElement extends Entity {
    private material: StandardMaterial

    constructor(app: AppBase, count: number = 1200) {
        super('StarsElement', app)

        const starTexture = this.createStarGlowTexture(app.graphicsDevice)

        this.material = new StandardMaterial()
        this.material.diffuse = new Color(0, 0, 0)
        this.material.emissive = new Color(1, 1, 1)
        this.material.emissiveMap = starTexture
        this.material.diffuseVertexColor = true
        this.material.emissiveVertexColor = true
        this.material.emissiveIntensity = 8.0
        this.material.blendType = BLEND_ADDITIVE
        this.material.cull = CULLFACE_NONE
        this.material.depthWrite = false
        this.material.useLighting = false
        this.material.useFog = false
        this.material.update()

        const mesh = this.buildStarfieldMesh(app.graphicsDevice, count)
        const meshInstance = new MeshInstance(mesh, this.material, this)

        this.addComponent('render', {
            type: 'asset',
            castShadows: false,
            receiveShadows: false
        })

        if (this.render) {
            this.render.meshInstances = [meshInstance]
        }
    }

    private createStarGlowTexture(graphicsDevice: any): Texture {
        const size = 64
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')

        if (ctx) {
            const imgData = ctx.createImageData(size, size)
            const data = imgData.data
            const center = (size - 1) / 2
            const maxR = size / 2

            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const dx = x - center
                    const dy = y - center
                    const dist = Math.sqrt(dx * dx + dy * dy)
                    const norm = Math.min(1, dist / maxR)
                    const factor = Math.max(0, 1 - norm)
                    const val = Math.pow(factor, 1.8)
                    const byteVal = Math.floor(val * 255)
                    const idx = (y * size + x) * 4
                    data[idx] = byteVal
                    data[idx + 1] = byteVal
                    data[idx + 2] = byteVal
                    data[idx + 3] = byteVal
                }
            }
            ctx.putImageData(imgData, 0, 0)
        }

        const texture = new Texture(graphicsDevice, {
            width: size,
            height: size,
            format: PIXELFORMAT_RGBA8,
            mipmaps: true,
            minFilter: FILTER_LINEAR_MIPMAP_LINEAR,
            magFilter: FILTER_LINEAR
        })
        texture.setSource(canvas)
        return texture
    }

    private buildStarfieldMesh(graphicsDevice: any, count: number): Mesh {
        const positions: number[] = []
        const normals: number[] = []
        const uvs: number[] = []
        const colors: number[] = []
        const indices: number[] = []

        const up = new Vec3(0, 1, 0)
        const altUp = new Vec3(1, 0, 0)

        const normal = new Vec3()
        const tangentU = new Vec3()
        const tangentV = new Vec3()
        const center = new Vec3()
        const temp = new Vec3()

        for (let i = 0; i < count; i++) {
            const phi = Math.random() * Math.PI * 2
            const cosTheta = -0.05 + Math.random() * 1.05
            const clampedCos = Math.max(0, cosTheta)
            const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta))

            const distBonus = Math.random() * 50
            const radius = 210 + distBonus

            center.set(
                radius * sinTheta * Math.cos(phi),
                radius * cosTheta,
                radius * sinTheta * Math.sin(phi)
            )

            normal.copy(center).normalize()

            const refUp = Math.abs(normal.y) > 0.95 ? altUp : up
            tangentU.cross(refUp, normal).normalize()
            tangentV.cross(normal, tangentU).normalize()

            const tier = Math.random()
            let starSize = 0.55 + Math.random() * 0.35
            let starBrightness = 1.2 + Math.random() * 0.6

            if (tier > 0.97) {
                starSize = 1.30 + Math.random() * 0.35
                starBrightness = 2.4 + Math.random() * 0.6
            } else if (tier > 0.85) {
                starSize = 1.10 + Math.random() * 0.50
                starBrightness = 2.2 + Math.random() * 0.8
            }

            const redShift = (distBonus / 50) * 0.65 + (1 - clampedCos) * 0.35
            let r = 1.0
            let g = 1.0
            let b = 1.0

            if (redShift > 0.75) {
                r = 1.0
                g = 0.25 + Math.random() * 0.15
                b = 0.12 + Math.random() * 0.10
            } else if (redShift > 0.50) {
                r = 1.0
                g = 0.55 + Math.random() * 0.15
                b = 0.25 + Math.random() * 0.15
            } else if (redShift > 0.30) {
                r = 1.0
                g = 0.85 + Math.random() * 0.12
                b = 0.60 + Math.random() * 0.15
            } else {
                const blueTint = Math.random()
                if (blueTint > 0.5) {
                    r = 0.82 + Math.random() * 0.10
                    g = 0.90 + Math.random() * 0.08
                    b = 1.0
                } else {
                    r = 0.96 + Math.random() * 0.04
                    g = 0.96 + Math.random() * 0.04
                    b = 1.0
                }
            }

            const hs = starSize * 0.5
            const baseIndex = i * 4

            temp.copy(center).sub(tangentU.clone().mulScalar(hs)).sub(tangentV.clone().mulScalar(hs))
            positions.push(temp.x, temp.y, temp.z)

            temp.copy(center).add(tangentU.clone().mulScalar(hs)).sub(tangentV.clone().mulScalar(hs))
            positions.push(temp.x, temp.y, temp.z)

            temp.copy(center).add(tangentU.clone().mulScalar(hs)).add(tangentV.clone().mulScalar(hs))
            positions.push(temp.x, temp.y, temp.z)

            temp.copy(center).sub(tangentU.clone().mulScalar(hs)).add(tangentV.clone().mulScalar(hs))
            positions.push(temp.x, temp.y, temp.z)

            for (let v = 0; v < 4; v++) {
                normals.push(-normal.x, -normal.y, -normal.z)
                colors.push(r * starBrightness, g * starBrightness, b * starBrightness, 1.0)
            }

            uvs.push(0, 0, 1, 0, 1, 1, 0, 1)

            indices.push(baseIndex, baseIndex + 1, baseIndex + 2)
            indices.push(baseIndex, baseIndex + 2, baseIndex + 3)
        }

        const mesh = new Mesh(graphicsDevice)
        mesh.setPositions(positions)
        mesh.setNormals(normals)
        mesh.setUvs(0, uvs)
        mesh.setColors(colors)
        mesh.setIndices(indices)
        mesh.update()

        return mesh
    }

    public update(nightFactor: number, camPos: Vec3): void {
        this.setPosition(camPos)
        this.material.opacity = nightFactor
        this.material.emissiveIntensity = nightFactor * 5.0
        this.material.update()
        this.enabled = nightFactor > 0.001
    }
}
