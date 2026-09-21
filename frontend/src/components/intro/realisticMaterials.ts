import * as THREE from "three";
import { flightColors as colors } from "./flightTokens";

type Surface = "terrain" | "grass" | "plaster" | "paving" | "roof" | "asphalt";

export function createRealisticMaterials() {
  const canvas = document.createElement("canvas"); canvas.width = 256; canvas.height = 256;
  const context = canvas.getContext("2d")!;
  const image = context.createImageData(256, 256);
  let seed = 38721;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < image.data.length; i += 4) {
    const shade = Math.round(100 + random() * 80);
    image.data[i] = shade; image.data[i + 1] = shade; image.data[i + 2] = shade; image.data[i + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  const grain = new THREE.CanvasTexture(canvas);
  grain.wrapS = THREE.RepeatWrapping; grain.wrapT = THREE.RepeatWrapping;
  grain.anisotropy = 4;

  const foliageCanvas = document.createElement("canvas"); foliageCanvas.width = 256; foliageCanvas.height = 256;
  const foliageContext = foliageCanvas.getContext("2d")!;
  const leafColors = [colors.forest, colors.leaf, colors.leafLight, colors.grass];
  for (let index = 0; index < 1500; index++) {
    const angle = random() * Math.PI * 2; const radius = Math.sqrt(random());
    const x = 128 + Math.cos(angle) * radius * (98 + Math.sin(angle * 5) * 12);
    const y = 132 + Math.sin(angle) * radius * (107 + Math.cos(angle * 3) * 10);
    foliageContext.fillStyle = leafColors[Math.floor(random() * leafColors.length)];
    foliageContext.globalAlpha = 0.75 + random() * 0.25;
    foliageContext.beginPath(); foliageContext.ellipse(x, y, 3 + random() * 7, 2 + random() * 5, random() * Math.PI, 0, Math.PI * 2); foliageContext.fill();
  }
  const foliageTexture = new THREE.CanvasTexture(foliageCanvas); foliageTexture.colorSpace = THREE.SRGBColorSpace;
  foliageTexture.anisotropy = 4;
  const leafMaterial = new THREE.MeshStandardMaterial({ map: foliageTexture, color: colors.white, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1 });
  const owned: THREE.Material[] = [leafMaterial];

  function surface(color: string, kind: Surface, roughness = 0.85) {
    const result = new THREE.MeshStandardMaterial({ color, roughness, bumpMap: kind === "plaster" ? grain : null, bumpScale: kind === "plaster" ? 0.035 : 0 });
    result.onBeforeCompile = (shader) => {
      shader.uniforms.surfaceGrain = { value: grain };
      shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vSurfaceWorld;varying vec3 vSurfaceNormal;");
      shader.vertexShader = shader.vertexShader.replace("#include <project_vertex>", `vec4 surfacePosition=vec4(transformed,1.);vec3 surfaceNormal=objectNormal;
        #ifdef USE_INSTANCING
          surfacePosition=instanceMatrix*surfacePosition;surfaceNormal=mat3(instanceMatrix)*surfaceNormal;
        #endif
        vSurfaceWorld=(modelMatrix*surfacePosition).xyz;vSurfaceNormal=normalize(mat3(modelMatrix)*surfaceNormal);
        #include <project_vertex>`);
      shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>
        varying vec3 vSurfaceWorld;varying vec3 vSurfaceNormal;uniform sampler2D surfaceGrain;
        float surfaceHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float surfaceNoise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.-2.*f);return mix(mix(surfaceHash(i),surfaceHash(i+vec2(1,0)),f.x),mix(surfaceHash(i+vec2(0,1)),surfaceHash(i+vec2(1,1)),f.x),f.y);}
      `);
      const planes = `vec3 surfaceWeights=pow(abs(normalize(vSurfaceNormal)),vec3(8.));surfaceWeights/=max(.001,surfaceWeights.x+surfaceWeights.y+surfaceWeights.z);
        vec2 surfaceUv=vSurfaceWorld.zy*surfaceWeights.x+vSurfaceWorld.xz*surfaceWeights.y+vSurfaceWorld.xy*surfaceWeights.z;
        float grainValue=texture2D(surfaceGrain,surfaceUv*.17).r-.5;`;
      const effects: Record<Surface, string> = {
        terrain: `vec2 fieldPoint=vSurfaceWorld.xz*.0008;fieldPoint+=vec2(surfaceNoise(fieldPoint*.43),surfaceNoise(fieldPoint*.39+13.))*1.4;
          vec2 fieldCell=floor(fieldPoint);vec2 fieldFraction=fract(fieldPoint);float nearest=8.;float second=8.;vec2 chosen=vec2(0.);
          for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){vec2 cell=fieldCell+vec2(float(x),float(y));vec2 center=vec2(surfaceHash(cell),surfaceHash(cell+37.));float distanceTo=length(vec2(float(x),float(y))+center-fieldFraction);if(distanceTo<nearest){second=nearest;nearest=distanceTo;chosen=cell;}else{second=min(second,distanceTo);}}
          float identity=surfaceHash(chosen+4.);vec3 fieldTint=mix(vec3(.64,.78,.52),vec3(1.17,1.05,.65),identity);
          float cityMask=1.-smoothstep(2800.,4800.,length(vSurfaceWorld.xz+vec2(600.,-300.)));
          fieldTint=mix(fieldTint,vec3(.88,.93,.76),cityMask);
          float hedgerow=mix(.72,1.,smoothstep(.004,.025,second-nearest));
          float terrainDetail=surfaceNoise(vSurfaceWorld.xz*.025)*.07+surfaceNoise(vSurfaceWorld.xz*.0018)*.16;
          diffuseColor.rgb*=fieldTint*hedgerow*(.83+terrainDetail+grainValue*.05);`,
        grass: `float variation=surfaceNoise(vSurfaceWorld.xz*.045)*.16+surfaceNoise(vSurfaceWorld.xz*.8)*.055;diffuseColor.rgb*=.87+variation+grainValue*.12;`,
        plaster: `float stain=surfaceNoise(surfaceUv*.12)*.05;diffuseColor.rgb*=.94+stain+grainValue*.06;`,
        paving: `vec2 pavingUv=surfaceUv*1.2;pavingUv.x+=step(.5,fract(pavingUv.y*.5))*.5;vec2 joints=min(fract(pavingUv),1.-fract(pavingUv));float joint=smoothstep(.006,.022,min(joints.x,joints.y));float wear=surfaceNoise(floor(pavingUv)*.7)*.08;diffuseColor.rgb*=mix(.70,.92+wear,joint)+grainValue*.09;`,
        roof: `vec2 tileUv=surfaceUv*2.7;float tileRidge=.94+.055*cos(tileUv.x*6.283);float seam=smoothstep(.025,.07,fract(tileUv.y));diffuseColor.rgb*=(.83+.17*seam)*tileRidge+grainValue*.12;`,
        asphalt: `float patches=surfaceNoise(surfaceUv*.07)*.13;diffuseColor.rgb*=.78+patches+grainValue*.14;`,
      };
      shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>\n${planes}\n${effects[kind]}`);
    };
    result.customProgramCacheKey = () => `greenmind-surface-${kind}`;
    owned.push(result);
    return result;
  }

  return {
    surface,
    foliage: leafMaterial,
    dispose() { owned.forEach((value) => value.dispose()); grain.dispose(); foliageTexture.dispose(); },
  };
}
