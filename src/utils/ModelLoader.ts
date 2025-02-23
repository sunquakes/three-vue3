import * as THREE from 'three'
import { GLTFLoader as THREEGLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader as THREEFBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { OBJLoader as THREEOBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { MTLLoader as THREEMTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js'

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

export async function GLTFLoader(
  url: string,
  cache?: boolean,
  onProgress?: (event: LoadEvent) => void
): Promise<THREE.Group> {
  const data = await fileLoader(url, cache, onProgress)
  const loader = new THREEGLTFLoader()
  return new Promise((resolve) => {
    onProgress?.({ type: 'parse', progress: 0 })
    loader.parse(data, '', (gltf) => {
      const model = gltf.scene
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
