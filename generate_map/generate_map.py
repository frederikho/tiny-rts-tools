"""
Procedural RTS map generator plus parameter metadata for local tooling.

Usage:
    python3 generate_map.py --output "Generated Wilds.json"
    python3 generate_map.py --seed 42 --output "Generated Wilds.json"
    python3 generate_map.py --config params.json --output "Generated Wilds.json"
    python3 generate_map.py --print-default-config
"""

from __future__ import annotations

import argparse
import json
import math
import random
import secrets
from collections import deque
from dataclasses import asdict, dataclass
from pathlib import Path


TILE_SIZE = 64


PARAMETER_SPECS = [
    {"key": "width", "label": "Width", "type": "int", "min": 40, "max": 160, "step": 4},
    {"key": "height", "label": "Height", "type": "int", "min": 40, "max": 160, "step": 4},
    {"key": "blob_count", "label": "Land Blobs", "type": "int", "min": 4, "max": 18, "step": 1},
    {"key": "blob_radius_min", "label": "Blob Radius Min", "type": "float", "min": 0.04, "max": 0.20, "step": 0.005},
    {"key": "blob_radius_max", "label": "Blob Radius Max", "type": "float", "min": 0.06, "max": 0.30, "step": 0.005},
    {"key": "basin_count", "label": "Basins", "type": "int", "min": 0, "max": 10, "step": 1},
    {"key": "ridge_count", "label": "Ridges", "type": "int", "min": 0, "max": 12, "step": 1},
    {"key": "ridge_width_min", "label": "Ridge Width Min", "type": "float", "min": 0.01, "max": 0.10, "step": 0.002},
    {"key": "ridge_width_max", "label": "Ridge Width Max", "type": "float", "min": 0.02, "max": 0.14, "step": 0.002},
    {"key": "lake_count", "label": "Lakes", "type": "int", "min": 0, "max": 8, "step": 1},
    {"key": "lake_radius_min", "label": "Lake Radius Min", "type": "float", "min": 0.02, "max": 0.12, "step": 0.002},
    {"key": "lake_radius_max", "label": "Lake Radius Max", "type": "float", "min": 0.03, "max": 0.16, "step": 0.002},
    {"key": "land_threshold", "label": "Land Threshold", "type": "float", "min": -0.8, "max": 0.4, "step": 0.01},
    {"key": "land_smooth_passes", "label": "Land Smooth", "type": "int", "min": 0, "max": 5, "step": 1},
    {"key": "lake_threshold", "label": "Lake Threshold", "type": "float", "min": 0.20, "max": 1.40, "step": 0.01},
    {"key": "tier2_threshold", "label": "Tier 2 Threshold", "type": "float", "min": 0.20, "max": 1.80, "step": 0.01},
    {"key": "tier3_threshold", "label": "Tier 3 Threshold", "type": "float", "min": 0.40, "max": 2.20, "step": 0.01},
    {"key": "forest_patch_count", "label": "Forest Patches", "type": "int", "min": 0, "max": 40, "step": 1},
    {"key": "forest_patch_radius_min", "label": "Forest Radius Min", "type": "float", "min": 0.01, "max": 0.12, "step": 0.002},
    {"key": "forest_patch_radius_max", "label": "Forest Radius Max", "type": "float", "min": 0.02, "max": 0.18, "step": 0.002},
    {"key": "forest_base_density", "label": "Tree Base Density", "type": "float", "min": 0.00, "max": 0.50, "step": 0.01},
    {"key": "forest_cluster_strength", "label": "Tree Cluster Strength", "type": "float", "min": 0.00, "max": 1.50, "step": 0.01},
    {"key": "forest_extra_tree_chance", "label": "Extra Cluster Trees", "type": "float", "min": 0.00, "max": 0.70, "step": 0.01},
    {"key": "cliff_tree_penalty", "label": "Cliff Tree Penalty", "type": "float", "min": 0.00, "max": 1.00, "step": 0.01},
    {"key": "rock_shore_chance", "label": "Shore Rock Chance", "type": "float", "min": 0.00, "max": 0.50, "step": 0.01},
    {"key": "rock_cliff_chance", "label": "Cliff Rock Chance", "type": "float", "min": 0.00, "max": 0.50, "step": 0.01},
    {"key": "stair_chance", "label": "Stair Chance", "type": "float", "min": 0.00, "max": 1.00, "step": 0.01},
]


