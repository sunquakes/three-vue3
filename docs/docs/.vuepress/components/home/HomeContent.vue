<template>
  <div class="home-page">
    <header class="home-hero">
      <div class="home-hero__inner">
        <span class="home-badge">
          <span class="home-badge__dot" />
          {{ copy.badge }}
        </span>
        <h1 class="home-hero__title">three-vue3</h1>
        <p class="home-hero__description">{{ copy.description }}</p>
        <div class="home-hero__actions">
          <a class="home-button home-button--primary" :href="links.quickStart">
            {{ copy.getStarted }}
          </a>
          <a class="home-button" :href="links.demo">{{ copy.demo }}</a>
          <a class="home-button" :href="links.ai">{{ copy.ai }}</a>
          <a class="home-button" :href="links.github" target="_blank" rel="noopener noreferrer">
            {{ copy.github }}
          </a>
        </div>
      </div>
    </header>

    <main class="home-main">
      <section class="home-section">
        <div class="home-section__inner home-showcase">
          <div class="home-stage">
            <IndexAnimation />
            <a class="home-stage__overlay" :href="links.demo" :aria-label="copy.stageLabel">
              <span class="home-stage__hint">{{ copy.stageHint }}</span>
            </a>
          </div>
          <div class="home-code">
            <div class="home-code__window">
              <div class="home-code__dots">
                <span class="home-code__dot home-code__dot--red" />
                <span class="home-code__dot home-code__dot--yellow" />
                <span class="home-code__dot home-code__dot--green" />
              </div>
              <pre><code>{{ installSnippet }}</code></pre>
            </div>
            <div class="home-code__window">
              <div class="home-code__dots">
                <span class="home-code__dot home-code__dot--red" />
                <span class="home-code__dot home-code__dot--yellow" />
                <span class="home-code__dot home-code__dot--green" />
              </div>
              <pre><code>{{ usageSnippet }}</code></pre>
            </div>
          </div>
        </div>
      </section>

      <section class="home-band">
        <div class="home-band__inner">
          <h2 class="home-band__title">{{ copy.demoTitle }}</h2>
          <p class="home-band__description">{{ copy.demoDescription }}</p>
          <a class="home-button home-button--solid" :href="links.demo">{{ copy.demoCta }}</a>
        </div>
      </section>

      <section class="home-band">
        <div class="home-band__inner">
          <h2 class="home-band__title">{{ copy.aiTitle }}</h2>
          <p class="home-band__description">{{ copy.aiDescription }}</p>
          <a class="home-button home-button--solid" :href="links.ai">{{ copy.aiCta }}</a>
        </div>
      </section>

      <section class="home-section">
        <div class="home-section__inner">
          <div class="home-heading">
            <h2 class="home-heading__title">{{ copy.featuresTitle }}</h2>
            <p class="home-heading__description">{{ copy.featuresDescription }}</p>
          </div>
          <div class="home-features">
            <article v-for="feature in copy.features" :key="feature.title" class="home-feature">
              <div class="home-feature__icon">{{ feature.icon }}</div>
              <h3 class="home-feature__title">{{ feature.title }}</h3>
              <p class="home-feature__description">{{ feature.description }}</p>
            </article>
          </div>
        </div>
      </section>

      <section class="home-band">
        <div class="home-band__inner">
          <h2 class="home-band__title">{{ copy.quickStartTitle }}</h2>
          <p class="home-band__description">{{ copy.quickStartDescription }}</p>
          <div class="home-command">
            <code>{{ installSnippet }}</code>
          </div>
          <a class="home-button home-button--solid" :href="links.quickStart">
            {{ copy.readDocs }}
          </a>
        </div>
      </section>

      <section class="home-band home-band--stats">
        <div class="home-stats">
          <div v-for="stat in copy.stats" :key="stat.label" class="home-stat">
            <div class="home-stat__value">{{ stat.value }}</div>
            <div class="home-stat__label">{{ stat.label }}</div>
          </div>
        </div>
      </section>

      <section class="home-section">
        <div class="home-section__inner home-contributors">
          <h2 class="home-heading__title">{{ copy.contributorsTitle }}</h2>
          <p class="home-heading__description">{{ copy.contributorsDescription }}</p>
          <a
            class="home-contributors__link"
            href="https://github.com/sunquakes/three-vue3/graphs/contributors"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              class="home-contributors__image"
              src="https://contrib.rocks/image?repo=sunquakes/three-vue3"
              alt="Contributors"
            />
          </a>
        </div>
      </section>
    </main>

    <footer class="home-footer">{{ copy.footer }}</footer>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { usePageData } from 'vuepress/client'
