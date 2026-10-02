import { Color, Entity, Mesh, MeshInstance } from 'playcanvas'
import type { GraphicsDevice, Material, Vec3 } from 'playcanvas'

import { edgeCorners, table } from './triangulation'

export const SURFACE_LEVEL = 0.0

export type ChunkConfig = {
    gridX: number
    gridY: number
    gridZ: number
    cellsX: number
    cellsY: number
    cellsZ: number
    voxelSize: number
    worldOriginX: number
    worldOriginY: number
    worldOriginZ: number
}

const CORNER_OFFSETS: [number, number, number][] = [
    [0, 0, 0],
    [1, 0, 0],
    [1, 0, 1],
    [0, 0, 1],
    [0, 1, 0],
    [1, 1, 0],
    [1, 1, 1],
    [0, 1, 1]
]

export class MarchingCubesChunk extends Entity {
    public readonly config: ChunkConfig
    private readonly device: GraphicsDevice
    private readonly material: Material

    private readonly sizeX: number
    private readonly sizeY: number
    private readonly sizeZ: number
    private readonly densities: Float32Array
    public isModified = false

    private meshInstance: MeshInstance | null = null
    private currentMesh: Mesh | null = null

    constructor(appDevice: GraphicsDevice, config: ChunkConfig, material: Material) {
        super(`Chunk_${config.gridX}_${config.gridY}_${config.gridZ}`)
        this.device = appDevice
        this.config = config
        this.material = material

        this.sizeX = config.cellsX + 1
        this.sizeY = config.cellsY + 1
        this.sizeZ = config.cellsZ + 1

        this.densities = new Float32Array(this.sizeX * this.sizeY * this.sizeZ)
    }

    public getIndex(x: number, y: number, z: number): number {
        return (y * this.sizeZ + z) * this.sizeX + x
    }

    public getDensity(x: number, y: number, z: number): number {
        if (x < 0 || x >= this.sizeX || y < 0 || y >= this.sizeY || z < 0 || z >= this.sizeZ) {
            return 1.0
        }
        return this.densities[this.getIndex(x, y, z)]
    }

    public setDensity(x: number, y: number, z: number, val: number): void {
        if (x >= 0 && x < this.sizeX && y >= 0 && y < this.sizeY && z >= 0 && z < this.sizeZ) {
            this.densities[this.getIndex(x, y, z)] = val
        }
    }

    public sampleTrilinear(lx: number, ly: number, lz: number): number {
        const x0 = Math.max(0, Math.min(this.config.cellsX, Math.floor(lx)))
        const x1 = Math.max(0, Math.min(this.config.cellsX, x0 + 1))
        const y0 = Math.max(0, Math.min(this.config.cellsY, Math.floor(ly)))
        const y1 = Math.max(0, Math.min(this.config.cellsY, y0 + 1))
        const z0 = Math.max(0, Math.min(this.config.cellsZ, Math.floor(lz)))
        const z1 = Math.max(0, Math.min(this.config.cellsZ, z0 + 1))

        const fx = Math.max(0, Math.min(1, lx - x0))
        const fy = Math.max(0, Math.min(1, ly - y0))
        const fz = Math.max(0, Math.min(1, lz - z0))

        const d000 = this.getDensity(x0, y0, z0)
        const d100 = this.getDensity(x1, y0, z0)
        const d010 = this.getDensity(x0, y1, z0)
        const d110 = this.getDensity(x1, y1, z0)
        const d001 = this.getDensity(x0, y0, z1)
        const d101 = this.getDensity(x1, y0, z1)
        const d011 = this.getDensity(x0, y1, z1)
        const d111 = this.getDensity(x1, y1, z1)

        const d00 = d000 * (1 - fx) + d100 * fx
        const d10 = d010 * (1 - fx) + d110 * fx
        const d01 = d001 * (1 - fx) + d101 * fx
        const d11 = d011 * (1 - fx) + d111 * fx

        const d0 = d00 * (1 - fy) + d10 * fy
        const d1 = d01 * (1 - fy) + d11 * fy

        return d0 * (1 - fz) + d1 * fz
    }

    public initializeDensities(densitySampler: (wx: number, wy: number, wz: number) => number): void {
        const originX = this.config.worldOriginX
        const originY = this.config.worldOriginY
        const originZ = this.config.worldOriginZ
        const vSize = this.config.voxelSize

        let idx = 0
        for (let y = 0; y < this.sizeY; y++) {
            const wy = originY + y * vSize
            for (let z = 0; z < this.sizeZ; z++) {
                const wz = originZ + z * vSize
                for (let x = 0; x < this.sizeX; x++) {
                    const wx = originX + x * vSize
                    this.densities[idx++] = densitySampler(wx, wy, wz)
                }
            }
        }
    }

