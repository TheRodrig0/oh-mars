import { AppBase } from 'playcanvas'

import MovementSystem from '../systems/movement-system'
import TimeSystem from '../systems/time-system'
import Player from '../world/player'
import Sky from '../world/sky'
import Terrain from '../world/terrain'

import Camera from './camera'
import type GameOptions from './game-options'

export class Game extends AppBase {
    public readonly gameOptions: GameOptions
    public cameraEntity!: Camera
    public playerEntity!: Player

    constructor(canvas: HTMLCanvasElement, options: GameOptions) {
        super(canvas)

        this.gameOptions = options

        this.init(options)
        this.setCanvasFillMode(options.fillMode)
        this.setCanvasResolution(options.resolutionMode)
        this.resizeCanvas()

        this.setupCameraAndPlayer()
        this.setupSystems()
        this.setupSky()
        this.setupTerrain()

        this.start()

        window.addEventListener('resize', this.handleResize)
    }

    private setupSystems(): void {
        const systems = [
            new TimeSystem(this),
            new MovementSystem(this, this.playerEntity, this.cameraEntity)
        ]

        for (const system of systems) {
            system.initialize()
        }
    }

    private setupSky(): void {
        new Sky(this)
    }

    private setupTerrain(): void {
        new Terrain(this)
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
