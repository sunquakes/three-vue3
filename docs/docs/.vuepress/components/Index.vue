<template>
  <a-row class="index-container" :gutter="16">
    <a-col :xs="24" :sm="24" :md="24" :lg="12" :xl="12">
      <Animation />
    </a-col>
    <a-col :xs="24" :sm="24" :md="24" :lg="12" :xl="12">
      <Content path="/animation.md" />
    </a-col>
  </a-row>
</template>

<script lang="ts" setup></script>

<style scoped>
.index-container {
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
</style>
