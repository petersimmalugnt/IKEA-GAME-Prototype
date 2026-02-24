import { useEntityStore } from "@/entities/entityStore";
import { isPlaying } from "@/game/gamePhaseStore";
import {
  useSpawnerStore,
  type SpawnedItemDescriptor,
} from "@/gameplay/spawnerStore";
import type { PositionTargetHandle } from "@/scene/PositionTargetHandle";
import { SETTINGS } from "@/settings/GameSettings";
import { useFrame } from "@react-three/fiber";
import {
  Children,
  cloneElement,
  useMemo,
  useRef,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from "react";

const SPAWN_HEIGHT = 1.3;

function SpawnedItemView({
  item,
  templates,
}: {
  item: SpawnedItemDescriptor;
  templates: ReactElement[];
}) {
  const onCleanupRequested = () => {
    useEntityStore.getState().unregister(item.id);
    useSpawnerStore.getState().removeItem(item.id);
  };

  if (templates.length === 0) return null;
  const template = templates[item.templateIndex % templates.length];

  return cloneElement(template as ReactElement<Record<string, unknown>>, {
    position: item.position,
    onCleanupRequested,
  });
}

type ItemSpawnerProps = {
  spawnMarkerRef: RefObject<PositionTargetHandle | null>;
  cullMarkerRef: RefObject<PositionTargetHandle | null>;
  children: ReactNode;
};

export function ItemSpawner({
  spawnMarkerRef,
  children,
}: ItemSpawnerProps) {
  const spawnTimerRef = useRef(0);
  const spawnIdRef = useRef(0);

  const templates = useMemo(() => {
    return Children.toArray(children).filter(
      (child): child is ReactElement =>
        typeof child === "object" && child !== null && "type" in child,
    );
  }, [children]);

  const items = useSpawnerStore((state) => state.items);
  const addItem = useSpawnerStore((state) => state.addItem);
  const registerEntity = useEntityStore((state) => state.register);

  useFrame((_state, delta) => {
    if (!isPlaying()) return;
    const cfg = SETTINGS.spawner;
    if (!cfg.enabled) return;
    if (templates.length === 0) return;

    const spawnPos = spawnMarkerRef.current?.getPosition();
    if (!spawnPos) return;

    spawnTimerRef.current += delta;
    const intervalSec = cfg.spawnIntervalMs / 1000;
    while (
      spawnTimerRef.current >= intervalSec &&
      useSpawnerStore.getState().activeCount < cfg.maxItems
    ) {
      spawnTimerRef.current -= intervalSec;

      const xOffset = (Math.random() * 2 - 1) * cfg.spawnXRange;
      const itemId = `spawn-${++spawnIdRef.current}`;
      addItem({
        id: itemId,
        radius: cfg.radius,
        templateIndex: Math.floor(Math.random() * templates.length),
        position: [spawnPos.x + xOffset, SPAWN_HEIGHT, spawnPos.z],
      });
      registerEntity(itemId, "spawned_item");
    }
  });

  return (
    <group>
      {items.map((item) => (
        <SpawnedItemView key={item.id} item={item} templates={templates} />
      ))}
    </group>
  );
}
