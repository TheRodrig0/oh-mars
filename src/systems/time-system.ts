import { TimeEvent, DayPhase } from '../core/enums/time-system-enums'
import type { Game } from '../core/game'
import type { DayPhase as DayPhaseType, TimeData } from '../core/types/time-system-types'

import { GameSystem } from './game-system'

export default class TimeSystem extends GameSystem {
    public currentHour = 12.0
    public currentDay = 1
    public dayDurationMinutes = 1
    public timeScale = 1.0
    public isPaused = false

    private currentPhase: DayPhaseType = DayPhase.DAY

    constructor(app: Game) {
        super(app)

        const opts = app.gameOptions.time
        this.currentHour = opts.initialHour
        this.currentDay = opts.initialDay
        this.dayDurationMinutes = opts.dayDurationMinutes
        this.timeScale = opts.timeScale
    }

    public initialize(): void {
        this.app.on('time:pause', this.pause, this)
        this.app.on('time:resume', this.resume, this)
        this.app.on('time:toggle-pause', this.togglePause, this)
        this.app.on('time:set-scale', this.setTimeScale, this)
        this.app.on('time:set-hour', this.setHour, this)
        this.app.on('time:skip-hours', this.skipHours, this)

        this.currentPhase = this.calculatePhase()
        this.app.fire(TimeEvent.TICK, this.getTimeData())
    }

    public override dispose(): void {
        this.app.off('time:pause', this.pause, this)
        this.app.off('time:resume', this.resume, this)
        this.app.off('time:toggle-pause', this.togglePause, this)
        this.app.off('time:set-scale', this.setTimeScale, this)
        this.app.off('time:set-hour', this.setHour, this)
        this.app.off('time:skip-hours', this.skipHours, this)
        super.dispose()
    }

    public override update(delta: number): void {
        const isSystemPaused = this.isPaused
        if (isSystemPaused) {
            return
        }

        const hoursPerSecond = (24 / (this.dayDurationMinutes * 60)) * this.timeScale
        this.advanceHours(delta * hoursPerSecond)
    }

    public pause(): void {
        const isAlreadyPaused = this.isPaused
        if (isAlreadyPaused) {
            return
        }

        this.isPaused = true
        this.app.fire(TimeEvent.PAUSE_CHANGED, true)
        this.app.fire(TimeEvent.TICK, this.getTimeData())
    }

    public resume(): void {
        const isNotPaused = !this.isPaused
        if (isNotPaused) {
            return
        }

        this.isPaused = false
        this.app.fire(TimeEvent.PAUSE_CHANGED, false)
        this.app.fire(TimeEvent.TICK, this.getTimeData())
    }

    public togglePause(): void {
        const isCurrentlyPaused = this.isPaused
        if (isCurrentlyPaused) {
            this.resume()
            return
        }

        this.pause()
    }

    public setTimeScale(scale: number): void {
        this.timeScale = Math.max(0, scale)
        this.app.fire(TimeEvent.SCALE_CHANGED, this.timeScale)
        this.app.fire(TimeEvent.TICK, this.getTimeData())
    }

    public setHour(hour: number): void {
        this.currentHour = ((hour % 24) + 24) % 24
        this.checkPhaseAndTick()
    }

    public skipHours(hours: number): void {
        this.advanceHours(hours)
    }

    private advanceHours(hours: number): void {
        this.currentHour += hours

        while (this.currentHour >= 24) {
            this.currentHour -= 24
            this.currentDay++
            this.app.fire(TimeEvent.NEW_DAY, this.currentDay)
        }

        while (this.currentHour < 0) {
            this.currentHour += 24
            this.currentDay = Math.max(1, this.currentDay - 1)
        }

        this.checkPhaseAndTick()
    }

    private checkPhaseAndTick(): void {
        const newPhase = this.calculatePhase()
        const hasPhaseChanged = newPhase !== this.currentPhase
        if (hasPhaseChanged) {
            this.currentPhase = newPhase
            this.app.fire(TimeEvent.PHASE_CHANGED, this.currentPhase)
        }

        this.app.fire(TimeEvent.TICK, this.getTimeData())
    }

    private calculatePhase(): DayPhaseType {
        const isDawn = this.currentHour >= 5 && this.currentHour < 7
        if (isDawn) {
            return DayPhase.DAWN
        }

        const isDay = this.currentHour >= 7 && this.currentHour < 17
        if (isDay) {
            return DayPhase.DAY
        }

        const isDusk = this.currentHour >= 17 && this.currentHour < 19
        if (isDusk) {
            return DayPhase.DUSK
        }

        return DayPhase.NIGHT
    }

    public getTimeData(): TimeData {
        const hour = Math.floor(this.currentHour)
        const minute = Math.floor((this.currentHour % 1) * 60)

        return {
            hour,
            minute,
            day: this.currentDay,
            phase: this.currentPhase,
            normalized: this.currentHour / 24,
            isPaused: this.isPaused,
            timeScale: this.timeScale
        }
    }
}
