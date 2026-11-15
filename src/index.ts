import { App } from 'vue'
import Scene from './components/Scene'
import GLTFLoader from './components/GLTFLoader'
import FBXLoader from './components/FBXLoader'
import OBJLoader from './components/OBJLoader'
import Rain from './components/Rain'
import Snow from './components/Snow'
import SkyBox from './utils/SkyBox'
import Popup from './utils/Popup'
import ME from './utils/ME'
import WaveCircleMesh from './meshes/WaveCircleMesh'
import FlowLineMesh from './meshes/FlowLineMesh'
import Bloom from './components/Bloom'
import HeightFog from './components/HeightFog'
import Water from './components/Water'
import WaterPool from './components/WaterPool'
import SandyBeach from './components/SandyBeach'
import GeoObject from './components/GeoObject'
import GeoJsonLayer from './components/GeoJsonLayer'
import TileLayer from './components/TileLayer'
import Animation from './utils/Animation'

// component
export default {
  install: (app: App) => {
    app.component('tv-scene', Scene)
    app.component('tv-gltf-loader', GLTFLoader)
    app.component('tv-fbx-loader', FBXLoader)
    app.component('tv-obj-loader', OBJLoader)
    app.component('tv-bloom', Bloom)
    app.component('tv-height-fog', HeightFog)
    app.component('tv-rain', Rain)
    app.component('tv-snow', Snow)
    app.component('tv-water', Water)
    app.component('tv-water-pool', WaterPool)
    app.component('tv-sandy-beach', SandyBeach)
    app.component('tv-geo-object', GeoObject)
    app.component('tv-geo-json-layer', GeoJsonLayer)
    app.component('tv-tile-layer', TileLayer)
  }
}

// component
export { default as Scene } from './components/Scene'
export type { GridHelperOptions } from './components/Scene'

// class
export { default as Renderer } from './utils/Renderer'
export type { RendererType } from './utils/Renderer'
export { SkyBox, Popup, ME, WaveCircleMesh, FlowLineMesh, Animation }

// class
export { default as Picker } from './utils/Picker'
export type { PickEvent, PickEventType, PickCallback, PickerOptions } from './utils/Picker'
export { default as ModelRotator } from './utils/ModelRotator'
export type { ModelRotatorOptions } from './utils/ModelRotator'
export { default as FitCamera } from './utils/FitCamera'
export { default as SkyDome } from './utils/SkyDome'
export type { SkyDomeOptions } from './utils/SkyDome'
export { default as RainEffect } from './effects/RainEffect'
export type { RainEffectOptions } from './effects/RainEffect'
export { default as SnowEffect } from './effects/SnowEffect'
export type { SnowEffectOptions } from './effects/SnowEffect'
export { default as SweepLight } from './effects/SweepLight'
export type { SweepLightOptions } from './effects/SweepLight'
export { default as LightPillar } from './effects/LightPillar'
export type { LightPillarOptions } from './effects/LightPillar'
export { default as LightGradient } from './effects/LightGradient'
export type { LightGradientOptions } from './effects/LightGradient'
export { default as GlowSprite } from './effects/GlowSprite'
export type { GlowSpriteOptions } from './effects/GlowSprite'
export { default as RadarSweep } from './effects/RadarSweep'
export type { RadarSweepOptions } from './effects/RadarSweep'
export { default as SignalWave } from './effects/SignalWave'
export type { SignalWaveOptions } from './effects/SignalWave'
export { default as ForceShield } from './effects/ForceShield'
export type { ForceShieldOptions } from './effects/ForceShield'
export { default as NebulaGalaxy } from './effects/NebulaGalaxy'
export type { NebulaGalaxyOptions, GalaxyPalette } from './effects/NebulaGalaxy'
export { default as Fireworks } from './effects/Fireworks'
export type { FireworksOptions } from './effects/Fireworks'
export { default as TextFireworks } from './effects/TextFireworks'
export type { TextFireworksOptions } from './effects/TextFireworks'
export { layoutText, sampleTextParticles } from './effects/TextSampling'
export type {
  TextSampleOptions,
  TextLayoutOptions,
  TextLayout,
  TextSample,
  TextMeasure
} from './effects/TextSampling'
export { default as Callout } from './effects/Callout'
export type { CalloutOptions, LineShape, BendAxis, LabelAnchor } from './effects/Callout'
export { ParameterBus, globalParameterBus } from './utils/ParameterBus'
export type { GlobalParameters } from './utils/ParameterBus'

// water & beach
export { default as Water } from './components/Water'
export type { WaterProps } from './components/Water'
export { default as WaterPool } from './components/WaterPool'
export type { WaterPoolProps, WaterPoolBoxConfig } from './components/WaterPool'
export { default as SandyBeach } from './components/SandyBeach'
export { mountBeachScene } from './utils/BeachScene'
export type { BeachSceneOptions } from './utils/BeachScene'
export type { BeachPresetName, BeachPresetDefinition } from './utils/BeachPresets'

// gis
export { default as GeoObject } from './components/GeoObject'
export { default as GeoJsonLayer } from './components/GeoJsonLayer'
export type { GeoJsonStyle } from './components/GeoJsonLayer'
export { default as TileLayer } from './components/TileLayer'
export type { TileLayerProps } from './components/TileLayer'
export { GeoReference, createGeoReference } from './crs/GeoReference'
export type {
  AxesMapping,
  CRS,
  CrsCode,
  DatumType,
  GeoPoint,
  GeoReferenceOptions,
  LocalPlane
} from './crs/types'
export {
  wgs84ToGcj02,
  gcj02ToWgs84,
  gcj02ToBd09,
  bd09ToGcj02,
  toWGS84,
  fromWGS84,
  convertDatum
} from './crs/Datum'
export { mercatorProject, mercatorUnproject, mercatorCRS } from './crs/Mercator'
export { createLocalPlane } from './crs/LocalPlane'
export { bindSceneGeo, ensureSceneGeo, getSceneGeo } from './crs/SceneGeo'
export type { SceneLocalPoint, ScenePosition } from './crs/SceneGeo'
export { collectGeometries, flattenGeoJson } from './crs/GeoJson'
export type {
  GeoJsonData,
  GeoJsonFeature,
  GeoJsonFeatureCollection,
  GeoJsonGeometry,
  GeoJsonGeometryData,
  GeoJsonLineString,
  GeoJsonMultiLineString,
  GeoJsonMultiPoint,
  GeoJsonMultiPolygon,
  GeoJsonPoint,
  GeoJsonPolygon,
  GeoJsonPosition,
  GeoJsonRingSet
} from './crs/GeoJson'
export { TilePyramid, TileState, ROOT_TILES, childIndex, tileKey } from './crs/TilePyramid'
export type { GroundRect, SelectIdealOptions, TileNodeBase } from './crs/TilePyramid'
export {
  TILE_SIZE,
  lngLatToTile,
  selectTiles,
  selectTilesInBounds,
  tileToCorners,
  tileToLngLatBounds,
  tileUrl
} from './crs/Tiles'
export type { TileBounds, TileCorners, TileIndex } from './crs/Tiles'

// function
export * from './utils/ModelLoader'
export { fitCameraToBox, fitCameraToObject, fitCameraToPoints } from './utils/CameraFit'
export type { CameraFitOptions, LocalPoint } from './utils/CameraFit'

// context
export { useScene, useFrame, sceneContextKey } from './context/SceneContext'
export type { FramePhase } from './context/SceneContext'

// enum
export { AxisType } from './enums/AxisType'
