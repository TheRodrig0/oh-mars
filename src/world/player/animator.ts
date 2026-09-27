import type { Asset, ContainerResource, Entity } from 'playcanvas'
import { Animation as PcAnimation, AnimTrack } from 'playcanvas'

import { PlayerEvent } from '../../core/enums/player-enums'
import type { Game } from '../../core/game'
import type { PlayerAnimation } from '../../core/types/player-types'

export class PlayerAnimator {
    private app: Game
    private modelEntity: Entity | null = null
    private animClips: Record<string, string> = {}
    private currentAnimState: PlayerAnimation = 'Idle'

    constructor(app: Game) {
        this.app = app

        this.onAnimationChanged = this.onAnimationChanged.bind(this)

        this.app.on(PlayerEvent.ANIMATION_CHANGED, this.onAnimationChanged, this)
    }

    public initModelAnimations(entity: Entity, container: ContainerResource): void {
        this.modelEntity = entity

        const animAssets = (container as { animations?: Asset[] }).animations || []
        const hasNoAnimations = animAssets.length === 0
        if (hasNoAnimations) {
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
            const isJump = asset === jumpAsset || asset.name.includes('003')
            this.stripRootMotion(asset, isJump)
        })

        entity.addComponent('animation', {
            assets: animAssets,
            speed: 1.0,
            loop: true,
            activate: true
        })

        entity.animation?.play(this.animClips.Idle, 0.2)
    }

    public setEnabled(enabled: boolean): void {
        const hasAnimationComponent = Boolean(this.modelEntity?.animation)
        if (hasAnimationComponent) {
            this.modelEntity!.animation!.enabled = enabled
        }
    }

    public playAnimation(stateName: PlayerAnimation): void {
        const isAnimationDisabled = Boolean(this.modelEntity?.animation && !this.modelEntity.animation.enabled)
        if (isAnimationDisabled) {
            return
        }

        const isAlreadyPlayingState = this.currentAnimState === stateName
        if (isAlreadyPlayingState) {
            return
        }

        this.currentAnimState = stateName

        const clipName = this.animClips[stateName]
        const canPlayClip = Boolean(this.modelEntity?.animation && clipName)
        if (canPlayClip) {
            this.modelEntity!.animation!.loop = stateName !== 'Jump'
            this.modelEntity!.animation!.play(clipName, 0.2)
        }
    }

    private stripRootMotion(animAsset: Asset, isJumpAnimation: boolean): void {
        const resource = animAsset.resource
        const hasNoResource = !resource
        if (hasNoResource) {
            return
        }

        const isAnimTrackResource = resource instanceof AnimTrack && Boolean(resource.curves)
        if (isAnimTrackResource) {
            const animTrack = resource as AnimTrack
            for (const curve of animTrack.curves) {
                const paths = curve.paths as { propertyPath?: string[]; entityPath?: string[] }[] | undefined
                const targetsHipsPosition = paths?.some((path) => {
                    const isTranslation = path.propertyPath?.[0] === 'localPosition'
                    const isHipsBone = path.entityPath?.some((nodeName: string) =>
                        nodeName.toLowerCase().includes('hips')
                    )
                    return isTranslation && isHipsBone
                })

                if (!targetsHipsPosition) {
                    continue
                }

                const trackOutput = animTrack.outputs[curve.output]
                const isInvalidOutput = !trackOutput || trackOutput.components !== 3
                if (isInvalidOutput) {
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

        const isPcAnimationResource = resource instanceof PcAnimation && Boolean(resource.nodes)
        if (isPcAnimationResource) {
            const pcAnim = resource as PcAnimation
            const hipsNode =
                pcAnim.getNode('mixamorig:Hips') ??
                pcAnim.nodes.find((node) => node._name?.toLowerCase().includes('hips'))

            const hasNoHipsKeys = !hipsNode?._keys?.length
            if (hasNoHipsKeys) {
                return
            }

            const initialPosition = hipsNode._keys[0].position
            const hasNoInitialPosition = !initialPosition
            if (hasNoInitialPosition) {
                return
            }

            for (const keyframe of hipsNode._keys) {
                const hasNoKeyframePosition = !keyframe.position
                if (hasNoKeyframePosition) {
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

    private onAnimationChanged(stateName: PlayerAnimation): void {
        this.playAnimation(stateName)
    }

    public dispose(): void {
        this.app.off(PlayerEvent.ANIMATION_CHANGED, this.onAnimationChanged, this)
    }
}
