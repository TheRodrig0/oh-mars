import type { AppBase, Asset, ContainerResource, MeshInstance, Texture } from 'playcanvas'
import { Animation as PcAnimation, AnimTrack, Color, Entity, StandardMaterial } from 'playcanvas'

export default class Player extends Entity {
    private appInstance: AppBase
    private modelEntity: Entity | null = null
    private baseTexture: Texture | null = null
    private animClips: Record<string, string> = {}
    private currentAnimState: 'Idle' | 'Walk' | 'Run' | 'Jump' = 'Idle'

    constructor(app: AppBase) {
        super('Player', app)
        this.appInstance = app

        this.build()
        app.root.addChild(this)
    }

    private build(): void {
        this.setPosition(0, 0, 0)
        this.loadAstronaut()
    }

    private loadAstronaut(): void {
        this.appInstance.assets.loadFromUrl(
            '/models/astronaut/Astronaut_BaseColor.png',
            'texture',
            (err, asset) => {
                if (!err && asset?.resource) {
                    this.baseTexture = asset.resource as Texture
                    if (this.modelEntity) {
                        this.applyMaterialToEntity(this.modelEntity, this.baseTexture)
                    }
                }
            }
        )

        this.appInstance.assets.loadFromUrl(
            '/models/astronaut/astronaut.glb',
            'container',
            (err, asset) => {
                if (err || !asset?.resource) {
                    console.error('Erro ao carregar modelo do astronauta:', err)
                    return
                }

                this.setupAstronautModel(asset.resource as ContainerResource)
            }
        )
    }

    private setupAstronautModel(container: ContainerResource): void {
        const entity = container.instantiateModelEntity()
        if (!entity) {
            return
        }

        this.modelEntity = entity

        const uniformScale = 45
        entity.setLocalScale(uniformScale, uniformScale, uniformScale)
        entity.setLocalPosition(0, 0, 0)
        entity.setLocalEulerAngles(0, 180, 0)

        if (this.baseTexture) {
            this.applyMaterialToEntity(entity, this.baseTexture)
        }

        this.setupAnimations(entity, container)
        this.addChild(entity)
    }

    private applyMaterialToEntity(entity: Entity, texture: Texture): void {
        const mat = new StandardMaterial()
        mat.diffuseMap = texture
        mat.diffuse = new Color(1, 1, 1)
        mat.gloss = 0.35
        mat.metalness = 0.15
        mat.useMetalness = true
        mat.update()

        if (entity.model?.meshInstances) {
            entity.model.meshInstances.forEach((mi: MeshInstance) => {
                mi.material = mat
                mi.castShadow = true
                mi.receiveShadow = true
            })
            entity.model.castShadows = true
            entity.model.receiveShadows = true
        }
    }

    private stripRootMotion(animAsset: Asset, isJumpAnimation: boolean): void {
        const resource = animAsset.resource
        if (!resource) {
            return
        }

        if (resource instanceof AnimTrack && resource.curves) {
            for (const curve of resource.curves) {
                const targetsHipsPosition = curve.paths.some((path) => {
                    const isTranslation = path.propertyPath?.[0] === 'localPosition'
                    const isHipsBone = path.entityPath.some((nodeName) => nodeName.toLowerCase().includes('hips'))
                    return isTranslation && isHipsBone
                })

                if (!targetsHipsPosition) {
                    continue
                }

                const trackOutput = resource.outputs[curve.output]
                if (!trackOutput || trackOutput.components !== 3) {
                    continue
                }

                const keyframePositions = trackOutput.data
                const initialX = keyframePositions[0]
                const initialForwardY = keyframePositions[1]
                const initialHeightZ = keyframePositions[2]

                for (let i = 0; i < keyframePositions.length; i += 3) {
                    keyframePositions[i] = initialX
                    keyframePositions[i + 1] = initialForwardY
                    if (isJumpAnimation) {
                        keyframePositions[i + 2] = initialHeightZ
                    }
                }
            }
            return
        }

        if (resource instanceof PcAnimation && resource.nodes) {
            const hipsNode = resource.getNode('mixamorig:Hips') ??
                resource.nodes.find((node) => node._name?.toLowerCase().includes('hips'))

            if (!hipsNode?._keys?.length) {
                return
            }

            const initialPosition = hipsNode._keys[0].position
            if (!initialPosition) {
                return
            }

            for (const keyframe of hipsNode._keys) {
                if (!keyframe.position) {
                    continue
                }

                keyframe.position.x = initialPosition.x
                keyframe.position.y = initialPosition.y
                if (isJumpAnimation) {
                    keyframe.position.z = initialPosition.z
                }
            }
        }
    }

    private setupAnimations(entity: Entity, container: ContainerResource): void {
        const animAssets = (container.animations || []) as Asset[]
        if (animAssets.length === 0) {
            return
        }

        const idleAsset = animAssets.find((a) => a.name.includes('Layer0') && !a.name.includes('.')) || animAssets[0]
        const walkAsset = animAssets.find((a) => a.name.includes('Layer0.002')) || animAssets[2] || idleAsset
        const runAsset = animAssets.find((a) => a.name.includes('Layer0.001')) || animAssets[1] || walkAsset
        const jumpAsset = animAssets.find((a) => a.name.includes('Layer0.003')) || animAssets[3] || idleAsset

        this.animClips = {
            Idle: idleAsset.name,
            Walk: walkAsset.name,
            Run: runAsset.name,
            Jump: jumpAsset.name
        }

        animAssets.forEach((asset) => {
            this.stripRootMotion(asset, asset === jumpAsset || asset.name.includes('003'))
        })

        entity.addComponent('animation', {
            assets: animAssets,
            speed: 1.0,
            loop: true,
            activate: true
        })

        entity.animation?.play(this.animClips.Idle, 0.2)
    }

    public playAnimation(stateName: 'Idle' | 'Walk' | 'Run' | 'Jump'): void {
        if (this.currentAnimState === stateName) {
            return
        }
        this.currentAnimState = stateName

        const clipName = this.animClips[stateName]
        if (this.modelEntity?.animation && clipName) {
            this.modelEntity.animation.loop = stateName !== 'Jump'
            this.modelEntity.animation.play(clipName, 0.2)
        }
    }
}

