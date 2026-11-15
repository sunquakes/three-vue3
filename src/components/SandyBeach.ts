import { defineComponent, onBeforeUnmount, onMounted, PropType, watch } from 'vue'
import { useScene } from '../context/SceneContext'
import { mountBeachScene } from '../utils/BeachScene'
import type { BeachPresetName } from '../utils/BeachPresets'

export default defineComponent({
  name: 'TvSandyBeach',
  props: {
    /** Time-of-day preset. Defaults to `'sunrise'`. */
    preset: {
      type: String as PropType<BeachPresetName>,
      default: 'sunrise'
    },
    /** Walk forward automatically, without keyboard input. Defaults to `false`. */
    autoWalk: {
      type: Boolean,
      default: false
    },
    /** Lower the camera to a crouched eye height. Defaults to `false`. */
    crouching: {
      type: Boolean,
      default: false
    },
    /** Enables pointer look, WASD / arrow keys and wheel stepping. Defaults to `true`. */
    interactive: {
      type: Boolean,
      default: true
    }
  },
  setup(props) {
    const sceneContext = useScene()

    // The animation loop reads these values every frame, so changing a prop
    // must not rebuild the scene. Local variables keep the latest values,
    // mirroring the refs the React component uses.
    let preset: BeachPresetName = props.preset
    let autoWalk: boolean = props.autoWalk
    let crouching: boolean = props.crouching
    let interactive: boolean = props.interactive

    let dispose: (() => void) | undefined

    watch(
      () => [props.preset, props.autoWalk, props.crouching, props.interactive],
      () => {
        preset = props.preset
        autoWalk = props.autoWalk
        crouching = props.crouching
        interactive = props.interactive
      }
    )

    onMounted(() => {
      preset = props.preset
      autoWalk = props.autoWalk
      crouching = props.crouching
      interactive = props.interactive

      dispose = mountBeachScene(sceneContext, {
        preset: () => preset,
        autoWalk: () => autoWalk,
        crouching: () => crouching,
        interactive: () => interactive
      })
    })

    onBeforeUnmount(() => {
      dispose?.()
      dispose = undefined
    })
  },
  render() {
    return null
  }
})