import { version as pkgVersion } from '../../../../../package.json'
import IndexAnimation from '../IndexAnimation.vue'

interface Feature {
  icon: string
  title: string
  description: string
}

interface Stat {
  label: string
  value: string
}

interface HomeCopy {
  badge: string
  description: string
  getStarted: string
  demo: string
  ai: string
  github: string
  stageLabel: string
  stageHint: string
  demoTitle: string
  demoDescription: string
  demoCta: string
  aiTitle: string
  aiDescription: string
  aiCta: string
  featuresTitle: string
  featuresDescription: string
  features: Feature[]
  quickStartTitle: string
  quickStartDescription: string
  readDocs: string
  stats: Stat[]
  contributorsTitle: string
  contributorsDescription: string
  footer: string
}

const page = usePageData()

const isZh = computed(() => page.value.path.startsWith('/zh/'))

const installSnippet = 'npm install three-vue3'

// The escaped closing tag keeps the SFC parser from ending this block early.
const usageSnippet = `<script setup lang="ts">
import { GLTFLoader } from 'three-vue3'

const created = async (scene, { camera }) => {
  camera.position.set(0, 1.5, 2.1)
  const model = await GLTFLoader('/model.glb')
  scene.add(model)
}
<\/script>

<template>
  <tv-scene @created="created" />
</template>`

const links = computed(() =>
  isZh.value
    ? {
        quickStart: '/zh/guide/getting-started.html',
        demo: '/zh/demo.html',
        ai: '/zh/ai/',
        github: 'https://github.com/sunquakes/three-vue3'
      }
    : {
        quickStart: '/guide/getting-started.html',
        demo: '/demo.html',
        ai: '/ai/',
        github: 'https://github.com/sunquakes/three-vue3'
      }
)

