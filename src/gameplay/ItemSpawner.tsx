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
  useCallback,
  useMemo,
  useRef,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from "react";

const SPAWN_HEIGHT = 1.3;

type ZGetter = () => number | undefined;

function SpawnedItemView({
  item,
  templates,
  onRegisterCullZ,
}: {
  item: SpawnedItemDescriptor;
  templates: ReactElement[];
  onRegisterCullZ: (getter: ZGetter) => () => void;
}) {
  if (templates.length === 0) return null;
  const template = templates[item.templateIndex % templates.length];

  return cloneElement(template as ReactElement<Record<string, unknown>>, {
    position: item.position,
    onRegisterCullZ,
  });
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
  const cullGettersRef = useRef<Map<string, ZGetter>>(new Map());

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
    // ── Spawn ─────────────────────────────────────────────────────────────
    if (isPlaying()) {
      const cfg = SETTINGS.spawner;
      if (cfg.enabled && templates.length > 0) {
        const spawnPos = spawnMarkerRef.current?.getPosition();
        if (spawnPos) {
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
        }
      }
    }

    // ── Cull ──────────────────────────────────────────────────────────────
    const cullPos = cullMarkerRef.current?.getPosition();
    if (!cullPos) return;
    const cullZ = cullPos.z + (SETTINGS.spawner.cullOffset ?? 0);

    const toRemove: string[] = [];
    cullGettersRef.current.forEach((getZ, id) => {
      const z = getZ();
      if (z !== undefined && z > cullZ) toRemove.push(id);
    });

    for (const id of toRemove) {
      cullGettersRef.current.delete(id);
      useEntityStore.getState().unregister(id);
      useSpawnerStore.getState().removeItem(id);
      console.log(`[cull] removed ${id} — active: ${useSpawnerStore.getState().activeCount}`);
    }
  });

  const makeRegisterCullZ = useCallback(
    (id: string) => (getter: ZGetter) => {
      cullGettersRef.current.set(id, getter);
      return () => { cullGettersRef.current.delete(id); };
    },
    [],
  );

  return (
    <group>
      {items.map((item) => (
        <SpawnedItemView
          key={item.id}
          item={item}
          templates={templates}
          onRegisterCullZ={makeRegisterCullZ(item.id)}
        />
      ))}
    </group>
  );
}