    public carve(worldCenter: Vec3, radius: number, strength = 1.0): boolean {
        const originX = this.config.worldOriginX
        const originY = this.config.worldOriginY
        const originZ = this.config.worldOriginZ
        const vSize = this.config.voxelSize

        const minChunkX = originX
        const maxChunkX = originX + this.config.cellsX * vSize
        const minChunkY = originY
        const maxChunkY = originY + this.config.cellsY * vSize
        const minChunkZ = originZ
        const maxChunkZ = originZ + this.config.cellsZ * vSize

        if (
            worldCenter.x + radius < minChunkX ||
            worldCenter.x - radius > maxChunkX ||
            worldCenter.y + radius < minChunkY ||
            worldCenter.y - radius > maxChunkY ||
            worldCenter.z + radius < minChunkZ ||
            worldCenter.z - radius > maxChunkZ
        ) {
            return false
        }

        const r2 = radius * radius
        let modified = false

        const startX = Math.max(0, Math.floor((worldCenter.x - radius - originX) / vSize))
        const endX = Math.min(this.sizeX - 1, Math.ceil((worldCenter.x + radius - originX) / vSize))
        const startY = Math.max(0, Math.floor((worldCenter.y - radius - originY) / vSize))
        const endY = Math.min(this.sizeY - 1, Math.ceil((worldCenter.y + radius - originY) / vSize))
        const startZ = Math.max(0, Math.floor((worldCenter.z - radius - originZ) / vSize))
        const endZ = Math.min(this.sizeZ - 1, Math.ceil((worldCenter.z + radius - originZ) / vSize))

        for (let y = startY; y <= endY; y++) {
            const wy = originY + y * vSize
            const dy = wy - worldCenter.y
            const dy2 = dy * dy

            for (let z = startZ; z <= endZ; z++) {
                const wz = originZ + z * vSize
                const dz = wz - worldCenter.z
                const dyz2 = dy2 + dz * dz

                if (dyz2 > r2) continue

                for (let x = startX; x <= endX; x++) {
                    const wx = originX + x * vSize
                    const dx = wx - worldCenter.x
                    const distSq = dx * dx + dyz2

                    if (distSq < r2) {
                        const dist = Math.sqrt(distSq)
                        const falloff = 1 - (dist / radius) * (dist / radius)
                        const delta = falloff * strength * 2.5

                        const idx = this.getIndex(x, y, z)
                        this.densities[idx] = Math.min(2.0, this.densities[idx] + delta)
                        modified = true
                    }
                }
            }
        }

        if (modified) {
            this.isModified = true
            this.rebuildMesh()
        }

        return modified
    }

    public get mesh(): Mesh | null {
        return this.currentMesh
    }

