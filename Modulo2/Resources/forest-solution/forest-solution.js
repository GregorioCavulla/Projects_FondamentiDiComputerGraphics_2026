/**
 * Exercise: "Forest under a moving sun"
 * Topics: lighting, shadows, MeshStandardMaterial, geometry merging, instancing
 *
 * Three implementations of 5,000 trees. Switch between them in the GUI and
 * compare the numbers in the "Renderer stats" panel.
*/

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import Stats from 'three/examples/jsm/libs/stats.module.js'
import { mergeBufferGeometries as mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import GUI from 'lil-gui'

// ─── Constants ────────────────────────────────────────────────────────────────
const TREE_COUNT    = 5000
const SPREAD        = 100       // trees scattered inside ±SPREAD on X and Z
const TRUNK_H       = 2        // cylinder height
const TRUNK_R_TOP   = 0.15
const TRUNK_R_BOT   = 0.25
const FOLIAGE_H     = 4        // cone height
const FOLIAGE_R     = 1.5
const SEG           = 6        // radial segments — low-poly keeps triangles lean

// ─── Renderer ─────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
document.body.style.margin   = '0'
document.body.style.overflow = 'hidden'
document.body.appendChild(renderer.domElement)

// Enable shadows — this is the one flag you must flip; without it the renderer
// skips every shadow pass regardless of castShadow/receiveShadow settings.
renderer.shadowMap.enabled = true
renderer.shadowMap.type    = THREE.PCFSoftShadowMap

// ─── Scene & Camera ───────────────────────────────────────────────────────────
const scene  = new THREE.Scene()
scene.background = new THREE.Color(0x87ceeb)
scene.fog        = new THREE.Fog(0x87ceeb, 90, 220)

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000)
camera.position.set(0, 30, 70)

const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0, 5, 0)
controls.update()

// ─── Stats overlay ────────────────────────────────────────────────────────────
const stats = Stats()
document.body.appendChild(stats.dom)

// ─── Ambient light ────────────────────────────────────────────────────────────
const ambient = new THREE.AmbientLight(0xffffff, 0.4)
scene.add(ambient)

// ─── Sun (DirectionalLight) ───────────────────────────────────────────────────
const sun = new THREE.DirectionalLight(0xfff4e0, 2.5)
sun.position.set(80, 80, 20)

// castShadow activates the shadow pass. The renderer now renders the scene
// TWICE each frame: once into the shadow map (depth only), once into the
// colour buffer. Every mesh with castShadow = true participates in both passes,
// which is why the naive version goes from 10 k to ~20 k draw calls.
sun.castShadow            = true
sun.shadow.mapSize.width  = 2048
sun.shadow.mapSize.height = 2048
// The shadow camera is an OrthographicCamera whose frustum must cover the scene.
sun.shadow.camera.near   = 1
sun.shadow.camera.far    = 400
sun.shadow.camera.left   = -110
sun.shadow.camera.right  =  110
sun.shadow.camera.top    =  110
sun.shadow.camera.bottom = -110
// A small negative bias prevents "shadow acne" (self-shadowing artefacts).
sun.shadow.bias = -0.001

scene.add(sun)
scene.add(sun.target)   // target stays at origin; must be in the scene

// ─── Ground plane ─────────────────────────────────────────────────────────────
// Roughness map borrowed from chapter-10 marble example.
// It makes the ground surface react to grazing light like real grass — a flat
// roughness value would look plastic.  This ties Chapter 10 texture work to
// the Chapter 8 lighting concepts.
const loader = new THREE.TextureLoader()

const roughnessMap = loader.load('/assets/textures/marble/marble_0008_roughness_2k.jpg', (t) => {
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(12, 12)
})

// Grass is not metallic — a very-dark metalness map keeps metalness near zero
// while still demonstrating the metalnessMap slot from chapter-10.
const metalnessMap = loader.load('/assets/textures/marble/marble_0008_roughness_2k.jpg', (t) => {
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(12, 12)
})

