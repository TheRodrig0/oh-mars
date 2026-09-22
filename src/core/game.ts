import { AppBase } from 'playcanvas'
import type GameOptions from './game-options'
import Terrain from '../world/terrain'
import Sky from '../world/sky'
import Camera from './camera'
import TimeSystem from '../systems/time-system'

export class Game extends AppBase {
    public readonly gameOptions: GameOptions

    constructor(canvas: HTMLCanvasElement, options: GameOptions) {
        super(canvas)

        this.gameOptions = options

        this.init(options)
        this.setCanvasFillMode(options.fillMode)
        this.setCanvasResolution(options.resolutionMode)
        this.resizeCanvas()

        this.setupSystems()
        this.setupSky()
        this.setupTerrain()
        this.setupCamera()

        this.start()

        window.addEventListener('resize', this.handleResize)
    }

    private setupSystems(): void {
        const systems = [
            new TimeSystem(this)
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

    private setupCamera(): void {
        new Camera(this)
    }

    private handleResize = (): void => {
        this.resizeCanvas()
    }

    public override destroy(): void {
        window.removeEventListener('resize', this.handleResize)
        super.destroy()
    }
}
