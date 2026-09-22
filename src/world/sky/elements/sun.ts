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
    FILTER_LINEAR,
    BLEND_ADDITIVE,
    CULLFACE_NONE,
    ADDRESS_CLAMP_TO_EDGE
} from "playcanvas"

export class SunElement extends Entity {
    private sunMat: StandardMaterial
    private coronaMat: StandardMaterial
    private corona: Entity

    constructor(app: AppBase) {
        super('SunElement', app)

        this.sunMat = new StandardMaterial()
        this.sunMat.diffuse.set(1, 1, 1)
        this.sunMat.emissive.set(1, 0.98, 0.92)
        this.sunMat.emissiveIntensity = 6.0
        this.sunMat.useFog = false
        this.sunMat.update()

        const sphere = new Entity('SunSphere', app)
        sphere.addComponent('render', { type: 'sphere', material: this.sunMat, castShadows: false, receiveShadows: false })
        sphere.setLocalScale(8.5, 8.5, 8.5)
        this.addChild(sphere)

        this.coronaMat = new StandardMaterial()
        this.coronaMat.diffuse.set(0, 0, 0)
        this.coronaMat.emissive.set(1, 0.98, 0.92)
        this.coronaMat.emissiveMap = this.createTexture(app.graphicsDevice)
        this.coronaMat.emissiveIntensity = 0.5
        this.coronaMat.blendType = BLEND_ADDITIVE
        this.coronaMat.cull = CULLFACE_NONE
        this.coronaMat.depthWrite = false
        this.coronaMat.useLighting = false
        this.coronaMat.useFog = false
        this.coronaMat.update()

        const mesh = new Mesh(app.graphicsDevice)
        mesh.setPositions([-14, -14, 0, 14, -14, 0, 14, 14, 0, -14, 14, 0])
        mesh.setNormals([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1])
        mesh.setUvs(0, [0, 0, 1, 0, 1, 1, 0, 1])
        mesh.setIndices([0, 1, 2, 0, 2, 3])
        mesh.update()

        this.corona = new Entity('SunCorona', app)
        this.corona.addComponent('render', { type: 'asset', castShadows: false, receiveShadows: false })
        if (this.corona.render) {
            this.corona.render.meshInstances = [new MeshInstance(mesh, this.coronaMat, this.corona)]
        }
        this.addChild(this.corona)
    }

    private createTexture(device: any): Texture {
        const size = 64
        const tex = new Texture(device, {
            width: size,
            height: size,
            format: PIXELFORMAT_RGBA8,
            mipmaps: false,
            minFilter: FILTER_LINEAR,
            magFilter: FILTER_LINEAR,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        })
        const pixels = tex.lock()
        const half = (size - 1) / 2
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const norm = Math.hypot(x - half, y - half) / (size * 0.46)
                const v = norm < 1 ? Math.floor(Math.pow(1 - norm, 2.8) * 255) : 0
                const i = (y * size + x) * 4
                pixels[i] = v
                pixels[i + 1] = v
                pixels[i + 2] = v
                pixels[i + 3] = 255
            }
        }
        tex.unlock()
        return tex
    }

    public update(sunPos: Vec3, camPos: Vec3, color: Color): void {
        this.setPosition(sunPos)
        this.corona.lookAt(camPos)

        const fade = Math.max(0, Math.min(1, (sunPos.y + 15) / 35))
        this.enabled = fade > 0.001

        if (this.enabled) {
            this.sunMat.emissive.copy(color)
            this.sunMat.emissiveIntensity = fade * 6.0
            this.sunMat.update()

            this.coronaMat.emissive.copy(color)
            this.coronaMat.emissiveIntensity = fade * 0.5
            this.coronaMat.update()
        }
    }
}
