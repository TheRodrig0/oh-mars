import { AppBase, Entity, Vec3, type CameraComponent } from "playcanvas"
import { TimeEvent } from "../../core/enums/time-system-enums"
import type { TimeData } from "../../core/types/time-system-types"
import { Atmosphere } from "./atmosfere"
import { SkyLight } from "./light"
import { SunElement } from "./elements/sun"
import { PhobosElement } from "./elements/phobos"
import { DeimosElement } from "./elements/deimos"
import { StarsElement } from "./elements/stars"

export default class Sky extends Entity {
    private atmosphere: Atmosphere
    private skyLight: SkyLight
    private sun: SunElement
    private phobos: PhobosElement
    private deimos: DeimosElement
    private stars: StarsElement

    private mainCamera: CameraComponent | null = null

    constructor(app: AppBase) {
        super('sky', app)

        this.atmosphere = new Atmosphere(app)

        this.skyLight = new SkyLight()
        this.addChild(this.skyLight)

        this.sun = new SunElement(app)
        this.addChild(this.sun)

        this.phobos = new PhobosElement()
        this.addChild(this.phobos)

        this.deimos = new DeimosElement()
        this.addChild(this.deimos)

        this.stars = new StarsElement(app)
        this.addChild(this.stars)

        this.bindEvents(app)

        app.root.addChild(this)
    }

    private bindEvents(app: AppBase): void {
        app.on(TimeEvent.TICK, (data: TimeData) => {
            const currentHour = ((data.normalized * 24) % 24 + 24) % 24

            if (!this.mainCamera) {
                const camEntity = app.root.findByName('MainCamera') as Entity | null
                this.mainCamera = camEntity?.camera ?? null
            }

            const camPos = this.mainCamera ? this.mainCamera.entity.getPosition() : new Vec3(0, 15, 30)

            const state = this.atmosphere.update(currentHour, this.mainCamera)

            const sunAngleRad = (data.normalized * Math.PI * 2) - Math.PI / 2
            const sunRadius = 190
            const tilt = 0.44

            const sunX = Math.cos(sunAngleRad) * sunRadius
            const sunY = Math.sin(sunAngleRad) * sunRadius * Math.cos(tilt)
            const sunZ = -Math.sin(sunAngleRad) * sunRadius * Math.sin(tilt)

            const sunWorldPos = new Vec3(camPos.x + sunX, camPos.y + sunY, camPos.z + sunZ)

            this.skyLight.update(sunWorldPos, camPos, state.lightColor, state.lightIntensity)
            this.sun.update(sunWorldPos, camPos, state.lightColor)

            const totalDays = (data.day - 1) + data.normalized
            this.phobos.update(totalDays, camPos, sunWorldPos)
            this.deimos.update(totalDays, camPos, sunWorldPos)
            this.stars.update(state.nightFactor, camPos)
        })
    }
}
