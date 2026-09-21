import * as THREE from "three";
import { flightColors as colors } from "./flightTokens";

export const kassaiReferenceLayout = {
  source: "User-supplied Screenshot 2026-09-21 at 2.19.37.png",
  fidelity: "Visible building forms and relative placement reconstructed from a single oblique image; dimensions and hidden elevations are estimates. Pink selection tint is not treated as a façade material.",
  landmarks: {
    deik: { u: 0, v: 40 },
    ovalCourtyard: { u: 287, v: 127 },
    sportsHall: { u: 340, v: 264 },
    historicHall: { u: 76, v: 130 },
    circularAuditorium: { u: 308, v: -3 },
    modernComplex: { u: 342, v: 33 },
    frontWest: { u: -141, v: -37 },
    centralVilla: { u: 164, v: -47 },
    courts: { u: 284, v: 205 },
  },
  sign: { text: "DEIK", position: [0, 9.1, 2.38] as const, width: 17, height: 3.6 },
} as const;

export interface CampusMaterials {
  white: THREE.Material;
  cream: THREE.Material;
  concrete: THREE.Material;
  road: THREE.Material;
  path: THREE.Material;
  lawn: THREE.Material;
  glass: THREE.Material;
  darkGlass: THREE.Material;
}

export function createDeikSignTexture() {
  const canvas = document.createElement("canvas"); canvas.width = 1024; canvas.height = 256;
  const context = canvas.getContext("2d")!;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = colors.white;
  context.font = "600 168px Arial, sans-serif";
  context.textAlign = "center"; context.textBaseline = "middle";
  context.fillText(kassaiReferenceLayout.sign.text, 512, 139);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  return texture;
}

