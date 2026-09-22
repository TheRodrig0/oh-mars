export const TimeEvent = {
    TICK: "time:tick",
    PHASE_CHANGED: "time:phase-changed",
    NEW_DAY: "time:new-day",
    PAUSE_CHANGED: "time:pause-changed",
    SCALE_CHANGED: "time:scale-changed"
} as const

export const DayPhase = {
    DAWN: "dawn",
    DAY: "day",
    DUSK: "dusk",
    NIGHT: "night"
} as const
