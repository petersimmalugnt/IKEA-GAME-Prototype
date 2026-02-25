import { useEffect } from 'react'
import { CubeElement } from '@/primitives/CubeElement'
import { SphereElement } from '@/primitives/SphereElement'
import { CylinderElement } from '@/primitives/CylinderElement'
import { BlockElement } from '@/primitives/BlockElement'
import { SplineElement } from '@/primitives/SplineElement'
import { TriangleBlockElement } from '@/primitives/TriangleBlockElement'
import { CylinderBlockElement } from '@/primitives/CylinderBlockElement'
import { BallElement } from '@/primitives/BallElement'
import { DomeBlockElement } from '@/primitives/DomeBlockElement'
import { ConeBlockElement } from '@/primitives/ConeBlockElement'
import { StepsBlockElement } from '@/primitives/StepsBlockElement'
import {
  Fracture,
  GridCloner,
  LinearFieldEffector,
  RandomEffector,
  NoiseEffector,
  TimeEffector,
  StepEffector,
} from '@/scene/GridCloner'
import { TransformMotion } from '@/scene/TransformMotion'
import { useLevelStore, type LevelNode } from './levelStore'
import type { Vec3 } from '@/settings/GameSettings'
import { useGameplayStore } from '@/gameplay/gameplayStore'

function toRadians(rotation: Vec3): Vec3 {
  return [
    rotation[0] * (Math.PI / 180),
    rotation[1] * (Math.PI / 180),
    rotation[2] * (Math.PI / 180),
  ]
}

type ComponentRegistryEntry = {
  component: React.ComponentType<any>
  needsRotationConversion: boolean
}

const COMPONENT_REGISTRY: Record<string, ComponentRegistryEntry> = {
  CubeElement: { component: CubeElement, needsRotationConversion: false },
  SphereElement: { component: SphereElement, needsRotationConversion: false },
  CylinderElement: { component: CylinderElement, needsRotationConversion: false },
  BlockElement: { component: BlockElement, needsRotationConversion: false },
  TriangleBlockElement: { component: TriangleBlockElement, needsRotationConversion: false },
  CylinderBlockElement: { component: CylinderBlockElement, needsRotationConversion: false },
  BallElement: { component: BallElement, needsRotationConversion: false },
  DomeBlockElement: { component: DomeBlockElement, needsRotationConversion: false },
  ConeBlockElement: { component: ConeBlockElement, needsRotationConversion: false },
  StepsBlockElement: { component: StepsBlockElement, needsRotationConversion: false },
  SplineElement: { component: SplineElement, needsRotationConversion: false },
}

const EFFECTOR_COMPONENTS: Record<string, React.ComponentType<any>> = {
  LinearFieldEffector,
  RandomEffector,
  NoiseEffector,
  TimeEffector,
  StepEffector,
}

const CONTAGION_CAPABLE_OBJECT_TYPES = new Set([
  'CubeElement',
  'SphereElement',
  'CylinderElement',
  'BlockElement',
  'TriangleBlockElement',
  'CylinderBlockElement',
  'BallElement',
  'DomeBlockElement',
  'ConeBlockElement',
  'StepsBlockElement',
])

function isNodeHiddenInBuilder(node: LevelNode): boolean {
  return Boolean(node.builder?.hiddenInBuilder)
}

function renderObjectNode(
  node: LevelNode,
  asClonerTemplate: boolean,
) {
  const entry = COMPONENT_REGISTRY[node.type]
  if (!entry) {
    console.warn(`Unknown object type: ${node.type} (id: ${node.id})`)
    return null
  }

  const { component: Component, needsRotationConversion } = entry
  const rotation = needsRotationConversion && node.rotation
    ? toRadians(node.rotation)
    : node.rotation
  const nodeProps = (node.props ?? {}) as Record<string, unknown>
  const nextProps: Record<string, unknown> = { ...nodeProps }

  if (!asClonerTemplate) {
    if (CONTAGION_CAPABLE_OBJECT_TYPES.has(node.type)) {
      nextProps.entityId = node.id
      nextProps.contagionCarrier = nodeProps.contagionCarrier === true
      if (nodeProps.contagionInfectable === false) {
        nextProps.contagionInfectable = false
      }
    }
  }

  return (
    <Component
      key={node.id}
      {...nextProps}
      position={node.position}
      rotation={rotation}
    />
  )
}

function renderEffectorNode(node: LevelNode) {
  const Component = EFFECTOR_COMPONENTS[node.type]
  if (!Component) {
    console.warn(`Unknown effector type: ${node.type} (id: ${node.id})`)
    return null
  }
  return <Component key={node.id} {...node.props} />
}

function renderNullNode(
  node: LevelNode,
  asClonerTemplate: boolean,
) {
  const children = (node.children ?? []).filter((child) => child.nodeType === 'object')
  const rotation: Vec3 = node.rotation ? toRadians(node.rotation) : [0, 0, 0]

  return (
    <group
      key={node.id}
      position={node.position}
      rotation={rotation}
    >
      {children.map((child) => renderNode(child, asClonerTemplate))}
    </group>
  )
}

function renderTransformMotionNode(
  node: LevelNode,
  asClonerTemplate: boolean,
) {
  const children = (node.children ?? []).filter((child) => child.nodeType === 'object')
  const rotation: Vec3 = node.rotation ? toRadians(node.rotation) : [0, 0, 0]
  const motionProps = (node.props ?? {}) as Record<string, unknown>

  return (
    <TransformMotion
      key={node.id}
      position={node.position}
      rotation={rotation}
      {...motionProps}
    >
      {children.map((child) => renderNode(child, asClonerTemplate))}
    </TransformMotion>
  )
}

function renderGridClonerNode(node: LevelNode) {
  const children = node.children ?? []
  const { position, rotation, ...restProps } = node.props as Record<string, unknown>

  return (
    <GridCloner
      key={node.id}
      {...restProps}
      position={node.position}
      rotation={node.rotation}
      entityPrefix={node.id}
    >
      {children.map((child) => renderNode(child, true))}
    </GridCloner>
  )
}

function renderFractureNode(node: LevelNode) {
  const children = node.children ?? []
  const { position, rotation, ...restProps } = node.props as Record<string, unknown>

  return (
    <Fracture
      key={node.id}
      {...restProps}
      position={node.position}
      rotation={node.rotation}
    >
      {children.map((child) => renderNode(child, false))}
    </Fracture>
  )
}

export function renderNode(
  node: LevelNode,
  asClonerTemplate = false,
) {
  if (isNodeHiddenInBuilder(node)) {
    return null
  }

  if (node.nodeType === 'effector') {
    return renderEffectorNode(node)
  }

  if (node.type === 'Null') {
    return renderNullNode(node, asClonerTemplate)
  }

  if (node.type === 'TransformMotion') {
    return renderTransformMotionNode(node, asClonerTemplate)
  }

  if (node.type === 'GridCloner') {
    return renderGridClonerNode(node)
  }

  if (node.type === 'Fracture') {
    return renderFractureNode(node)
  }

  return renderObjectNode(node, asClonerTemplate)
}

export function LevelRenderer() {
  const levelData = useLevelStore((state) => state.levelData)
  const levelReloadKey = useLevelStore((state) => state.levelReloadKey)
  const resetGameplay = useGameplayStore((state) => state.reset)

  useEffect(() => {
    resetGameplay()
  }, [levelReloadKey, levelData, resetGameplay])

  if (!levelData) {
    return null
  }

  return (
    <group key={levelReloadKey}>
      {levelData.nodes.map((node) => renderNode(node))}
    </group>
  )
}
