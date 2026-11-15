export default function (options) {
  return [
    'getting-started',
    'scene',
    'parameter-bus',
    'sky-box',
    {
      text: options.modelLoaderText,
      collapsible: true,
      children: ['model-loader-component', 'model-loader-function']
    },
    'popup',
    'callout',
    'movable-element',
    'animation',
    'model-rotator',
    'picking',
    'fit-camera',
    {
      text: options.meshText,
      collapsible: true,
      children: ['meshes/wave-circle-mesh', 'meshes/flow-line-mesh']
    },
    {
      text: options.effectText,
      collapsible: true,
      children: [
        {
          text: options.natureText,
          collapsible: true,
          children: [
            'effects/rain',
            'effects/snow',
            'effects/water',
            'effects/water-pool',
            'effects/sandy-beach'
          ]
        },
        {
          text: options.skyAtmosphereText,
          collapsible: true,
          children: ['sky-dome', 'effects/height-fog', 'effects/nebula-galaxy']
        },
        {
          text: options.lightText,
          collapsible: true,
          children: [
            'effects/bloom',
            'effects/sweep-light',
            'effects/light-gradient',
            'effects/light-pillar',
            'effects/radar-sweep',
            'effects/signal-wave',
            'effects/force-shield'
          ]
        },
        {
          text: options.particlesText,
          collapsible: true,
          children: ['effects/fireworks', 'effects/text-fireworks', 'effects/glow-sprite']
        }
      ]
    },
    {
      text: options.gisText,
      collapsible: true,
      children: ['gis/geo-reference', 'gis/geo-object', 'gis/geojson-layer', 'gis/tile-layer']
    }
  ]
}