@dataclass
class GeneratorConfig:
    width: int = 100
    height: int = 100
    blob_count: int = 10
    blob_radius_min: float = 0.08
    blob_radius_max: float = 0.18
    basin_count: int = 4
    basin_radius_min: float = 0.06
    basin_radius_max: float = 0.14
    ridge_count: int = 5
    ridge_width_min: float = 0.028
    ridge_width_max: float = 0.07
    lake_count: int = 3
    lake_radius_min: float = 0.035
    lake_radius_max: float = 0.08
    land_threshold: float = -0.14
    land_smooth_passes: int = 2
    min_land_component: int = 6
    lake_threshold: float = 0.52
    min_lake_component: int = 12
    tier2_threshold: float = 0.94
    tier3_threshold: float = 1.12
    tier2_min_component: int = 14
    tier3_min_component: int = 5
    forest_patch_count: int = 18
    forest_patch_radius_min: float = 0.035
    forest_patch_radius_max: float = 0.09
    forest_base_density: float = 0.08
    forest_cluster_strength: float = 0.82
    forest_noise_strength: float = 0.16
    forest_extra_tree_chance: float = 0.20
    cliff_tree_penalty: float = 0.45
    rock_shore_chance: float = 0.20
    rock_cliff_chance: float = 0.16
    stair_chance: float = 0.55
    edge_void_margin: int = 2
    seed: int | None = None


def default_config() -> GeneratorConfig:
    return GeneratorConfig()


def parameter_schema() -> dict:
    return {
        "parameters": PARAMETER_SPECS,
        "defaults": asdict(default_config()),
    }


def merge_config(overrides: dict | None = None) -> GeneratorConfig:
    config = default_config()
    if not overrides:
        return config
    for key, value in overrides.items():
        if hasattr(config, key):
            setattr(config, key, value)
    if config.blob_radius_min > config.blob_radius_max:
        config.blob_radius_min, config.blob_radius_max = config.blob_radius_max, config.blob_radius_min
    if config.basin_radius_min > config.basin_radius_max:
        config.basin_radius_min, config.basin_radius_max = config.basin_radius_max, config.basin_radius_min
    if config.ridge_width_min > config.ridge_width_max:
        config.ridge_width_min, config.ridge_width_max = config.ridge_width_max, config.ridge_width_min
    if config.lake_radius_min > config.lake_radius_max:
        config.lake_radius_min, config.lake_radius_max = config.lake_radius_max, config.lake_radius_min
    if config.forest_patch_radius_min > config.forest_patch_radius_max:
        config.forest_patch_radius_min, config.forest_patch_radius_max = (
            config.forest_patch_radius_max,
            config.forest_patch_radius_min,
        )
    if config.tier3_threshold < config.tier2_threshold:
        config.tier3_threshold = config.tier2_threshold + 0.05
    return config


def smoothstep(t: float) -> float:
    t = max(0.0, min(1.0, t))
    return t * t * (3.0 - 2.0 * t)


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


class NoiseField:
    def __init__(self, seed: int) -> None:
        self.seed = seed

    def _rand_at(self, ix: int, iy: int) -> float:
        n = ix * 374761393 + iy * 668265263 + self.seed * 982451653
        n = (n ^ (n >> 13)) * 1274126177
        n ^= n >> 16
        return (n & 0xFFFFFFFF) / 0xFFFFFFFF

    def value(self, x: float, y: float, scale: float) -> float:
        x /= scale
        y /= scale
        x0 = math.floor(x)
        y0 = math.floor(y)
        tx = smoothstep(x - x0)
        ty = smoothstep(y - y0)

        v00 = self._rand_at(x0, y0)
        v10 = self._rand_at(x0 + 1, y0)
        v01 = self._rand_at(x0, y0 + 1)
        v11 = self._rand_at(x0 + 1, y0 + 1)

        a = lerp(v00, v10, tx)
        b = lerp(v01, v11, tx)
        return lerp(a, b, ty) * 2.0 - 1.0

    def fbm(
        self,
        x: float,
        y: float,
        base_scale: float,
        octaves: int = 4,
        lacunarity: float = 2.0,
        gain: float = 0.5,
    ) -> float:
        amplitude = 1.0
        frequency = 1.0
        total = 0.0
        max_amp = 0.0
        for _ in range(octaves):
            total += amplitude * self.value(x * frequency, y * frequency, base_scale)
            max_amp += amplitude
            amplitude *= gain
            frequency *= lacunarity
        return total / max_amp if max_amp else 0.0


