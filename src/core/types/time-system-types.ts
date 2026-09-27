import type { TimeEvent, DayPhase } from '../enums/time-system-enums'

export type TimeEvent = (typeof TimeEvent)[keyof typeof TimeEvent]

export type DayPhase = (typeof DayPhase)[keyof typeof DayPhase]

export type TimeData = {
    hour: number
    minute: number
    day: number
    phase: DayPhase
    normalized: number
    isPaused: boolean
    timeScale: number
}
