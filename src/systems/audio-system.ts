import type { Game } from '../core/game'

import { GameSystem } from './game-system'

export type PlayAudioOptions = {
    volume?: number
    loop?: boolean
}

export default class AudioSystem extends GameSystem {
    private sounds = new Map<string, HTMLAudioElement>()
    private isUnlocked = false
    private masterVolume = 1.0

    constructor(app: Game) {
        super(app)

        this.masterVolume = app.gameOptions.audio.masterVolume

        this.unlockAudio = this.unlockAudio.bind(this)
        this.play = this.play.bind(this)
        this.stop = this.stop.bind(this)
        this.stopAll = this.stopAll.bind(this)
    }

    public initialize(): void {
        window.addEventListener('pointerdown', this.unlockAudio, { once: true })
        window.addEventListener('keydown', this.unlockAudio, { once: true })

        this.app.on('audio:play', this.play, this)
        this.app.on('audio:stop', this.stop, this)
        this.app.on('audio:stop-all', this.stopAll, this)
    }

    public override dispose(): void {
        window.removeEventListener('pointerdown', this.unlockAudio)
        window.removeEventListener('keydown', this.unlockAudio)

        this.app.off('audio:play', this.play, this)
        this.app.off('audio:stop', this.stop, this)
        this.app.off('audio:stop-all', this.stopAll, this)

        this.stopAll()
        this.sounds.clear()
        super.dispose()
    }

    private unlockAudio(): void {
        this.isUnlocked = true
    }

    private getOrCreateAudio(src: string): HTMLAudioElement {
        let audio = this.sounds.get(src)
        if (!audio) {
            audio = new Audio(src)
            this.sounds.set(src, audio)
        }

        return audio
    }

    public play(src: string, options?: PlayAudioOptions): HTMLAudioElement | null {
        try {
            const audio = this.getOrCreateAudio(src)

            const hasCustomVolume = options?.volume !== undefined
            if (hasCustomVolume) {
                audio.volume = Math.max(0, Math.min(1, options!.volume! * this.masterVolume))
            }

            const hasCustomLoop = options?.loop !== undefined
            if (hasCustomLoop) {
                audio.loop = options!.loop!
            }

            const isOneShot = !audio.loop
            if (isOneShot) {
                audio.currentTime = 0
            }

            const canAutoplay = this.isUnlocked
            if (canAutoplay) {
                void audio.play().catch(() => {
                    // Autoplay prevented or aborted
                })
            }

            return audio
        } catch {
            return null
        }
    }

    public stop(src: string): void {
        const audio = this.sounds.get(src)
        const hasAudio = Boolean(audio)
        if (hasAudio) {
            try {
                audio!.pause()
                audio!.currentTime = 0
            } catch {
                // Ignore audio pause errors
            }
        }
    }

    public stopAll(): void {
        this.sounds.forEach((audio) => {
            try {
                audio.pause()
                audio.currentTime = 0
            } catch {
                // Ignore audio pause errors
            }
        })
    }

    public setMasterVolume(vol: number): void {
        this.masterVolume = Math.max(0, Math.min(1, vol))
    }
}
