export const PlayerEvent = {
    ANIMATION_CHANGED: 'player:anim-changed',
    STATE_CHANGED: 'player:state-changed',
    READY: 'player:ready'
} as const

export const PlayerAnimationState = {
    IDLE: 'Idle',
    WALK: 'Walk',
    RUN: 'Run',
    JUMP: 'Jump'
} as const
