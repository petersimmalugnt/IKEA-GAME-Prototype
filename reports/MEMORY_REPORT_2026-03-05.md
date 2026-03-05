# Memory / GC Report

**Date:** 2026-03-05  
**Project:** IKEA-GAME-Prototype  
**Purpose:** Verify long-session RAM/GC behavior for exhibition runtime without manual refreshes.

## Scope
- Investigate whether memory grows uncontrollably over time.
- Distinguish leak-like behavior from normal warmup/cache behavior.
- Validate under both idle and active gameplay conditions.
- Base conclusions on measured outcomes + code analysis (not assumptions).

## Method
- Chrome CDP probes in headless mode with periodic sampling.
- Explicit `gc()` before post-sample readings to track retained JS heap.
- Scenarios executed:
  - Dev idle (6 min)
  - Dev active run/game-over cycles (8 min, deterministic)
  - Production idle (`vite preview`, 6 min)
  - Production active sweep (`vite preview`, 6 min)
  - Production active sweep long run (`vite preview`, 15 min)
- Correlated heap samples with runtime state indicators (idle/run/game-over), and bounded runtime counters where available.

## Measured Results

### 1) Dev idle (6 min)
- Start post-GC heap: **14.09 MB**
- End post-GC heap: **14.06 MB**
- Delta: **-0.03 MB**
- Result: stable baseline.

### 2) Dev active run/game-over cycles (8 min)
- Start post-GC heap: **39.34 MB**
- End post-GC heap: **77.06 MB**
- Delta: **+37.72 MB**
- Max post-GC heap: **78.61 MB**
- Runtime bounds observed during run:
  - Max active items: **9**
  - Max level segments: **4**
  - Max entities: **478**

### 3) Production idle (6 min)
- Start post-GC heap: **23.52 MB**
- End post-GC heap: **44.04 MB**
- Delta: **+20.52 MB**
- Max post-GC heap: **45.99 MB**

### 4) Production active sweep (6 min)
- Start post-GC heap: **15.76 MB**
- End post-GC heap: **37.21 MB**
- Delta: **+21.45 MB**
- Max post-GC heap: **50.09 MB**
- Run and game-over states were reached repeatedly.

### 5) Production active sweep (15 min)
- Start post-GC heap: **12.32 MB**
- End post-GC heap: **46.81 MB**
- Delta: **+34.49 MB**
- Min post-GC heap: **12.32 MB**
- Max post-GC heap: **53.56 MB**
- Avg post-GC heap: **40.02 MB**
- State visibility samples:
  - Idle prompt seen: **67**
  - Game over seen: **14**
  - High score step seen: **12**

## Findings
- No immediate catastrophic/explosive JS-heap leak was observed in these windows.
- A gradual retained-memory increase exists under active, repeated gameplay cycling.
- Spawn/tiling runtime counts appeared bounded in measured runs (not unbounded world growth).
- Browser tab memory behavior can still look high due to allocator/GPU/process reservation effects even when GC works.

## Likely Root Causes
1. **Unbounded outline material cache**
   - File: `src/render/SurfaceIdEffect.tsx`
   - `idMaterialCache` (Map) creates/caches `MeshBasicMaterial` entries per surface color and does not evict/clear/dispose cache contents during runtime.

2. **Surface IDs generated per mount**
   - File: `src/scene/SceneHelpers.ts`
   - `useSurfaceId()` derives IDs from `useId()`.
   - With endless remount patterns, this can increase unique IDs/keys over long sessions.

3. **Global toon caches without eviction policy**
   - File: `src/render/Materials.tsx`
   - `materialCache` and `autoMidCache` are process-lifetime Maps.
   - Good for reuse/perf, but no cap/eviction means retained growth risk if key cardinality expands.

## Confidence / Limitations
- **High confidence** in measured trend direction (multiple scenarios, explicit GC normalization).
- **Medium confidence** on absolute “all-day” behavior (no full 6-10 hour soak in this pass).
- Measurements focused on JS retained heap via CDP; full GPU memory attribution still requires dedicated profiling pass.
- Chrome process memory can retain reservations and not immediately return memory to OS.

## Recommended Next Phase
1. Add bounded cache policy + disposal strategy for `SurfaceIdEffect` material cache.
2. Instrument cache sizes and key cardinality over runtime (outline/toon caches).
3. Run production soak test (4-8h) with periodic snapshot logging.
4. Perform targeted memory snapshot diff to confirm dominant retainers before final hardening.
5. Re-validate exhibition scenario with stable FPS + flat/controlled long-horizon memory trend.