const groundMat = new THREE.MeshStandardMaterial({
  color:        0x4a7c3f,
  roughness:    0.9,
  metalness:    0.0,
  roughnessMap,
  metalnessMap
})

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry((SPREAD + 5) * 2, (SPREAD + 5) * 2),
  groundMat
)
ground.rotation.x   = -Math.PI / 2
ground.receiveShadow = true
scene.add(ground)

// ─── Shared prototype geometries (never mutated) ──────────────────────────────
const baseTrunkGeo   = new THREE.CylinderGeometry(TRUNK_R_TOP, TRUNK_R_BOT, TRUNK_H, SEG)
const baseFoliageGeo = new THREE.ConeGeometry(FOLIAGE_R, FOLIAGE_H, SEG)

// ─── Colour helpers ───────────────────────────────────────────────────────────
const randomGreen = () =>
  new THREE.Color(
    0.05 + Math.random() * 0.06,
    0.28 + Math.random() * 0.28,
    0.03 + Math.random() * 0.05
  )

const randomBrown = () =>
  new THREE.Color(
    0.28 + Math.random() * 0.22,
    0.12 + Math.random() * 0.10,
    0.01 + Math.random() * 0.04
  )

const randomPos = () => ({
  x: (Math.random() - 0.5) * 2 * SPREAD,
  z: (Math.random() - 0.5) * 2 * SPREAD
})

// ─────────────────────────────────────────────────────────────────────────────
//  Implementation 1 — NAIVE
//  5,000 THREE.Group objects, each containing two Meshes (10,000 meshes total).
//  With castShadow enabled on every mesh the shadow pass doubles the draw calls.
// ─────────────────────────────────────────────────────────────────────────────
function buildNaiveForest() {
  const root       = new THREE.Group()
  const trunkMat   = new THREE.MeshStandardMaterial({ color: 0x8b4513 })
  const foliageMat = new THREE.MeshStandardMaterial({ color: 0x228b22 })

  for (let i = 0; i < TREE_COUNT; i++) {
    const { x, z } = randomPos()
    const scale     = 0.7 + Math.random() * 0.6

    const tree = new THREE.Group()
    tree.position.set(x, 0, z)
    tree.scale.setScalar(scale)

    const trunk = new THREE.Mesh(baseTrunkGeo, trunkMat.clone())
    trunk.position.y    = TRUNK_H / 2
    trunk.castShadow    = true
    trunk.receiveShadow = true
    trunk.material.color.copy(randomBrown())

    const foliage = new THREE.Mesh(baseFoliageGeo, foliageMat.clone())
    foliage.position.y    = TRUNK_H + FOLIAGE_H / 2
    foliage.castShadow    = true
    foliage.receiveShadow = true
    foliage.material.color.copy(randomGreen())

    tree.add(trunk, foliage)
    root.add(tree)
  }
  return root
}

