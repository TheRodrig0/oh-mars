import { Color, Entity, TONEMAP_ACES, Vec3 } from 'playcanvas'

import { LifeSupportEvent } from './enums/life-support-enums'
import type { Game } from './game'

export default class Camera extends Entity {
    private appInstance: Game
    private target: Entity | null = null

    public distance = 6.0
    public minDistance = 2.5
    public maxDistance = 14.0

    public yaw = 0
    public pitch = 18
    public minPitch = -35
    public maxPitch = 75
    public minHeightAboveGround = 0.4

    public sensitivity = 0.22
    public isDragging = false

    public keyTurnSpeed = 95.0
    public keyPitchSpeed = 65.0
    private activeArrowKeys = new Set<string>()

    private prevMouseX = 0
    private prevMouseY = 0

    public targetOffsetY = 0.6
    private focusPoint: Vec3 = new Vec3(0, 1.5, 0)
    private desiredFocus: Vec3 = new Vec3()

    public forwardHorizontal: Vec3 = new Vec3(0, 0, -1)
    public rightHorizontal: Vec3 = new Vec3(1, 0, 0)

    private rayStart: Vec3 = new Vec3()
    private rayEnd: Vec3 = new Vec3()

    private isTargetEntity(entity: Entity | null | undefined): boolean {
        if (!entity || !this.target) return false
        if (entity === this.target) return true
        let curr = entity.parent
        while (curr) {
            if (curr === this.target) return true
            curr = curr.parent
        }
        return false
    }



    constructor(app: Game) {
        super('MainCamera', app)
        this.appInstance = app

        const opts = app.gameOptions.camera
        this.distance = opts.distance
        this.minDistance = opts.minDistance
        this.maxDistance = opts.maxDistance
        this.pitch = opts.pitch
        this.yaw = opts.yaw
        this.minPitch = opts.minPitch ?? -35
        this.maxPitch = opts.maxPitch ?? 75
        this.minHeightAboveGround = opts.minHeightAboveGround
        this.sensitivity = opts.sensitivity
        this.keyTurnSpeed = opts.keyTurnSpeed
        this.keyPitchSpeed = opts.keyPitchSpeed

        this.onMouseDown = this.onMouseDown.bind(this)
        this.onMouseUp = this.onMouseUp.bind(this)
        this.onMouseMove = this.onMouseMove.bind(this)
        this.onWheel = this.onWheel.bind(this)
        this.onKeyDown = this.onKeyDown.bind(this)
        this.onKeyUp = this.onKeyUp.bind(this)
        this.onBlur = this.onBlur.bind(this)
        this.onGameOver = this.onGameOver.bind(this)
        this.onRespawn = this.onRespawn.bind(this)

        this.build()
        this.setupEvents()

        app.root.addChild(this)
    }

    private build(): void {
        this.addComponent('camera', {
            clearColor: new Color(0.85, 0.32, 0.20),
            nearClip: 0.04,
            farClip: 1200,
            fov: 50,
            toneMapping: TONEMAP_ACES
        })

        this.updateCameraVectors()
        this.appInstance.on('update', this.onPostUpdate, this)
    }

    private setupEvents(): void {
        const canvas = this.appInstance.graphicsDevice.canvas
        canvas.addEventListener('mousedown', this.onMouseDown)
        window.addEventListener('mouseup', this.onMouseUp)
        window.addEventListener('mousemove', this.onMouseMove)
        canvas.addEventListener('wheel', this.onWheel, { passive: true })
        window.addEventListener('keydown', this.onKeyDown)
        window.addEventListener('keyup', this.onKeyUp)
        window.addEventListener('blur', this.onBlur)

        this.appInstance.on(LifeSupportEvent.GAME_OVER, this.onGameOver, this)
        this.appInstance.on(LifeSupportEvent.RESPAWN, this.onRespawn, this)
    }

    private onGameOver(): void {
        this.targetOffsetY = 0.3
    }

    private onRespawn(): void {
        this.targetOffsetY = 0.6
        this.pitch = this.appInstance.gameOptions.camera.pitch
    }

    private onKeyDown(event: KeyboardEvent): void {
        const code = event.code.toLowerCase()
        const key = event.key.toLowerCase()

        if (
            code === 'arrowup' ||
            code === 'arrowdown' ||
            code === 'arrowleft' ||
            code === 'arrowright' ||
            key === 'arrowup' ||
            key === 'arrowdown' ||
            key === 'arrowleft' ||
            key === 'arrowright'
        ) {
            this.activeArrowKeys.add(code || key)
            event.preventDefault()
        }
    }

