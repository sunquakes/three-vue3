import * as THREE from 'three'

export default class SkyBox {
  public scene: THREE.CubeTexture

  private disposed = false

  constructor(images: string[]) {
    this.scene = this.load(images)
  }

  private load(images: string[]): THREE.CubeTexture {
    const loader = new THREE.CubeTextureLoader()
    const texture = loader.load(images)
    // CubeTexture used as scene.background must be in SRGBColorSpace,
    // otherwise WebGPU treats it as linear and the skybox appears black.
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }

  /**
   * Dispose the cube texture and release GPU memory.
   * Safe to call more than once.
   */
  public dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.scene.dispose()
  }
}
