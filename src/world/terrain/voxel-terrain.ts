import { Entity } from 'playcanvas'
import type { AppBase, GraphicsDevice, Material, Vec3 } from 'playcanvas'

import { TerrainChunk } from './chunk'
import { createTerrainMaterial } from './material'

export class VoxelTerrain extends Entity {
    private readonly chunks = new Map<string, TerrainChunk>()

    // Configurações do grid de chunks expandido (230.4m x 230.4m e 52m de profundidade)
    public static readonly CHUNKS_X = 8
    public static readonly CHUNKS_Z = 8
    public static readonly CELLS_X = 16
    public static readonly CELLS_Y = 36
    public static readonly CELLS_Z = 16
    public static readonly VOXEL_SIZE = 1.8

    // Origem vertical do terreno: de Y = -52m até Y = +12.8m (profundidade subterrânea maciça)
    public static readonly WORLD_ORIGIN_Y = -52.0

    constructor(app: AppBase) {
        super('VoxelTerrain', app)

        const material = createTerrainMaterial()
        this.buildWorld(app.graphicsDevice, material)
        app.root.addChild(this)
    }

    /**
     * Função que calcula a elevação natural da superfície marciana estilo Astroneer.
     */
    public static getSurfaceHeight(wx: number, wz: number): number {
        const distFromCenter = Math.sqrt(wx * wx + wz * wz)
        // Base perfeitamente plana nos primeiros 10 metros para o astronauta se locomover
        const duneWeight = Math.min(1, Math.max(0, (distFromCenter - 10) / 16))

        const wave1 = Math.sin(wx * 0.05) * Math.cos(wz * 0.04) * 4.5
        const wave2 = Math.sin((wx + wz) * 0.075) * 2.2
        const wave3 = Math.cos(wx * 0.1 - wz * 0.08) * 1.5

        return (wave1 + wave2 + wave3) * duneWeight
    }

    /**
     * Função que avalia a densidade do terreno em qualquer ponto do espaço 3D.
     * Valores negativos = rocha sólida; Valores positivos = ar/vazio.
     */
    public sampleDensity(wx: number, wy: number, wz: number): number {
        const surfaceY = VoxelTerrain.getSurfaceHeight(wx, wz)
        // Densidade é positiva acima da superfície (ar) e negativa abaixo (rocha)
        return (wy - surfaceY) / 2.0
    }

    private buildWorld(device: GraphicsDevice, material: Material): void {
        const numX = VoxelTerrain.CHUNKS_X
        const numZ = VoxelTerrain.CHUNKS_Z
        const cellsX = VoxelTerrain.CELLS_X
        const cellsY = VoxelTerrain.CELLS_Y
        const cellsZ = VoxelTerrain.CELLS_Z
        const vSize = VoxelTerrain.VOXEL_SIZE

        const chunkWidthX = cellsX * vSize
        const chunkWidthZ = cellsZ * vSize

        const totalWidthX = numX * chunkWidthX
        const totalWidthZ = numZ * chunkWidthZ

        const startOriginX = -totalWidthX / 2
        const startOriginZ = -totalWidthZ / 2
        const originY = VoxelTerrain.WORLD_ORIGIN_Y

        for (let cz = 0; cz < numZ; cz++) {
            for (let cx = 0; cx < numX; cx++) {
                const worldX = startOriginX + cx * chunkWidthX
                const worldZ = startOriginZ + cz * chunkWidthZ

                const chunk = new TerrainChunk(
                    device,
                    {
                        gridX: cx,
                        gridY: 0,
                        gridZ: cz,
                        cellsX,
                        cellsY,
                        cellsZ,
                        voxelSize: vSize,
                        worldOriginX: worldX,
                        worldOriginY: originY,
                        worldOriginZ: worldZ
                    },
                    material
                )

                chunk.initializeDensities((wx, wy, wz) => this.sampleDensity(wx, wy, wz))
                chunk.rebuildMesh()

                this.addChild(chunk)
                this.chunks.set(`${cx}_${cz}`, chunk)
            }
        }
    }

    /**
     * Escava uma depressão ou túnel 3D com raio esférico utilizando Marching Cubes.
     * @param center Centro 3D do corte
     * @param radius Raio da esfera de escavação
     * @param strength Intensidade de corte
     */
    public carve(center: Vec3, radius = 2.4, strength = 1.0): boolean {
        let anyModified = false
        for (const chunk of this.chunks.values()) {
            if (chunk.carve(center, radius, strength)) {
                anyModified = true
            }
        }
        return anyModified
    }

    /**
     * Retorna a densidade volumétrica em qualquer coordenada 3D do mundo.
     * Valores <= 0 indicam rocha sólida; valores > 0 indicam ar.
     */
    public getDensityAt(worldX: number, worldY: number, worldZ: number): number {
        const vSize = VoxelTerrain.VOXEL_SIZE
        const chunkWidthX = VoxelTerrain.CELLS_X * vSize
        const chunkWidthZ = VoxelTerrain.CELLS_Z * vSize
        const totalWidthX = VoxelTerrain.CHUNKS_X * chunkWidthX
        const totalWidthZ = VoxelTerrain.CHUNKS_Z * chunkWidthZ
        const startX = -totalWidthX / 2
        const startZ = -totalWidthZ / 2

        const cx = Math.floor((worldX - startX) / chunkWidthX)
        const cz = Math.floor((worldZ - startZ) / chunkWidthZ)
        const chunk = this.chunks.get(`${cx}_${cz}`)

        if (!chunk) {
            return 1.0 // Ar fora dos limites
        }

        if (!chunk.isModified) {
            return this.sampleDensity(worldX, worldY, worldZ)
        }

        const originY = VoxelTerrain.WORLD_ORIGIN_Y
        const localX = (worldX - chunk.config.worldOriginX) / vSize
        const localY = (worldY - originY) / vSize
        const localZ = (worldZ - chunk.config.worldOriginZ) / vSize

        return chunk.sampleTrilinear(localX, localY, localZ)
    }

