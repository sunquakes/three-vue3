import { defineClientConfig } from 'vuepress/client'
import { h } from 'vue'
import DefaultLayout from '@vuepress/theme-default/layouts/Layout.vue'
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
import FlowLineMesh from './components/meshes/FlowLineMesh.vue'
import FlowLineMeshOptions from './components/meshes/FlowLineMeshOptions.vue'
import Bloom from './components/effects/Bloom.vue'
import HeightFogDemo from './components/effects/HeightFogDemo.vue'
import RainDemo from './components/effects/RainDemo.vue'
import RainCollisionDemo from './components/effects/RainCollisionDemo.vue'
import SnowDemo from './components/effects/SnowDemo.vue'
import SweepLightDemo from './components/effects/SweepLightDemo.vue'
import LightPillarDemo from './components/effects/LightPillarDemo.vue'
import LightGradientDemo from './components/effects/LightGradientDemo.vue'
import GlowSpriteDemo from './components/effects/GlowSpriteDemo.vue'
import RadarSweepDemo from './components/effects/RadarSweepDemo.vue'
import SignalWaveDemo from './components/effects/SignalWaveDemo.vue'
import ForceShieldDemo from './components/effects/ForceShieldDemo.vue'
import NebulaGalaxyDemo from './components/effects/NebulaGalaxyDemo.vue'
import FireworksDemo from './components/effects/FireworksDemo.vue'
import TextFireworksDemo from './components/effects/TextFireworksDemo.vue'
import CalloutDemo from './components/CalloutDemo.vue'
import FitCameraDemo from './components/FitCameraDemo.vue'
import PickerDemo from './components/PickerDemo.vue'
import ModelRotatorDemo from './components/ModelRotatorDemo.vue'
import ParameterBusDemo from './components/ParameterBusDemo.vue'
import SkyDomeDemo from './components/SkyDomeDemo.vue'
import WaterDemo from './components/effects/WaterDemo.vue'
import WaterShapeDemo from './components/effects/WaterShapeDemo.vue'
import WaterPoolDemo from './components/effects/WaterPoolDemo.vue'
import WaterPoolIrregularDemo from './components/effects/WaterPoolIrregularDemo.vue'
import SandyBeachDemo from './components/effects/SandyBeachDemo.vue'
import GeoObjectDemo from './components/gis/GeoObjectDemo.vue'
import GeoReferenceDemo from './components/gis/GeoReferenceDemo.vue'
import GeoJsonLayerDemo from './components/gis/GeoJsonLayerDemo.vue'
import TileLayerDemo from './components/gis/TileLayerDemo.vue'
import Animation from './components/Animation.vue'
import Index from './components/Index.vue'
import IndexAnimation from './components/IndexAnimation.vue'
import DemoScene from './components/demo/DemoScene.vue'
import RendererScene from './components/demo/RendererScene.vue'
import RendererSwitch from './components/demo/RendererSwitch.vue'
import { rendererType } from './components/demo/rendererState'
import DemoLayout from './layouts/DemoLayout.vue'
import HomeLayout from './layouts/HomeLayout.vue'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'

// Changing the backend cannot happen in place: the renderer, every TSL
// material and every scene are rebuilt. Keying the layout by renderer type
// unmounts the whole page subtree, so each demo releases its frame loops, DOM
// overlays and three.js objects before the page is created again on the new
// backend. The switch sits at the top of the page content so it is easy to
// find.
const withRendererKey = (Layout, extraSlots) => (props, { attrs, slots }) =>
  h(Layout, { ...props, ...attrs, key: rendererType.value }, { ...slots, ...extraSlots })

const RendererLayout = withRendererKey(DefaultLayout, {
  'page-content-top': () => h(RendererSwitch)
})
const RendererDemoLayout = withRendererKey(DemoLayout)

export default defineClientConfig({
  layouts: {
    Layout: RendererLayout,
    DemoLayout: RendererDemoLayout,
    Home: HomeLayout
  },
  enhance({ app }) {
    // Register the renderer-aware scene before the plugin so the plugin keeps
    // this intentional override instead of replacing it with a warning.
    app.component('tv-scene', RendererScene)
    app.use(ThreeVue3)
    app.use(Antd)
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
    app.component('FlowLineMesh', FlowLineMesh)
    app.component('FlowLineMeshOptions', FlowLineMeshOptions)
    app.component('Bloom', Bloom)
    app.component('HeightFogDemo', HeightFogDemo)
    app.component('RainDemo', RainDemo)
    app.component('RainCollisionDemo', RainCollisionDemo)
    app.component('SnowDemo', SnowDemo)
    app.component('SweepLightDemo', SweepLightDemo)
    app.component('LightPillarDemo', LightPillarDemo)
    app.component('LightGradientDemo', LightGradientDemo)
    app.component('GlowSpriteDemo', GlowSpriteDemo)
    app.component('RadarSweepDemo', RadarSweepDemo)
    app.component('SignalWaveDemo', SignalWaveDemo)
    app.component('ForceShieldDemo', ForceShieldDemo)
    app.component('NebulaGalaxyDemo', NebulaGalaxyDemo)
    app.component('FireworksDemo', FireworksDemo)
    app.component('TextFireworksDemo', TextFireworksDemo)
    app.component('CalloutDemo', CalloutDemo)
    app.component('FitCameraDemo', FitCameraDemo)
    app.component('PickerDemo', PickerDemo)
    app.component('ModelRotatorDemo', ModelRotatorDemo)
    app.component('ParameterBusDemo', ParameterBusDemo)
    app.component('SkyDomeDemo', SkyDomeDemo)
    app.component('WaterDemo', WaterDemo)
    app.component('WaterShapeDemo', WaterShapeDemo)
    app.component('WaterPoolDemo', WaterPoolDemo)
    app.component('WaterPoolIrregularDemo', WaterPoolIrregularDemo)
    app.component('SandyBeachDemo', SandyBeachDemo)
    app.component('GeoObjectDemo', GeoObjectDemo)
    app.component('GeoReferenceDemo', GeoReferenceDemo)
    app.component('GeoJsonLayerDemo', GeoJsonLayerDemo)
    app.component('TileLayerDemo', TileLayerDemo)
    app.component('Animation', Animation)
    app.component('Index', Index)
    app.component('IndexAnimation', IndexAnimation)
    app.component('DemoScene', DemoScene)
  }
})
