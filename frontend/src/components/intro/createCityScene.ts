import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { Sky } from "three/addons/objects/Sky.js";
import { createVolumetricClouds } from "./volumetricClouds";
import { createRealisticMaterials } from "./realisticMaterials";
import { buildKassaiCampus, createDeikSignTexture } from "./kassaiCampus";
import { connectionProgress, FLIGHT_DURATION, flightColors as colors } from "./flightTokens";
import { campusReference, existingSensors, geoToScene, greatChurch } from "./campusGeography";

interface FlightSceneOptions {
  onProgress: (time: number) => void;
  onPause: () => void;
  onContextLost: () => void;
  initialTime: number;
}

type Pose = { time: number; position: [number, number, number]; target: [number, number, number]; fov: number };
const poses: Pose[] = [
  { time: 0, position: [-1900, 8700, 6500], target: [-650, 0, 450], fov: 46 },
  { time: 1.6, position: [-2100, 3600, 2800], target: [-700, 0, 200], fov: 49 },
  { time: 3.3, position: [385, 470, -520], target: [-160, 0, 100], fov: 46 },
  { time: 4.55, position: [78, 78, -110], target: [-5, 5, 35], fov: 52 },
  { time: 5.2, position: [13, 3.6, -26], target: [0, 6.2, 10], fov: 60 },
  { time: 6.3, position: [5, 3.2, -20], target: [0, 5.5, 8], fov: 59 },
  { time: 7.35, position: [-5, 3.8, -23], target: [0, 5.2, 6], fov: 58 },
  { time: 8, position: [175, 340, -280], target: [-125, 0, 95], fov: 54 },
  { time: 9.5, position: [3000, 15000, 17000], target: [1700, 0, 1700], fov: 58 },
  { time: 11.5, position: [3300, 32000, 27000], target: [1700, 0, 1700], fov: 48 },
];
const smooth = (value: number) => { const t = THREE.MathUtils.clamp(value, 0, 1); return t * t * (3 - 2 * t); };
const random = (index: number) => { const n = Math.sin(index * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };

export function createCityScene(canvas: HTMLCanvasElement, options: FlightSceneOptions) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 700 ? 1.25 : 1.5));
  renderer.setClearColor(colors.sky);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(colors.sky);
  const fog = new THREE.FogExp2(colors.sky, 0.000018); scene.fog = fog;
  const camera = new THREE.PerspectiveCamera(48, 1, 0.15, 140000);
  const composer = new EffectComposer(renderer);
  const ambientOcclusion = new SSAOPass(scene, camera, 512, 320, 12);
  ambientOcclusion.kernelRadius = 1.8;
  ambientOcclusion.ssaoMaterial.fragmentShader = ambientOcclusion.ssaoMaterial.fragmentShader.replace("1.0 - occlusion", "1.0 - occlusion * 0.5");
  ambientOcclusion.enabled = false;
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.32, 0.6, 1.7);
  const clouds = createVolumetricClouds(renderer);
  const surfaces = createRealisticMaterials();
  const output = new OutputPass();
  composer.addPass(new RenderPass(scene, camera)); composer.addPass(ambientOcclusion); composer.addPass(bloom); composer.addPass(clouds.pass); composer.addPass(output);

  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const instances: THREE.InstancedMesh[] = [];
  const geometry = <T extends THREE.BufferGeometry>(value: T): T => { geometries.add(value); return value; };
  const material = <T extends THREE.Material>(value: T): T => { materials.add(value); return value; };
  const finish = (color: string, roughness = 0.85) => material(new THREE.MeshStandardMaterial({ color, roughness }));
  const grass = surfaces.surface(colors.grass, "terrain");
  const lawn = surfaces.surface(colors.lawn, "grass");
  const cream = surfaces.surface(colors.cream, "plaster");
  const white = surfaces.surface(colors.white, "plaster");
  const concrete = surfaces.surface(colors.concrete, "paving");
  const road = surfaces.surface(colors.road, "asphalt");
  const path = surfaces.surface(colors.path, "paving");
  const roof = surfaces.surface(colors.roof, "roof");
  const glass = material(new THREE.MeshPhysicalMaterial({ color: colors.glass, roughness: 0.12, metalness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.6 }));
  const darkGlass = material(new THREE.MeshPhysicalMaterial({ color: colors.glassDark, roughness: 0.19, metalness: 0.38, clearcoat: 1, envMapIntensity: 1.2 }));
  const trunk = finish(colors.trunk);
  const foliage = surfaces.foliage;
  const unitBox = geometry(new THREE.BoxGeometry(1, 1, 1));
  const sphere = geometry(new THREE.IcosahedronGeometry(1, 2));
  const foliagePlanes = [0, Math.PI / 3, -Math.PI / 3].map((angle) => geometry(new THREE.PlaneGeometry(2, 2).rotateY(angle)));
  const canopyGeometry = geometry(mergeGeometries(foliagePlanes));
  const world = new THREE.Group(); scene.add(world);
  const campus = new THREE.Group(); campus.name = "DEIK-Kassai-campus"; world.add(campus);
  campus.userData = { ...campusReference, entranceScenePosition: [0, 0, 0] };
  const hemisphere = new THREE.HemisphereLight(colors.cloud, colors.cloudShadow, 0.75); scene.add(hemisphere);
  const sunlight = new THREE.DirectionalLight(colors.cloudWarm, 2.4);
  sunlight.position.set(-120, 180, -90); sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(1536, 1536);
  Object.assign(sunlight.shadow.camera, { left: -130, right: 130, top: 150, bottom: -110, near: 1, far: 600 });
  sunlight.shadow.bias = -0.0004; sunlight.shadow.normalBias = 0.12;
  sunlight.target.position.set(0, 0, 30); scene.add(sunlight, sunlight.target);

  const dummy = new THREE.Object3D();
  const matrix = (x: number, y: number, z: number, sx: number, sy: number, sz: number, rotation = 0) => {
    dummy.position.set(x, y, z); dummy.scale.set(sx, sy, sz); dummy.rotation.set(0, rotation, 0); dummy.updateMatrix(); return dummy.matrix.clone();
  };
  function mesh(shape: THREE.BufferGeometry, surface: THREE.Material, position: number[], parent: THREE.Group | THREE.Scene = world) {
    const object = new THREE.Mesh(geometry(shape), surface); object.position.set(position[0], position[1], position[2]); parent.add(object); return object;
  }
  function box(x: number, y: number, z: number, width: number, height: number, depth: number, surface: THREE.Material, parent = campus) {
    const object = mesh(unitBox, surface, [x, y, z], parent); object.scale.set(width, height, depth); return object;
  }
  function batch(shape: THREE.BufferGeometry, surface: THREE.Material, transforms: THREE.Matrix4[], palette?: readonly string[]) {
    const object = new THREE.InstancedMesh(shape, surface, transforms.length);
    transforms.forEach((value, index) => {
      object.setMatrixAt(index, value);
      if (palette) object.setColorAt(index, new THREE.Color(palette[index % palette.length]));
    });
    world.add(object); instances.push(object); return object;
  }
  const sky = new Sky(); sky.scale.setScalar(160000);
  const skyUniforms = sky.material.uniforms;
  skyUniforms.turbidity.value = 3.8; skyUniforms.rayleigh.value = 1.5;
  skyUniforms.mieCoefficient.value = 0.004; skyUniforms.mieDirectionalG.value = 0.82;
  skyUniforms.sunPosition.value.copy(sunlight.position).normalize();
  const environmentScene = new THREE.Scene(); environmentScene.add(sky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(environmentScene, 0.04, 1, 200000); pmrem.dispose();
  scene.environment = environment.texture; scene.environmentIntensity = 0.24;
  scene.add(sky);
  const ground = mesh(new THREE.PlaneGeometry(120000, 120000), grass, [0, -3, 0]); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  const houseShape = new THREE.Shape(); houseShape.moveTo(-0.5, 0); houseShape.lineTo(0, 0.45); houseShape.lineTo(0.5, 0); houseShape.closePath();
  const roofGeometry = geometry(new THREE.ExtrudeGeometry(houseShape, { depth: 1, bevelEnabled: false })); roofGeometry.translate(0, 0, -0.5);
  const houses: THREE.Matrix4[] = []; const roofs: THREE.Matrix4[] = []; const streets: THREE.Matrix4[] = []; const leaves: THREE.Matrix4[] = []; const trunks: THREE.Matrix4[] = []; const treeShadows: THREE.Matrix4[] = [];
  const churchPosition = new THREE.Vector3(...geoToScene(greatChurch.lat, greatChurch.lng));
  const inForest = (x: number, z: number) => ((x + 1300) / 1450) ** 2 + ((z + 2300) / 1550) ** 2 < 1;
  function addTree(x: number, z: number, size: number, detailed = false) {
    treeShadows.push(matrix(x + size * 0.2, 0.12, z + size * 0.25, size * 0.72, 1, size * 0.52));
    trunks.push(matrix(x, size * 0.3, z, size * 0.1, size * 0.6, size * 0.1));
    leaves.push(matrix(x, size * 0.78, z, size * 0.48, size * 0.6, size * 0.48));
    if (detailed) {
      leaves.push(matrix(x - size * 0.24, size * 0.6, z + size * 0.1, size * 0.35, size * 0.4, size * 0.35));
      leaves.push(matrix(x + size * 0.23, size * 0.64, z - size * 0.12, size * 0.32, size * 0.42, size * 0.32));
    }
  }
  const streetPoint = (column: number, row: number) => new THREE.Vector3(column * 90 + Math.sin(row * 0.35) * 42 + Math.sin(column * 0.17) * 14, 0, row * 90 + Math.sin(column * 0.25) * 30);
  for (let row = -40; row <= 42; row++) for (let column = -44; column <= 44; column++) {
    const point = streetPoint(column, row);
    const x = point.x; const z = point.z; const seed = random(row * 79 + column * 17);
    const urbanDensity = Math.max(0, Math.min(1, (4800 - Math.hypot(x + 600, z - 300)) / 1700));
    if (seed > urbanDensity || inForest(x, z) || (x > -620 && x < 220 && z > -170 && z < 360)) continue;
    if (Math.hypot(x - churchPosition.x, z - churchPosition.z) < 130) continue;
    const height = 7 + seed * 14; const width = 17 + seed * 20; const depth = 18 + random(row + column * 3) * 20;
    const jitter = (random(row * 31 + column * 13) - 0.5) * 10;
    const orientation = (random(row * 43 + column * 23) - 0.5) * 0.15;
    houses.push(matrix(x - 15 + jitter, height / 2, z + 12, width, height, depth, orientation));
    if (seed < 0.86) roofs.push(matrix(x - 15 + jitter, height, z + 12, width + 2, 10, depth + 2, orientation));
    if (seed > 0.35) {
      houses.push(matrix(x + 27, height * 0.3, z - 20, 16, height * 0.6, 21));
      roofs.push(matrix(x + 27, height * 0.6, z - 20, 18, 7, 23));
    }
    for (const [a, b] of [[streetPoint(column + 0.5, row - 0.5), streetPoint(column + 0.5, row + 0.5)], [streetPoint(column - 0.5, row + 0.5), streetPoint(column + 0.5, row + 0.5)]]) {
      const middle = a.clone().lerp(b, 0.5);
      streets.push(matrix(middle.x, 0.04, middle.z, 7, 0.05, a.distanceTo(b) + 1, Math.atan2(b.x - a.x, b.z - a.z)));
    }
    addTree(x + 25, z + 29, 10 + seed * 6);
    addTree(x - 35, z - 28, 9 + seed * 5);
  }
  for (let index = 0; index < 2700; index++) {
    const x = -1300 + (random(index * 7) - 0.5) * 2900;
    const z = -2300 + (random(index * 11) - 0.5) * 3100;
    if (inForest(x, z)) addTree(x, z, 18 + random(index) * 14);
  }
  batch(unitBox, cream, houses, [colors.cream, colors.white, colors.path]);
  batch(roofGeometry, roof, roofs, [colors.roof, colors.roofLight, colors.cream]);
  batch(unitBox, road, streets);
  function avenue(points: THREE.Vector3[], width: number, surface: THREE.Material, parent = world) {
    for (let index = 1; index < points.length; index++) {
      const a = points[index - 1]; const b = points[index]; const middle = a.clone().lerp(b, 0.5);
      const segment = box(middle.x, 0.085, middle.z, width, 0.06, a.distanceTo(b), surface, parent);
      segment.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    }
  }
  avenue([new THREE.Vector3(200, 0, -4000), new THREE.Vector3(175, 0, 500), new THREE.Vector3(-300, 0, 1050), churchPosition], 25, road);
  avenue([churchPosition, churchPosition.clone().add(new THREE.Vector3(0, 0, 2700))], 28, path);

  const church = new THREE.Group(); church.position.copy(churchPosition); world.add(church);
  const churchWall = finish(colors.cloudWarm);
  box(0, 17, 0, 50, 34, 35, churchWall, church);
  box(0, 4, 27, 100, 1, 90, path, church);
  for (const side of [-1, 1]) {
    box(side * 20, 28, 11, 13, 56, 14, churchWall, church);
    mesh(new THREE.CylinderGeometry(5, 7, 10, 8), roof, [side * 20, 61, 11], church);
    mesh(new THREE.ConeGeometry(5.6, 12, 8), finish(colors.metal), [side * 20, 72, 11], church);
    const clock = mesh(new THREE.CircleGeometry(2.5, 24), white, [side * 20, 46, 18.05], church);
    clock.name = "Great-Church-clock";
  }
  const churchRoof = mesh(roofGeometry, roof, [0, 34, -1], church); churchRoof.scale.set(49, 19, 36);

  const deikSignTexture = createDeikSignTexture();
  const campusModel = buildKassaiCampus(campus, { white, cream, concrete, road, path, lawn, glass, darkGlass }, addTree, deikSignTexture);
  const shadowDisc = geometry(new THREE.CircleGeometry(1, 16)); shadowDisc.rotateX(-Math.PI / 2);
  batch(shadowDisc, material(new THREE.MeshBasicMaterial({ color: colors.deepGreen, transparent: true, opacity: 0.09, depthWrite: false })), treeShadows);
  const treeTrunks = batch(geometry(new THREE.CylinderGeometry(0.4, 0.6, 1, 6)), trunk, trunks);
  const treeLeaves = batch(canopyGeometry, foliage, leaves, [colors.white, colors.cream, colors.cloud]);
  treeTrunks.name = "Debrecen-tree-trunks"; treeLeaves.name = "Debrecen-green-canopy";

  const marker = new THREE.Group(); campus.add(marker);
  const amber = material(new THREE.MeshBasicMaterial({ color: colors.amber, transparent: true, opacity: 0.8, toneMapped: false }));
  const blindRing = mesh(new THREE.TorusGeometry(1.3, 0.045, 8, 64), amber, [0, 0.18, 0], marker); blindRing.rotation.x = -Math.PI / 2;
  const blindHalo = mesh(new THREE.CylinderGeometry(0.3, 1.25, 3.6, 32, 1, true), material(new THREE.MeshBasicMaterial({ color: colors.amber, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide })), [0, 1.8, 0], marker);
  const target = mesh(new THREE.OctahedronGeometry(0.25), amber, [0, 1.6, 0], marker);

  const sensor = new THREE.Group(); sensor.name = "DEIK-entrance-simulated-sensor"; campus.add(sensor);
  mesh(new THREE.CylinderGeometry(0.16, 0.25, 0.3, 16), concrete, [0, 0.15, 0], sensor);
  mesh(new THREE.CylinderGeometry(0.05, 0.08, 2.3, 12), finish(colors.metal, 0.4), [0, 1.25, 0], sensor);
  const enclosure = box(0, 2.35, 0, 0.48, 0.65, 0.4, white, sensor); enclosure.castShadow = true;
  const panel = box(0, 2.85, 0, 0.85, 0.035, 0.55, darkGlass, sensor); panel.rotation.x = -0.35;
  for (let index = 0; index < 5; index++) box(0, 2.12 + index * 0.075, -0.21, 0.33, 0.018, 0.018, concrete, sensor);
  const signalMaterial = material(new THREE.MeshBasicMaterial({ color: new THREE.Color(colors.green).multiplyScalar(2), toneMapped: false }));
  mesh(new THREE.SphereGeometry(0.045, 12, 8), signalMaterial, [0, 2.52, -0.23], sensor);
  const aerial = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.45, 6), darkGlass, [0.15, 2.92, 0], sensor); aerial.rotation.z = 0.1;
  const sensorPulseMaterial = material(new THREE.MeshBasicMaterial({ color: colors.green, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
  const sensorPulse = mesh(new THREE.RingGeometry(0.96, 1, 96), sensorPulseMaterial, [0, 0.13, 0], campus); sensorPulse.rotation.x = -Math.PI / 2;
  const orbit = mesh(new THREE.TorusGeometry(0.7, 0.017, 6, 48), signalMaterial, [0, 2.2, 0], campus); orbit.rotation.x = -Math.PI / 2;

  const network = new THREE.Group(); world.add(network);
  const networkMaterial = material(new THREE.MeshBasicMaterial({ color: colors.network, toneMapped: false }));
  const connections = existingSensors.map((station, index) => {
    const destination = new THREE.Vector3(...geoToScene(station.lat, station.lng)); destination.y = 20;
    const distance = destination.length();
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 2.8, 0),
      new THREE.Vector3(destination.x * 0.45, Math.max(70, distance * 0.22), destination.z * 0.45),
      destination,
    ]);
    const tube = mesh(new THREE.TubeGeometry(curve, 90, 11, 5, false), networkMaterial, [0, 0, 0], network);
    const beacon = new THREE.Group(); beacon.position.copy(destination); network.add(beacon);
    mesh(sphere, networkMaterial, [0, 0, 0], beacon);
    const ring = mesh(new THREE.TorusGeometry(2.5, 0.12, 5, 40), networkMaterial, [0, -0.2, 0], beacon); ring.rotation.x = -Math.PI / 2;
    const packet = mesh(sphere, signalMaterial, [0, 0, 0], network);
    const halo = mesh(new THREE.CircleGeometry(3.5, 48), material(new THREE.MeshBasicMaterial({ color: colors.green, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide })), [0, -0.3, 0], beacon); halo.rotation.x = -Math.PI / 2;
    return { tube, curve, beacon, packet, index, count: tube.geometry.index!.count };
  });

  let time = options.initialTime; let playing = false; let frame = 0; let previous = 0; let renderedAt = 0; let disposed = false;
  const lookAt = new THREE.Vector3(); const startPosition = new THREE.Vector3(); const endPosition = new THREE.Vector3();
  const startTarget = new THREE.Vector3(); const endTarget = new THREE.Vector3();
  function render() {
    if (disposed) return;
    const t = THREE.MathUtils.clamp(time, 0, FLIGHT_DURATION);
    const next = poses.findIndex((pose) => pose.time > t);
    const index = next === -1 ? poses.length - 2 : Math.max(0, next - 1);
    const a = poses[index]; const b = poses[index + 1]; const progress = smooth((t - a.time) / (b.time - a.time));
    startPosition.fromArray(a.position); endPosition.fromArray(b.position);
    camera.position.copy(startPosition.lerp(endPosition, progress));
    startTarget.fromArray(a.target); endTarget.fromArray(b.target);
    lookAt.copy(startTarget.lerp(endTarget, progress));
    if (camera.aspect < 0.8 && t > 8) camera.position.y *= 1 + smooth((t - 8) / 1.5) * 2;
    camera.fov = THREE.MathUtils.lerp(a.fov, b.fov, progress) + (camera.aspect < 0.8 ? 12 : 0);
    camera.near = Math.max(0.2, camera.position.y * 0.0005);
    camera.far = Math.max(12000, camera.position.y * 5);
    camera.lookAt(lookAt); camera.updateProjectionMatrix();
    sky.position.copy(camera.position); sky.scale.setScalar(camera.far);
    ambientOcclusion.enabled = camera.position.y < 450;
    ambientOcclusion.minDistance = 0.06 / camera.far; ambientOcclusion.maxDistance = 8 / camera.far;
    ambientOcclusion.ssaoMaterial.uniforms.cameraNear.value = camera.near;
    ambientOcclusion.ssaoMaterial.uniforms.cameraFar.value = camera.far;
    ambientOcclusion.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(camera.projectionMatrix);
    ambientOcclusion.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);
    sunlight.shadow.autoUpdate = camera.position.y < 1500;
    fog.density = t > 8 ? 0.000008 : 0.000018;
    const opening = smooth(t / 1.65); const closing = smooth((t - 9.5) / 1.3);
    clouds.render(t, opening * (1 - closing));
    marker.visible = t >= 4.2 && t < 6.9;
    marker.scale.setScalar(1 + Math.sin(t * 3) * 0.06);
    target.rotation.y = t * 0.8;
    target.position.y = 1.6 + Math.sin(t * 3) * 0.1;
    const installation = smooth((t - 6.3) / 0.65);
    amber.opacity = 0.8 * (1 - installation);
    blindHalo.scale.y = Math.max(0.01, 1 - installation);
    sensor.visible = t >= 6.3;
    sensor.position.y = -3.1 * (1 - installation);
    orbit.visible = t >= 6.3 && t < 7.5;
    orbit.position.y = 0.2 + installation * 2.7;
    sensorPulse.visible = t >= 6.45 && t < 8.4;
    sensorPulse.scale.setScalar(1 + smooth((t - 6.45) / 1.8) * 80);
    sensorPulseMaterial.opacity = 0.5 * (1 - smooth((t - 7.2) / 1.2));
    network.visible = t >= 7.5 && t < 10.8;
    connections.forEach(({ tube, curve, beacon, packet, index: connectionIndex, count }) => {
      const connected = connectionProgress(t, connectionIndex);
      tube.geometry.setDrawRange(0, Math.floor(count * connected / 30) * 30);
      beacon.visible = connected >= 0.98;
      const size = Math.max(9, camera.position.y * 0.0045);
      beacon.scale.setScalar(size);
      packet.visible = connected > 0 && connected < 1;
      packet.scale.setScalar(size * 0.7);
      packet.position.copy(curve.getPointAt(connected));
    });
    composer.render();
  }
  function pause() { playing = false; cancelAnimationFrame(frame); frame = 0; }
  function animate(now: number) {
    if (!playing || disposed) return;
    if (document.hidden) { pause(); options.onPause(); return; }
    time = Math.min(FLIGHT_DURATION, time + (now - previous) / 1000); previous = now;
    if (now - renderedAt >= 1000 / 30 || time === FLIGHT_DURATION) { renderedAt = now; render(); options.onProgress(time); }
    if (time >= FLIGHT_DURATION) { pause(); options.onPause(); return; }
    frame = requestAnimationFrame(animate);
  }
  function resize() {
    const { width, height } = canvas.getBoundingClientRect(); if (!width || !height) return;
    camera.aspect = width / height; clouds.resize(width, height);
    renderer.setSize(width, height, false); composer.setSize(width, height);
    const occlusionScale = Math.min(0.5, 720 / width);
    ambientOcclusion.setSize(Math.round(width * occlusionScale), Math.round(height * occlusionScale));
    render();
  }
  const observer = new ResizeObserver(resize); observer.observe(canvas);
  const onVisibility = () => { if (document.hidden && playing) { pause(); options.onPause(); } };
  const onContextLost = (event: Event) => { event.preventDefault(); pause(); options.onContextLost(); };
  document.addEventListener("visibilitychange", onVisibility); canvas.addEventListener("webglcontextlost", onContextLost); resize();

  return {
    play() {
      if (disposed || playing) return;
      if (time >= FLIGHT_DURATION) time = 0;
      playing = true; previous = performance.now(); renderedAt = previous; options.onProgress(time);
      frame = requestAnimationFrame(animate);
    },
    pause,
    seek(value: number) { pause(); time = THREE.MathUtils.clamp(value, 0, FLIGHT_DURATION); render(); options.onProgress(time); },
    dispose() {
      if (disposed) return;
      disposed = true; pause(); observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility); canvas.removeEventListener("webglcontextlost", onContextLost);
      geometries.forEach((value) => value.dispose()); materials.forEach((value) => value.dispose()); instances.forEach((value) => value.dispose());
      campusModel.dispose(); deikSignTexture.dispose();
      sunlight.shadow.map?.dispose(); sky.geometry.dispose(); sky.material.dispose(); environment.dispose(); surfaces.dispose();
      ambientOcclusion.dispose(); bloom.dispose(); clouds.dispose(); output.dispose(); composer.dispose(); renderer.dispose();
    },
  };
}
