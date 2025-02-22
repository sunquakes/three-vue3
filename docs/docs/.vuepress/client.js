import { defineClientConfig } from '@vuepress/client'
import ThreeVue3 from 'three-vue3'
import Scene from './components/Scene.vue'
import SceneBgImage from './components/SceneBgImage.vue'
import SceneBgColor from './components/SceneBgColor.vue'
import SkyBox from './components/SkyBox.vue'
import GLTFLoaderComponent from './components/GLTFLoaderComponent.vue'
import GLTFLoaderFunction from './components/GLTFLoaderFunction.vue'
import FBXLoaderComponent from './components/FBXLoaderComponent.vue'
import FBXLoaderFunction from './components/FBXLoaderFunction.vue'
import OBJLoaderComponent from './components/OBJLoaderComponent.vue'
import OBJLoaderFunction from './components/OBJLoaderFunction.vue'
import Popup from './components/Popup.vue'
import MovableElement from './components/MovableElement.vue'
import WaveCircleMesh from './components/meshes/WaveCircleMesh.vue'
import WaveCircleMeshOptions from './components/meshes/WaveCircleMeshOptions.vue'
import Bloom from './components/effects/Bloom.vue'

export default defineClientConfig({
  enhance({ app }) {
    app.use(ThreeVue3)
    app.component('Scene', Scene)
    app.component('SceneBgImage', SceneBgImage)
    app.component('SceneBgColor', SceneBgColor)
    app.component('SkyBox', SkyBox)
    app.component('GLTFLoaderComponent', GLTFLoaderComponent)
    app.component('GLTFLoaderFunction', GLTFLoaderFunction)
    app.component('FBXLoaderComponent', FBXLoaderComponent)
    app.component('FBXLoaderFunction', FBXLoaderFunction)
    app.component('OBJLoaderComponent', OBJLoaderComponent)
    app.component('OBJLoaderFunction', OBJLoaderFunction)
    app.component('Popup', Popup)
    app.component('MovableElement', MovableElement)
    app.component('WaveCircleMesh', WaveCircleMesh)
    app.component('WaveCircleMeshOptions', WaveCircleMeshOptions)
    app.component('Bloom', Bloom)
  }
})
