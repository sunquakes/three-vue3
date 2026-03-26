import * as THREE from 'three'
import { AxisType } from '../enums/AxisType'

function createArrowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 64
  
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)
  
  // 半透明黑色背景
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  
  const arrowWidth = 40
  const arrowHeight = 30
  const spacing = 60
  const lineWidth = 3
  
  // 绘制多个箭头
  for (let x = 10; x < canvas.width; x += spacing) {
    // 外发光效果
    ctx.shadowColor = '#00ffff'
    ctx.shadowBlur = 15
    ctx.strokeStyle = '#00ffff'
    ctx.lineWidth = lineWidth
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    
    // 绘制空心箭头轮廓（箭头朝右）
    ctx.beginPath()
    // 从箭头尾部左上角开始
    ctx.moveTo(x, 32 - arrowHeight / 2)
    // 上边线
    ctx.lineTo(x + arrowWidth - arrowHeight, 32 - arrowHeight / 2)
    // 上斜边
    ctx.lineTo(x + arrowWidth - arrowHeight, 32 - arrowHeight)
    // 箭头尖端
    ctx.lineTo(x + arrowWidth, 32)
    // 下斜边
    ctx.lineTo(x + arrowWidth - arrowHeight, 32 + arrowHeight)
    // 下边线
    ctx.lineTo(x + arrowWidth - arrowHeight, 32 + arrowHeight / 2)
    // 尾部
    ctx.lineTo(x, 32 + arrowHeight / 2)
    ctx.closePath()
    ctx.stroke()
    
    // 内部填充半透明
    ctx.shadowBlur = 0
    ctx.fillStyle = 'rgba(0, 255, 255, 0.2)'
    ctx.fill()
  }
  
  // 添加上下边框发光线
  ctx.shadowColor = '#0088ff'
  ctx.shadowBlur = 10
  ctx.strokeStyle = 'rgba(0, 136, 255, 0.5)'
  ctx.lineWidth = 2
  
  ctx.beginPath()
  ctx.moveTo(0, 6)
  ctx.lineTo(canvas.width, 6)
  ctx.stroke()
  
  ctx.beginPath()
  ctx.moveTo(0, canvas.height - 6)
  ctx.lineTo(canvas.width, canvas.height - 6)
  ctx.stroke()
  
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  
  return texture
}

function createLineGeometry(
  points: THREE.Vector3[],
  width: number,
  axis: AxisType
): { geometry: THREE.BufferGeometry; totalLength: number } {
  const geometry = new THREE.BufferGeometry()
  
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  
  let totalLength = 0
  const lengths: number[] = [0]
  
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    totalLength += new THREE.Vector3().subVectors(curr, prev).length()
    lengths.push(totalLength)
  }
  
  for (let i = 0; i < points.length; i++) {
    const point = points[i]
    const next = i < points.length - 1 ? points[i + 1] : points[i]
    const prev = i > 0 ? points[i - 1] : points[i]
    
    let tangent = new THREE.Vector3().subVectors(next, prev).normalize()
    let normal: THREE.Vector3
    
    if (axis === AxisType.X) {
      normal = new THREE.Vector3(0, tangent.z, -tangent.y).normalize()
    } else if (axis === AxisType.Y) {
      normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize()
    } else {
      normal = new THREE.Vector3(-tangent.y, tangent.x, 0).normalize()
    }
    
    const offset = normal.clone().multiplyScalar(width / 2)
    
    positions.push(
      point.x - offset.x, point.y - offset.y, point.z - offset.z,
      point.x + offset.x, point.y + offset.y, point.z + offset.z
    )
    
    // UV 的 X 方向沿线的长度方向，这样纹理会沿线流动
    const uvX = lengths[i] / totalLength
    uvs.push(uvX, 0, uvX, 1)
    
    if (i < points.length - 1) {
      const base = i * 2
      indices.push(base, base + 1, base + 2)
      indices.push(base + 1, base + 3, base + 2)
    }
  }
  
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  
  return { geometry, totalLength }
}

function getLineMaterial(color?: Array4, textureRepeat?: number): { material: THREE.MeshBasicMaterial; texture: THREE.Texture } {
  const arrowTexture = createArrowTexture()
  
  const material = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 1,
    depthWrite: false,
    side: THREE.DoubleSide,
    map: arrowTexture
  })
  
  if (textureRepeat !== undefined) {
    arrowTexture.repeat.set(textureRepeat, 1)
  }
  
  return { material, texture: arrowTexture }
}

export default class FlowLineMesh extends THREE.Mesh {
  private texture!: THREE.Texture
  private speed: number = 1
  private startTime: number = Date.now()

  constructor(options: FlowLineMeshOptions = {}) {
    const points = options.points ?? [
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 0.5, 0),
      new THREE.Vector3(1, 0, 0)
    ]
    const width = options.width ?? 0.05
    const color = options.color ?? [0.0, 0.8, 1.0, 1]
    const axis = options.axis ?? AxisType.Z
    const textureRepeat = options.textureRepeat ?? 20
    const speed = options.speed ?? 1
    
    const { geometry } = createLineGeometry(points, width, axis)
    const { material, texture } = getLineMaterial(color, textureRepeat)
    super(geometry, material)
    this.texture = texture
    this.speed = speed
    this.startAnimation()
  }

  private startAnimation() {
    this.startTime = Date.now()
    const animate = () => {
      const now = Date.now()
      const offset = ((now - this.startTime) / 1000) * this.speed
      // 沿 X 方向（线的长度方向）流动
      this.texture.offset = new THREE.Vector2(-offset, 0)
      requestAnimationFrame(animate)
    }
    animate()
  }
}
