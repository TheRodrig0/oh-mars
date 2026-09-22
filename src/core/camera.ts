import {
    AppBase,
    Entity,
    Color,
    Vec3,
    TONEMAP_ACES
} from 'playcanvas'
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs'

export default class Camera extends Entity {
    constructor(app: AppBase) {
        super('MainCamera', app)

        this.build()

        app.root.addChild(this)
    }

    private build(): void {
        this.addComponent('camera', {
            clearColor: new Color(0.82, 0.46, 0.28),
            farClip: 1200,
            fov: 50,
            toneMapping: TONEMAP_ACES
        })

        this.setPosition(0, 15, 30)
        this.lookAt(new Vec3(0, 0, 0))

        this.addComponent('script')
        this.script?.create(CameraControls)
    }
}
