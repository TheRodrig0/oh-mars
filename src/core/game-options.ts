import type { GraphicsDevice } from 'playcanvas';
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
    WasmModule
} from 'playcanvas';

export default class GameOptions extends AppOptions {
    // Sistemas ECS nativos que o jogo utilizará
    override componentSystems = [
        RenderComponentSystem,
        ModelComponentSystem,
        CameraComponentSystem,
        LightComponentSystem,
        ScriptComponentSystem,
        CollisionComponentSystem,
        RigidBodyComponentSystem,
        AnimComponentSystem,
        AnimationComponentSystem
    ];

    // Manipuladores de recursos para carregar modelos GLB, texturas e animações
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
    ];

    // Configurações do jogo
    fillMode: string = FILLMODE_FILL_WINDOW;
    resolutionMode: string = RESOLUTION_AUTO;
    useDevicePixelRatio = true;

    seed = 42;
    worldSize = 1200;
    marsGravity = 3.72;

    constructor(graphicsDevice?: GraphicsDevice) {
        super();

        if (graphicsDevice) {
            this.graphicsDevice = graphicsDevice;
        }
    }

    public static async create(canvas: HTMLCanvasElement): Promise<GameOptions> {
        WasmModule.setConfig('Ammo', {
            glueUrl: '/ammo/ammo.wasm.js',
            wasmUrl: '/ammo/ammo.wasm.wasm',
            fallbackUrl: '/ammo/ammo.js'
        });

        await new Promise<void>((resolve) => {
            WasmModule.getInstance('Ammo', () => resolve());
        });

        const graphicsDevice = await createGraphicsDevice(canvas);
        const options = new GameOptions(graphicsDevice);
        return options;
    }
}
