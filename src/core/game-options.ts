import {
    AppOptions,
    CameraComponentSystem,
    CollisionComponentSystem,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    RenderComponentSystem,
    RESOLUTION_AUTO,
    RigidBodyComponentSystem,
    ScriptComponentSystem,
    WasmModule,
    createGraphicsDevice,
    type GraphicsDevice
} from 'playcanvas';

export default class GameOptions extends AppOptions {

    // Sistemas ECS nativos que o jogo utilizará
    componentSystems = [
        RenderComponentSystem,
        CameraComponentSystem,
        LightComponentSystem,
        ScriptComponentSystem,
        CollisionComponentSystem,
        RigidBodyComponentSystem
    ];

    // Configurações do jogo    
    fillMode: string = FILLMODE_FILL_WINDOW;
    resolutionMode: string = RESOLUTION_AUTO;
    useDevicePixelRatio: boolean = true;

    seed: number = 42;
    worldSize: number = 1200;
    marsGravity: number = 3.72;


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
