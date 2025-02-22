import * as THREE from 'three'
import { AxisType } from '../enums/AxisType'

function getGeometry(axis: AxisType, radius: number): THREE.CircleGeometry {
  const geometry = new THREE.CircleGeometry(radius)
  let rotateMatrix: THREE.Matrix4
  if (axis === AxisType.X) {
    rotateMatrix = new THREE.Matrix4().makeRotationY((Math.PI / 180) * 90)
  } else if (axis === AxisType.Y) {
    rotateMatrix = new THREE.Matrix4().makeRotationX((-Math.PI / 180) * 90)
  } else {
    rotateMatrix = new THREE.Matrix4()
  }
  geometry.applyMatrix4(rotateMatrix)
  return geometry
}

function getMaterial(radius?: number, color?: Array4): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    uniforms: {
      time: { value: 0 },
      radius: { value: radius ?? 1 },
      center: { value: [0, 0, 0] },
      color: { value: color ?? [0.6, 0.96, 0.98, 1] }
    },
    vertexShader: `
            varying vec2 vUv;
            varying vec3 pos;

            void main() {
              pos = position.xyz;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
            `,
    fragmentShader: `
            uniform float time;
            uniform float radius;
            uniform vec3 center;
            uniform vec4 color;
            varying vec3 pos;

            void main() {
              gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
              if (gl_FrontFacing == false) discard;
              float dis = distance(pos, center);
              float per = fract(time);
              if (per < 0.5) {
                per += 0.5;
              }
              float alpha = 1.0 - dis / per / radius;
              float m = per * radius;
              if (dis >= 0.5 * m && dis <= 0.52 * m || dis >= 0.7 * m && dis <= 0.72 * m) {
                alpha = 0.8;
              }
        
              gl_FragColor = vec4(color[0], color[1], color[2], alpha);
            }
            `
  })
  return material
}

export default class WaveCircleMesh extends THREE.Mesh {
  constructor(options: WaveCircleMeshOptions = {}) {
    const geometry = getGeometry(options.verticalAxis ?? AxisType.Y, options.radius ?? 1)
    const material = getMaterial(options.radius, options.color)
    super(geometry, material)
    this.create(geometry, material, options.speed ?? 1)
  }

  create(
    geometry: THREE.CircleGeometry,
    material: THREE.ShaderMaterial,
    speed: number
  ) {
    const circle = new THREE.Mesh(geometry, material)
    circle.updateMatrix()
    function animate() {
      requestAnimationFrame(animate)
      material.uniforms.time.value += 0.005 * speed
    }
    animate()
  }
}
