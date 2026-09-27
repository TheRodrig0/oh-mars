import { LifeSupportEvent } from '../../core/enums/life-support-enums'
import type { Game } from '../../core/game'
import type { VitalsData } from '../../core/types/life-support-types'

export class PlayerAudio {
    private app: Game
    private static readonly SOUND_WARNING = '/audios/warning.mp3'
    private static readonly SOUND_BREATHING = '/audios/astronaut/heavy-breathing.mp3'
    private isCriticalWarning = false
    private warningTimer = 0

    constructor(app: Game) {
        this.app = app

        this.playWarning = this.playWarning.bind(this)
        this.playBreathing = this.playBreathing.bind(this)
        this.stopBreathing = this.stopBreathing.bind(this)
        this.stopAllAudio = this.stopAllAudio.bind(this)
        this.onVitalsChanged = this.onVitalsChanged.bind(this)
        this.update = this.update.bind(this)

        this.app.on(LifeSupportEvent.WARNING_TRIGGERED, this.playWarning, this)
        this.app.on(LifeSupportEvent.VITALS_CHANGED, this.onVitalsChanged, this)
        this.app.on(LifeSupportEvent.SUFFOCATION_START, this.playBreathing, this)
        this.app.on(LifeSupportEvent.SUFFOCATION_STOP, this.stopBreathing, this)
        this.app.on(LifeSupportEvent.GAME_OVER, this.stopAllAudio, this)
        this.app.on(LifeSupportEvent.RESPAWN, this.stopAllAudio, this)
        this.app.on('update', this.update, this)
    }

    private onVitalsChanged(data: VitalsData): void {
        this.isCriticalWarning = data.isCriticalOxygen && !data.isSuffocating
        if (!this.isCriticalWarning) {
            this.warningTimer = 0
        }
    }

    private update(dt: number): void {
        if (!this.isCriticalWarning) {
            return
        }

        this.warningTimer += dt
        const warningInterval = this.app.gameOptions.audio.warningInterval
        if (this.warningTimer >= warningInterval) {
            this.warningTimer = 0
            this.playWarning()
        }
    }

    public playWarning(): void {
        const volume = this.app.gameOptions.audio.warningVolume
        this.app.fire('audio:play', PlayerAudio.SOUND_WARNING, { volume })
    }

    public playBreathing(): void {
        const volume = this.app.gameOptions.audio.breathingVolume
        this.app.fire('audio:play', PlayerAudio.SOUND_BREATHING, { volume, loop: true })
    }

    public stopBreathing(): void {
        this.app.fire('audio:stop', PlayerAudio.SOUND_BREATHING)
    }

    public stopAllAudio(): void {
        this.isCriticalWarning = false
        this.warningTimer = 0
        this.app.fire('audio:stop', PlayerAudio.SOUND_BREATHING)
        this.app.fire('audio:stop', PlayerAudio.SOUND_WARNING)
    }

    public dispose(): void {
        this.app.off(LifeSupportEvent.WARNING_TRIGGERED, this.playWarning, this)
        this.app.off(LifeSupportEvent.VITALS_CHANGED, this.onVitalsChanged, this)
        this.app.off(LifeSupportEvent.SUFFOCATION_START, this.playBreathing, this)
        this.app.off(LifeSupportEvent.SUFFOCATION_STOP, this.stopBreathing, this)
        this.app.off(LifeSupportEvent.GAME_OVER, this.stopAllAudio, this)
        this.app.off(LifeSupportEvent.RESPAWN, this.stopAllAudio, this)
        this.app.off('update', this.update, this)

        this.stopAllAudio()
    }
}
