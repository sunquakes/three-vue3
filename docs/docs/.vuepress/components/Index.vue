<template>
  <a-row class="index-container" :gutter="30">
    <a-col :xs="24" :sm="24" :md="24" :lg="12" :xl="12">
      <IndexAnimation />
    </a-col>
    <a-col :xs="24" :sm="24" :md="24" :lg="12" :xl="12">
      <Content class="index-content" :path="path" />
    </a-col>
  </a-row>
</template>

<script lang="ts" setup>
import { defineProps } from 'vue'

defineProps({
  path: {
    type: String,
    required: true
  }
})
</script>

<style scoped>
.index-container {
  margin-top: 50px;
  margin-bottom: 20px;
}

::v-deep .language-vue pre {
  max-height: 300px !important;
}

::v-deep .language-vue pre::-webkit-scrollbar {
  display: none;
}

::v-deep .language-vue pre * {
  scrollbar-width: none;
}

.index-content {
  margin-top: -65px;
}
</style>
