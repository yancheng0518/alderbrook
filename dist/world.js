import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createCottage } from './cottage.js';
import { createPavilion } from './pavilion.js';
import { createWoodland } from './woodland.js';

const views = {
  overview: { eye: [8.5, 6.25, 17.8], aim: [-.2, 2.05, .3], fov: 34, min: 8.2 },
  cottage:  { eye: [1.85, 3.45, 9.75], aim: [-2.06, 2.37, .10], fov: 37, min: 5.7 },
  pavilion: { eye: [6.55, 1.96, 2.40], aim: [5.53, 1.12, -1.68], fov: 36, min: 2.8 },
  creek:    { eye: [1.9, 1.74, 8.45], aim: [-4.65, .67, 5.55], fov: 40, min: 3.2 }
};
const moods = {
  afternoon: {sky:'#88b6c1',mist:'#adc3ba',sun:'#ffe0b5',hemi:'#dfebef',soil:'#77816f',dir:[-15,16,7],strength:2.96,ambient:1.35,exposure:1.12,fog:61,clear:12},
  morning:   {sky:'#97b6bf',mist:'#c0cfbf',sun:'#ffe7c7',hemi:'#e1edf3',soil:'#667464',dir:[15,11,8],strength:1.75,ambient:1.65,exposure:1.10,fog:46,clear:6},
  evening:   {sky:'#293958',mist:'#536780',sun:'#a0b4da',hemi:'#b6c7e6',soil:'#55596a',dir:[-12,14,-10],strength:.67,ambient:.78,exposure:.86,fog:61,clear:8}
};
const vec = a => new THREE.Vector3(...a);
const color = a => new THREE.Color(a);
const damp = THREE.MathUtils.damp;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