const copy = computed<HomeCopy>(() =>
  isZh.value
    ? {
        badge: `v${pkgVersion} 已发布`,
        description: '基于 Three.js 的 Vue 3 组件库，让 3D Web 体验开箱即用。',
        getStarted: '快速开始',
        demo: '在线 3D 演示',
        ai: 'AI 智能体',
        github: 'GitHub',
        stageLabel: '打开在线 3D 演示',
        stageHint: '打开在线演示 →',
        demoTitle: '在线 3D 演示',
        demoDescription: '浏览一个完全由 three-vue3 构建的完整 3D 场景。',
        demoCta: '打开演示',
        aiTitle: '用 AI 智能体开发',
        aiDescription:
          '安装一次 three-vue3 技能，编程助手就能写出正确的 Scene 代码 —— Claude Code、Codex CLI、DeepSeek Harness 等。',
        aiCta: '配置 AI 智能体',
        featuresTitle: '3D 开发所需的一切',
        featuresDescription: '用 Vue 组件构建 3D Web 应用',
        features: [
          {
            icon: '🚀',
            title: '自动初始化',
            description:
              'tv-scene 挂载时自动初始化渲染器、相机、光源、辅助坐标轴与控制器，卸载时释放全部资源。'
          },
          {
            icon: '📦',
            title: '模型加载与缓存',
            description:
              'GLTF、FBX 与 OBJ 加载器使用 IndexedDB 缓存模型，重复访问时优先读取本地数据库。'
          },
          {
            icon: '🎯',
            title: '增强的交互性',
            description:
              'Popup 在 3D 空间中渲染任意 Vue 组件，Picker 把指针事件转换为悬停与点击，MovableElement 支持拖动浮层。'
          },
          {
            icon: '🎬',
            title: '动画支持',
            description: 'Animation 助手可播放与控制已加载模型的动画片段。'
          },
          {
            icon: '✨',
            title: '自定义效果',
            description:
              'Rain、Snow、HeightFog、Bloom、Water 与 TSL 着色器网格均以组件形式提供，同时支持 WebGPU 与 WebGL。'
          },
          {
            icon: '📘',
            title: 'TypeScript 就绪',
            description: '全量 TypeScript 编写，提供类型化的 props、工具类与声明文件。'
          }
        ],
        quickStartTitle: '快速开始',
        quickStartDescription: '安装依赖，即可在任意 Vue 3 应用中放入一个场景。',
        readDocs: '阅读文档',
        stats: [
          { label: 'TypeScript', value: '100%' },
          { label: '渲染器', value: 'WebGPU + WebGL' },
          { label: '依赖', value: '极简' }
        ],
        contributorsTitle: '贡献者',
        contributorsDescription: '感谢所有贡献者！',
        footer: 'Apache-2.0 license | Copyright © 2025-present Shing Rui'
      }
    : {
        badge: `v${pkgVersion} released`,
        description: 'A Vue 3 component library built on Three.js for seamless 3D web experiences.',
        getStarted: 'Quick Start',
        demo: 'Live 3D Demo',
        ai: 'AI Agents',
        github: 'GitHub',
        stageLabel: 'Open the live 3D demo',
        stageHint: 'Open the demo →',
        demoTitle: 'Live 3D Demo',
        demoDescription: 'Explore a full 3D scene built entirely with three-vue3.',
        demoCta: 'Open the Demo',
        aiTitle: 'Build with AI Agents',
        aiDescription:
          'Install the three-vue3 skill once and your coding agent writes correct Scene code — Claude Code, Codex CLI, DeepSeek Harness and more.',
        aiCta: 'Set up AI Agents',
        featuresTitle: 'Everything you need for 3D',
        featuresDescription: 'Build 3D web applications with Vue components',
        features: [
          {
            icon: '🚀',
            title: 'Automatic Initialization',
            description:
              'tv-scene sets up the renderer, camera, lights, axes helper and controls when it mounts, and disposes them on unmount.'
          },
          {
            icon: '📦',
            title: 'Model Loading and Caching',
            description:
              'GLTF, FBX and OBJ loaders cache models in IndexedDB, so repeated visits read from the local database.'
          },
          {
            icon: '🎯',
            title: 'Enhanced Interactivity',
            description:
              'Popup renders any Vue component in 3D space, Picker turns pointer events into hover and click, and MovableElement drags overlays.'
          },
          {
            icon: '🎬',
            title: 'Animation Support',
            description: 'The Animation helper plays and controls the clips of a loaded model.'
          },
          {
            icon: '✨',
            title: 'Custom Effects',
            description:
              'Rain, Snow, HeightFog, Bloom, Water and TSL shader meshes ship as components on both WebGPU and WebGL.'
          },
          {
            icon: '📘',
            title: 'TypeScript Ready',
            description:
              'Written in TypeScript with typed props, typed helper classes and generated declarations.'
          }
        ],
        quickStartTitle: 'Quick Start',
        quickStartDescription: 'Install the package and drop a scene into any Vue 3 app.',
        readDocs: 'Read the Docs',
        stats: [
          { label: 'TypeScript', value: '100%' },
          { label: 'Renderers', value: 'WebGPU + WebGL' },
          { label: 'Dependencies', value: 'Minimal' }
        ],
        contributorsTitle: 'Contributors',
        contributorsDescription: 'Thanks to all our contributors!',
        footer: 'Apache-2.0 license | Copyright © 2025-present Shing Rui'
      }
)
</script>

