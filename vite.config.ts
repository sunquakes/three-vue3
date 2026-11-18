import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'

import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'three-vue3'
    },
    rollupOptions: {
      // make sure to externalize deps that shouldn't be bundled
      // into your library
      external: ['vue', /^three(\/.*)?$/],
      output: {
        // Provide global variables to use in the UMD build
        // for externalized deps
        globals: (id: string) => {
          if (id === 'vue') return 'Vue'
          if (id === 'three') return 'THREE'
          if (id.startsWith('three/')) return 'THREE'
          return id
        }
      }
    }
  },
  plugins: [
    vue(),
    dts({
      // rollupTypes: true,
      insertTypesEntry: true,
      include: ['src']
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