// ─────────────────────────────────────────────────────────────────────────────
//  Implementation 2 — MERGED
//  One merged BufferGeometry for all trunks, one for all foliage (2 meshes).
//  Per-tree colour is encoded as a vertex colour attribute so MeshStandardMaterial
//  can still shade it under the directional light.
// ─────────────────────────────────────────────────────────────────────────────
function buildMergedForest() {
  const trunkGeos   = []
  const foliageGeos = []

  for (let i = 0; i < TREE_COUNT; i++) {
    const { x, z } = randomPos()
    const scale     = 0.7 + Math.random() * 0.6

    // Clone, then apply a TRS matrix so the geometry lands at its world position.
    // makeTranslation(tx,ty,tz).multiply(makeScale(s,s,s)) = T*S matrix:
    // vertices are first scaled in local space, then translated to world space.

    const tg = baseTrunkGeo.clone()
    tg.applyMatrix4(
      new THREE.Matrix4()
        .makeTranslation(x, (TRUNK_H / 2) * scale, z)
        .multiply(new THREE.Matrix4().makeScale(scale, scale, scale))
    )
    // Attach a per-vertex colour attribute so vertexColors:true works later.
    const tc  = randomBrown()
    const tca = new Float32Array(tg.attributes.position.count * 3)
    for (let v = 0; v < tg.attributes.position.count; v++) {
      tca[v * 3] = tc.r;  tca[v * 3 + 1] = tc.g;  tca[v * 3 + 2] = tc.b
    }
    tg.setAttribute('color', new THREE.BufferAttribute(tca, 3))
    trunkGeos.push(tg)

    const fg = baseFoliageGeo.clone()
    fg.applyMatrix4(
      new THREE.Matrix4()
        .makeTranslation(x, (TRUNK_H + FOLIAGE_H / 2) * scale, z)
        .multiply(new THREE.Matrix4().makeScale(scale, scale, scale))
    )
    const fc  = randomGreen()
    const fca = new Float32Array(fg.attributes.position.count * 3)
    for (let v = 0; v < fg.attributes.position.count; v++) {
      fca[v * 3] = fc.r;  fca[v * 3 + 1] = fc.g;  fca[v * 3 + 2] = fc.b
    }
    fg.setAttribute('color', new THREE.BufferAttribute(fca, 3))
    foliageGeos.push(fg)
  }

  const trunkMesh = new THREE.Mesh(
    mergeGeometries(trunkGeos),
    new THREE.MeshStandardMaterial({ vertexColors: true })
  )
  trunkMesh.castShadow    = true
  trunkMesh.receiveShadow = true

  const foliageMesh = new THREE.Mesh(
    mergeGeometries(foliageGeos),
    new THREE.MeshStandardMaterial({ vertexColors: true })
  )
  foliageMesh.castShadow    = true
  foliageMesh.receiveShadow = true

  const root = new THREE.Group()
  root.add(trunkMesh, foliageMesh)
  return root
}

// ─────────────────────────────────────────────────────────────────────────────
//  Implementation 3 — INSTANCED
//  One InstancedMesh per part (2 draw calls for colour pass, 2 for shadow pass).
//  setColorAt gives each tree a different green that responds to lighting because
//  we use MeshStandardMaterial — try swapping to MeshBasicMaterial and compare.
// ─────────────────────────────────────────────────────────────────────────────
function buildInstancedForest() {
  const trunkMat   = new THREE.MeshStandardMaterial({ color: 0x8b4513 })
  const foliageMat = new THREE.MeshStandardMaterial({ color: 0x228b22 })

  const trunkIM   = new THREE.InstancedMesh(baseTrunkGeo,   trunkMat,   TREE_COUNT)
  const foliageIM = new THREE.InstancedMesh(baseFoliageGeo, foliageMat, TREE_COUNT)

  trunkIM.castShadow    = true
  trunkIM.receiveShadow = true
  foliageIM.castShadow    = true
  foliageIM.receiveShadow = true

  const dummy = new THREE.Object3D()

  for (let i = 0; i < TREE_COUNT; i++) {
    const { x, z } = randomPos()
    const scale     = 0.7 + Math.random() * 0.6

    // Trunk
    dummy.position.set(x, (TRUNK_H / 2) * scale, z)
    dummy.scale.setScalar(scale)
    dummy.updateMatrix()
    trunkIM.setMatrixAt(i, dummy.matrix)

    // Foliage
    dummy.position.set(x, (TRUNK_H + FOLIAGE_H / 2) * scale, z)
    dummy.updateMatrix()
    foliageIM.setMatrixAt(i, dummy.matrix)

    // Per-instance colour — mirrors the texture.needsUpdate = true idiom from Ch.10
    trunkIM.setColorAt(i,   randomBrown())
    foliageIM.setColorAt(i, randomGreen())
  }

  // Without these flags the GPU buffer is never uploaded and all trees share the
  // default colour.  Same pattern as texture.needsUpdate = true.
  trunkIM.instanceMatrix.needsUpdate   = true
  foliageIM.instanceMatrix.needsUpdate = true
  trunkIM.instanceColor.needsUpdate    = true
  foliageIM.instanceColor.needsUpdate  = true

  const root = new THREE.Group()
  root.add(trunkIM, foliageIM)
  return root
}