export function buildKassaiCampus(parent: THREE.Group, palette: CampusMaterials, addTree: (x: number, z: number, size: number, detailed?: boolean) => void, signTexture: THREE.Texture) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const instances: THREE.InstancedMesh[] = [];
  const geo = <T extends THREE.BufferGeometry>(value: T) => { geometries.add(value); return value; };
  const mat = <T extends THREE.Material>(value: T) => { materials.add(value); return value; };
  const heritage = mat(new THREE.MeshStandardMaterial({ color: colors.heritage, roughness: 0.85 }));
  const terracotta = mat(new THREE.MeshStandardMaterial({ color: colors.terracotta, roughness: 0.88 }));
  const slate = mat(new THREE.MeshStandardMaterial({ color: colors.slate, roughness: 0.72 }));
  const brick = mat(new THREE.MeshStandardMaterial({ color: colors.brick, roughness: 0.9 }));
  const courtMaterial = mat(new THREE.MeshStandardMaterial({ color: colors.court, roughness: 0.95 }));
  const paint = mat(new THREE.LineBasicMaterial({ color: colors.white }));
  const boxGeometry = geo(new THREE.BoxGeometry(1, 1, 1));
  const dummy = new THREE.Object3D();

  function group(name: string, u = 0, v = 0) {
    const value = new THREE.Group(); value.name = name; value.position.set(-u, 0, v); parent.add(value); return value;
  }
  function mesh<G extends THREE.BufferGeometry, M extends THREE.Material>(shape: G, surface: M, position: number[], owner: THREE.Group) {
    const value = new THREE.Mesh(geo(shape), surface); value.position.set(position[0], position[1], position[2]);
    value.castShadow = true; value.receiveShadow = true; owner.add(value); return value;
  }
  function box(owner: THREE.Group, x: number, y: number, z: number, width: number, height: number, depth: number, surface: THREE.Material) {
    const value = mesh(boxGeometry, surface, [x, y, z], owner); value.scale.set(width, height, depth); return value;
  }
  function batch(owner: THREE.Group, transforms: THREE.Matrix4[], surface: THREE.Material) {
    const value = new THREE.InstancedMesh(boxGeometry, surface, transforms.length);
    transforms.forEach((transform, index) => value.setMatrixAt(index, transform));
    owner.add(value); instances.push(value); return value;
  }
  function transform(x: number, y: number, z: number, width: number, height: number, depth: number, angle = 0) {
    dummy.position.set(x, y, z); dummy.scale.set(width, height, depth); dummy.rotation.set(0, angle, 0); dummy.updateMatrix(); return dummy.matrix.clone();
  }
  function stroke(owner: THREE.Group, points: number[][], surface: THREE.LineBasicMaterial = paint) {
    const value = new THREE.Line(geo(new THREE.BufferGeometry().setFromPoints(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)))), surface); owner.add(value); return value;
  }
  const grounds = group("Kassai-landscape");
  function groundBox(u: number, v: number, width: number, depth: number, surface: THREE.Material, elevation = 0.07) {
    return box(grounds, -u, elevation, v, width, 0.12, depth, surface);
  }
  function route(points: number[][], width: number, surface = palette.path, elevation = 0.16) {
    for (let index = 1; index < points.length; index++) {
      const [au, av] = points[index - 1]; const [bu, bv] = points[index];
      const dx = -(bu - au); const dz = bv - av;
      const segment = groundBox((au + bu) / 2, (av + bv) / 2, width, Math.hypot(dx, dz), surface, elevation);
      segment.rotation.y = Math.atan2(dx, dz);
    }
  }
  function tree(u: number, v: number, size = 11) { addTree(-u, v, size, true); }
  function hipRoof(width: number, depth: number, rise: number) {
    const a = [-width / 2, 0, -depth / 2]; const b = [width / 2, 0, -depth / 2];
    const c = [width / 2, 0, depth / 2]; const d = [-width / 2, 0, depth / 2];
    const inset = Math.min(width * 0.35, depth * 0.45);
    const e = [-width / 2 + inset, rise, 0]; const f = [width / 2 - inset, rise, 0];
    const points = [...a, ...e, ...f, ...a, ...f, ...b, ...b, ...f, ...c, ...c, ...f, ...e, ...c, ...e, ...d, ...d, ...e, ...a];
    const value = geo(new THREE.BufferGeometry()); value.setAttribute("position", new THREE.Float32BufferAttribute(points, 3)); value.computeVertexNormals(); return value;
  }
  function historical(name: string, u: number, v: number, width: number, depth: number, height: number) {
    const building = group(name, u, v);
    box(building, 0, height / 2, 0, width, height, depth, heritage);
    box(building, 0, 0.55, 0, width + 0.5, 1.1, depth + 0.5, palette.cream);
    box(building, 0, height - 0.35, 0, width + 1.2, 0.7, depth + 1.2, palette.white);
    mesh(hipRoof(width + 1.4, depth + 1.4, Math.min(depth * 0.3, 7)), terracotta, [0, height, 0], building);
    const floors = Math.max(1, Math.round(height / 4)); const windows: THREE.Matrix4[] = [];
    for (let floor = 0; floor < floors; floor++) {
      const y = floor * (height / floors) + 2;
      for (let x = -width / 2 + 3; x < width / 2 - 2; x += 4.6) {
        for (const side of [-1, 1]) windows.push(transform(x, y, side * (depth / 2 + 0.08), 1.7, 2.3, 0.15));
      }
      for (let z = -depth / 2 + 3; z < depth / 2 - 2; z += 4.6) {
        for (const side of [-1, 1]) windows.push(transform(side * (width / 2 + 0.08), y, z, 0.15, 2.3, 1.7));
      }
      if (floor > 0) box(building, 0, floor * height / floors, 0, width + 0.6, 0.26, depth + 0.6, palette.white);
    }
    batch(building, windows, palette.darkGlass);
    for (const x of [-width / 2 + 0.5, width / 2 - 0.5]) for (const z of [-depth / 2 + 0.5, depth / 2 - 0.5]) box(building, x, height / 2, z, 0.9, height, 0.9, palette.white);
    return building;
  }

  groundBox(145, 100, 660, 440, palette.lawn, 0);
  groundBox(147, 18, 207, 116, palette.lawn, 0.06);
  route([[-205, -107], [505, -107]], 24, palette.road);
  route([[-183, -107], [-183, 322]], 12, palette.road);
  route([[-183, -24], [54, -24], [115, 61], [241, 67], [376, 71], [442, 94], [450, 302]], 9, palette.road);
  route([[-183, 87], [10, 87], [70, 65], [115, 61]], 8, palette.road);
  route([[213, 76], [214, 305]], 8, palette.road);
  route([[0, -24], [0, 2]], 7);
  route([[43, 73], [241, -31]], 2.7);
  route([[74, -30], [220, 66]], 2.7);
  route([[159, -34], [164, 66]], 3);
  route([[48, 15], [262, 15]], 2.5);
  route([[0, 89], [73, 89], [76, 102]], 3.5);
  route([[120, 60], [139, 47], [152, 47]], 3);
  groundBox(129, 43, 36, 15, palette.path, 0.19);
  const pool = mat(new THREE.MeshPhysicalMaterial({ color: colors.water, roughness: 0.12, metalness: 0.15, clearcoat: 1 }));
  groundBox(129, 43, 25, 4, pool, 0.3);
  for (let u = -175; u < 485; u += 21) tree(u, -88, 10 + (Math.round(u) % 4));
  for (let v = -79; v < 295; v += 20) tree(-167, v, 12);
  const treePositions = [[-67, 13], [-63, 66], [-84, 101], [-29, 105], [27, 101], [40, 63], [54, 11], [55, -5], [78, 27], [99, 21], [107, 98], [153, 97], [205, 44], [223, 37], [225, -10], [246, 10], [262, 59], [281, 52], [298, 52], [369, -34], [391, 14], [402, 65], [411, 155], [426, 231], [195, 200], [196, 230], [194, 263], [229, 264]];
  treePositions.forEach(([u, v], index) => tree(u, v, 9 + index % 5));

  const deik = group("DEIK-building");
  deik.userData = { reference: kassaiReferenceLayout.source, mainCourtyardCount: 1, facadeLettering: "DEIK" };
  const front = [
    [-25.5, 7.6, 6, 9, 15.2, 10], [25.5, 7.6, 6, 9, 15.2, 10],
    [0, 13.4, 6, 60, 3.6, 10],
    [-25, 8, 43, 10, 16, 68], [25, 8, 43, 10, 16, 68],
    [0, 8.9, 72, 60, 17.8, 14],
  ];
  front.forEach(([x, y, z, w, h, d]) => box(deik, x, y, z, w, h, d, palette.white));
  box(deik, 0, 8.4, 2.9, 42, 6.4, 0.24, palette.glass);
  box(deik, 0, 2.6, 7.4, 40, 5.2, 0.18, palette.darkGlass);
  box(deik, 0, 5.15, 3, 43, 0.35, 0.85, palette.concrete);
  box(deik, 0, 0.06, 39, 40, 0.13, 53, palette.path).name = "DEIK-open-courtyard";
  box(deik, 0, 15.4, 6, 60.6, 0.36, 10.7, palette.concrete);
  box(deik, -25, 16.2, 43, 10.6, 0.36, 68.6, palette.concrete);
  box(deik, 25, 16.2, 43, 10.6, 0.36, 68.6, palette.concrete);
  box(deik, 0, 18, 72, 60.6, 0.36, 14.6, palette.concrete);
  for (const x of [-29.7, 29.7]) box(deik, x, 16.5, 44, 0.42, 0.8, 69, palette.white);
  for (const z of [1, 11]) box(deik, 0, 15.75, z, 60, 0.6, 0.4, palette.white);
  for (let x = -19; x <= 19; x += 2.15) box(deik, x, 8.4, 2.69, 0.09, 6.4, 0.15, palette.concrete);
  box(deik, 0, 8.2, 2.67, 42, 0.055, 0.16, palette.concrete);
  for (let x = -18; x <= 18; x += 3.5) box(deik, x, 2.6, 7.23, 0.11, 5.2, 0.14, palette.concrete);
  for (const side of [-1, 1]) {
    for (let z = 16; z <= 67; z += 3.3) {
      box(deik, side * 30.02, 8.2, z, 0.1, 11.8, 1.75, palette.darkGlass);
      box(deik, side * 30.22, 8.1, z - 1.05, 0.48, 12.7, 0.32, palette.white);
      for (let floor = 0; floor < 3; floor++) box(deik, side * 19.93, 2.7 + floor * 4.4, z, 0.12, 2.7, 2.1, palette.glass);
    }
  }
  for (let x = -17; x <= 17; x += 4.2) for (let floor = 0; floor < 3; floor++) box(deik, x, 2.8 + floor * 4.5, 64.9, 2.5, 3, 0.15, palette.glass);
  for (let index = 0; index < 6; index++) box(deik, -22 + index * 8.5, 19.15, 71, 5.7, 2.1, 4.6, palette.concrete);
  box(deik, -14, 18.8, 65, 20, 1.5, 4, palette.white);
  for (const x of [-15, 15]) box(deik, x, 0.55, 52, 5, 1, 6, palette.lawn);
  const sign = kassaiReferenceLayout.sign;
  const signMaterial = mat(new THREE.MeshBasicMaterial({ map: signTexture, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1 }));
  const lettering = mesh(new THREE.PlaneGeometry(sign.width, sign.height), signMaterial, [...sign.position], deik);
  lettering.rotation.y = Math.PI; lettering.castShadow = false; lettering.name = "DEIK-front-glass-lettering"; lettering.userData.text = sign.text;

  const ovalPosition = kassaiReferenceLayout.landmarks.ovalCourtyard;
  const oval = group("Kassai-oval-courtyard-building", ovalPosition.u, ovalPosition.v);
  const ringShape = new THREE.Shape(); ringShape.absellipse(0, 0, 79, 49, 0, Math.PI * 2, false, 0);
  const ringHole = new THREE.Path(); ringHole.absellipse(0, 0, 61, 33, 0, Math.PI * 2, true, 0); ringShape.holes.push(ringHole);
  const ringWalls = geo(new THREE.ExtrudeGeometry(ringShape, { depth: 21, bevelEnabled: false, curveSegments: 96 })); ringWalls.rotateX(-Math.PI / 2);
  mesh(ringWalls, palette.cream, [0, 0, 0], oval);
  const ringRoof = geo(new THREE.ShapeGeometry(ringShape, 96)); ringRoof.rotateX(-Math.PI / 2); mesh(ringRoof, slate, [0, 21.15, 0], oval);
  box(oval, 0, 6.7, -44, 166, 13.4, 20, palette.cream);
  box(oval, 0, 13.6, -44, 168, 0.45, 22, slate);
  const ovalWindows: THREE.Matrix4[] = [];
  for (let index = 0; index < 110; index++) {
    const angle = index / 110 * Math.PI * 2;
    for (let floor = 0; floor < 4; floor++) {
      ovalWindows.push(transform(Math.cos(angle) * 79.12, 2.8 + floor * 4.5, Math.sin(angle) * 49.12, 1.7, 2.55, 0.15, Math.atan2(Math.cos(angle) / 79, Math.sin(angle) / 49)));
      ovalWindows.push(transform(Math.cos(angle) * 60.85, 2.8 + floor * 4.5, Math.sin(angle) * 32.85, 1.45, 2.55, 0.15, Math.atan2(Math.cos(angle) / 61, Math.sin(angle) / 33)));
    }
  }
  for (let x = -78; x <= 78; x += 4.2) for (let floor = 0; floor < 3; floor++) ovalWindows.push(transform(x, 2.5 + floor * 3.9, -54.12, 2.2, 2.35, 0.15));
  batch(oval, ovalWindows, palette.darkGlass);
  const yard = mesh(new THREE.CircleGeometry(1, 80), palette.lawn, [0, 0.15, 0], oval); yard.rotation.x = -Math.PI / 2; yard.scale.set(60, 32, 1);
  const courtyardPath = mesh(new THREE.RingGeometry(0.72, 0.84, 80), palette.path, [0, 0.22, 0], oval); courtyardPath.rotation.x = -Math.PI / 2; courtyardPath.scale.set(54, 29, 1);
  for (const [du, dv] of [[-28, -8], [24, -10], [0, 10], [40, 7], [-40, 7]]) tree(ovalPosition.u + du, ovalPosition.v + dv, 12);
  for (const x of [-66, 66]) box(oval, x, 23, 8, 14, 3.8, 19, palette.concrete);

  const hallPosition = kassaiReferenceLayout.landmarks.sportsHall;
  const hall = group("Kassai-white-vaulted-sports-hall", hallPosition.u, hallPosition.v);
  box(hall, 0, 7, 0, 100, 14, 72, brick);
  const arch = new THREE.Shape(); arch.moveTo(-51, 0); arch.quadraticCurveTo(0, 23, 51, 0); arch.lineTo(51, -0.8); arch.quadraticCurveTo(0, 21.8, -51, -0.8); arch.closePath();
  mesh(new THREE.ExtrudeGeometry(arch, { depth: 76, bevelEnabled: false, curveSegments: 32 }), palette.white, [0, 14.5, -38], hall);
  box(hall, 0, 6.5, -36.08, 76, 12, 0.2, palette.glass);
  for (let x = -37; x <= 37; x += 4) box(hall, x, 6.5, -36.25, 0.15, 12, 0.2, palette.white);
  for (const x of [-45, 45]) box(hall, x, 8.3, -36.8, 7, 16.6, 3.7, brick);
  groundBox(hallPosition.u, hallPosition.v - 43, 108, 17, palette.path);
  for (const [u, v] of [[264, 202], [299, 202]]) {
    const court = group("Kassai-sports-court", u, v);
    box(court, 0, 0.15, 0, 28, 0.12, 22, courtMaterial);
    stroke(court, [[-12, 0.24, -9], [12, 0.24, -9], [12, 0.24, 9], [-12, 0.24, 9], [-12, 0.24, -9]]);
    stroke(court, [[0, 0.24, -9], [0, 0.24, 9]]);
    stroke(court, Array.from({ length: 41 }, (_, index) => [Math.cos(index / 40 * Math.PI * 2) * 2.4, 0.24, Math.sin(index / 40 * Math.PI * 2) * 2.4]));
  }

  const modernPosition = kassaiReferenceLayout.landmarks.modernComplex;
  const modern = group("Kassai-modern-complex", modernPosition.u, modernPosition.v);
  [[-45, 7, 0, 22, 14, 58], [43, 7, 0, 22, 14, 58], [0, 7, 26, 105, 14, 13], [0, 7, -21, 105, 14, 13]].forEach(([x, y, z, w, h, d]) => {
    box(modern, x, y, z, w, h, d, palette.white); box(modern, x, h + 0.25, z, w + 1, 0.45, d + 1, slate);
  });
  const modernWindows: THREE.Matrix4[] = [];
  for (let x = -49; x < 50; x += 4) for (let floor = 0; floor < 3; floor++) modernWindows.push(transform(x, 2.7 + floor * 4.1, -27.6, 2.3, 2.5, 0.15));
  batch(modern, modernWindows, palette.darkGlass);
  const auditoriumPosition = kassaiReferenceLayout.landmarks.circularAuditorium;
  const auditorium = group("Kassai-circular-auditorium", auditoriumPosition.u, auditoriumPosition.v);
  mesh(new THREE.CylinderGeometry(20, 20, 13, 64), palette.white, [0, 6.5, 0], auditorium);
  mesh(new THREE.CylinderGeometry(20.6, 20.6, 0.6, 64), slate, [0, 13.4, 0], auditorium);
  const roundWindows: THREE.Matrix4[] = [];
  for (let index = 0; index < 44; index++) {
    const angle = index / 44 * Math.PI * 2;
    roundWindows.push(transform(Math.cos(angle) * 20.1, 4.3, Math.sin(angle) * 20.1, 1.15, 5.6, 0.13, Math.PI / 2 - angle));
  }
  batch(auditorium, roundWindows, palette.darkGlass);
  box(auditorium, -17, 7, 15, 17, 14, 12, palette.glass);

  historical("Kassai-long-orange-roof-hall", 76, 130, 27, 78, 9);
  historical("Kassai-small-orange-roof-pavilion", 147, 116, 33, 25, 5.5);
  historical("Kassai-front-west-historic-wing", -141, -37, 106, 26, 12);
  historical("Kassai-front-west-return-wing", -94, -11, 24, 57, 12);
  historical("Kassai-front-villa-west", 97, -61, 31, 24, 12.5);
  const villa = historical("Kassai-central-historic-villa", 164, -47, 42, 29, 15);
  box(villa, 0, 7.7, -16.5, 15, 15.4, 5, heritage);
  box(villa, 0, 15.4, -16.6, 16, 0.65, 6, palette.white);
  for (const x of [-5.5, 5.5]) box(villa, x, 7.4, -19.3, 1, 14.8, 0.55, palette.white);
  historical("Kassai-front-villa-east", 267, -49, 37, 25, 13.5);
  historical("Kassai-east-orange-roof-range", 350, -42, 102, 25, 12);
  historical("Kassai-east-orange-roof-return", 401, -17, 23, 65, 12);
  const circleWalk = mesh(new THREE.RingGeometry(22, 25, 80), palette.path, [-164, 0.21, -66], grounds); circleWalk.rotation.x = -Math.PI / 2; circleWalk.scale.set(1.3, 0.8, 1);
  groundBox(-105, -4, 57, 24, palette.path, 0.18);
  groundBox(-66, -40, 63, 28, brick, 0.18);
  groundBox(-40, 47, 23, 78, palette.path, 0.19);
  groundBox(0, -13, 79, 14, palette.path, 0.18);

  const parking = group("Kassai-parking-and-road-detail");
  const carBodies: THREE.Matrix4[] = []; const carGlass: THREE.Matrix4[] = []; const carColors: string[] = [];
  function car(u: number, v: number, angle = 0) {
    carBodies.push(transform(-u, 0.82, v, 1.9, 1.45, 4.2, angle));
    carGlass.push(transform(-u, 1.57, v - 0.2, 1.6, 0.17, 2.1, angle));
    carColors.push([colors.white, colors.glassDark, colors.terracotta, colors.metal, colors.glass][carBodies.length % 5]);
  }
  for (let u = -35; u <= 35; u += 5.7) if (Math.abs(u) > 26) car(u, -13);
  for (let v = 10; v < 82; v += 6) car(-40, v, Math.PI / 2);
  for (let u = -86; u <= -43; u += 7) { car(u, -34); car(u, -45); }
  for (let u = 130; u < 240; u += 7) car(u, 73);
  for (let v = 190; v <= 293; v += 7) car(222, v, Math.PI / 2);
  const carMaterial = mat(new THREE.MeshStandardMaterial({ color: colors.white, roughness: 0.3, metalness: 0.18 }));
  const bodies = batch(parking, carBodies, carMaterial); carColors.forEach((color, index) => bodies.setColorAt(index, new THREE.Color(color)));
  batch(parking, carGlass, palette.darkGlass);
  for (let u = -35; u <= 37; u += 5.7) if (Math.abs(u) > 10) stroke(parking, [[-u, 0.27, -16], [-u, 0.27, -10]]);
  for (let u = -190; u < 480; u += 13) groundBox(u, -107, 6, 0.18, palette.white, 0.24);
  for (let v = -118; v < -96; v += 2.5) groundBox(40, v, 7, 1.1, palette.white, 0.25);

  return {
    deik,
    lettering,
    dispose() { instances.forEach((value) => value.dispose()); geometries.forEach((value) => value.dispose()); materials.forEach((value) => value.dispose()); },
  };
}
