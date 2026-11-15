import * as THREE from 'three'
import { GLTFLoader as THREEGLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader as THREEFBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { OBJLoader as THREEOBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { MTLLoader as THREEMTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

const OBJECT_STORE = 'THREE_VUE_OBJECT_STORE'
const DB_NAME = 'THREE_VUE_OBJECT_DB'

export default function fileLoader(
  url: string,
  cache: boolean = true,
  onProgress?: (event: LoadEvent) => void
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    if (!cache) {
      fetchWithProgress(url, onProgress).then((data) => {
        resolve(data)
      })
      return
    }
    const key = btoa(url)
    const checkCacheAndLoadModel = () => {
      onProgress?.({ type: 'cache', progress: 0 })
      const request = indexedDB.open(DB_NAME, 2)

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result
        db.createObjectStore(OBJECT_STORE)
      }

      request.onsuccess = (event: any) => {
        const db = event.target.result
        const transaction = db.transaction([OBJECT_STORE], 'readonly')
        const objectStore = transaction.objectStore(OBJECT_STORE)
        const getRequest = objectStore.get(key)

        getRequest.onsuccess = (event: any) => {
          onProgress?.({ type: 'cache', progress: 33.33 })
          const data = event.target.result
          if (!data) {
            cacheModelToIndexedDB()
          } else {
            loadModelFromIndexedDB()
          }
        }

        getRequest.onerror = () => {
          reject('Error checking cache in IndexedDB')
        }
      }

      request.onerror = () => {
        reject('Error opening IndexedDB')
      }
    }

    const cacheModelToIndexedDB = async () => {
      fetchWithProgress(url, onProgress)
        .then((data) => {
          const request = indexedDB.open(DB_NAME, 2)

          request.onupgradeneeded = (event: any) => {
            const db = event.target.result
            db.createObjectStore(OBJECT_STORE)
          }

          request.onsuccess = (event: any) => {
            const db = event.target.result
            const transaction = db.transaction([OBJECT_STORE], 'readwrite')
            const objectStore = transaction.objectStore(OBJECT_STORE)
            const putRequest = objectStore.put(data, key)
            putRequest.onsuccess = () => {
              onProgress?.({ type: 'cache', progress: 66.66 })
              loadModelFromIndexedDB()
            }
          }

          request.onerror = () => {
            reject('Error opening IndexedDB')
          }
        })
        .catch((error) => {
          reject(error)
        })
    }

    const loadModelFromIndexedDB = () => {
      const request = indexedDB.open(DB_NAME, 2)

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result
        db.createObjectStore(OBJECT_STORE)
      }

      request.onsuccess = (event: any) => {
        const db = event.target.result
        const transaction = db.transaction([OBJECT_STORE], 'readonly')
        const objectStore = transaction.objectStore(OBJECT_STORE)
        const getRequest = objectStore.get(key)

        getRequest.onsuccess = (event: any) => {
          const data = event.target.result
          onProgress?.({ type: 'cache', progress: 100 })
          resolve(data)
        }

        getRequest.onerror = () => {
          reject('Error loading Model file from IndexedDB')
        }
      }

      request.onerror = () => {
        reject('Error opening IndexedDB')
      }
    }

    checkCacheAndLoadModel()
  })
}

async function fetchWithProgress(
  url: string,
  onProgress?: (event: LoadEvent) => void
): Promise<ArrayBuffer> {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const contentLength = response.headers.get('Content-Length')
  const totalBytes = contentLength ? parseInt(contentLength, 10) : null
  let loadedBytes = 0

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('Failed to get reader from response body')
  }

  const chunks: Uint8Array[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    chunks.push(value)
    loadedBytes += value.length

    if (onProgress && totalBytes !== null) {
      const progress = (loadedBytes / totalBytes) * 100
      onProgress({ type: 'fetch', progress })
    }
  }

  const arrayBuffer = new Uint8Array(loadedBytes)
  let offset = 0
  for (const chunk of chunks) {
    arrayBuffer.set(chunk, offset)
    offset += chunk.length
  }

  return arrayBuffer.buffer
}

export interface GLTFLoaderOptions {
  /** Enable Draco mesh decompression, default: false */
  draco?: boolean
  /** Base URL of the Draco decoder, default: the official gstatic decoder */
  dracoDecoderPath?: string
}