def distance_to_segment(px: float, py: float, ax: float, ay: float, bx: float, by: float) -> float:
    abx = bx - ax
    aby = by - ay
    apx = px - ax
    apy = py - ay
    ab_len_sq = abx * abx + aby * aby
    if ab_len_sq == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, (apx * abx + apy * aby) / ab_len_sq))
    cx = ax + abx * t
    cy = ay + aby * t
    return math.hypot(px - cx, py - cy)


def gaussian(px: float, py: float, cx: float, cy: float, radius: float) -> float:
    d = math.hypot(px - cx, py - cy)
    return math.exp(-((d / radius) ** 2))


def bfs_components(mask: list[int], width: int, height: int) -> list[list[int]]:
    seen = [False] * (width * height)
    components: list[list[int]] = []
    for idx, value in enumerate(mask):
        if value == 0 or seen[idx]:
            continue
        queue = deque([idx])
        seen[idx] = True
        component = []
        while queue:
            current = queue.popleft()
            component.append(current)
            r = current // width
            c = current % width
            for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nr = r + dr
                nc = c + dc
                if nr < 0 or nr >= height or nc < 0 or nc >= width:
                    continue
                nxt = nr * width + nc
                if mask[nxt] and not seen[nxt]:
                    seen[nxt] = True
                    queue.append(nxt)
        components.append(component)
    return components


def smooth_scalar(field: list[float], width: int, height: int, passes: int = 1) -> list[float]:
    current = field[:]
    for _ in range(passes):
        updated = current[:]
        for r in range(1, height - 1):
            for c in range(1, width - 1):
                total = 0.0
                weight = 0.0
                for dr in (-1, 0, 1):
                    for dc in (-1, 0, 1):
                        w = 2.0 if dr == 0 and dc == 0 else 1.0
                        total += current[(r + dr) * width + (c + dc)] * w
                        weight += w
                updated[r * width + c] = total / weight
        current = updated
    return current


def smooth_land(mask: list[int], width: int, height: int, passes: int) -> list[int]:
    current = mask[:]
    for _ in range(passes):
        updated = current[:]
        for r in range(1, height - 1):
            for c in range(1, width - 1):
                idx = r * width + c
                neighbors = 0
                for dr in (-1, 0, 1):
                    for dc in (-1, 0, 1):
                        if dr == 0 and dc == 0:
                            continue
                        neighbors += current[(r + dr) * width + (c + dc)]
                if current[idx]:
                    updated[idx] = 1 if neighbors >= 3 else 0
                else:
                    updated[idx] = 1 if neighbors >= 5 else 0
        current = updated
    return current


def erode_mask(mask: list[int], width: int, height: int, min_neighbors: int) -> list[int]:
    updated = mask[:]
    for r in range(1, height - 1):
        for c in range(1, width - 1):
            idx = r * width + c
            if not mask[idx]:
                continue
            neighbors = 0
            for dr in (-1, 0, 1):
                for dc in (-1, 0, 1):
                    if dr == 0 and dc == 0:
                        continue
                    neighbors += mask[(r + dr) * width + (c + dc)]
            if neighbors < min_neighbors:
                updated[idx] = 0
    return updated


