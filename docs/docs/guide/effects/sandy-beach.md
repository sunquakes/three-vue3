---
lang: en-US
title: Sandy Beach
---

::: tip type
Component
:::

A first-person dawn beach walk. The island is a 260 m ring, and the sand height, the wet band, the ocean swells and the footprints all share one set of shore coordinates, so the waterline, the walker and the shader stay aligned at every angle. A single fullscreen ray-march evaluates the sand heightfield and the wave surface in one TSL pass, then tone-maps the result with an ACES curve — the WebGPU and the WebGL renderer compile the same shader and produce the same image. Only sand and water are drawn: every ray above the horizon stays transparent, so the Scene background colour shows through there.

Drag to look around, walk with `WASD` or the arrow keys, and scroll to take a step forward. Footprints are written into a small ring buffer and washed away by the tide.

## Default Usage

<SandyBeachDemo />

::: details Click me to view the codes

```vue
<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)">
    <tv-sandy-beach preset="sunrise" />
  </tv-scene>
</template>

<style>
.scene {
  margin-top: 10px;
  margin-bottom: 16px;
  width: 100%;
  height: 300px;
}
</style>
```

:::

## Interaction

- **Drag** turns the camera. The look drag is captured on the canvas, so the page does not scroll while you look around.
- **`W` / `A` / `S` / `D`** or the **arrow keys** walk across the sand. Keyboard input only applies while the pointer is over the canvas.
- **Wheel** takes a step forward with a short impulse instead of a continuous zoom.
- The walker stays inside the beach ring, so the camera can never walk into the ocean or climb the inland slope.

## Props

| Name        | Type                                                       | Default   | Description                                                                                    |
| ----------- | ---------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------- |
| preset      | `'sunrise' \| 'morning' \| 'sunset' \| 'night' \| 'blueHour'` | `'sunrise'` | `optional` Time-of-day preset. Changing it cross-fades the sun, water and sand colours.       |
| autoWalk    | `boolean`                                                  | `false`   | `optional` Walk forward automatically, useful for an attract-mode background.                   |
| crouching   | `boolean`                                                  | `false`   | `optional` Lower the camera to a crouched eye height.                                           |
| interactive | `boolean`                                                  | `true`    | `optional` Attach pointer look, `WASD` / arrow keys and wheel stepping to the canvas.           |

## Presets

| Preset   | Description                                                              |
| -------- | ------------------------------------------------------------------------ |
| sunrise  | Warm low sun, peach-tinted shallows and long soft shadows on the sand     |
| morning  | High sun, bright turquoise shallows and pale dry sand                     |
| sunset   | Very low sun behind the water, an orange glitter path and violet-tinted sand |
| night    | Cool moonlight over dark water and muted sand                             |
| blueHour | Sun just below the horizon, pink light on dim blue water                  |

## Notes

- The component owns the camera while it is mounted. It saves the previous camera pose, field of view and near/far planes, disables the scene's `OrbitControls`, and restores all of them on unmount.
- The beach is drawn by one fullscreen TSL shader on an inside-out sphere: it sphere-traces the sand, intersects the animated wave surface, and shades whichever hit is nearer, including depth-absorbed shallows, foam, wet sand and footprints. Rays that miss both hits stay transparent, so the Scene background shows through where the sky would be.
- Every geometry, material, texture and event listener is disposed on unmount.
- Changing a prop updates the running scene in place; it never rebuilds the beach.
