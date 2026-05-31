/**
 * Exercise: "Forest under a moving sun"
 * Topics: lighting, shadows, MeshStandardMaterial, geometry merging, instancing
 *
 * Your task: complete the six TODO blocks below so that all three implementations
 * render correctly.  Then switch between them in the GUI.
*/

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import Stats from 'three/examples/jsm/libs/stats.module.js'
import { mergeBufferGeometries as mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import GUI from 'lil-gui'

// ─── Constants (do not change) ────────────────────────────────────────────────
const TREE_COUNT    = 5_000
const SPREAD        = 95
const TRUNK_H       = 2
const TRUNK_R_TOP   = 0.15
const TRUNK_R_BOT   = 0.25
const FOLIAGE_H     = 4
const FOLIAGE_R     = 1.5
const SEG           = 6

// ─── Renderer ─────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
document.body.style.margin   = '0'
document.body.style.overflow = 'hidden'
document.body.appendChild(renderer.domElement)

// ┌─────────────────────────────────────────────────────────────────────────────
// │ TODO 1 — Enable the shadow map (2 properties).
// │
// │ Without the first line the renderer skips every shadow pass entirely,
// │ regardless of castShadow/receiveShadow settings on individual objects.
// │ The second line selects the algorithm; THREE.PCFSoftShadowMap gives smooth
// │ soft-edged shadows at moderate cost.
// │
// │   renderer.shadowMap.??? = ???
// │   renderer.shadowMap.??? = THREE.PCFSoftShadowMap
// └─────────────────────────────────────────────────────────────────────────────

// ─── Scene & Camera ───────────────────────────────────────────────────────────
const scene  = new THREE.Scene()
scene.background = new THREE.Color(0x87ceeb)
scene.fog        = new THREE.Fog(0x87ceeb, 90, 220) 
// ┌─────────────────────────────────────────────────────────────────────────────
// │ QUESTION — Which buffer can be used to create fog?
// | Actually, ThreeJS uses a Vertex Shader + a Fragment Shader
// └─────────────────────────────────────────────────────────────────────────────

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

// ┌─────────────────────────────────────────────────────────────────────────────
// │ TODO 2 — Configure shadow casting on the sun.
// │
// │ Step 1: set  sun.castShadow = true
// │   This activates the shadow pass. The renderer now renders the scene TWICE
// │   each frame: first into a depth-only shadow map, then into the colour buffer.
// │   Every mesh with castShadow = true appears in both passes — that is why the
// │   naive version jumps from 10 k to ~20 k draw calls.
// │
// │ Step 2: set  sun.shadow.mapSize.width  = 2048
// │              sun.shadow.mapSize.height = 2048
// │   Higher resolution gives sharper shadow edges at the cost of GPU memory.
// │
// │ Step 3: configure the shadow camera frustum.
// │   The shadow camera is an OrthographicCamera; its frustum must be large
// │   enough to contain the whole scene, or trees near the edges will lose
// │   their shadows.  Use these values:
// │     sun.shadow.camera.near   = 1
// │     sun.shadow.camera.far    = 400
// │     sun.shadow.camera.left   = -110
// │     sun.shadow.camera.right  =  110
// │     sun.shadow.camera.top    =  110
// │     sun.shadow.camera.bottom = -110
// │
// │ Step 4: set  sun.shadow.bias = -0.001
// │   A small negative bias prevents "shadow acne" — the self-shadowing
// │   moire pattern that appears when a surface shadows itself due to
// │   floating-point precision limits in the depth comparison.
// └─────────────────────────────────────────────────────────────────────────────

scene.add(sun)
scene.add(sun.target)  // the target Object3D must be in the scene too

// ─── Ground plane ─────────────────────────────────────────────────────────────
// Roughness map reused from chapter-10 (texture-rougness-map.js) — the same
// marble texture that demonstrated roughnessMap there now makes grass look
// uneven under grazing light.  This is the direct Ch.10 → Ch.8 connection.
const loader = new THREE.TextureLoader()

const roughnessMap = loader.load('/assets/textures/marble/marble_0008_roughness_2k.jpg', (t) => {
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(12, 12)
})

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
ground.rotation.x    = -Math.PI / 2
ground.receiveShadow = true
scene.add(ground)

// ─── Shared prototype geometries (never mutate these) ─────────────────────────
const baseTrunkGeo   = new THREE.CylinderGeometry(TRUNK_R_TOP, TRUNK_R_BOT, TRUNK_H, SEG)
const baseFoliageGeo = new THREE.ConeGeometry(FOLIAGE_R, FOLIAGE_H, SEG)

// ─── Colour helpers (provided) ────────────────────────────────────────────────
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
// ─────────────────────────────────────────────────────────────────────────────
function buildNaiveForest() {
  const root       = new THREE.Group()
  const trunkMat   = new THREE.MeshStandardMaterial({ color: 0x8b4513 })
  const foliageMat = new THREE.MeshStandardMaterial({ color: 0x228b22 })

  for (let i = 0; i < TREE_COUNT; i++) {
    const { x, z } = randomPos()
    const scale     = 0.7 + Math.random() * 0.6

    // ┌───────────────────────────────────────────────────────────────────────
    // │ TODO 3 — Build one tree as a Group containing two Meshes.
    // │
    // │ a. Create  const tree = new THREE.Group()
    // │    Position it at (x, 0, z) and scale it uniformly with scale.
    // │
    // │ b. Create the trunk:
    // │      new THREE.Mesh(baseTrunkGeo, trunkMat.clone())
    // │    • trunk.position.y = TRUNK_H / 2   (lifts it above the ground)
    // │    • trunk.castShadow    = true
    // │    • trunk.receiveShadow = true
    // │    • trunk.material.color.copy(randomBrown())
    // │
    // │ c. Create the foliage:
    // │      new THREE.Mesh(baseFoliageGeo, foliageMat.clone())
    // │    • foliage.position.y = TRUNK_H + FOLIAGE_H / 2  (sits on top of trunk)
    // │    • foliage.castShadow    = true
    // │    • foliage.receiveShadow = true
    // │    • foliage.material.color.copy(randomGreen())
    // │
    // │ d. tree.add(trunk, foliage)   then   root.add(tree)
    // └───────────────────────────────────────────────────────────────────────
  }
  return root
}

// ─────────────────────────────────────────────────────────────────────────────
//  Implementation 2 — MERGED
// ─────────────────────────────────────────────────────────────────────────────
function buildMergedForest() {
  const trunkGeos   = []
  const foliageGeos = []

  for (let i = 0; i < TREE_COUNT; i++) {
    const { x, z } = randomPos()
    const scale     = 0.7 + Math.random() * 0.6

    // ┌───────────────────────────────────────────────────────────────────────
    // │ TODO 4a — Per-tree geometry preparation (repeat for trunk AND foliage).
    // │
    // │ Step 1 — Clone the base geometry and bake the world transform into it:
    // │
    // │   const tg = baseTrunkGeo.clone()
    // │   tg.applyMatrix4(
    // │     new THREE.Matrix4()
    // │       .makeTranslation(x,  (TRUNK_H / 2) * scale,  z)
    // │       .multiply(new THREE.Matrix4().makeScale(scale, scale, scale))
    // │   )
    // │
    // │   Why T * S?  Vertices are scaled in local space first, then translated
    // │   to world space.  The translation value (TRUNK_H/2)*scale already
    // │   accounts for the fact that the cylinder's centre is at its geometric
    // │   midpoint — so its bottom lands exactly at y = 0.
    // │
    // │ Step 2 — Add a per-vertex colour attribute:
    // │
    // │   const col      = randomBrown()                 // (or randomGreen())
    // │   const vertCount = tg.attributes.position.count
    // │   const colorArr  = new Float32Array(vertCount * 3)
    // │   for (let v = 0; v < vertCount; v++) {
    // │     colorArr[v*3]   = col.r
    // │     colorArr[v*3+1] = col.g
    // │     colorArr[v*3+2] = col.b
    // │   }
    // │   tg.setAttribute('color', new THREE.BufferAttribute(colorArr, 3))
    // │   trunkGeos.push(tg)
    // │
    // │ Repeat steps 1-2 for the foliage geometry.
    // │ Foliage y-translation: (TRUNK_H + FOLIAGE_H / 2) * scale
    // └───────────────────────────────────────────────────────────────────────
  }

  // ┌─────────────────────────────────────────────────────────────────────────
  // │ TODO 4b — After the loop, merge and create the two final meshes.
  // │
  // │   const trunkMesh = new THREE.Mesh(
  // │     mergeGeometries(trunkGeos),
  // │     new THREE.MeshStandardMaterial({ vertexColors: true })
  // │   )
  // │   trunkMesh.castShadow    = true
  // │   trunkMesh.receiveShadow = true
  // │
  // │ Do the same for the foliage, then:
  // │   const root = new THREE.Group()
  // │   root.add(trunkMesh, foliageMesh)
  // │   return root
  // │
  // │ Why vertexColors: true?  The merged geometry has no material.color; all
  // │ colour information lives in the 'color' BufferAttribute.  Without this
  // │ flag the material ignores the attribute and renders everything white.
  // └─────────────────────────────────────────────────────────────────────────

  return new THREE.Group()   // ← replace this with the real implementation
}

// ─────────────────────────────────────────────────────────────────────────────
//  Implementation 3 — INSTANCED
// ─────────────────────────────────────────────────────────────────────────────
function buildInstancedForest() {
  const trunkMat   = new THREE.MeshStandardMaterial({ color: 0x8b4513 })
  const foliageMat = new THREE.MeshStandardMaterial({ color: 0x228b22 })

  // ┌─────────────────────────────────────────────────────────────────────────
  // │ TODO 5a — Create the two InstancedMesh objects.
  // │
  // │   const trunkIM   = new THREE.InstancedMesh(baseTrunkGeo,   trunkMat,   TREE_COUNT)
  // │   const foliageIM = new THREE.InstancedMesh(baseFoliageGeo, foliageMat, TREE_COUNT)
  // │
  // │ Set castShadow = true and receiveShadow = true on both.
  // └─────────────────────────────────────────────────────────────────────────

  const dummy = new THREE.Object3D()

  for (let i = 0; i < TREE_COUNT; i++) {
    const { x, z } = randomPos()
    const scale     = 0.7 + Math.random() * 0.6

    // ┌─────────────────────────────────────────────────────────────────────
    // │ TODO 5b — Set the trunk matrix for instance i.
    // │
    // │   dummy.position.set(x,  (TRUNK_H / 2) * scale,  z)
    // │   dummy.scale.setScalar(scale)
    // │   dummy.updateMatrix()
    // │   trunkIM.setMatrixAt(i, dummy.matrix)
    // │
    // │ Object3D.updateMatrix() computes dummy.matrix = T * R * S from the
    // │ position/quaternion/scale properties.  You must call it explicitly
    // │ because Three.js defers automatic matrix updates for performance.
    // └─────────────────────────────────────────────────────────────────────

    // ┌─────────────────────────────────────────────────────────────────────
    // │ TODO 5c — Set the foliage matrix for instance i.
    // │
    // │   dummy.position.set(x,  (TRUNK_H + FOLIAGE_H / 2) * scale,  z)
    // │   dummy.updateMatrix()          // scale is still set from above
    // │   foliageIM.setMatrixAt(i, dummy.matrix)
    // └─────────────────────────────────────────────────────────────────────

    // ┌─────────────────────────────────────────────────────────────────────
    // │ TODO 5d — Set per-instance colours.
    // │
    // │   trunkIM.setColorAt(i,   randomBrown())
    // │   foliageIM.setColorAt(i, randomGreen())
    // │
    // │ Why does this look better than a flat material.color?
    // │ MeshStandardMaterial shades the colour under the directional light, so
    // │ each tree gets its own unique shading response.  With MeshBasicMaterial
    // │ the colours would be flat tints independent of the light direction.
    // └─────────────────────────────────────────────────────────────────────
  }

  // ┌───────────────────────────────────────────────────────────────────────────
  // │ TODO 5e — Flag instance data for GPU upload.
  // │
  // │   trunkIM.instanceMatrix.needsUpdate   = true
  // │   foliageIM.instanceMatrix.needsUpdate = true
  // │   trunkIM.instanceColor.needsUpdate    = true
  // │   foliageIM.instanceColor.needsUpdate  = true
  // │
  // │ This is the same idiom as  texture.needsUpdate = true  from Chapter 10:
  // │ Three.js marks a GPU buffer dirty and re-uploads it on the next render.
  // │ Without these lines all trees share the default matrix/colour and the
  // │ forest will appear as a single tree (or nothing at all).
  // └───────────────────────────────────────────────────────────────────────────

  const root = new THREE.Group()
  // root.add(trunkIM, foliageIM)   ← uncomment after completing TODO 5a
  return root
}

// ─── Scene switching (provided) ───────────────────────────────────────────────
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
    case 'Naive':     forestGroup = buildNaiveForest();     break
    case 'Merged':    forestGroup = buildMergedForest();    break
    case 'Instanced': forestGroup = buildInstancedForest(); break
  }
  console.timeEnd(name + ' build')

  scene.add(forestGroup)
}

