<template>
  <DemoScene :home-link="homeLink" :docs-link="docsLink" :ai-link="aiLink" />
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { usePageData } from 'vuepress/client'
import DemoScene from '../components/demo/DemoScene.vue'

const page = usePageData()

const isZh = computed(() => page.value.path.startsWith('/zh/'))
const homeLink = computed(() => (isZh.value ? '/zh/' : '/'))
const docsLink = computed(() =>
  isZh.value ? '/zh/guide/getting-started.html' : '/guide/getting-started.html'
)
const aiLink = computed(() => (isZh.value ? '/zh/ai/' : '/ai/'))
</script>