function createSky() {
  const uniforms = {topColor:{value:color('#89afa9')},horizon:{value:color('#c2c5a5')},sunColor:{value:color('#ffdcab')},sunDir:{value:vec([-12,16,11]).normalize()}};
  const material = new THREE.ShaderMaterial({
    uniforms,side:THREE.BackSide,depthWrite:false,
    vertexShader:'varying vec3 ray;void main(){ray=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform vec3 topColor,horizon,sunColor,sunDir; varying vec3 ray;
      void main(){vec3 d=normalize(ray);float h=pow(clamp(d.y*1.7,0.,1.),.66);
      vec3 sky=mix(horizon,topColor,h);float s=max(0.,dot(d,normalize(sunDir)));
      sky+=sunColor*pow(s,26.)*.20;sky+=sunColor*smoothstep(.99966,.99987,s)*1.3;
      gl_FragColor=vec4(sky,1.);
      #include <colorspace_fragment>
      }`
  });
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(185,24,14),material);
  mesh.renderOrder=-5;
  return mesh;
}

function createMotes() {
  const positions=new Float32Array(70*3);
  let seed=973;
  const random=()=>((seed=Math.imul(16807,seed)>>>0)/4294967296);
  for(let i=0;i<positions.length;i+=3){
    positions[i]=(random()-.5)*24;
    positions[i+1]=.25+random()**1.5*6.7;
    positions[i+2]=(random()-.5)*17+1.5;
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const material=new THREE.PointsMaterial({color:0xffe59e,size:.026,transparent:true,opacity:.56,depthWrite:false});
  const mesh=new THREE.Points(geometry,material);
  return mesh;
}

function createLightShafts(){
  // Sparse light fans in the canopy gaps. Each strip always faces the viewer around its sun axis.
  const vertices=[], data=[], widths=[], indices=[];
  const shafts=[[-13,14,-7,.48,15],[-11.9,14,-7,.20,15],[-10,15,-12,.77,17],
    [-5.5,14,-14,.35,15],[-4.8,15,-14,.58,16],[4.1,13,-10,.32,13],[5.1,14,-10,.59,14],
    [-11.8,12,3,.42,12],[-11.2,12,3,.16,12]];
  const axis=vec([.71,-1,-.33]).normalize();
  shafts.forEach(([x,y,z,w,len],i)=>{
    for(const [u,along] of [[-1,0],[1,0],[-1,1],[1,1]]){
      vertices.push(x+axis.x*len*along,y+axis.y*len*along,z+axis.z*len*along);
      data.push(u,along);widths.push(w);
    }
    const k=i*4;indices.push(k,k+1,k+2,k+2,k+1,k+3);
  });
  const g=new THREE.BufferGeometry();g.setIndex(indices);
  g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(data,2));g.setAttribute('width',new THREE.Float32BufferAttribute(widths,1));
  const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
    uniforms:{axis:{value:axis},amount:{value:1}},
    vertexShader:`uniform vec3 axis;attribute float width;varying vec2 coord;void main(){
      coord=uv;vec3 across=normalize(cross(normalize(cameraPosition-position),axis));
      vec3 p=position+across*uv.x*width*(.4+uv.y*1.7);
      gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`,
    fragmentShader:`varying vec2 coord;uniform float amount;void main(){
      float edge=pow(max(0.,1.-coord.x*coord.x),2.);
      float fade=smoothstep(0.,.18,coord.y)*(1.-smoothstep(.26,1.,coord.y));
      gl_FragColor=vec4(.94,.84,.57,edge*fade*amount*.085);}`});
  const mesh=new THREE.Mesh(g,mat);
  mesh.frustumCulled=false;
  return mesh;
}

function contactShadows(scene){
  const image=document.createElement('canvas');image.width=image.height=64;
  const ctx=image.getContext('2d'),gradient=ctx.createRadialGradient(32,32,3,32,32,32);
  gradient.addColorStop(0,'rgba(0,0,0,.70)');gradient.addColorStop(.64,'rgba(0,0,0,.40)');gradient.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  const mat=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(image),transparent:true,opacity:.55,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  const plane=new THREE.PlaneGeometry(1,1);
  for(const [x,z,w,d] of [[-2,-1,9,7],[5.4,-1.7,6.6,5.2],[-1.2,1.85,5,3.1],[-6.85,2.05,2.6,2.6]]){
    const shadow=new THREE.Mesh(plane,mat);shadow.rotation.x=-Math.PI/2;shadow.position.set(x,.012,z);shadow.scale.set(w,d,1);scene.add(shadow);
  }
}

export function createWorld(host, onManual) {
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=moods.afternoon.exposure;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate=false;
  renderer.shadowMap.needsUpdate=true;
  renderer.domElement.setAttribute('aria-hidden','true');
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(34,1,.14,220);
  const control=new OrbitControls(camera,renderer.domElement);
  control.enablePan=false;
  control.enableDamping=true;
  control.dampingFactor=.11;
  control.rotateSpeed=.62;
  control.zoomSpeed=.76;
  control.minPolarAngle=.21;
  control.maxPolarAngle=Math.PI*.495;
  control.maxDistance=33;
  const sky=createSky(), motes=createMotes(),shafts=createLightShafts();
  scene.add(sky,motes,shafts);
  const sun=new THREE.DirectionalLight(), hemi=new THREE.HemisphereLight();
  sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-18,right:18,top:17,bottom:-17,near:1,far:63});
  sun.shadow.bias=-.00035;
  sun.shadow.normalBias=.025;
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun,sun.target,hemi);
  scene.fog=new THREE.Fog(moods.afternoon.mist,12,61);

  const trees=createWoodland(), house=createCottage(), oil=createPavilion();
  house.group.position.set(-2,0,-1);
  oil.group.position.set(5.4,0,-1.7);
  scene.add(trees.group,house.group,oil.group);
  contactShadows(scene);
  host.append(renderer.domElement);

  const units={house,oil}, levels={house:1,oil:1}, targets={...levels};
  let timeOfDay='afternoon', moodGoal, moodLeft=0, lastShadow=0, nextDue=0;
  const tunings={};
  for(const [key,m] of Object.entries(moods)) {
    tunings[key]={...m,sky:color(m.sky),mist:color(m.mist),sun:color(m.sun),hemi:color(m.hemi),soil:color(m.soil),dir:vec(m.dir)};
  }
  function applyMood(k) {
    const t=moodGoal,u=sky.material.uniforms;
    u.topColor.value.lerp(t.sky,k);u.horizon.value.lerp(t.mist,k);
    u.sunColor.value.lerp(t.sun,k);
    scene.fog.color.copy(u.horizon.value);
    scene.fog.far=THREE.MathUtils.lerp(scene.fog.far,t.fog,k);
    scene.fog.near=THREE.MathUtils.lerp(scene.fog.near,t.clear,k);
    const shaftLevel=timeOfDay==='afternoon'?1:0;
    shafts.material.uniforms.amount.value=THREE.MathUtils.lerp(shafts.material.uniforms.amount.value,shaftLevel,k);
    sun.position.lerp(t.dir,k);u.sunDir.value.copy(sun.position).normalize();
    sun.color.lerp(t.sun,k);hemi.color.lerp(t.hemi,k);hemi.groundColor.lerp(t.soil,k);
    sun.intensity=THREE.MathUtils.lerp(sun.intensity,t.strength,k);
    hemi.intensity=THREE.MathUtils.lerp(hemi.intensity,t.ambient,k);
    renderer.toneMappingExposure=THREE.MathUtils.lerp(renderer.toneMappingExposure,t.exposure,k);
  }
  function setTime(id, snap=false){
    if(!(id in tunings))return;
    nextDue=0;
    timeOfDay=id;moodGoal=tunings[id];moodLeft=snap||reduced?0:1.55;
    if(!moodLeft){applyMood(1);renderer.shadowMap.needsUpdate=true;}
  }
  setTime(timeOfDay,true);
  let currentView='overview', transition, cssWidth=0,cssHeight=0, interactiveUntil=0;
  let pixelLimit=Math.min(devicePixelRatio||1,1.65);
  function lens(view) {
    const aspect=cssWidth/cssHeight||1;
    const widthAtTarget=view===views.overview?15.8:view===views.cottage?7.6:view===views.pavilion?4.8:5.4;
    const distance=vec(view.eye).distanceTo(vec(view.aim));
    const fitFov=THREE.MathUtils.radToDeg(2*Math.atan(widthAtTarget/(2*distance*aspect)));
    return Math.max(view.fov,Math.min(85,fitFov));
  }
  function frame(id,snap=false) {
    if(!(id in views))return;
    nextDue=0;
    const view=views[id];
    currentView=id;
    // Flush residual drag damping before taking a fresh camera pose.
    control.enableDamping=false;control.update();control.enableDamping=true;
    control.minDistance=view.min;
    transition={
      startEye:camera.position.clone(),startAim:control.target.clone(),startFov:camera.fov,
      eye:vec(view.eye),aim:vec(view.aim),fov:lens(view),elapsed:0
    };
    if(snap||reduced){place(1);transition=null;}
  }
  function place(t){
    const v=transition;
    camera.position.lerpVectors(v.startEye,v.eye,t);
    control.target.lerpVectors(v.startAim,v.aim,t);
    camera.fov=THREE.MathUtils.lerp(v.startFov,v.fov,t);
    camera.updateProjectionMatrix();control.update();
  }
  function resize(){
    const {width,height}=host.getBoundingClientRect();
    if(width<1||height<1)return;
    cssWidth=width;cssHeight=height;
    renderer.setPixelRatio(pixelLimit);
    renderer.setSize(width,height,false);
    camera.aspect=width/height;camera.fov=lens(views[currentView]);camera.updateProjectionMatrix();
    if(transition)transition.fov=camera.fov;
    interactiveUntil=performance.now()+250;
  }
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);
  resize();frame('overview',true);
  control.addEventListener('start',()=>{transition=null;onManual?.();});
  control.addEventListener('change',()=>{
    const now=performance.now();
    if(now>=interactiveUntil)nextDue=0;
    interactiveUntil=now+250;
  });
  host.addEventListener('pointerdown',()=>{host.classList.add('dragging');host.focus({preventScroll:true});});
  window.addEventListener('pointerup',()=>host.classList.remove('dragging'));
  host.addEventListener('pointercancel',()=>host.classList.remove('dragging'));
  const spherical=new THREE.Spherical(),offset=new THREE.Vector3();
  host.addEventListener('keydown',e=>{
    const keys=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'];
    if(!keys.includes(e.key))return;
    e.preventDefault();transition=null;
    if(e.key==='Home'){frame(currentView);return;}
    spherical.setFromVector3(offset.subVectors(camera.position,control.target));
    if(e.key==='ArrowLeft')spherical.theta-=.12;
    if(e.key==='ArrowRight')spherical.theta+=.12;
    if(e.key==='ArrowUp')spherical.phi-=.10;
    if(e.key==='ArrowDown')spherical.phi+=.10;
    if(e.key==='='||e.key==='+')spherical.radius*=.90;
    if(e.key==='-')spherical.radius*=1.11;
    spherical.phi=THREE.MathUtils.clamp(spherical.phi,control.minPolarAngle,control.maxPolarAngle);
    spherical.radius=THREE.MathUtils.clamp(spherical.radius,control.minDistance,control.maxDistance);
    camera.position.copy(control.target).add(offset.setFromSpherical(spherical));control.update();onManual?.();
  });
  let last=0,elapsed=0,slowFrames=0,frames=0,handle=0;
  function render(now){
    if(now+.6<nextDue){handle=requestAnimationFrame(render);return;}
    // Limit passive scenery to 30 Hz (or 4 Hz with reduced motion). Input, lighting and camera moves use 60 Hz.
    const busy=transition||moodLeft>0||now<interactiveUntil||levels.house!==targets.house||levels.oil!==targets.oil;
    const period=1000/(busy?60:reduced?4:30);
    nextDue=Math.max(now+.5,Math.min(now+period,nextDue+period));
    const actualDelta=last?(now-last)/1000:0;last=now;
    const dt=Math.min(actualDelta,.4);elapsed+=dt;
    if(transition){
      transition.elapsed+=dt;const t=Math.min(transition.elapsed/.9,1);
      place(t*t*(3-2*t));if(t>=1)transition=null;
    } else control.update();
    if(moodLeft>0){
      moodLeft=Math.max(0,moodLeft-dt);applyMood(moodLeft===0?1:1-Math.exp(-4*dt));
      if(elapsed-lastShadow>.22||moodLeft===0){renderer.shadowMap.needsUpdate=true;lastShadow=elapsed;}
    }
    for(const key of ['house','oil']){
      if(levels[key]!==targets[key]){
        levels[key]=reduced?targets[key]:damp(levels[key],targets[key],8,dt);
        if(Math.abs(levels[key]-targets[key])<.002)levels[key]=targets[key];
        units[key].setLight(levels[key]);
      }
    }
    const t=reduced?0:elapsed;
    trees.updateSightline(camera.position,control.target);
    trees.update(t);house.update(t);oil.update(t);
    motes.position.set(Math.sin(t*.13)*.52,Math.sin(t*.27)*.12,Math.cos(t*.16)*.38);
    renderer.render(scene,camera);
    if(frames++>12&&actualDelta>Math.max(.047,period*.0016))slowFrames++;else slowFrames=Math.max(0,slowFrames-1);
    if(slowFrames>35&&pixelLimit>.8){
      pixelLimit=Math.max(.8,pixelLimit*.84);slowFrames=0;resize();
    }
    handle=requestAnimationFrame(render);
  }
  function resume(){cancelAnimationFrame(handle);last=nextDue=0;if(!document.hidden)handle=requestAnimationFrame(render);}
  document.addEventListener('visibilitychange',resume);
  render(performance.now());
  return {frame,setTime,setLight:(key,on)=>{if(key in targets){targets[key]=on?1:0;nextDue=0;}},
    inspect:()=>({view:currentView,time:timeOfDay,levels:{...levels},target:control.target.toArray(),eye:camera.position.toArray(),
      calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,pixelRatio:renderer.getPixelRatio(),frames})};
}
