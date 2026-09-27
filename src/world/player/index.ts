import type { ContainerResource, Texture } from 'playcanvas'
import { Color, Entity, StandardMaterial, Vec3 } from 'playcanvas'

import { PlayerEvent } from '../../core/enums/player-enums'
import type { Game } from '../../core/game'

import { PlayerAnimator } from './animator'
import { PlayerAudio } from './audio'
import { PlayerController } from './controller'
import { PlayerLifeSupport } from './life-support'
import { PlayerRagdoll } from './ragdoll'

export default class Player extends Entity {
    public audio: PlayerAudio
    public animator: PlayerAnimator
    public controller: PlayerController
    public lifeSupport: PlayerLifeSupport
    public ragdoll: PlayerRagdoll
    private static readonly MODEL_URL = '/models/astronaut/astronaut.glb'
    private static readonly TEXTURE_URL = '/models/astronaut/Astronaut_BaseColor.png'
    private static readonly SCALE = 45
    private appInstance: Game
    private modelEntity: Entity | null = null
    private baseTexture: Texture | null = null

    constructor(app: Game) {
        super('Player', app)
        this.appInstance = app
        app.root.addChild(this)

        this.audio = new PlayerAudio(app)
        this.animator = new PlayerAnimator(app)
        this.controller = new PlayerController(this, app)
        this.lifeSupport = new PlayerLifeSupport(app)
        this.ragdoll = new PlayerRagdoll(this)

        this.build()
    }

    public get facingDirection(): Vec3 {
        const yawRad = (this.controller.yaw * Math.PI) / 180
        return new Vec3(-Math.sin(yawRad), 0, -Math.cos(yawRad))
    }

    private build(): void {
        this.setPosition(0, 1.5, 0)

        this.addComponent('collision', {
            type: 'capsule',
            radius: 0.35,
            height: 1.8,
            axis: 1
        })

        this.addComponent('rigidbody', {
            type: 'dynamic',
            mass: 80,
            linearDamping: 0.05,
            angularDamping: 0.1,
            friction: 0.0,
            rollingFriction: 0.0,
            restitution: 0.0
        })

        const hasRigidBody = Boolean(this.rigidbody)
        if (hasRigidBody) {
            this.rigidbody!.angularFactor = new Vec3(0, 0, 0)
        }

        this.loadAstronaut()
    }

    private loadAstronaut(): void {
        const textureUrl = Player.TEXTURE_URL
        const modelUrl = Player.MODEL_URL

        this.appInstance.assets.loadFromUrl(textureUrl, 'texture', (err, asset) => {
            const isLoaded = !err && Boolean(asset?.resource)
            if (isLoaded) {
                this.baseTexture = asset!.resource as Texture
                const hasModelEntity = Boolean(this.modelEntity)
                if (hasModelEntity) {
                    this.applyMaterialToEntity(this.modelEntity!, this.baseTexture)
                }
            }
        })

        this.appInstance.assets.loadFromUrl(modelUrl, 'container', (err, asset) => {
            const hasFailed = Boolean(err || !asset?.resource)
            if (hasFailed) {
                return
            }

            this.setupAstronautModel(asset!.resource as ContainerResource)
        })
    }

    private setupAstronautModel(container: ContainerResource): void {
        const entity = container.instantiateModelEntity()
        const hasNoEntity = !entity
        if (hasNoEntity) {
            return
        }

        this.modelEntity = entity

        const uniformScale = Player.SCALE
        entity.setLocalScale(uniformScale, uniformScale, uniformScale)
        entity.setLocalPosition(0, -0.9, 0)
        entity.setLocalEulerAngles(0, 180, 0)

        const hasBaseTexture = Boolean(this.baseTexture)
        if (hasBaseTexture) {
            this.applyMaterialToEntity(entity, this.baseTexture!)
        }

        this.animator.initModelAnimations(entity, container)
        this.addChild(entity)

        this.appInstance.fire(PlayerEvent.READY, this)
    }

    private applyMaterialToEntity(entity: Entity, texture: Texture): void {
        const mat = new StandardMaterial()
        mat.diffuseMap = texture
        mat.diffuse = new Color(1, 1, 1)
        mat.gloss = 0.35
        mat.metalness = 0.15
        mat.useMetalness = true
        mat.update()

        entity.forEach((node) => {
            if (!(node instanceof Entity)) {
                return
            }

            const model = node.model
            const hasModel = Boolean(model)
            if (hasModel && model) {
                model.material = mat
                model.castShadows = true
                model.receiveShadows = true
                const hasMeshInstances = Boolean(model.meshInstances)
                if (hasMeshInstances && model.meshInstances) {
                    for (const mi of model.meshInstances) {
                        mi.material = mat
                    }
                }
            }

            const render = node.render
            const hasRender = Boolean(render)
            if (hasRender && render) {
                render.material = mat
                render.castShadows = true
                render.receiveShadows = true
                const hasRenderMeshes = Boolean(render.meshInstances)
                if (hasRenderMeshes && render.meshInstances) {
                    for (const mi of render.meshInstances) {
                        mi.material = mat
                    }
                }
            }
        })
    }

    public getModelEntity(): Entity | null {
        return this.modelEntity
    }

    public setFacingYaw(yaw: number): void {
        if (this.modelEntity) {
            this.modelEntity.setLocalEulerAngles(0, yaw + 180, 0)
        }
    }

    public activateRagdoll(): void {
        this.animator.setEnabled(false)
        this.ragdoll.activate()
    }

    public deactivateRagdoll(): void {
        this.ragdoll.deactivate()
        this.animator.setEnabled(true)
        this.animator.playAnimation('Idle')
    }

    public override destroy(): void {
        this.audio.dispose()
        this.animator.dispose()
        this.controller.dispose()
        this.lifeSupport.dispose()
        this.ragdoll.dispose()
        super.destroy()
    }
}