    /**
     * Retorna a elevação exata da superfície do solo na coordenada (worldX, worldZ).
     * Se uma altura de referência (referenceY) for informada, faz a amostragem vertical
     * no volume para encontrar o piso sob o jogador (mesmo dentro de cavernas e túneis).
     */
    public getHeightAt(worldX: number, worldZ: number, referenceY?: number): number {
        const naturalHeight = VoxelTerrain.getSurfaceHeight(worldX, worldZ)

        const vSize = VoxelTerrain.VOXEL_SIZE
        const chunkWidthX = VoxelTerrain.CELLS_X * vSize
        const chunkWidthZ = VoxelTerrain.CELLS_Z * vSize
        const totalWidthX = VoxelTerrain.CHUNKS_X * chunkWidthX
        const totalWidthZ = VoxelTerrain.CHUNKS_Z * chunkWidthZ
        const startX = -totalWidthX / 2
        const startZ = -totalWidthZ / 2

        const cx = Math.floor((worldX - startX) / chunkWidthX)
        const cz = Math.floor((worldZ - startZ) / chunkWidthZ)
        const chunk = this.chunks.get(`${cx}_${cz}`)

        // Se o chunk não existe ou nunca foi escavado, o relevo natural é 100% perfeito e estável
        if (!chunk || !chunk.isModified) {
            return naturalHeight
        }

        const originY = VoxelTerrain.WORLD_ORIGIN_Y
        const localX = (worldX - chunk.config.worldOriginX) / vSize
        const localZ = (worldZ - chunk.config.worldOriginZ) / vSize

        // Modo A: Sem altura de referência - busca da superfície natural para baixo
        if (referenceY === undefined) {
            const searchTop = naturalHeight + 0.2
            let prevY = searchTop
            let prevDensity = chunk.sampleTrilinear(localX, (searchTop - originY) / vSize, localZ)

            if (prevDensity <= 0) {
                return naturalHeight
            }

            const step = 0.2
            for (let y = searchTop - step; y >= originY; y -= step) {
                const ly = (y - originY) / vSize
                const density = chunk.sampleTrilinear(localX, ly, localZ)

                if (density <= 0) {
                    const denom = prevDensity - density
                    if (denom > 0.00001) {
                        const t = prevDensity / denom
                        const foundY = prevY + t * (y - prevY)
                        return Math.min(naturalHeight, foundY)
                    }
                    return Math.min(naturalHeight, y)
                }

                prevY = y
                prevDensity = density
            }

            return naturalHeight
        }

        // Modo B: Com altura de referência (jogador ou câmera) - busca o piso diretamente sob referenceY
        let startY = referenceY
        let startDensity = chunk.sampleTrilinear(localX, (startY - originY) / vSize, localZ)

        // Se o ponto de referência for ar, verifica se podemos subir um pouco (até +0.4m) para acomodar passos
        if (startDensity > 0) {
            const elevatedY = referenceY + 0.4
            const elevatedDensity = chunk.sampleTrilinear(localX, (elevatedY - originY) / vSize, localZ)
            if (elevatedDensity > 0) {
                startY = elevatedY
                startDensity = elevatedDensity
            }
        } else {
            // Se o ponto de referência estiver dentro da rocha (ex.: pés afundados), procura ar subindo até +1.2m
            let foundAir = false
            for (let testY = referenceY + 0.2; testY <= referenceY + 1.2; testY += 0.2) {
                const d = chunk.sampleTrilinear(localX, (testY - originY) / vSize, localZ)
                if (d > 0) {
                    startY = testY
                    startDensity = d
                    foundAir = true
                    break
                }
            }
            // Se não encontrou ar acima, busca para baixo
            if (!foundAir) {
                for (let testY = referenceY - 0.2; testY >= originY; testY -= 0.2) {
                    const d = chunk.sampleTrilinear(localX, (testY - originY) / vSize, localZ)
                    if (d > 0) {
                        startY = testY
                        startDensity = d
                        foundAir = true
                        break
                    }
                }
            }
            if (!foundAir) {
                return naturalHeight
            }
        }

        // Desce pelo ar até encontrar a rocha sólida (piso da caverna ou chão externo)
        const step = 0.15
        let prevY = startY
        let prevDensity = startDensity

        for (let y = startY - step; y >= originY; y -= step) {
            const ly = (y - originY) / vSize
            const density = chunk.sampleTrilinear(localX, ly, localZ)

            if (density <= 0) {
                const denom = prevDensity - density
                if (denom > 0.00001) {
                    const t = prevDensity / denom
                    return prevY + t * (y - prevY)
                }
                return y
            }

            prevY = y
            prevDensity = density
        }

        return originY
    }
}
