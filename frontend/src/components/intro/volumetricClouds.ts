import * as THREE from "three";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { flightColors } from "./flightTokens";

function noiseVolume() {
  const size = 64;
  const data = new Uint8Array(size * size * size * 2);
  const hash = (x: number, y: number, z: number, period: number) => {
    let n = Math.imul(x % period, 73856093) ^ Math.imul(y % period, 19349663) ^ Math.imul(z % period, 83492791);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  const noise = (x: number, y: number, z: number, frequency: number) => {
    x *= frequency; y *= frequency; z *= frequency;
    const ix = Math.floor(x); const iy = Math.floor(y); const iz = Math.floor(z);
    const fade = (t: number) => t * t * (3 - 2 * t);
    const fx = fade(x - ix); const fy = fade(y - iy); const fz = fade(z - iz);
    let value = 0;
    for (let dz = 0; dz <= 1; dz++) for (let dy = 0; dy <= 1; dy++) for (let dx = 0; dx <= 1; dx++) {
      value += hash(ix + dx, iy + dy, iz + dz, frequency) * (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * (dz ? fz : 1 - fz);
    }
    return value;
  };
  for (let z = 0; z < size; z++) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const index = ((z * size + y) * size + x) * 2;
    const px = x / size; const py = y / size; const pz = z / size;
    data[index] = Math.round((noise(px, py, pz, 4) * 0.7 + noise(px, py, pz, 8) * 0.3) * 255);
    data[index + 1] = Math.round((noise(px, py, pz, 16) * 0.65 + noise(px, py, pz, 32) * 0.35) * 255);
  }
  const texture = new THREE.Data3DTexture(data, size, size, size);
  texture.format = THREE.RGFormat;
  texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping; texture.wrapR = THREE.RepeatWrapping;
  texture.unpackAlignment = 1; texture.needsUpdate = true;
  return texture;
}

export function createVolumetricClouds(renderer: THREE.WebGLRenderer) {
  const noise = noiseVolume();
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
  const volume = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: {
      densityMap: { value: noise }, time: { value: 0 }, openness: { value: 0 }, aspect: { value: 1 }, steps: { value: 28 },
      shadowColor: { value: new THREE.Color(flightColors.cloudShadow) }, sunColor: { value: new THREE.Color(flightColors.cloudWarm) },
    },
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader: `precision highp sampler3D;
      uniform sampler3D densityMap;uniform float time;uniform float openness;uniform float aspect;uniform int steps;uniform vec3 shadowColor;uniform vec3 sunColor;varying vec2 vUv;
      float density(vec3 p){
        vec3 wind=vec3(time*.035,time*.008,-time*.018);
        vec2 n=texture(densityMap,p*.105+wind+vec3(.12,.37,.08)).rg;
        float detail=texture(densityMap,p*.237-wind*.5).g;
        float shape=smoothstep(-3.8,-2.6,p.z)*(1.-smoothstep(3.6,4.6,p.z));
        float gap=length(p.xy*vec2(.75,1.))+(n.r-.5)*1.8;
        float opening=smoothstep(openness*12.-1.6,openness*12.-.5,gap);
        return max(0.,n.r-.38-(1.-detail)*.16)*4.6*shape*opening;
      }
      void main(){
        vec2 screen=(vUv-.5)*vec2(aspect,1.);
        vec3 direction=normalize(vec3(screen*1.6,1.7));vec3 origin=vec3(0.,0.,-6.);
        float begin=2.2/direction.z;float stepLength=8.2/(float(steps)*direction.z);
        float jitter=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
        vec3 lightDirection=normalize(vec3(-.6,.85,-.5));
        vec3 radiance=vec3(0.);float transmission=1.;
        for(int i=0;i<28;i++){
          if(i>=steps||transmission<.012)break;
          vec3 p=origin+direction*(begin+(float(i)+jitter)*stepLength);
          float d=density(p);if(d<.012)continue;
          float shadow=density(p+lightDirection*.4)*.45+density(p+lightDirection*.95)*.65+density(p+lightDirection*1.8)*1.0;
          float sun=exp(-shadow*1.65);float powder=1.-exp(-d*3.);
          vec3 ambient=mix(shadowColor*.58,shadowColor*.93,smoothstep(-2.,3.,p.y));
          vec3 light=ambient+sunColor*(sun*1.5+powder*.12);
          float alpha=1.-exp(-d*stepLength*1.9);
          radiance+=transmission*alpha*light;transmission*=1.-alpha;
        }
        gl_FragColor=vec4(radiance,1.-transmission);
      }`,
  });
  const quad = new FullScreenQuad(volume);
  const pass = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, cloudTexture: { value: null }, openness: { value: 0 }, skyColor: { value: new THREE.Color(flightColors.sky) }, texel: { value: new THREE.Vector2(1, 1) } },
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform sampler2D tDiffuse;uniform sampler2D cloudTexture;uniform float openness;uniform vec3 skyColor;uniform vec2 texel;varying vec2 vUv;
      void main(){vec4 c=texture2D(cloudTexture,vUv)*.4;
      c+=texture2D(cloudTexture,vUv+vec2(texel.x,0.))*.15;c+=texture2D(cloudTexture,vUv-vec2(texel.x,0.))*.15;
      c+=texture2D(cloudTexture,vUv+vec2(0.,texel.y))*.15;c+=texture2D(cloudTexture,vUv-vec2(0.,texel.y))*.15;
      vec3 sky=skyColor*mix(.95,1.25,vUv.y);vec3 background=mix(sky,texture2D(tDiffuse,vUv).rgb,smoothstep(0.,.25,openness));
      gl_FragColor=vec4(c.rgb+background*(1.-c.a),1.);}`,
  });
  pass.uniforms.cloudTexture.value = target.texture;
  return {
    pass,
    render(time: number, openness: number) {
      pass.enabled = openness < 0.995;
      if (!pass.enabled) return;
      volume.uniforms.time.value = time; volume.uniforms.openness.value = openness;
      pass.uniforms.openness.value = openness;
      const previous = renderer.getRenderTarget();
      renderer.setRenderTarget(target); renderer.clear(); quad.render(renderer); renderer.setRenderTarget(previous);
    },
    resize(width: number, height: number) {
      const scale = Math.min(0.45, 480 / width, 360 / height);
      target.setSize(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
      volume.uniforms.aspect.value = width / height; volume.uniforms.steps.value = width < 700 ? 22 : 28;
      pass.uniforms.texel.value.set(1 / target.width, 1 / target.height);
    },
    dispose() { quad.dispose(); volume.dispose(); pass.dispose(); noise.dispose(); target.dispose(); },
  };
}
