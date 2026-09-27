export const LifeSupportEvent = {
    VITALS_CHANGED: 'life-support:vitals-changed',
    WARNING_TRIGGERED: 'life-support:warning-triggered',
    SUFFOCATION_START: 'life-support:suffocation-start',
    SUFFOCATION_STOP: 'life-support:suffocation-stop',
    GAME_OVER: 'life-support:game-over',
    RESPAWN: 'life-support:respawn',
    REFILL_OXYGEN: 'life-support:refill-oxygen',
    DRINK_WATER: 'life-support:drink-water',
    EAT_FOOD: 'life-support:eat-food',
    REQUEST_VITALS: 'life-support:request-vitals'
} as const
