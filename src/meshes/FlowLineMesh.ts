import * as THREE from 'three'
import { AxisType } from '../enums/AxisType'

function createArrowTexture(arrowColor: [number, number, number]): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)
  
  // Fully transparent background
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  
  const arrowWidth = 80
  const arrowHeight = 50
  const spacing = 100
  const lineWidth = 12
  
  // Draw multiple V-shaped arrows (pointing up)
  for (let x = 20; x < canvas.width; x += spacing) {
    const r = Math.round(arrowColor[0] * 255)
    const g = Math.round(arrowColor[1] * 255)
    const b = Math.round(arrowColor[2] * 255)
    
    // Fill arrow with solid color
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
    ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`
    ctx.lineWidth = lineWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    
    // Draw V-shaped arrow (pointing up)
    ctx.beginPath()
    ctx.moveTo(x, 64 + arrowHeight / 2)
    ctx.lineTo(x + arrowWidth / 2, 64 - arrowHeight / 2)
    ctx.lineTo(x + arrowWidth, 64 + arrowHeight / 2)
    ctx.stroke()
  }
  
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
    
    // UV X direction follows the line length direction, so texture flows along the line
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

function getLineMaterial(
  color: [number, number, number, number],
  arrowColor: [number, number, number],
  textureRepeat?: number
): { material: THREE.ShaderMaterial; texture: THREE.Texture } {
  const arrowTexture = createArrowTexture(arrowColor)
  
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      time: { value: 0 },
      lineColor: { value: color },
      arrowColor: { value: arrowColor },
      arrowTexture: { value: arrowTexture },
      textureRepeat: { value: textureRepeat ?? 10 }
    },
    vertexShader: `
      varying vec2 vUv;
      
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform vec4 lineColor;
      uniform vec3 arrowColor;
      uniform sampler2D arrowTexture;
      uniform float textureRepeat;
      varying vec2 vUv;
      
      void main() {
        vec2 uv = vUv;
        // Flow along X direction
        uv.x = fract(uv.x * textureRepeat + time);
        
        vec4 texColor = texture2D(arrowTexture, uv);
        
        // Calculate gradient from center to edges (Y direction) - glow effect
        float centerDist = abs(vUv.y - 0.5) * 2.0;
        float alpha = 1.0 - centerDist;
        
        // Background color gradient transparency
        float bgAlpha = (1.0 - centerDist) * lineColor.a;
        
        // Arrow brightness (use max channel as brightness)
        float arrowBrightness = max(max(texColor.r, texColor.g), texColor.b);
        
        // Mix background and arrows
        vec3 bgColor = lineColor.rgb;
        vec3 finalColor = mix(bgColor, arrowColor, arrowBrightness);
        float finalAlpha = max(bgAlpha, alpha * arrowBrightness);
        
        gl_FragColor = vec4(finalColor, finalAlpha);
      }
    `
  })
  
  return { material, texture: arrowTexture }
}

export default class FlowLineMesh extends THREE.Mesh {
  private flowMaterial!: THREE.ShaderMaterial
  private speed: number = 1
  private startTime: number = Date.now()

  constructor(options: FlowLineMeshOptions = {}) {
    const points = options.points ?? [
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 0.5, 0),
      new THREE.Vector3(1, 0, 0)
    ]
    const width = options.width ?? 0.05
    const color = options.color ?? [0, 0.5, 1, 0.5]
    const arrowColor = options.arrowColor ?? [1, 1, 1]
    const axis = options.axis ?? AxisType.Z
    const textureRepeat = options.textureRepeat ?? 20
    const speed = options.speed ?? 0.3
    
    const { geometry } = createLineGeometry(points, width, axis)
    const { material, texture } = getLineMaterial(color, arrowColor, textureRepeat)
    super(geometry, material)
    this.flowMaterial = material as THREE.ShaderMaterial
    this.speed = speed
    this.startAnimation()
  }

  private startAnimation() {
    this.startTime = Date.now()
    const animate = () => {
      const now = Date.now()
      const time = ((now - this.startTime) / 1000) * this.speed
      // Update time uniform in shader
      this.flowMaterial.uniforms.time.value = time
      requestAnimationFrame(animate)
    }
    animate()
  }
}
