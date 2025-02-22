export default function (options) {
  return [
    'getting-started',
    'scene',
    'sky-box',
    {
      text: options.modelLoaderText,
      collapsible: true,
      children: ['model-loader-component', 'model-loader-function']
    },
    'popup',
    'movable-element',
    {
      text: options.meshText,
      collapsible: true,
      prefix: 'meshes/',
      children: ['wave-circle-mesh']
    },
    {
      text: options.effectText,
      collapsible: true,
      prefix: 'effects/',
      children: ['bloom']
    }
  ]
}