function getDefaultDecoderPath(): string {
  return 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/'
}

let dracoLoader: DRACOLoader | null = null

function getDRACOLoader(decoderPath?: string): DRACOLoader {
  if (!dracoLoader) {
    dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath(decoderPath || getDefaultDecoderPath())
    dracoLoader.preload()
  }
  return dracoLoader
}

/**
 * Absolute directory of `url`. Parsing relative to it (instead of an empty
 * string) lets `.bin` buffers and textures referenced by a glTF resolve.
 */
function getResourcePath(url: string): string {
  const absolute = typeof document === 'undefined' ? url : new URL(url, document.baseURI).href
  return absolute.slice(0, absolute.lastIndexOf('/') + 1)
}

/**
 * Load a glTF/GLB model.
 *
 * The second argument may either be the `cache` flag, keeping the original
 * positional API, or a `GLTFLoaderOptions` object. The object form is the
 * concise way to enable Draco: `GLTFLoader(url, { draco: true })`.
 */
export async function GLTFLoader(
  url: string,
  cache?: boolean | GLTFLoaderOptions,
  onProgress?: (event: LoadEvent) => void,
  options?: GLTFLoaderOptions
): Promise<THREE.Group> {
  const loaderOptions = typeof cache === 'object' ? cache : options
  const useCache = typeof cache === 'boolean' ? cache : undefined
  const data = await fileLoader(url, useCache, onProgress)
  const loader = new THREEGLTFLoader()
  if (loaderOptions?.draco) {
    loader.setDRACOLoader(getDRACOLoader(loaderOptions.dracoDecoderPath))
  }
  return new Promise((resolve) => {
    onProgress?.({ type: 'parse', progress: 0 })
    loader.parse(data, getResourcePath(url), (gltf) => {
      const model = gltf.scene
      model.animations = gltf.animations
      onProgress?.({ type: 'parse', progress: 100 })
      resolve(model)
    })
  })
}

export async function FBXLoader(
  url: string,
  cache?: boolean,
  onProgress?: (event: LoadEvent) => void
): Promise<THREE.Group> {
  const data = await fileLoader(url, cache)
  const loader = new THREEFBXLoader()
  return new Promise((resolve) => {
    onProgress?.({ type: 'parse', progress: 0 })
    const model = loader.parse(data, '')
    onProgress?.({ type: 'parse', progress: 100 })
    resolve(model)
  })
}

export async function OBJLoader(
  url: string,
  mtlUrl: string,
  cache?: boolean,
  onProgress?: (event: LoadEvent) => void
): Promise<THREE.Group> {
  const data = await fileLoader(url, cache, onProgress)
  const mtlData = await fileLoader(mtlUrl, cache)
  const decoder = new TextDecoder('utf-8')
  const text = decoder.decode(data)
  const mtlText = decoder.decode(mtlData)
  const loader = new THREEOBJLoader()
  const mtlLoader = new THREEMTLLoader()
  const mtl = mtlLoader.parse(mtlText, '')
  loader.setMaterials(mtl)
  return new Promise((resolve) => {
    onProgress?.({ type: 'parse', progress: 0 })
    const model = loader.parse(text)
    onProgress?.({ type: 'parse', progress: 100 })
    resolve(model)
  })
}

/** Release the shared Draco decoder, call when the last model is gone. */
export function disposeDRACOLoader(): void {
  if (dracoLoader) {
    dracoLoader.dispose()
    dracoLoader = null
  }
}

/**
 * Dispose every geometry, material and texture under `model` and detach it from
 * its parent. Call before dropping a loaded model so GPU memory is reclaimed.
 */
export function disposeModel(model: THREE.Object3D): void {
  model.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (mesh.geometry) mesh.geometry.dispose()

    const material = mesh.material
    if (!material) return

    const materials = Array.isArray(material) ? material : [material]
    for (const item of materials) {
      for (const value of Object.values(item)) {
        if (value && typeof value === 'object') {
          const texture = value as THREE.Texture
          if (texture.isTexture) texture.dispose()
        }
      }
      item.dispose()
    }
  })

  model.parent?.remove(model)
}