// ─── GUI (provided) ───────────────────────────────────────────────────────────
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

// ─── Benchmark stats panel (provided) ────────────────────────────────────────
const bench = { fps: 0, drawCalls: 0, triangles: 0, geometries: 0 }
const bf    = gui.addFolder('Renderer stats — record these')
bf.add(bench, 'fps').listen().disable()
bf.add(bench, 'drawCalls').name('draw calls').listen().disable()
bf.add(bench, 'triangles').listen().disable()
bf.add(bench, 'geometries').listen().disable()
bf.open()

// ─── Resize (provided) ────────────────────────────────────────────────────────
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

  // ┌─────────────────────────────────────────────────────────────────────────
  // │ TODO 6 — Move the sun along a slow arc across the sky.
  // │
  // │ Use Math.sin and Math.cos of  (t * guiState.sunSpeed)  to trace a circle,
  // │ then wrap Math.abs around the y component so the sun never dips below the
  // │ horizon.  A minimum y offset (e.g. + 15) keeps it visible at "sunrise".
  // │
  // │   sun.position.set(
  // │     Math.sin(t * guiState.sunSpeed) * 100,
  // │     Math.abs(Math.cos(t * guiState.sunSpeed)) * 85 + 15,
  // │     Math.cos(t * guiState.sunSpeed) * 55
  // │   )
  // │
  // │ The sun.target stays at origin (set earlier); you only move the light
  // │ position — Three.js recomputes the direction automatically.
  // └─────────────────────────────────────────────────────────────────────────

  // Provided: colour-tint the sun warmer near the horizon, cooler at noon.
  const elev = sun.position.y / 100
  sun.color.setHSL(0.10 - elev * 0.04, 0.95, 0.45 + elev * 0.35)
  ambient.intensity = 0.15 + elev * 0.45

  controls.update()
  renderer.render(scene, camera)
  stats.update()

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