    private onKeyUp(event: KeyboardEvent): void {
        const code = event.code.toLowerCase()
        const key = event.key.toLowerCase()
        this.activeArrowKeys.delete(code)
        this.activeArrowKeys.delete(key)
    }

    private onBlur(): void {
        this.activeArrowKeys.clear()
    }

    public setTarget(target: Entity | null): void {
        this.target = target
        if (target) {
            const targetPos = target.getPosition()
            this.focusPoint.set(targetPos.x, targetPos.y + 1.5, targetPos.z)
            this.updateCameraTransform()
        }
    }

    private onMouseDown(event: MouseEvent): void {
        if (event.button === 0 || event.button === 2) {
            this.isDragging = true
        }

        this.prevMouseX = event.clientX
        this.prevMouseY = event.clientY

        const canvas = this.appInstance.graphicsDevice.canvas
        if (event.button === 0 && document.pointerLockElement !== canvas) {
            try {
                canvas.requestPointerLock()
            } catch {
                // Ignore pointer lock request failures
            }
        }
    }

    private onMouseUp(): void {
        this.isDragging = false
    }

    private onMouseMove(event: MouseEvent): void {
        const canvas = this.appInstance.graphicsDevice.canvas
        const isLocked = document.pointerLockElement === canvas

        if (!isLocked && !this.isDragging) {
            return
        }

        let deltaX = 0
        let deltaY = 0

        if (typeof event.movementX === 'number' && typeof event.movementY === 'number') {
            deltaX = event.movementX
            deltaY = event.movementY
        } else {
            deltaX = event.clientX - this.prevMouseX
            deltaY = event.clientY - this.prevMouseY
        }

        this.prevMouseX = event.clientX
        this.prevMouseY = event.clientY

        this.yaw -= deltaX * this.sensitivity
        this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch - deltaY * this.sensitivity))

        this.updateCameraVectors()
    }

    private onWheel(event: WheelEvent): void {
        this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance + event.deltaY * 0.005))
    }

    public getMinPitch(): number {
        return this.minPitch
    }

    private updateCameraVectors(): void {
        const radYaw = (this.yaw * Math.PI) / 180
        this.forwardHorizontal.set(-Math.sin(radYaw), 0, -Math.cos(radYaw)).normalize()
        this.rightHorizontal.set(Math.cos(radYaw), 0, -Math.sin(radYaw)).normalize()
    }

    private findSafeCameraDistance(dirX: number, dirY: number, dirZ: number, maxDist: number): number {
        const terrain = this.appInstance.terrainEntity
        let safeDist = maxDist

        // 1. Raycast contra entidades e obstáculos com RigidBody
        this.rayStart.copy(this.focusPoint)
        this.rayEnd.set(
            this.focusPoint.x + dirX * maxDist,
            this.focusPoint.y + dirY * maxDist,
            this.focusPoint.z + dirZ * maxDist
        )

        const hits = this.appInstance.systems.rigidbody?.raycastAll(this.rayStart, this.rayEnd)
        if (hits && hits.length > 0) {
            let closestDistSq = Infinity
            for (const hit of hits) {
                if (!this.isTargetEntity(hit.entity)) {
                    const dx = hit.point.x - this.focusPoint.x
                    const dy = hit.point.y - this.focusPoint.y
                    const dz = hit.point.z - this.focusPoint.z
                    const distSq = dx * dx + dy * dy + dz * dz
                    if (distSq < closestDistSq) {
                        closestDistSq = distSq
                    }
                }
            }
            if (closestDistSq !== Infinity) {
                const dist = Math.sqrt(closestDistSq)
                safeDist = Math.min(safeDist, Math.max(0.35, dist - 0.40))
            }
        }

        // 2. Colisão volumétrica contínua com o terreno 3D (Marching Cubes)
        if (terrain) {
            const step = 0.12
            const minCheckDist = 0.15
            let hitT = -1

            for (let t = minCheckDist; t <= safeDist; t += step) {
                const px = this.focusPoint.x + dirX * t
                const py = this.focusPoint.y + dirY * t
                const pz = this.focusPoint.z + dirZ * t

                if (terrain.getDensityAt(px, py, pz) <= 0) {
                    hitT = t
                    break
                }
            }

            if (hitT !== -1) {
                let low = Math.max(0, hitT - step)
                let high = hitT
                for (let iter = 0; iter < 4; iter++) {
                    const mid = (low + high) * 0.5
                    const px = this.focusPoint.x + dirX * mid
                    const py = this.focusPoint.y + dirY * mid
                    const pz = this.focusPoint.z + dirZ * mid
                    if (terrain.getDensityAt(px, py, pz) <= 0) {
                        high = mid
                    } else {
                        low = mid
                    }
                }
                const exactHit = (low + high) * 0.5
                safeDist = Math.min(safeDist, Math.max(0.35, exactHit - 0.45))
            }

            // 3. Verificação de desobstrução esférica na posição e lente da câmera
            const clearance = 0.28
            for (let iter = 0; iter < 15 && safeDist > 0.35; iter++) {
                const cx = this.focusPoint.x + dirX * safeDist
                const cy = this.focusPoint.y + dirY * safeDist
                const cz = this.focusPoint.z + dirZ * safeDist

                const dCenter = terrain.getDensityAt(cx, cy, cz)
                const dBelow = terrain.getDensityAt(cx, cy - clearance, cz)
                const dBehind = terrain.getDensityAt(cx + dirX * 0.2, cy + dirY * 0.2, cz + dirZ * 0.2)
                const dAbove = terrain.getDensityAt(cx, cy + clearance, cz)

                if (dCenter > 0.08 && dBelow > 0.02 && dBehind > 0.02 && dAbove > 0.02) {
                    break
                }
                safeDist = Math.max(0.35, safeDist - 0.12)
            }
        }

        return safeDist
    }

    private updateCameraTransform(): void {
        const radYaw = (this.yaw * Math.PI) / 180
        const radPitch = (this.pitch * Math.PI) / 180

        const cosPitch = Math.cos(radPitch)
        const sinPitch = Math.sin(radPitch)
        const cosYaw = Math.cos(radYaw)
        const sinYaw = Math.sin(radYaw)

        const dirX = sinYaw * cosPitch
        const dirY = sinPitch
        const dirZ = cosYaw * cosPitch

        const safeDist = this.findSafeCameraDistance(dirX, dirY, dirZ, this.distance)

        this.setPosition(
            this.focusPoint.x + safeDist * dirX,
            this.focusPoint.y + safeDist * dirY,
            this.focusPoint.z + safeDist * dirZ
        )

        this.lookAt(this.focusPoint)
    }

    private onPostUpdate(dt?: number): void {
        const delta = typeof dt === 'number' && dt > 0 ? dt : 0.016

        if (this.activeArrowKeys.size > 0) {
            if (this.activeArrowKeys.has('arrowleft')) {
                this.yaw += this.keyTurnSpeed * delta
            }
            if (this.activeArrowKeys.has('arrowright')) {
                this.yaw -= this.keyTurnSpeed * delta
            }
            if (this.activeArrowKeys.has('arrowup')) {
                this.pitch = Math.min(this.maxPitch, this.pitch + this.keyPitchSpeed * delta)
            }
            if (this.activeArrowKeys.has('arrowdown')) {
                this.pitch = Math.max(this.minPitch, this.pitch - this.keyPitchSpeed * delta)
            }
        }

        if (!this.target) {
            this.updateCameraVectors()
            this.updateCameraTransform()
            return
        }

        const targetPos = this.target.getPosition()
        this.desiredFocus.set(targetPos.x, targetPos.y + this.targetOffsetY, targetPos.z)
        this.focusPoint.lerp(this.focusPoint, this.desiredFocus, 0.18)

        this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch))

        this.updateCameraVectors()
        this.updateCameraTransform()
    }

    public override destroy(): void {
        const canvas = this.appInstance.graphicsDevice.canvas
        canvas.removeEventListener('mousedown', this.onMouseDown)
        window.removeEventListener('mouseup', this.onMouseUp)
        window.removeEventListener('mousemove', this.onMouseMove)
        canvas.removeEventListener('wheel', this.onWheel)
        window.removeEventListener('keydown', this.onKeyDown)
        window.removeEventListener('keyup', this.onKeyUp)
        window.removeEventListener('blur', this.onBlur)

        this.appInstance.off(LifeSupportEvent.GAME_OVER, this.onGameOver, this)
        this.appInstance.off(LifeSupportEvent.RESPAWN, this.onRespawn, this)
        this.appInstance.off('update', this.onPostUpdate, this)
        super.destroy()
    }
}
