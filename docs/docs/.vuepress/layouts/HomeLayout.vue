<template>
  <DefaultLayout>
    <template #page>
      <HomeContent />
    </template>
  </DefaultLayout>
</template>

<script lang="ts" setup>
import DefaultLayout from '@vuepress/theme-default/layouts/Layout.vue'
import HomeContent from '../components/home/HomeContent.vue'
</script>
