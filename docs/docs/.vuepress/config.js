import { defaultTheme } from '@vuepress/theme-default'
import { defineUserConfig } from 'vuepress/cli'
import { viteBundler } from '@vuepress/bundler-vite'
import getChildren from './sidebar'

export default defineUserConfig({
  lang: 'en-US',

  title: 'Three Vue3',
  description: 'A vue3.x component library of Three.js.',

  head: [['link', { rel: 'icon', href: '/images/logo.png' }]],

  theme: defaultTheme({
    logo: '/images/logo.png',
    repo: 'sunquakes/three-vue3',
    editLinks: true,
    sidebarDepth: 0,
    locales: {
      '/': {
        selectLanguageName: 'English',
        selectLanguageText: 'Languages',
        selectLanguageAriaLabel: 'Languages',
        editLinkText: 'Edit this page on GitHub',
        navbar: [
          { text: 'Guide', link: '/guide/getting-started' },
          { text: 'Demo', link: '/demo' },
          { text: 'AI Agents', link: '/ai/' }
        ],
        sidebar: {
          '/guide/': [
            {
              children: getChildren({
                modelLoaderText: 'Model Loader',
                gisText: 'GIS',
                meshText: 'Mesh',
                effectText: 'Effect',
                natureText: 'Nature',
                skyAtmosphereText: 'Sky & Atmosphere',
                lightText: 'Light',
                particlesText: 'Particles & Sprites'
              })
            }
          ],
          '/ai/': [
            {
              text: 'AI Agents',
              collapsible: false,
              children: ['', 'claude-code', 'codex-cli', 'deepseek-harness', 'others']
            }
          ]
        }
      },
      '/zh/': {
        selectLanguageName: '简体中文',
        selectLanguageText: '选择语言',
        selectLanguageAriaLabel: '选择语言',
        editLinkText: '在 GitHub 上编辑此页',
        navbar: [
          { text: '指南', link: '/zh/guide/getting-started' },
          { text: '在线演示', link: '/zh/demo' },
          { text: 'AI 智能体', link: '/zh/ai/' }
        ],
        sidebar: {
          '/zh/guide/': [
            {
              children: getChildren({
                modelLoaderText: '模型加载器',
                gisText: '地理',
                meshText: '网格模型',
                effectText: '效果',
                natureText: '自然',
                skyAtmosphereText: '天空与大气',
                lightText: '光照',
                particlesText: '粒子与精灵'
              })
            }
          ],
          '/zh/ai/': [
            {
              text: 'AI 智能体',
              collapsible: false,
              children: ['', 'claude-code', 'codex-cli', 'deepseek-harness', 'others']
            }
          ]
        }
      }
    }
  }),

  locales: {
    '/': {
      lang: 'English',
      title: 'Three Vue3',
      description: 'A vue3.x component library of Three.js.'
    },
    '/zh/': {
      lang: '简体中文',
      title: 'Three Vue3',
      description: '一个Three.js的vue3.x组件库。'
    }
  },

  bundler: viteBundler({
    viteOptions: {
      optimizeDeps: {
        // `three-vue3` resolves to a local `file:` build that is rebuilt often.
        // Vite keys its pre-bundled dep cache by the lockfile, so a rebuilt
        // library keeps being served as a stale immutable chunk. Excluding it
        // makes the dev server load the freshly built ESM directly.
        exclude: ['three-vue3'],
        // The excluded library imports these `three` entry points, so they
        // must be pre-bundled up front. Otherwise Vite discovers them lazily
        // and reloads the page in the middle of a render.
        include: [
          'three',
          'three/webgpu',
          'three/tsl',
          'three/examples/jsm/controls/OrbitControls.js',
          'three/examples/jsm/renderers/CSS2DRenderer.js',
          'three/examples/jsm/tsl/WebGLNodesHandler.js',
          'three/examples/jsm/loaders/GLTFLoader.js',
          'three/examples/jsm/loaders/FBXLoader.js',
          'three/examples/jsm/loaders/OBJLoader.js',
          'three/examples/jsm/loaders/MTLLoader.js',
          'three/examples/jsm/loaders/DRACOLoader.js',
          'three/examples/jsm/tsl/display/BloomNode.js',
          'three/examples/jsm/postprocessing/EffectComposer.js',
          'three/examples/jsm/postprocessing/RenderPass.js',
          'three/examples/jsm/postprocessing/UnrealBloomPass.js'
        ]
      }
    }
  })
})