def dilate_mask(mask: list[int], width: int, height: int, min_neighbors: int) -> list[int]:
    updated = mask[:]
    for r in range(1, height - 1):
        for c in range(1, width - 1):
            idx = r * width + c
            if mask[idx]:
                continue
            neighbors = 0
            for dr in (-1, 0, 1):
                for dc in (-1, 0, 1):
                    if dr == 0 and dc == 0:
                        continue
                    neighbors += mask[(r + dr) * width + (c + dc)]
            if neighbors >= min_neighbors:
                updated[idx] = 1
    return updated


def remove_small_components(mask: list[int], width: int, height: int, min_size: int) -> list[int]:
    current = mask[:]
    for component in bfs_components(current, width, height):
        if len(component) < min_size:
            for idx in component:
                current[idx] = 0
    return current


def build_tier_mask(base_mask: list[int], width: int, height: int, min_size: int) -> list[int]:
    current = erode_mask(base_mask, width, height, min_neighbors=3)
    current = smooth_land(current, width, height, passes=1)
    current = remove_small_components(current, width, height, min_size=min_size)
    return current


def choose_land_features(
    rng: random.Random,
    width: int,
    height: int,
    config: GeneratorConfig,
) -> tuple[list[tuple[float, float, float]], list[tuple[float, float, float]], list[tuple[float, float, float]], list[tuple[float, float, float, float, float]], float]:
    blobs = []
    for _ in range(config.blob_count):
        blobs.append(
            (
                rng.uniform(width * 0.12, width * 0.88),
                rng.uniform(height * 0.12, height * 0.88),
                rng.uniform(width * config.blob_radius_min, width * config.blob_radius_max),
            )
        )

    basins = []
    for _ in range(config.basin_count):
        basins.append(
            (
                rng.uniform(width * 0.15, width * 0.85),
                rng.uniform(height * 0.15, height * 0.85),
                rng.uniform(width * config.basin_radius_min, width * config.basin_radius_max),
            )
        )

    ridges = []
    for _ in range(config.ridge_count):
        ax = rng.uniform(width * 0.05, width * 0.95)
        ay = rng.uniform(height * 0.05, height * 0.95)
        bx = ax + rng.uniform(-width * 0.35, width * 0.35)
        by = ay + rng.uniform(-height * 0.35, height * 0.35)
        ridge_width = rng.uniform(width * config.ridge_width_min, width * config.ridge_width_max)
        ridges.append((ax, ay, bx, by, ridge_width))

    lakes = []
    for _ in range(config.lake_count):
        lakes.append(
            (
                rng.uniform(width * 0.22, width * 0.78),
                rng.uniform(height * 0.22, height * 0.78),
                rng.uniform(width * config.lake_radius_min, width * config.lake_radius_max),
            )
        )

    border_margin = rng.uniform(1.5, 3.0)
    return blobs, basins, lakes, ridges, border_margin


