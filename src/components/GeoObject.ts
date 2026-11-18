import { defineComponent, onBeforeUnmount, onMounted, PropType, watch } from 'vue'
import * as THREE from 'three'
import { useScene } from '../context/SceneContext'
import { ensureSceneGeo } from '../crs/SceneGeo'
import type { DatumType, GeoPoint } from '../crs/types'

function disposeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh
    mesh.geometry?.dispose()
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(material)) {
      material.forEach((m) => m.dispose())
    } else {
      material?.dispose()
    }
  })
}

export default defineComponent({
  name: 'TvGeoObject',
  props: {
    /** Geographic position of the anchor, in the datum declared by `datum`. */
    coordinate: {
      type: Object as PropType<GeoPoint>,
      required: true
    },
    /** Datum of the input coordinate. Defaults to the Scene's configured datum. */
    datum: {
      type: String as PropType<DatumType>
    },
    /**
     * Existing object to anchor. Ownership stays with the caller: the component
     * only reparents it and restores the original parent on unmount. When
     * omitted, an empty Group is created and handed to `onReady`.
     */
    object: {
      type: Object as PropType<THREE.Object3D>
    },
    /** Called once with the anchored object (created Group or supplied object). */
    onReady: {
      type: Function as PropType<(object: THREE.Object3D) => void>
    },
    /** Optional explicit scene; defaults to the Scene provided by context. */
    scene: {
      type: Object as PropType<THREE.Scene>
    }
  },
  setup(props) {
    const sceneContext = useScene()

    let anchored: THREE.Object3D | null = null
    let owned = false
    let originalParent: THREE.Object3D | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    let disposed = false

    function clearTimer() {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
    }

    function destroy() {
      disposed = true
      clearTimer()
      const object = anchored
      if (object) {
        // Restore the caller's parent when an external object was supplied;
        // dispose everything when the Group was created internally.
        if (originalParent && !owned) {
          originalParent.add(object)
        } else {
          object.removeFromParent()
          if (owned) disposeObject(object)
        }
      }
      anchored = null
      originalParent = null
      owned = false
    }

    function create() {
      destroy()
      disposed = false

      const init = () => {
        if (disposed) return
        const scene = props.scene || sceneContext.scene
        if (!scene) {
          // The Scene context is published asynchronously after the renderer
          // starts; retry briefly in the same way as the model loaders.
          timer = setTimeout(init, 100)
          return
        }

        const object = props.object ?? new THREE.Group()
        owned = !props.object
        originalParent = object.parent
        // Scenes created by <tv-scene> already carry setPosition; a user-supplied
        // bare scene is bound here without a reference, so lng/lat/alt fall back
        // to local metres exactly as the previous manual positioning branch did.
        ensureSceneGeo(scene)
        scene.setPosition(object, props.coordinate, props.datum)
        scene.add(object)
        anchored = object
        props.onReady?.(object)
      }

      init()
    }

    onMounted(create)
    onBeforeUnmount(destroy)

    // Rebuild only when the target scene or the anchored object changes.
    watch(() => [props.scene, props.object], create)

    // Keep the anchor position in sync with prop changes without rebuilding.
    watch(
      () => [props.coordinate, props.datum, props.scene],
      () => {
        const object = anchored
        const scene = props.scene || sceneContext.scene
        if (object && scene) {
          ensureSceneGeo(scene)
          scene.setPosition(object, props.coordinate, props.datum)
        }
      }
    )
  },
  render() {
    return null
  }
})
