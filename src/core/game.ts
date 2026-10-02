import { AppBase } from 'playcanvas'

import AudioSystem from '../systems/audio-system'
import TimeSystem from '../systems/time-system'
import Player from '../world/player/index'
import Sky from '../world/sky'
import Terrain from '../world/terrain/index'

import Camera from './camera'
import type GameOptions from './game-options'

export class Game extends AppBase {
    public readonly gameOptions: GameOptions
    public cameraEntity!: Camera
    public playerEntity!: Player
    public terrainEntity!: Terrain

    constructor(canvas: HTMLCanvasElement, options: GameOptions) {
        super(canvas)

        this.gameOptions = options

        this.init(options)
        this.setCanvasFillMode(options.fillMode)
        this.setCanvasResolution(options.resolutionMode)
        this.resizeCanvas()

        this.start()

        if (this.systems.rigidbody) {
            this.systems.rigidbody.gravity = options.physics.gravity
            this.systems.rigidbody.fixedTimeStep = options.physics.fixedTimeStep
        }

        this.setupTerrain()
        this.setupCameraAndPlayer()
        this.setupSystems()
        this.setupSky()

        window.addEventListener('resize', this.handleResize)
    }

    private setupSystems(): void {
        const systems = [new TimeSystem(this), new AudioSystem(this)]

        for (const system of systems) {
            system.initialize()
        }
    }

    private setupSky(): void {
        new Sky(this, this.cameraEntity.camera)
    }

    private setupTerrain(): void {
        this.terrainEntity = new Terrain(this)
    }

    private setupCameraAndPlayer(): void {
        this.cameraEntity = new Camera(this)
        this.playerEntity = new Player(this)
        this.cameraEntity.setTarget(this.playerEntity)
    }

    private handleResize = (): void => {
        this.resizeCanvas()
    }

    public override destroy(): void {
        window.removeEventListener('resize', this.handleResize)
        super.destroy()
    }
}