def classify_stairs(heightmap: list[int], tile_type: list[int], width: int, height: int, rng: random.Random, config: GeneratorConfig) -> None:
    for level in (0, 1, 2):
        for c in range(1, width - 1):
            r = 1
            while r < height - 1:
                idx = r * width + c
                if (
                    heightmap[idx] == level
                    and heightmap[r * width + c + 1] >= level + 1
                    and heightmap[r * width + c - 1] <= level
                    and tile_type[idx] == 1
                ):
                    run = 0
                    while (
                        r + run < height - 1
                        and heightmap[(r + run) * width + c] == level
                        and heightmap[(r + run) * width + c + 1] >= level + 1
                        and tile_type[(r + run) * width + c] == 1
                    ):
                        run += 1
                    if run >= 2 and rng.random() < config.stair_chance:
                        length = min(run, rng.randint(2, 4))
                        start = r + max(0, (run - length) // 2)
                        for offset in range(length):
                            tile_type[(start + offset) * width + c] = 2
                        r += run
                        continue
                if (
                    heightmap[idx] == level
                    and heightmap[r * width + c - 1] >= level + 1
                    and heightmap[r * width + c + 1] <= level
                    and tile_type[idx] == 1
                ):
                    run = 0
                    while (
                        r + run < height - 1
                        and heightmap[(r + run) * width + c] == level
                        and heightmap[(r + run) * width + c - 1] >= level + 1
                        and tile_type[(r + run) * width + c] == 1
                    ):
                        run += 1
                    if run >= 2 and rng.random() < config.stair_chance:
                        length = min(run, rng.randint(2, 4))
                        start = r + max(0, (run - length) // 2)
                        for offset in range(length):
                            tile_type[(start + offset) * width + c] = 3
                        r += run
                        continue
                r += 1


def build_heightmap(config: GeneratorConfig, seed: int) -> tuple[list[int], list[int]]:
    width = config.width
    height = config.height
    rng = random.Random(seed)
    noise = NoiseField(seed)
    blobs, basins, lakes, ridges, border_margin = choose_land_features(rng, width, height, config)

    land_scores = [0.0] * (width * height)
    hill_scores = [0.0] * (width * height)
    lake_scores = [0.0] * (width * height)

    for r in range(height):
        for c in range(width):
            idx = r * width + c
            x = c + 0.5
            y = r + 0.5

            warp_x = noise.fbm(x + 211.3, y - 93.7, 18.0, octaves=3) * 4.0
            warp_y = noise.fbm(x - 57.1, y + 174.2, 18.0, octaves=3) * 4.0
            wx = x + warp_x
            wy = y + warp_y

            blob_score = sum(gaussian(wx, wy, cx, cy, radius) for cx, cy, radius in blobs)
            basin_score = sum(gaussian(wx, wy, cx, cy, radius) for cx, cy, radius in basins)
            lake_score = sum(gaussian(wx, wy, cx, cy, radius) for cx, cy, radius in lakes)

            ridge_score = 0.0
            for ax, ay, bx, by, ridge_width in ridges:
                d = distance_to_segment(wx, wy, ax, ay, bx, by)
                ridge_score += math.exp(-((d / ridge_width) ** 2))

            macro_noise = noise.fbm(wx, wy, 20.0, octaves=4)
            detail_noise = noise.fbm(wx + 91.0, wy - 47.0, 9.0, octaves=3)

            edge = min(c, width - 1 - c, r, height - 1 - r)
            edge_penalty = max(0.0, (border_margin - edge) / border_margin)

            land_scores[idx] = (
                blob_score * 0.95
                + ridge_score * 0.82
                + macro_noise * 0.55
                + detail_noise * 0.18
                - basin_score * 0.82
                - edge_penalty * 2.20
                - 1.05
            )
            hill_scores[idx] = ridge_score * 0.75 + blob_score * 0.25 + detail_noise * 0.35 + macro_noise * 0.15
            lake_scores[idx] = lake_score * 1.15 - ridge_score * 0.25 - detail_noise * 0.10

    mask = [1 if score > config.land_threshold else 0 for score in land_scores]
    mask = smooth_land(mask, width, height, passes=config.land_smooth_passes)
    mask = remove_small_components(mask, width, height, min_size=config.min_land_component)

    lake_mask = [0] * (width * height)
    for r in range(2, height - 2):
        for c in range(2, width - 2):
            idx = r * width + c
            if not mask[idx]:
                continue
            edge = min(c, width - 1 - c, r, height - 1 - r)
            if edge < 8:
                continue
            if lake_scores[idx] > config.lake_threshold and land_scores[idx] > -0.05 and hill_scores[idx] < config.tier3_threshold:
                lake_mask[idx] = 1
    lake_mask = erode_mask(lake_mask, width, height, min_neighbors=3)
    lake_mask = smooth_land(lake_mask, width, height, passes=1)
    lake_mask = dilate_mask(lake_mask, width, height, min_neighbors=3)
    lake_mask = remove_small_components(lake_mask, width, height, min_size=config.min_lake_component)

    land_mask = mask[:]
    for idx, value in enumerate(lake_mask):
        if value:
            land_mask[idx] = 0

    smoothed_hills = smooth_scalar(hill_scores, width, height, passes=2)
    tier2_seed = [0] * (width * height)
    tier3_seed = [0] * (width * height)
    for idx, is_land in enumerate(land_mask):
        if not is_land:
            continue
        if smoothed_hills[idx] > config.tier2_threshold:
            tier2_seed[idx] = 1
        if smoothed_hills[idx] > config.tier3_threshold:
            tier3_seed[idx] = 1

    tier1_mask = land_mask
    tier2_mask = build_tier_mask(tier2_seed, width, height, min_size=config.tier2_min_component)
    tier2_mask = [1 if tier2_mask[idx] and tier1_mask[idx] else 0 for idx in range(width * height)]
    tier3_mask = build_tier_mask([1 if tier3_seed[idx] and tier2_mask[idx] else 0 for idx in range(width * height)], width, height, min_size=config.tier3_min_component)
    tier3_mask = [1 if tier3_mask[idx] and tier2_mask[idx] else 0 for idx in range(width * height)]

    heightmap = [0] * (width * height)
    tile_type = [1] * (width * height)

    for r in range(height):
        for c in range(width):
            idx = r * width + c
            edge = min(c, width - 1 - c, r, height - 1 - r)
            if edge < config.edge_void_margin:
                tile_type[idx] = 0
                heightmap[idx] = 0
                continue
            if lake_mask[idx]:
                tile_type[idx] = 0
                heightmap[idx] = 0
                continue
            if not tier1_mask[idx]:
                tile_type[idx] = 0
                heightmap[idx] = 0
                continue

            heightmap[idx] = 0
            if tier2_mask[idx]:
                heightmap[idx] = 1
            if tier3_mask[idx]:
                heightmap[idx] = 2

    classify_stairs(heightmap, tile_type, width, height, rng, config)
    return heightmap, tile_type


def world_xy(col: int, row: int, rng: random.Random, spread: float = 0.9) -> tuple[float, float]:
    return (
        (col + rng.uniform(0.15, spread)) * TILE_SIZE,
        (row + rng.uniform(0.15, spread)) * TILE_SIZE,
    )


def generate_decorations(heightmap: list[int], tile_type: list[int], width: int, height: int, seed: int, config: GeneratorConfig) -> list[dict[str, float | str]]:
    rng = random.Random(seed + 1007)
    noise = NoiseField(seed + 17)
    decorations: list[dict[str, float | str]] = []

    forest_centers = []
    for _ in range(config.forest_patch_count):
        forest_centers.append(
            (
                rng.uniform(width * 0.08, width * 0.92),
                rng.uniform(height * 0.08, height * 0.92),
                rng.uniform(width * config.forest_patch_radius_min, width * config.forest_patch_radius_max),
                rng.random(),
            )
        )

    for r in range(height):
        for c in range(width):
            idx = r * width + c
            if tile_type[idx] == 0:
                continue

            x = c + 0.5
            y = r + 0.5
            broad_forest = noise.fbm(x + 13.0, y - 41.0, 13.0, octaves=3)
            species_noise = noise.fbm(x - 77.0, y + 121.0, 6.0, octaves=2)
            cluster_score = 0.0
            species_score = 0.0
            for cx, cy, radius, species_bias in forest_centers:
                influence = gaussian(x, y, cx, cy, radius)
                cluster_score = max(cluster_score, influence)
                species_score += influence * (species_bias - 0.5)

            near_slope = False
            near_water = False
            for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nr = r + dr
                nc = c + dc
                if nr < 0 or nr >= height or nc < 0 or nc >= width:
                    continue
                nidx = nr * width + nc
                if tile_type[nidx] == 0:
                    near_water = True
                    continue
                if abs(heightmap[idx] - heightmap[nidx]) >= 1:
                    near_slope = True

            density = config.forest_base_density + max(0.0, broad_forest) * config.forest_noise_strength + cluster_score * config.forest_cluster_strength
            if near_slope:
                density *= config.cliff_tree_penalty
            if tile_type[idx] in (2, 3):
                density = 0.0

            if rng.random() < density:
                tree_type = "spruce" if species_score + species_noise * 0.45 > 0 else "birch"
                px, py = world_xy(c, r, rng)
                decorations.append({"type": tree_type, "x": px, "y": py})

            if cluster_score > 0.62 and rng.random() < config.forest_extra_tree_chance and not near_slope and tile_type[idx] == 1:
                tree_type = "spruce" if species_score > -0.05 else "birch"
                px, py = world_xy(c, r, rng, spread=0.98)
                decorations.append({"type": tree_type, "x": px, "y": py})

            if near_water and rng.random() < config.rock_shore_chance:
                px, py = world_xy(c, r, rng, spread=0.95)
                decorations.append({"type": "rock", "x": px, "y": py})
            elif near_slope and rng.random() < config.rock_cliff_chance:
                px, py = world_xy(c, r, rng, spread=0.95)
                decorations.append({"type": "rock", "x": px, "y": py})

    return decorations


def summarize_map(map_data: dict) -> dict:
    width = map_data["tilesX"]
    height = map_data["tilesY"]
    heightmap = map_data["heightmap"]
    tile_type = map_data["tileType"]
    playable = sum(1 for i in range(width * height) if tile_type[i] != 0)
    lakes = sum(
        1
        for r in range(1, height - 1)
        for c in range(1, width - 1)
        if tile_type[r * width + c] == 0
        and any(tile_type[(r + dr) * width + (c + dc)] != 0 for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)))
    )
    trees = sum(1 for d in map_data["decorations"] if d["type"] in ("spruce", "birch"))
    rocks = sum(1 for d in map_data["decorations"] if d["type"] == "rock")
    return {
        "playable_tiles": playable,
        "shore_water_tiles": lakes,
        "stairs_east": sum(1 for value in tile_type if value == 2),
        "stairs_west": sum(1 for value in tile_type if value == 3),
        "tree_count": trees,
        "rock_count": rocks,
        "max_height": max(heightmap) if heightmap else 0,
    }


