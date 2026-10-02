import { Vec3 } from 'playcanvas'

import { LifeSupportEvent } from '../../core/enums/life-support-enums'
import { PlayerAnimationState, PlayerEvent } from '../../core/enums/player-enums'
import type { Game } from '../../core/game'
import type { PlayerAnimation } from '../../core/types/player-types'

import type Player from './index'

export class PlayerController {
    private player: Player
    private app: Game

    private speedWalk = 3.2
    private speedRun = 7.0
    private turnSpeed = 15.0
    private jumpForce = 6.8
    private isGrounded = true
    private isGameOver = false

    private activeKeys = new Set<string>()
    private moveDir = new Vec3()
    private currentYaw = 0
    private currentAnimState: PlayerAnimation = PlayerAnimationState.IDLE
    private rayStart = new Vec3()
    private rayEnd = new Vec3()

    public get yaw(): number {
        return this.currentYaw
    }

    constructor(player: Player, app: Game) {
        this.player = player
        this.app = app

        const opts = app.gameOptions.movement
        this.speedWalk = opts.speedWalk
        this.speedRun = opts.speedRun
        this.turnSpeed = opts.turnSpeed
        this.jumpForce = opts.jumpForce

        this.onKeyDown = this.onKeyDown.bind(this)
        this.onKeyUp = this.onKeyUp.bind(this)
        this.onBlur = this.onBlur.bind(this)
        this.onGameOver = this.onGameOver.bind(this)
        this.onRespawn = this.onRespawn.bind(this)
        this.update = this.update.bind(this)

        window.addEventListener('keydown', this.onKeyDown)
        window.addEventListener('keyup', this.onKeyUp)
        window.addEventListener('blur', this.onBlur)

        this.app.on(LifeSupportEvent.GAME_OVER, this.onGameOver, this)
        this.app.on(LifeSupportEvent.RESPAWN, this.onRespawn, this)
        this.app.on('update', this.update, this)
    }

    public dispose(): void {
        window.removeEventListener('keydown', this.onKeyDown)
        window.removeEventListener('keyup', this.onKeyUp)
        window.removeEventListener('blur', this.onBlur)

        this.app.off(LifeSupportEvent.GAME_OVER, this.onGameOver, this)
        this.app.off(LifeSupportEvent.RESPAWN, this.onRespawn, this)
        this.app.off('update', this.update, this)
    }

    private onGameOver(): void {
        this.isGameOver = true
        this.activeKeys.clear()
        this.player.activateRagdoll()
        this.setAnimation(PlayerAnimationState.IDLE)
    }

    private onRespawn(): void {
        this.isGameOver = false
        this.activeKeys.clear()
        this.isGrounded = true
        this.player.deactivateRagdoll()

        const terrain = this.app.terrainEntity
        const groundY = terrain ? terrain.getHeightAt(0, 0) : 0
        const spawnY = groundY + 1.2

        const hasRigidBody = Boolean(this.player.rigidbody)
        if (hasRigidBody) {
            this.player.rigidbody!.teleport(0, spawnY, 0, 0, 0, 0)
            this.player.rigidbody!.linearVelocity = Vec3.ZERO
            this.player.rigidbody!.angularVelocity = Vec3.ZERO
            this.player.rigidbody!.activate()
        }

        this.setAnimation(PlayerAnimationState.IDLE)
    }

    private onBlur(): void {
        this.activeKeys.clear()
    }

    private onKeyDown(e: KeyboardEvent): void {
        if (this.isGameOver) {
            return
        }

        this.activeKeys.add(e.code)

        const canJump = e.code === 'Space' && this.isGrounded && Boolean(this.player.rigidbody)
        if (canJump) {
            const vel = this.player.rigidbody!.linearVelocity
            this.player.rigidbody!.linearVelocity = new Vec3(vel.x, this.jumpForce, vel.z)
            this.player.rigidbody!.activate()
            this.isGrounded = false
            this.setAnimation(PlayerAnimationState.JUMP)
        }
    }

    private onKeyUp(e: KeyboardEvent): void {
        this.activeKeys.delete(e.code)
    }

    private setAnimation(state: PlayerAnimation): void {
        const isSameState = this.currentAnimState === state
        if (isSameState) {
            return
        }

        this.currentAnimState = state
        this.app.fire(PlayerEvent.ANIMATION_CHANGED, state)
    }

    private determineAnimation(isMoving: boolean, isRunning: boolean): PlayerAnimation {
        if (!this.isGrounded) {
            return PlayerAnimationState.JUMP
        }

        const isSprinting = isMoving && isRunning
        if (isSprinting) {
            return PlayerAnimationState.RUN
        }

        if (isMoving) {
            return PlayerAnimationState.WALK
        }

        return PlayerAnimationState.IDLE
    }