<style scoped>
.home-page {
  padding-top: var(--navbar-height);
  background: var(--vp-c-bg);
  color: var(--vp-c-text);
}

.home-hero {
  padding: 4rem 1.5rem 5rem;
  text-align: center;
  color: #fff;
  background: linear-gradient(135deg, #35495e 0%, #41b883 100%);
}

.home-hero__inner {
  max-width: 900px;
  margin: 0 auto;
}

.home-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 1rem;
  margin-bottom: 1.75rem;
  font-size: 0.9rem;
  border-radius: 50px;
  background: rgb(255 255 255 / 20%);
}

.home-badge__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #41b883;
}

.home-hero__title {
  margin: 0 0 1.25rem;
  font-size: clamp(2.75rem, 8vw, 4.5rem);
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -3px;
  color: #fff;
  text-shadow: 0 4px 20px rgb(0 0 0 / 20%);
}

.home-hero__description {
  margin: 0 auto 2.75rem;
  max-width: 640px;
  font-size: clamp(1.05rem, 2.5vw, 1.4rem);
  line-height: 1.6;
  color: rgb(255 255 255 / 95%);
}

.home-hero__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1rem;
}

.home-button {
  display: inline-block;
  padding: 0.9rem 2rem;
  font-size: 1rem;
  font-weight: 600;
  text-decoration: none;
  border: 1px solid rgb(255 255 255 / 30%);
  border-radius: 16px;
  color: #fff;
  background: rgb(255 255 255 / 15%);
  box-shadow: 0 4px 15px rgb(0 0 0 / 10%);
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease,
    background 0.3s ease;
}

.home-button:hover {
  transform: translateY(-2px);
  background: rgb(255 255 255 / 25%);
  box-shadow: 0 6px 20px rgb(0 0 0 / 15%);
}

.home-button--primary {
  border-color: #fff;
  color: #41b883;
  background: #fff;
}

.home-button--primary:hover {
  background: #fff;
}

.home-button--solid {
  border-color: #fff;
  color: #41b883;
  background: #fff;
  box-shadow: 0 4px 15px rgb(0 0 0 / 20%);
}

.home-button--solid:hover {
  background: #fff;
  box-shadow: 0 6px 20px rgb(0 0 0 / 25%);
}

.home-section {
  padding: 3.5rem 1.5rem;
}

.home-section__inner {
  max-width: 1200px;
  margin: 0 auto;
}

.home-showcase {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.75rem;
  align-items: stretch;
}

.home-stage {
  position: relative;
  height: auto;
  min-height: 340px;
  overflow: hidden;
  border: 1px solid var(--vp-c-border);
  border-radius: 16px;
  background: var(--vp-c-bg-alt);
}

.home-stage :deep(.scene) {
  width: 100%;
  height: 100%;
  margin: 0;
}

.home-stage__overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: block;
  text-decoration: none;
}

.home-stage__hint {
  position: absolute;
  bottom: 12px;
  left: 12px;
  padding: 0.35rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--vp-c-text);
  border: 1px solid var(--vp-c-border);
  border-radius: 999px;
  background: var(--vp-c-bg);
}

.home-code {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
}

.home-code__window {
  flex: none;
  overflow: hidden;
  padding: 1.1rem 1.25rem;
  border: 1px solid rgb(255 255 255 / 8%);
  border-radius: 12px;
  background: #35495e;
  box-shadow: 0 4px 6px rgb(0 0 0 / 10%);
}

.home-code__dots {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.9rem;
}

.home-code__dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.home-code__dot--red {
  background: #ef4444;
}

.home-code__dot--yellow {
  background: #f59e0b;
}

.home-code__dot--green {
  background: #41b883;
}

.home-code__window pre {
  margin: 0;
  overflow-x: auto;
}