    public rebuildMesh(): void {
        const positions: number[] = []
        const normals: number[] = []
        const colors: number[] = []
        const indices: number[] = []

        const originX = this.config.worldOriginX
        const originY = this.config.worldOriginY
        const originZ = this.config.worldOriginZ
        const vSize = this.config.voxelSize

        const cornerVals = new Float32Array(8)
        let vertCount = 0

        for (let y = 0; y < this.config.cellsY; y++) {
            const baseY = originY + y * vSize
            for (let z = 0; z < this.config.cellsZ; z++) {
                const baseZ = originZ + z * vSize
                for (let x = 0; x < this.config.cellsX; x++) {
                    const baseX = originX + x * vSize

                    cornerVals[0] = this.getDensity(x, y, z)
                    cornerVals[1] = this.getDensity(x + 1, y, z)
                    cornerVals[2] = this.getDensity(x + 1, y, z + 1)
                    cornerVals[3] = this.getDensity(x, y, z + 1)
                    cornerVals[4] = this.getDensity(x, y + 1, z)
                    cornerVals[5] = this.getDensity(x + 1, y + 1, z)
                    cornerVals[6] = this.getDensity(x + 1, y + 1, z + 1)
                    cornerVals[7] = this.getDensity(x, y + 1, z + 1)

                    let cubeIndex = 0
                    for (let n = 0; n < 8; n++) {
                        if (cornerVals[n] < SURFACE_LEVEL) {
                            cubeIndex |= 1 << n
                        }
                    }

                    if (cubeIndex === 0 || cubeIndex === 255) {
                        continue
                    }

                    const tableEdges = table[cubeIndex]
                    let e = 0

                    while (e < tableEdges.length) {
                        const edgeIdx1 = tableEdges[e]
                        const edgeIdx2 = tableEdges[e + 1]
                        const edgeIdx3 = tableEdges[e + 2]

                        const v1 = this.interpolateEdge(edgeIdx1, cornerVals, baseX, baseY, baseZ, vSize)
                        const v2 = this.interpolateEdge(edgeIdx2, cornerVals, baseX, baseY, baseZ, vSize)
                        const v3 = this.interpolateEdge(edgeIdx3, cornerVals, baseX, baseY, baseZ, vSize)

                        const ax = v2[0] - v1[0]
                        const ay = v2[1] - v1[1]
                        const az = v2[2] - v1[2]

                        const bx = v3[0] - v1[0]
                        const by = v3[1] - v1[1]
                        const bz = v3[2] - v1[2]

                        let nx = ay * bz - az * by
                        let ny = az * bx - ax * bz
                        let nz = ax * by - ay * bx
                        const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1
                        nx /= nLen
                        ny /= nLen
                        nz /= nLen

                        const avgY = (v1[1] + v2[1] + v3[1]) / 3
                        const color = this.getFacetColor(avgY, ny)

                        const cr = Math.min(255, Math.max(0, Math.round(color.r * 255)))
                        const cg = Math.min(255, Math.max(0, Math.round(color.g * 255)))
                        const cb = Math.min(255, Math.max(0, Math.round(color.b * 255)))

                        positions.push(v1[0], v1[1], v1[2])
                        normals.push(nx, ny, nz)
                        colors.push(cr, cg, cb, 255)
                        indices.push(vertCount++)

                        positions.push(v2[0], v2[1], v2[2])
                        normals.push(nx, ny, nz)
                        colors.push(cr, cg, cb, 255)
                        indices.push(vertCount++)

                        positions.push(v3[0], v3[1], v3[2])
                        normals.push(nx, ny, nz)
                        colors.push(cr, cg, cb, 255)
                        indices.push(vertCount++)

                        e += 3
                    }
                }
            }
        }

        if (positions.length === 0) {
            if (this.render) {
                this.removeComponent('render')
            }
            this.meshInstance = null
            this.currentMesh = null
            return
        }

        const posArray = new Float32Array(positions)
        const normArray = new Float32Array(normals)
        const colArray = new Uint8Array(colors)
        const idxArray = vertCount > 65535 ? new Uint32Array(indices) : new Uint16Array(indices)

        const mesh = new Mesh(this.device)
        mesh.setPositions(posArray)
        mesh.setNormals(normArray)
        mesh.setColors32(colArray)
        mesh.setIndices(idxArray)
        mesh.update()

        this.currentMesh = mesh
        this.meshInstance = new MeshInstance(mesh, this.material)

        if (!this.render) {
            this.addComponent('render', {
                meshInstances: [this.meshInstance],
                castShadows: false,
                receiveShadows: true
            })
        } else {
            this.render.meshInstances = [this.meshInstance]
        }
    }

    private interpolateEdge(
        edgeIndex: number,
        cornerVals: Float32Array,
        baseX: number,
        baseY: number,
        baseZ: number,
        vSize: number
    ): [number, number, number] {
        const corners = edgeCorners[edgeIndex]

        const cA = corners[0]
        const cB = corners[1]
        const vA = cornerVals[cA]
        const vB = cornerVals[cB]

        const denom = vB - vA
        const t = Math.abs(denom) > 0.00001 ? (SURFACE_LEVEL - vA) / denom : 0.5
        const clampedT = Math.max(0, Math.min(1, t))

        const pA = CORNER_OFFSETS[cA]
        const pB = CORNER_OFFSETS[cB]

        const localX = pA[0] + clampedT * (pB[0] - pA[0])
        const localY = pA[1] + clampedT * (pB[1] - pA[1])
        const localZ = pA[2] + clampedT * (pB[2] - pA[2])

        return [baseX + localX * vSize, baseY + localY * vSize, baseZ + localZ * vSize]
    }

    private getFacetColor(elevation: number, normalY: number): Color {
        if (elevation >= -2) {
            if (normalY > 0.8) {
                return new Color(0.92, 0.22, 0.14)
            }
            if (normalY > 0.4) {
                return new Color(0.82, 0.18, 0.12)
            }
            return new Color(0.70, 0.14, 0.11)
        }

        if (elevation >= -22) {
            return new Color(0.56, 0.12, 0.12)
        }

        if (elevation >= -42) {
            return new Color(0.38, 0.10, 0.14)
        }

        return new Color(0.22, 0.06, 0.12)
    }
}

export { MarchingCubesChunk as TerrainChunk }

