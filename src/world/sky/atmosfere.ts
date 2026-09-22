import { AppBase, Color, FOG_EXP2, type CameraComponent } from "playcanvas"
import { DayPhase } from "../../core/enums/time-system-enums"
import type { DayPhase as DayPhaseType } from "../../core/types/time-system-types"

export interface AtmosphereState {
    fogColor: Color
    ambientLight: Color
    lightColor: Color
    lightIntensity: number
    nightFactor: number
}

interface PhaseConfig {
    lightColor: Color
    lightIntensity: number
    fogColor: Color
    ambientLight: Color
}

const PHASE_CONFIGS: Record<DayPhaseType, PhaseConfig> = {
    [DayPhase.DAWN]: {
        lightColor: new Color(0.70, 0.80, 0.95),
        lightIntensity: 1.0,
        fogColor: new Color(0.32, 0.36, 0.50),
        ambientLight: new Color(0.20, 0.18, 0.24)
    },
    [DayPhase.DAY]: {
        lightColor: new Color(1.0, 0.94, 0.85),
        lightIntensity: 2.0,
        fogColor: new Color(0.82, 0.46, 0.28),
        ambientLight: new Color(0.38, 0.22, 0.16)
    },
    [DayPhase.DUSK]: {
        lightColor: new Color(0.45, 0.65, 0.95),
        lightIntensity: 1.0,
        fogColor: new Color(0.28, 0.32, 0.50),
        ambientLight: new Color(0.20, 0.20, 0.28)
    },
    [DayPhase.NIGHT]: {
        lightColor: new Color(0.20, 0.30, 0.50),
        lightIntensity: 0.0,
        fogColor: new Color(0.03, 0.04, 0.08),
        ambientLight: new Color(0.12, 0.14, 0.20)
    }
}

export class Atmosphere {
    private app: AppBase
    private currentFogColor = new Color()
    private currentAmbientLight = new Color()
    private currentLightColor = new Color()

    constructor(app: AppBase) {
        this.app = app
        this.app.scene.fog.type = FOG_EXP2
        this.app.scene.fog.density = 0.004
        this.app.scene.exposure = 1.15
    }

    private getPhaseBlend(hour: number): { from: PhaseConfig; to: PhaseConfig; progress: number } {
        if (hour >= 5 && hour < 6) {
            return { from: PHASE_CONFIGS[DayPhase.NIGHT], to: PHASE_CONFIGS[DayPhase.DAWN], progress: hour - 5 }
        }

        if (hour >= 6 && hour < 7) {
            return { from: PHASE_CONFIGS[DayPhase.DAWN], to: PHASE_CONFIGS[DayPhase.DAY], progress: hour - 6 }
        }

        if (hour >= 7 && hour < 17) {
            return { from: PHASE_CONFIGS[DayPhase.DAY], to: PHASE_CONFIGS[DayPhase.DAY], progress: 0 }
        }

        if (hour >= 17 && hour < 18) {
            return { from: PHASE_CONFIGS[DayPhase.DAY], to: PHASE_CONFIGS[DayPhase.DUSK], progress: hour - 17 }
        }

        if (hour >= 18 && hour < 19) {
            return { from: PHASE_CONFIGS[DayPhase.DUSK], to: PHASE_CONFIGS[DayPhase.NIGHT], progress: hour - 18 }
        }

        return { from: PHASE_CONFIGS[DayPhase.NIGHT], to: PHASE_CONFIGS[DayPhase.NIGHT], progress: 0 }
    }

    public update(hour: number, camera: CameraComponent | null): AtmosphereState {
        const { from, to, progress } = this.getPhaseBlend(hour)
        const t = progress * progress * (3 - 2 * progress)

        this.currentFogColor.lerp(from.fogColor, to.fogColor, t)
        this.currentAmbientLight.lerp(from.ambientLight, to.ambientLight, t)
        this.currentLightColor.lerp(from.lightColor, to.lightColor, t)
        const intensity = from.lightIntensity + (to.lightIntensity - from.lightIntensity) * t

        this.app.scene.fog.color.copy(this.currentFogColor)
        this.app.scene.ambientLight.copy(this.currentAmbientLight)

        if (camera) {
            camera.clearColor.copy(this.currentFogColor)
        }

        let nightFactor = 0
        if (hour >= 19 || hour < 5) {
            nightFactor = 1.0
        } else if (hour >= 17 && hour < 19) {
            nightFactor = (hour - 17) / 2.0
        } else if (hour >= 5 && hour < 7) {
            nightFactor = 1.0 - (hour - 5) / 2.0
        }

        return {
            fogColor: this.currentFogColor,
            ambientLight: this.currentAmbientLight,
            lightColor: this.currentLightColor,
            lightIntensity: intensity,
            nightFactor
        }
    }
}
