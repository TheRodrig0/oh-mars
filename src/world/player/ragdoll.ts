import { Vec3 } from 'playcanvas'

import type Player from './index'

export class PlayerRagdoll {
    private player: Player
    public isActive = false

    constructor(player: Player) {
        this.player = player

        this.onKeyDown = this.onKeyDown.bind(this)

        window.addEventListener('keydown', this.onKeyDown)
    }

    private onKeyDown(e: KeyboardEvent): void {
        const isRepeatKey = e.repeat
        if (isRepeatKey) {
            return
        }

        const isToggleKey = e.code === 'KeyK'
        if (isToggleKey) {
            this.toggle()
        }
    }

    public toggle(): void {
        if (this.isActive) {
            this.player.deactivateRagdoll()
            return
        }

        this.player.activateRagdoll()
    }

    public activate(): void {
        if (this.isActive) {
            return
        }

        this.isActive = true

        const hasRigidBody = Boolean(this.player.rigidbody)
        if (hasRigidBody) {
            this.player.rigidbody!.angularFactor = new Vec3(1, 0.2, 1)
            this.player.rigidbody!.friction = 0.95
            this.player.rigidbody!.rollingFriction = 0.9
            this.player.rigidbody!.angularDamping = 0.85
            this.player.rigidbody!.linearDamping = 0.35

            const fwd = this.player.facingDirection
            this.player.rigidbody!.linearVelocity = new Vec3(fwd.x * 1.5, -0.5, fwd.z * 1.5)

            this.player.rigidbody!.angularVelocity = new Vec3(fwd.z * 3.0, 0, -fwd.x * 3.0)

            this.player.rigidbody!.activate()
        }
    }

    public deactivate(): void {
        const isAlreadyInactive = !this.isActive
        if (isAlreadyInactive) {
            return
        }

        this.isActive = false

        const hasRigidBody = Boolean(this.player.rigidbody)
        if (hasRigidBody) {
            this.player.rigidbody!.angularFactor = new Vec3(0, 0, 0)
            this.player.rigidbody!.friction = 0.0
            this.player.rigidbody!.rollingFriction = 0.0
            this.player.rigidbody!.angularDamping = 0.1
            this.player.rigidbody!.linearDamping = 0.05
            const currentPos = this.player.getPosition()
            this.player.rigidbody!.teleport(currentPos.x, currentPos.y + 0.6, currentPos.z, 0, 0, 0)
            this.player.rigidbody!.linearVelocity = Vec3.ZERO
            this.player.rigidbody!.angularVelocity = Vec3.ZERO
            this.player.rigidbody!.activate()
        }
    }

    public dispose(): void {
        window.removeEventListener('keydown', this.onKeyDown)

        const shouldDeactivate = this.isActive
        if (shouldDeactivate) {
            this.deactivate()
        }
    }
}