def generate_map(config_overrides: dict | None = None, seed: int | None = None) -> dict:
    config = merge_config(config_overrides)
    resolved_seed = seed if seed is not None else config.seed
    if resolved_seed is None:
        resolved_seed = secrets.randbelow(2**31)

    heightmap, tile_type = build_heightmap(config, resolved_seed)
    decorations = generate_decorations(heightmap, tile_type, config.width, config.height, resolved_seed, config)
    result = {
        "tilesX": config.width,
        "tilesY": config.height,
        "heightmap": heightmap,
        "tileType": tile_type,
        "decorations": decorations,
        "buildings": [],
        "spawns": [],
        "towers": [],
        "workers": [],
        "seed": resolved_seed,
        "params": asdict(config),
    }
    result["summary"] = summarize_map(result)
    return result


def print_preview(map_data: dict, step: int = 4) -> None:
    width = map_data["tilesX"]
    height = map_data["tilesY"]
    heightmap = map_data["heightmap"]
    tile_type = map_data["tileType"]
    chars = {
        (0, 0): " ",
        (0, 1): ".",
        (1, 1): "^",
        (2, 1): "#",
        (0, 2): ">",
        (0, 3): "<",
        (1, 2): ">",
        (1, 3): "<",
    }
    print("Height preview:")
    for r in range(0, height, step):
        row = "".join(chars.get((heightmap[r * width + c], tile_type[r * width + c]), "?") for c in range(0, width, step))
        print(f"{r:02d} {row}")


def load_config_file(path: str | None) -> dict | None:
    if not path:
        return None
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", type=int)
    parser.add_argument("--output", default="Generated Wilds.json")
    parser.add_argument("--config")
    parser.add_argument("--print-default-config", action="store_true")
    args = parser.parse_args()

    if args.print_default_config:
        print(json.dumps(parameter_schema(), indent=2))
        return

    config_overrides = load_config_file(args.config)
    map_data = generate_map(config_overrides=config_overrides, seed=args.seed)
    output_path = Path(args.output)
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(map_data, handle, indent=2)

    print(f"Written: {output_path}")
    print(f"Seed: {map_data['seed']}")
    print(f"Summary: {json.dumps(map_data['summary'])}")
    print_preview(map_data)


if __name__ == "__main__":
    main()