    public update(dt: number): void {
        const isRagdollActive = this.player.ragdoll?.isActive ?? false
        const terrain = this.app.terrainEntity

        if (isRagdollActive) {
            if (terrain) {
                const pos = this.player.getPosition()
                const groundY = terrain.getHeightAt(pos.x, pos.z)
                const floorY = groundY + 0.4
                if (pos.y < floorY) {
                    this.player.setPosition(pos.x, floorY, pos.z)
                    if (this.player.rigidbody) {
                        this.player.rigidbody.teleport(pos.x, floorY, pos.z)
                        const v = this.player.rigidbody.linearVelocity
                        this.player.rigidbody.linearVelocity = new Vec3(v.x * 0.9, Math.max(0, v.y), v.z * 0.9)
                    }
                }
            }

            this.setAnimation(PlayerAnimationState.IDLE)
            this.app.fire(PlayerEvent.STATE_CHANGED, {
                isMoving: false,
                isRunning: false,
                isGrounded: this.isGrounded,
                speed: 0
            })
            return
        }

        if (this.isGameOver) {
            this.app.fire(PlayerEvent.STATE_CHANGED, {
                isMoving: false,
                isRunning: false,
                isGrounded: this.isGrounded,
                speed: 0
            })
            return
        }

        const pos = this.player.getPosition()
        const isFallingInVoid = pos.y < -55
        if (isFallingInVoid) {
            this.onRespawn()
            return
        }

        let grounded = false

        if (terrain) {
            const hCenter = terrain.getHeightAt(pos.x, pos.z, pos.y)
            const r = 0.28
            const d = 0.198 // r * cos(45 deg)

            const samples = [
                terrain.getHeightAt(pos.x + r, pos.z, pos.y),
                terrain.getHeightAt(pos.x - r, pos.z, pos.y),
                terrain.getHeightAt(pos.x, pos.z + r, pos.y),
                terrain.getHeightAt(pos.x, pos.z - r, pos.y),
                terrain.getHeightAt(pos.x + d, pos.z + d, pos.y),
                terrain.getHeightAt(pos.x - d, pos.z + d, pos.y),
                terrain.getHeightAt(pos.x + d, pos.z - d, pos.y),
                terrain.getHeightAt(pos.x - d, pos.z - d, pos.y)
            ]

            let groundY = hCenter
            for (const h of samples) {
                if (h > groundY && h - hCenter <= 0.60) {
                    groundY = h
                }
            }

            const floorY = groundY + 0.9
            const distToGround = pos.y - floorY

            // 1) Corrige penetrações de solo em planos, declives e bordas de crateras
            if (distToGround <= 0.08) {
                grounded = true
                if (distToGround < 0) {
                    this.player.setPosition(pos.x, floorY, pos.z)
                    if (this.player.rigidbody) {
                        this.player.rigidbody.teleport(pos.x, floorY, pos.z)
                        const vel = this.player.rigidbody.linearVelocity
                        this.player.rigidbody.linearVelocity = new Vec3(vel.x, Math.max(0, vel.y), vel.z)
                    }
                }
            } else if (this.isGrounded && distToGround <= 0.35 && !this.activeKeys.has('Space')) {
                // Suaviza descidas de declive mantendo contato com o chão sem oscilar
                grounded = true
                this.player.setPosition(pos.x, floorY, pos.z)
                if (this.player.rigidbody) {
                    this.player.rigidbody.teleport(pos.x, floorY, pos.z)
                    const vel = this.player.rigidbody.linearVelocity
                    this.player.rigidbody.linearVelocity = new Vec3(vel.x, 0, vel.z)
                }
            }
        }

        if (!grounded) {
            this.rayStart.set(pos.x, pos.y - 0.7, pos.z)
            this.rayEnd.set(pos.x, pos.y - 1.15, pos.z)
            const hits = this.app.systems.rigidbody?.raycastAll(this.rayStart, this.rayEnd)
            if (hits && hits.length > 0) {
                for (const h of hits) {
                    if (h.entity !== this.player) {
                        grounded = true
                        break
                    }
                }
            }
        }

        this.isGrounded = grounded

        const moveForward = this.activeKeys.has('KeyW')
        const moveBackward = this.activeKeys.has('KeyS')
        const moveLeft = this.activeKeys.has('KeyA')
        const moveRight = this.activeKeys.has('KeyD')
        const hasShiftKey = this.activeKeys.has('ShiftLeft') || this.activeKeys.has('ShiftRight')
        const hasDirectionalInput = moveForward || moveBackward || moveLeft || moveRight
        const isRunning = hasShiftKey && hasDirectionalInput

        const forwardInput = (moveForward ? 1 : 0) - (moveBackward ? 1 : 0)
        const sideInput = (moveRight ? 1 : 0) - (moveLeft ? 1 : 0)
        const isMoving = forwardInput !== 0 || sideInput !== 0
        const currentSpeed = isMoving ? (isRunning ? this.speedRun : this.speedWalk) : 0

        if (isMoving) {
            const camera = this.app.cameraEntity
            const camForward = camera.forwardHorizontal
            const camRight = camera.rightHorizontal

            this.moveDir.set(
                camForward.x * forwardInput + camRight.x * sideInput,
                0,
                camForward.z * forwardInput + camRight.z * sideInput
            )

            const hasDirectionMagnitude = this.moveDir.lengthSq() > 0.0001
            if (hasDirectionMagnitude) {
                this.moveDir.normalize()

                const targetYaw = Math.atan2(-this.moveDir.x, -this.moveDir.z) * (180 / Math.PI)
                const deltaYaw = ((targetYaw - this.currentYaw + 540) % 360) - 180
                this.currentYaw += deltaYaw * Math.min(1, dt * this.turnSpeed)
                this.currentYaw = ((this.currentYaw + 540) % 360) - 180

                this.player.setFacingYaw(this.currentYaw)
            }
        }

        const isCarving = this.activeKeys.has('KeyC') || this.activeKeys.has('c')
        if (isCarving && terrain) {
            const currentPos = this.player.getPosition()
            const rad = (this.currentYaw * Math.PI) / 180
            const fwdX = -Math.sin(rad)
            const fwdZ = -Math.cos(rad)

            const dist = 2.4
            const cutX = currentPos.x + fwdX * dist
            const cutZ = currentPos.z + fwdZ * dist
            const cutY = currentPos.y - 0.4

            terrain.carve(new Vec3(cutX, cutY, cutZ), 2.4, 0.4)
        }

        const hasRigidBody = Boolean(this.player.rigidbody)
        if (hasRigidBody) {
            const rawVy = this.player.rigidbody!.linearVelocity.y
            let vy = this.isGrounded ? Math.max(0, rawVy) : rawVy

            // Teto de cavernas: se a cabeça colidir com o teto enquanto sobe, cancela o salto
            if (terrain && rawVy > 0) {
                const headDensity = terrain.getDensityAt(pos.x, pos.y + 0.95, pos.z)
                if (headDensity <= 0) {
                    vy = -0.5
                }
            }

            let vx = isMoving ? this.moveDir.x * currentSpeed : 0
            let vz = isMoving ? this.moveDir.z * currentSpeed : 0

            // Paredes e encostas íngremes: impede atravessar rocha sólida horizontalmente
            if (isMoving && terrain) {
                const wallCheckDist = 0.38
                const targetX = pos.x + this.moveDir.x * wallCheckDist
                const targetZ = pos.z + this.moveDir.z * wallCheckDist

                const dLow = terrain.getDensityAt(targetX, pos.y - 0.45, targetZ)
                const dMid = terrain.getDensityAt(targetX, pos.y, targetZ)
                const dHigh = terrain.getDensityAt(targetX, pos.y + 0.45, targetZ)

                const isBlocked = dMid <= 0 || dHigh <= 0 || (dLow <= 0 && terrain.getHeightAt(targetX, targetZ, pos.y) - (pos.y - 0.9) > 0.55)

                if (isBlocked) {
                    const blockX = terrain.getDensityAt(targetX, pos.y, pos.z) <= 0 ||
                                  (terrain.getHeightAt(targetX, pos.z, pos.y) - (pos.y - 0.9) > 0.55)
                    const blockZ = terrain.getDensityAt(pos.x, pos.y, targetZ) <= 0 ||
                                  (terrain.getHeightAt(pos.x, targetZ, pos.y) - (pos.y - 0.9) > 0.55)

                    if (blockX && blockZ) {
                        vx = 0
                        vz = 0
                    } else if (blockX) {
                        vx = 0
                    } else if (blockZ) {
                        vz = 0
                    }
                }
            }

            this.player.rigidbody!.linearVelocity = new Vec3(vx, vy, vz)
            this.player.rigidbody!.activate()
        }

        this.setAnimation(this.determineAnimation(isMoving, isRunning))

        this.app.fire(PlayerEvent.STATE_CHANGED, {
            isMoving,
            isRunning,
            isGrounded: this.isGrounded,
            speed: currentSpeed
        })
    }
}