// ─── Scene switching ──────────────────────────────────────────────────────────
let forestGroup = null

function loadImplementation(name) {
  if (forestGroup) {
    scene.remove(forestGroup)
    forestGroup.traverse((obj) => {
      if (!obj.isMesh) return
      obj.geometry.dispose()
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      mats.forEach((m) => m.dispose())
    })
  }

  console.time(name + ' build')
  switch (name) {
    case 'Naive':     forestGroup = buildNaiveForest();    break
    case 'Merged':    forestGroup = buildMergedForest();   break
    case 'Instanced': forestGroup = buildInstancedForest(); break
  }
  console.timeEnd(name + ' build')

  scene.add(forestGroup)
}

// ─── GUI ──────────────────────────────────────────────────────────────────────
const guiState = { implementation: 'Instanced', sunSpeed: 0.12, shadows: true }

const gui = new GUI({ title: 'Forest Benchmark' })
gui.add(guiState, 'implementation', ['Naive', 'Merged', 'Instanced'])
   .name('Implementation')
   .onChange((v) => loadImplementation(v))
gui.add(guiState, 'sunSpeed', 0, 0.5, 0.01).name('Sun speed')
gui.add(guiState, 'shadows').name('Shadows on').onChange((v) => {
  renderer.shadowMap.enabled = v
  scene.traverse((obj) => { if (obj.isMesh) obj.material.needsUpdate = true })
})

// ─── Benchmark stats panel ────────────────────────────────────────────────────
// Live-polling read-only counters. Record these numbers for each implementation
// and fill in the table in your report.
const bench = { fps: 0, drawCalls: 0, triangles: 0, geometries: 0 }
const bf    = gui.addFolder('Renderer stats — record these')
bf.add(bench, 'fps').listen().disable()
bf.add(bench, 'drawCalls').name('draw calls').listen().disable()
bf.add(bench, 'triangles').listen().disable()
bf.add(bench, 'geometries').listen().disable()
bf.open()

// ─── Resize ───────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

// ─── Animation loop ───────────────────────────────────────────────────────────
const clock      = new THREE.Clock()
let frameCount   = 0
let fpsTimestamp = 0

function animate(now) {
  requestAnimationFrame(animate)
  frameCount++

  const t = clock.getElapsedTime()

  // Move the sun along a slow horizontal arc, keeping it above the horizon.
  // sin/cos traces a circle; abs(cos) folds the y so it never dips below ground.
  sun.position.set(
    Math.sin(t * guiState.sunSpeed) * 100,
    Math.abs(Math.cos(t * guiState.sunSpeed)) * 85 + 15,
    Math.cos(t * guiState.sunSpeed) * 55
  )

  // Tint the light warm (sunrise/sunset) or neutral (noon) based on elevation.
  const elev = sun.position.y / 100            // 0 near horizon, ~1 at zenith
  sun.color.setHSL(0.10 - elev * 0.04, 0.95, 0.45 + elev * 0.35)
  ambient.intensity = 0.15 + elev * 0.45

  controls.update()
  renderer.render(scene, camera)   // ← read renderer.info AFTER this call
  stats.update()

  // Sample renderer.info every 500 ms (values reset at the start of each render).
  if (now - fpsTimestamp >= 500) {
    bench.fps         = Math.round(frameCount * 2)
    bench.drawCalls   = renderer.info.render.calls
    bench.triangles   = renderer.info.render.triangles
    bench.geometries  = renderer.info.memory.geometries
    frameCount        = 0
    fpsTimestamp      = now
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
loadImplementation(guiState.implementation)
animate(0)
