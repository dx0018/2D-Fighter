import * as THREE from "three";

// Capture scenery once. Later shadow passes contain fighters and interactive props only.
export function bakeStaticShadows(renderer, scene, light, map) {
  const savedTarget = renderer.getRenderTarget(),
    savedOverride = scene.overrideMaterial;
  const scratch = new THREE.WebGLRenderTarget(1, 1),
    flat = new THREE.MeshBasicMaterial();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 300);
  camera.position.set(0, 15, 40);
  camera.lookAt(0, 0, 0);
  const extent = (map.bounds.right - map.bounds.left) / 2 + 16;
  light.shadow.camera.left = -extent;
  light.shadow.camera.right = extent;
  light.shadow.camera.top = 40;
  light.shadow.camera.bottom = -40;
  light.shadow.camera.updateProjectionMatrix();
  scene.overrideMaterial = flat;
  renderer.setRenderTarget(scratch);
  scene.updateMatrixWorld(true);
  renderer.render(scene, camera);
  const target = light.shadow.map,
    matrix = light.shadow.matrix.clone();
  renderer.setRenderTarget(savedTarget);
  scene.overrideMaterial = savedOverride;
  scratch.dispose();
  flat.dispose();
  light.shadow.map = null;
  const uniforms = {
    pcStaticMap: { value: target.texture },
    pcStaticMatrix: { value: matrix },
    pcStaticTexel: {
      value: new THREE.Vector2(1 / target.width, 1 / target.height),
    },
    pcStaticSamples: { value: 4 },
  };
  const materials = new Set();
  scene.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = false;
      for (const mat of Array.isArray(o.material) ? o.material : [o.material])
        if (mat?.isMeshStandardMaterial) materials.add(mat);
    }
  });
  for (const mat of materials) {
    const priorCompile = mat.onBeforeCompile,
      priorKey = mat.customProgramCacheKey();
    mat.onBeforeCompile = (shader, renderer) => {
      priorCompile.call(mat, shader, renderer);
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader =
        "uniform mat4 pcStaticMatrix; varying vec4 pcStaticCoord;\n" +
        shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <worldpos_vertex>",
        "#include <worldpos_vertex>\nvec3 pcWorld=(modelMatrix*vec4(transformed,1.0)).xyz+normalize(mat3(modelMatrix)*objectNormal)*.08;pcStaticCoord=pcStaticMatrix*vec4(pcWorld,1.0);",
      );
      shader.fragmentShader =
        "uniform sampler2D pcStaticMap; uniform vec2 pcStaticTexel; uniform float pcStaticSamples; varying vec4 pcStaticCoord;\n" +
        shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <shadowmap_pars_fragment>",
        `#include <shadowmap_pars_fragment>
float pcSceneryShadow(){vec3 p=pcStaticCoord.xyz/pcStaticCoord.w;if(p.z>1.||p.x<0.||p.x>1.||p.y<0.||p.y>1.)return 1.;float d=p.z-.0011;if(pcStaticSamples<1.5)return step(d,unpackRGBAToDepth(texture2D(pcStaticMap,p.xy)));float v=0.;
v+=step(d,unpackRGBAToDepth(texture2D(pcStaticMap,p.xy+pcStaticTexel*vec2(-.65,-.65))));
v+=step(d,unpackRGBAToDepth(texture2D(pcStaticMap,p.xy+pcStaticTexel*vec2(.65,-.65))));
v+=step(d,unpackRGBAToDepth(texture2D(pcStaticMap,p.xy+pcStaticTexel*vec2(-.65,.65))));
v+=step(d,unpackRGBAToDepth(texture2D(pcStaticMap,p.xy+pcStaticTexel*vec2(.65,.65))));return v*.25;}`,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <lights_fragment_end>",
        "#include <lights_fragment_end>\nfloat pcShade=pcSceneryShadow();reflectedLight.directDiffuse*=pcShade;reflectedLight.directSpecular*=pcShade;",
      );
    };
    mat.customProgramCacheKey = () => priorKey + ":pc-static-shadow-v1";
    mat.needsUpdate = true;
  }
  return {
    setSamples(samples) {
      uniforms.pcStaticSamples.value = samples;
    },
    dispose() {
      target.dispose();
    },
  };
}
