import { defineComponent, PropType, inject } from 'vue'
import * as THREE from 'three'
import { OBJLoader } from '../utils/ModelLoader'

export default defineComponent({
  setup(props, { emit }) {
    return {
      async init() {
        const sceneSlotProps: SceneSlotProps | undefined = inject('sceneSlotProps')
        const scene = sceneSlotProps?.scene
        const model = await OBJLoader(props.modelValue, props.mtl, props.cache, (event) =>
          emit('onProgress', event)
        )
        model.scale.set(...props.scale)
        scene.add(model)
        emit('loaded', model)
      }
    }
  },
  render() {
    return null
  },
  props: {
    modelValue: {
      type: String,
      required: true
    },
    mtl: {
      type: String,
      required: true
    },
    scene: {
      type: Object as PropType<THREE.Scene>,
      required: true
    },
    scale: {
      type: Object as PropType<[number, number, number]>,
      default: () => [1, 1, 1]
    },
    cache: {
      type: Boolean,
      default: true
    }
  },
  mounted() {
    this.init()
  }
})
