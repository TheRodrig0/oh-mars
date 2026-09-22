import { GameSystem } from "./game-system"
import {
    TimeEvent,
    DayPhase
} from "../core/enums/time-system-enums"
import type { DayPhase as DayPhaseType, TimeData } from "../core/types/time-system-types"

export default class TimeSystem extends GameSystem {
    public currentHour: number = 12.0
    public currentDay: number = 1
    public dayDurationMinutes: number = 1
    public timeScale: number = 1.0
    public isPaused: boolean = false

    private currentPhase: DayPhaseType = DayPhase.DAY

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
        if (this.isPaused) {
            return
        }

        const hoursPerSecond = (24 / (this.dayDurationMinutes * 60)) * this.timeScale
        this.advanceHours(delta * hoursPerSecond)
    }

    public pause(): void {
        if (this.isPaused) {
            return
        }

        this.isPaused = true
        this.app.fire(TimeEvent.PAUSE_CHANGED, true)
        this.app.fire(TimeEvent.TICK, this.getTimeData())
    }

    public resume(): void {
        if (!this.isPaused) {
            return
        }

        this.isPaused = false
        this.app.fire(TimeEvent.PAUSE_CHANGED, false)
        this.app.fire(TimeEvent.TICK, this.getTimeData())
    }

    public togglePause(): void {
        if (this.isPaused) {
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
        if (newPhase !== this.currentPhase) {
            this.currentPhase = newPhase
            this.app.fire(TimeEvent.PHASE_CHANGED, this.currentPhase)
        }

        this.app.fire(TimeEvent.TICK, this.getTimeData())
    }

    private calculatePhase(): DayPhaseType {
        if (this.currentHour >= 5 && this.currentHour < 7) return DayPhase.DAWN
        if (this.currentHour >= 7 && this.currentHour < 17) return DayPhase.DAY
        if (this.currentHour >= 17 && this.currentHour < 19) return DayPhase.DUSK
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
