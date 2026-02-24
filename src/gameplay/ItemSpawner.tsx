import { useEntityStore } from "@/entities/entityStore";
import { isPlaying } from "@/game/gamePhaseStore";
import { useGameplayStore } from "@/gameplay/gameplayStore";
import {
  getItemMotion,
  useSpawnerStore,
  type SpawnedItemDescriptor,
} from "@/gameplay/spawnerStore";
import type { PositionTargetHandle } from "@/scene/PositionTargetHandle";
import {
  getActivePalette,
  resolveMaterialColorIndex,
  SETTINGS,
} from "@/settings/GameSettings";
import { useFrame } from "@react-three/fiber";
import {
  Children,
  cloneElement,
  useCallback,
  useMemo,
  useRef,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from "react";
import * as THREE from "three";

const SPAWN_HEIGHT = 1.3;

function SpawnedItemView({
  item,
  templates,
  onGroupRef,
}: {
  item: SpawnedItemDescriptor;
  templates: ReactElement[];
  onGroupRef: (id: string, group: THREE.Group | null) => void;
}) {
  const template = templates[item.templateIndex % templates.length];

  const refCallback = useCallback(
    (node: THREE.Group | null) => onGroupRef(item.id, node),
    [item.id, onGroupRef],
  );

  const onPopped = useCallback(() => {
    useGameplayStore
      .getState()
      .addScore(SETTINGS.gameplay.balloons.scorePerPop);
    useEntityStore.getState().unregister(item.id);
    useSpawnerStore.getState().removeItem(item.id);
  }, [item.id]);

  return (
    <group ref={refCallback}>
      {cloneElement(template as ReactElement<Record<string, unknown>>, {
        color: item.colorIndex,
        onPopped,
      })}
    </group>
  );
}

type ItemSpawnerProps = {
  spawnMarkerRef: RefObject<PositionTargetHandle | null>;
  cullMarkerRef: RefObject<PositionTargetHandle | null>;
  children: ReactNode;
};

export function ItemSpawner({
  spawnMarkerRef,
  cullMarkerRef,
  children,
}: ItemSpawnerProps) {
  const spawnTimerRef = useRef(0);
  const spawnIdRef = useRef(0);
  const groupRefsMap = useRef<Map<string, THREE.Group>>(new Map());

  const templates = useMemo(() => {
    return Children.toArray(children).filter(
      (child): child is ReactElement =>
        typeof child === "object" && child !== null && "type" in child,
    );
  }, [children]);

  const items = useSpawnerStore((state) => state.items);
  const addItem = useSpawnerStore((state) => state.addItem);
  const removeItem = useSpawnerStore((state) => state.removeItem);
  const registerEntity = useEntityStore((state) => state.register);
  const unregisterEntity = useEntityStore((state) => state.unregister);

  const handleGroupRef = useCallback(
    (id: string, group: THREE.Group | null) => {
      if (group) {
        groupRefsMap.current.set(id, group);
      } else {
        groupRefsMap.current.delete(id);
      }
    },
    [],
  );

  useFrame((_state, delta) => {
    if (!isPlaying()) return;
    const cfg = SETTINGS.spawner;
    if (!cfg.enabled) return;

    const spawnPos = spawnMarkerRef.current?.getPosition();
    const cullPos = cullMarkerRef.current?.getPosition();
    if (!spawnPos || !cullPos) return;

    const cullZ = cullPos.z;

    // --- Spawn ---
    spawnTimerRef.current += delta;
    const intervalSec = cfg.spawnIntervalMs / 1000;
    while (
      spawnTimerRef.current >= intervalSec &&
      useSpawnerStore.getState().activeCount < cfg.maxItems
    ) {
      spawnTimerRef.current -= intervalSec;

      const xOffset = (Math.random() * 2 - 1) * cfg.spawnXRange;
      const speed = cfg.speed + (Math.random() * 2 - 1) * cfg.speedVariance;

      const palette = getActivePalette();
      const colorIndex = resolveMaterialColorIndex(
        Math.floor(Math.random() * palette.colors.length),
      );
      const itemId = `spawn-${++spawnIdRef.current}`;
      addItem(
        {
          id: itemId,
          colorIndex,
          radius: cfg.radius,
          templateIndex: Math.floor(Math.random() * templates.length),
        },
        [spawnPos.x + xOffset, SPAWN_HEIGHT, spawnPos.z],
        [0, 0, speed],
      );
      registerEntity(itemId, "spawned_item");
    }

    // --- Move + Cull + Sync (single pass) ---
    const currentItems = useSpawnerStore.getState().items;
    const refs = groupRefsMap.current;
    for (let i = currentItems.length - 1; i >= 0; i--) {
      const item = currentItems[i];
      const motion = getItemMotion(item.id);
      if (!motion) continue;

      motion.position[0] += motion.velocity[0] * delta;
      motion.position[1] += motion.velocity[1] * delta;
      motion.position[2] += motion.velocity[2] * delta;

      if (!motion.passedCullLine && motion.position[2] > cullZ) {
        motion.passedCullLine = true;
        useGameplayStore.getState().loseLife();
      }

      if (motion.position[2] > cullZ + cfg.cullOffset) {
        unregisterEntity(item.id);
        removeItem(item.id);
        continue;
      }

      const group = refs.get(item.id);
      if (group) {
        group.position.set(
          motion.position[0],
          motion.position[1],
          motion.position[2],
        );
      }
    }
  });

  return (
    <group>
      {items.map((item) => (
        <SpawnedItemView
          key={item.id}
          item={item}
          templates={templates}
          onGroupRef={handleGroupRef}
        />
      ))}
    </group>
  );
}
