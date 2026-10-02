import type { GraphicsDevice } from 'playcanvas'
import {
    AnimClipHandler,
    AnimComponentSystem,
    AnimStateGraphHandler,
    AnimationComponentSystem,
    AnimationHandler,
    AppOptions,
    BinaryHandler,
    CameraComponentSystem,
    CollisionComponentSystem,
    ContainerHandler,
    createGraphicsDevice,
    FILLMODE_FILL_WINDOW,
    JointComponentSystem,
    JsonHandler,
    LightComponentSystem,
    MaterialHandler,
    ModelComponentSystem,
    RenderComponentSystem,
    RESOLUTION_AUTO,
    RigidBodyComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    TextureHandler,
    Vec3,
    WasmModule
} from 'playcanvas'

export default class GameOptions extends AppOptions {
    override componentSystems = [
        RenderComponentSystem,
        ModelComponentSystem,
        CameraComponentSystem,
        LightComponentSystem,
        ScriptComponentSystem,
        CollisionComponentSystem,
        RigidBodyComponentSystem,
        JointComponentSystem,
        AnimComponentSystem,
        AnimationComponentSystem
    ]

    override resourceHandlers = [
        ContainerHandler,
        TextureHandler,
        BinaryHandler,
        AnimClipHandler,
        AnimStateGraphHandler,
        AnimationHandler,
        MaterialHandler,
        JsonHandler,
        ScriptHandler
    ]

    public readonly fillMode: string = FILLMODE_FILL_WINDOW
    public readonly resolutionMode: string = RESOLUTION_AUTO
    public readonly useDevicePixelRatio = true

    public readonly physics = {
        gravity: new Vec3(0, -9.81, 0),
        fixedTimeStep: 1 / 120
    }

    public readonly movement = {
        speedWalk: 3.2,
        speedRun: 7.0,
        turnSpeed: 15.0,
        gravity: 18.0,
        jumpForce: 6.8
    }

    public readonly lifeSupport = {
        initialHealth: 100,
        initialOxygen: 100,
        initialWater: 100,
        initialFood: 100,
        oxygenBaseRate: 0.8,
        oxygenWalkMultiplier: 2.0,
        oxygenRunMultiplier: 4.0,
        waterRatePerHour: 0.35,
        foodRatePerHour: 0.22,
        suffocationDamageRate: 10.0,
        dehydrationDamageRate: 2.5,
        starvationDamageRate: 1.5,
        healthRecoveryRate: 2.0,
        criticalOxygenThreshold: 25,
        safeVitalsThreshold: 20
    }

    public readonly audio = {
        masterVolume: 1.0,
        warningVolume: 0.25,
        breathingVolume: 0.3,
        warningInterval: 3.5
    }

    public readonly time = {
        initialHour: 12.0,
        initialDay: 1,
        dayDurationMinutes: 10,
        timeScale: 1.0
    }

    public readonly camera = {
        distance: 6.0,
        minDistance: 2.5,
        maxDistance: 14.0,
        pitch: 18,
        yaw: 0,
        minPitch: -35,
        maxPitch: 70,
        minHeightAboveGround: 0.4,
        sensitivity: 0.22,
        keyTurnSpeed: 95.0,
        keyPitchSpeed: 65.0
    }

    constructor(graphicsDevice?: GraphicsDevice) {
        super()

        if (graphicsDevice) {
            this.graphicsDevice = graphicsDevice
        }
    }

    public static async create(canvas: HTMLCanvasElement): Promise<GameOptions> {
        WasmModule.setConfig('Ammo', {
            glueUrl: '/ammo/ammo.wasm.js',
            wasmUrl: '/ammo/ammo.wasm.wasm',
            fallbackUrl: '/ammo/ammo.js'
        })

        await new Promise<void>((resolve) => {
            WasmModule.getInstance('Ammo', () => resolve())
        })

        const graphicsDevice = await createGraphicsDevice(canvas)
        const options = new GameOptions(graphicsDevice)
        return options
    }
}