.home-code__window code {
  font-family: Monaco, Menlo, monospace;
  font-size: 0.85rem;
  line-height: 1.6;
  color: #e2e8f0;
  white-space: pre;
}

.home-band {
  padding: 3.5rem 1.5rem;
  margin-bottom: 1rem;
  text-align: center;
  color: #fff;
  background: linear-gradient(135deg, #35495e 0%, #41b883 100%);
}

.home-band__inner {
  max-width: 760px;
  margin: 0 auto;
}

.home-band__title {
  margin: 0 0 1rem;
  font-size: clamp(1.75rem, 4vw, 2.5rem);
  font-weight: 700;
  color: #fff;
  border: none;
  padding: 0;
}

.home-band__description {
  margin: 0 auto 2rem;
  font-size: 1.1rem;
  line-height: 1.6;
  color: rgb(255 255 255 / 92%);
}

.home-command {
  display: inline-block;
  margin-bottom: 2rem;
  padding: 0.9rem 1.5rem;
  border: 1px solid rgb(255 255 255 / 25%);
  border-radius: 12px;
  background: rgb(15 23 42 / 45%);
}

.home-command code {
  font-family: Monaco, Menlo, monospace;
  font-size: 1rem;
  color: #e2e8f0;
}

.home-heading {
  margin-bottom: 2.75rem;
  text-align: center;
}

.home-heading__title {
  margin: 0 0 1rem;
  font-size: clamp(1.75rem, 4vw, 2.5rem);
  font-weight: 700;
  color: var(--vp-c-text);
  border: none;
  padding: 0;
}

.home-heading__description {
  max-width: 620px;
  margin: 0 auto;
  font-size: 1.1rem;
  line-height: 1.6;
  color: var(--vp-c-text-mute);
}

.home-features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.75rem;
}

.home-feature {
  padding: 1.9rem;
  border: 2px solid transparent;
  border-radius: 16px;
  background: var(--vp-c-bg-elv);
  box-shadow: 0 4px 6px rgb(0 0 0 / 5%);
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease,
    border-color 0.3s ease;
}

.home-feature:hover {
  transform: translateY(-4px);
  border-color: #41b883;
  box-shadow: 0 12px 24px rgb(0 0 0 / 10%);
}

.home-feature__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  margin-bottom: 1.1rem;
  font-size: 2.5rem;
  border-radius: 16px;
  background: linear-gradient(135deg, #41b883 0%, #b9f6ca 100%);
}

.home-feature__title {
  margin: 0 0 0.75rem;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--vp-c-text);
  border: none;
  padding: 0;
}

.home-feature__description {
  margin: 0;
  font-size: 0.98rem;
  line-height: 1.6;
  color: var(--vp-c-text-mute);
}

.home-band--stats {
  padding: 2.75rem 1.5rem;
}

.home-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 2rem;
  max-width: 900px;
  margin: 0 auto;
  text-align: center;
}

.home-stat__value {
  margin-bottom: 0.4rem;
  font-size: clamp(1.6rem, 4vw, 2.5rem);
  font-weight: 700;
  color: #fff;
}

.home-stat__label {
  font-size: 1rem;
  color: rgb(255 255 255 / 90%);
}

.home-contributors {
  text-align: center;
}

.home-contributors__link {
  display: inline-block;
}

.home-contributors__image {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
}

.home-footer {
  padding: 1.5rem;
  font-size: 0.85rem;
  text-align: center;
  color: var(--vp-c-text-subtle);
  border-top: 1px solid var(--vp-c-gutter);
}

@media (max-width: 900px) {
  .home-showcase {
    grid-template-columns: minmax(0, 1fr);
  }

  .home-stage {
    height: 280px;
  }
}

@media (max-width: 480px) {
  .home-hero__title {
    letter-spacing: -1px;
  }

  .home-button {
    width: 100%;
  }
}
</style>
