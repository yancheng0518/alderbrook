import * as THREE from 'three';

// All dimensions are local metres. The masonry, joinery and furniture share a
// single finished floor datum; moving the group also moves the lamp and glow.
export function createPavilion() {
  const group = new THREE.Group();
  group.name = 'Timber pavilion and nursery';
  const batches = new Map();
  const unitCube = new THREE.BoxGeometry(1, 1, 1);
  const pebbled = new THREE.IcosahedronGeometry(1, 0);
  const round = new THREE.SphereGeometry(1, 10, 7);
  const up = new THREE.Vector3(0, 1, 0);
  const identity = new THREE.Quaternion();
  const unit = new THREE.Vector3(1, 1, 1);
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  let seed = 27431;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  const pick = colors => colors[Math.floor(random() * colors.length)];
  const timber = ['#956840', '#825a3d', '#9d7149', '#87613e'];
  const boards = ['#ad8256', '#b78b5a', '#a77b50', '#b28a63'];
  const roofColors = ['#58635a', '#697467', '#677569', '#778274', '#5e6a62', '#6d7668', '#77816b'];
  const flagstones = ['#b5a68b', '#ae9d81', '#a69a83', '#beb096', '#ad9e85'];
  const leaves = ['#5d793e', '#829448', '#8a9951', '#6c884b', '#9caa62'];
  const matte = new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.92});
  const pottery = new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.48, metalness: 0.06});
  const metal = new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.46, metalness: 0.42});
  const ownedGeometry = new Set([unitCube, pebbled, round]);
  const cylinderCache = new Map();
  const scratchPosition = v(0, 0, 0);
  const scratchNormal = v(0, 0, 0);
  const scratchColor = new THREE.Color();

  // Transform directly into one buffer per surface finish. The roof shingles,
  // chamfered beams, tea service and flowers cost three opaque draw calls.
  function stamp(geometry, color, position, scale = unit, rotation = identity, material = matte) {
    if (!batches.has(material)) batches.set(material, {position: [], normal: [], color: []});
    const batch = batches.get(material);
    const transform = new THREE.Matrix4().compose(position, rotation, scale);
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(transform);
    const positions = geometry.getAttribute('position');
    const normals = geometry.getAttribute('normal');
    const indices = geometry.index;
    const count = indices ? indices.count : positions.count;
    scratchColor.set(color);
    for (let i = 0; i < count; i++) {
      const j = indices ? indices.getX(i) : i;
      scratchPosition.fromBufferAttribute(positions, j).applyMatrix4(transform);
      scratchNormal.fromBufferAttribute(normals, j).applyMatrix3(normalMatrix).normalize();
      batch.position.push(scratchPosition.x, scratchPosition.y, scratchPosition.z);
      batch.normal.push(scratchNormal.x, scratchNormal.y, scratchNormal.z);
      batch.color.push(scratchColor.r, scratchColor.g, scratchColor.b);
    }
  }
  function rotation(rx = 0, ry = 0, rz = 0) {
    return new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
  }
  function box(x, y, z, w, h, d, color, q = identity, material = matte) {
    stamp(unitCube, color, v(x,y,z), v(w,h,d), q, material);
  }
  function ellipsoid(x, y, z, w, h, d, color, q = identity, material = matte) {
    stamp(round, color, v(x,y,z), v(w,h,d), q, material);
  }
  function cylinder(x, y, z, top, bottom, height, segments, color, material = matte) {
    const key = [top, bottom, segments].join('/');
    if (!cylinderCache.has(key)) {
      const geometry = new THREE.CylinderGeometry(top, bottom, 1, segments);
      cylinderCache.set(key, geometry);
      ownedGeometry.add(geometry);
    }
    stamp(cylinderCache.get(key), color, v(x,y,z), v(1,height,1), identity, material);
  }
  function beam(a, b, width, depth, color, material = matte) {
    const direction = b.clone().sub(a);
    const length = direction.length();
    const orientation = new THREE.Quaternion().setFromUnitVectors(up, direction.divideScalar(length));
    stamp(unitCube, color, a.clone().lerp(b, 0.5), v(width, length, depth), orientation, material);
  }
  // Slim round rods are used for handles, flower stalks and the lamp cage.
  const rodGeo = new THREE.CylinderGeometry(1, 1, 1, 6);
  ownedGeometry.add(rodGeo);
  function rod(a, b, radius, color, material = matte) {
    const direction = b.clone().sub(a);
    const length = direction.length();
    const q = new THREE.Quaternion().setFromUnitVectors(up, direction.divideScalar(length));
    stamp(rodGeo, color, a.clone().lerp(b,0.5), v(radius,length,radius), q, material);
  }
  function bentWire(points, radius, color, material = metal) {
    for (let i=1; i<points.length; i++) rod(points[i-1], points[i], radius, color, material);
  }
  function turned(x,y,z, profile, segments, color, material) {
    const geo = new THREE.LatheGeometry(profile.map(([r,h]) => new THREE.Vector2(r,h)), segments);
    stamp(geo, color, v(x,y,z), unit, identity, material);
    geo.dispose();
  }

  const floor = 0.18, w = 2.07, d = 1.60, px = 1.81, pz = 1.36;
  box(0,0.046,0,2*w+0.04,0.19,2*d+0.04,'#8d806c');
  for (let row=0; row<7; row++) {
    const z = -d+(row+0.5)*(2*d/7);
    const cuts = [-w];
    for (let x=-w+0.34+(row%2)*0.28; x<w-0.12; x+=0.51+random()*0.20) cuts.push(x);
    cuts.push(w);
    for (let j=1; j<cuts.length; j++) {
      box((cuts[j]+cuts[j-1])/2, 0.155,z, cuts[j]-cuts[j-1]-0.012,0.05,2*d/7-0.014,pick(flagstones));
    }
  }
  box(0,0.042,d+0.15,1.46,0.14,0.30,'#a79b84');

  // Timber frame: all rails stop on the post centre-lines. Knee braces are
  // built from actual endpoints on their post and its adjoining top plate.
  for (const sx of [-1,1]) for (const sz of [-1,1]) {
    const x=sx*px,z=sz*pz;
    box(x, floor+0.10,z,0.29,0.20,0.29,'#a39980');
    box(x, floor+0.218,z,0.264,0.036,0.264,'#786b58');
    box(x,(floor+0.236+2.58)/2,z,0.178,2.58-floor-0.236,0.178,pick(timber));
    box(x,2.48,z,0.225,0.12,0.225,'#845f40');
    beam(v(x,1.99,z),v(x-sx*0.48,2.49,z),0.095,0.105,'#996c43');
    beam(v(x,1.99,z),v(x,2.49,z-sz*0.48),0.095,0.105,'#90673e');
    // A dark peg head is visible at both tenons on the outer gable.
    for (const p of [[x,2.03,0.09],[x-sx*0.45,2.48,0.054]]) {
      ellipsoid(p[0],p[1],z+sz*p[2],0.022,0.022,0.008,'#544336');
    }
  }
  for (const sx of [-1,1]) {
    const x=sx*px;
    box(x,2.605,0,0.20,0.26,3.05,'#805b3e');
    box(x,0.64,0,0.116,0.92,0.116,'#986e49');
    box(x,1.11,0,0.145,0.04,0.145,'#ab8053');
    for (const y of [0.55,0.90]) {
      box(x,y,0,0.07,y===0.90?0.105:0.082,pz*2,'#9c744e');
    }
    for (const z of [-0.84,-0.43,0.43,0.84]) {
      box(x,0.71,z,0.054,0.37,0.054,'#a47a53');
    }
  }
  for (const sz of [-1,1]) box(0,2.59,sz*pz,px*2+0.34,0.16,0.20,'#855f3d');
  box(0,0.64,-pz,0.12,0.92,0.12,'#906d48');
  for (const y of [0.55,0.90]) box(0,y,-pz,px*2,0.09,0.07,'#9b764f');
  for (const x of [-1.35,-0.91,-0.46,0.46,0.91,1.35]) box(x,0.72,-pz,0.055,0.36,0.052,'#9c754d');

  const eave=2.20, ridge=3.66, pitch=0.468, overhang=1.72;
  const roofY = x => ridge-Math.abs(x)*pitch;
  for (const z of [-1.60,-1.36,-0.90,-0.45,0,0.45,0.90,1.36,1.60]) {
    for (const sx of [-1,1]) {
      beam(v(0,ridge-0.07,z),v(sx*eave,roofY(eave)-0.07,z),0.095,0.094,'#866544');
    }
  }
  box(0,ridge-0.13,0,0.12,0.13,2*overhang+0.04,'#6c533d');
  for (const sz of [-1,1]) {
    const z=sz*pz;
    box(0,(2.65+ridge-0.15)/2,z,0.11,ridge-0.15-2.65,0.11,'#987450');
    for (const sx of [-1,1]) {
      beam(v(sx*0.77,2.65,z),v(0,3.14,z),0.081,0.085,'#946e48');
    }
  }
  // Width runs along the roof pitch; depth runs along its ridge. Each course
  // overlaps the lower course, with clipped slate corners and varied lengths.
  const slopeLength = Math.hypot(eave, eave*pitch);
  const roofAngle = Math.atan(pitch);
  const shingleShape = new THREE.Shape();
  shingleShape.moveTo(-0.5,-0.50);
  shingleShape.lineTo(0.40,-0.50);
  shingleShape.lineTo(0.50,-0.40);
  shingleShape.lineTo(0.50,0.36);
  shingleShape.lineTo(0.41,0.49);
  shingleShape.lineTo(-0.50,0.50);
  shingleShape.closePath();
  const tileGeo = new THREE.ExtrudeGeometry(shingleShape, {depth:1, bevelEnabled:false});
  // Project its xy face onto local xz, with extrusion in +y.
  tileGeo.rotateX(-Math.PI/2);
  ownedGeometry.add(tileGeo);
  for (const sx of [-1,1]) {
    const q = rotation(0,0,-sx*roofAngle);
    box(sx*eave/2,roofY(eave/2),0,slopeLength,0.063,overhang*2,'#846e53',q);
    for (let row=0;row<8;row++) {
      const x=eave-(row+0.46)*eave/8;
      const cuts=[-overhang];
      for (let z=-overhang+0.25+(row%2)*0.12;z<overhang-0.09;z+=0.28+random()*0.10) cuts.push(z);
      cuts.push(overhang);
      const tileRotation = sx===1 ? q : q.clone().multiply(rotation(0,Math.PI,0));
      for (let j=1;j<cuts.length;j++) {
        const extra=random()*0.014;
        stamp(tileGeo,pick(roofColors),v(sx*x,roofY(x)+0.040+row*0.005,(cuts[j]+cuts[j-1])/2),
          v((eave/8+0.075+extra)/Math.cos(roofAngle),0.032+extra,cuts[j]-cuts[j-1]-0.006),tileRotation);
      }
    }
    for (const sz of [-1,1]) {
      beam(v(0,ridge+0.036,sz*(overhang+0.014)),v(sx*(eave+0.024),roofY(eave)+0.018,sz*(overhang+0.014)),
        0.11,0.075,'#8e7858');
    }
    box(sx*eave,roofY(eave)-0.018,0,0.078,0.10,overhang*2+0.05,'#6f604b');
  }
  for (let i=0;i<13;i++) {
    const z=-overhang+(i+0.5)*(2*overhang/13);
    for (const sx of [-1,1]) {
      box(sx*0.076,ridge+0.080,z,0.195,0.041,2*overhang/13-0.007,'#8a8972',rotation(0,0,-sx*roofAngle));
    }
  }

  // Dining table and two trestle benches. Every foot begins at 'floor'.
  const tableTop=0.989;
  for (const x of [-0.89,0.89]) for (const z of [-0.29,0.29]) {
    beam(v(x+Math.sign(x)*0.033,floor,z+Math.sign(z)*0.035),v(x,tableTop-0.07,z),0.079,0.079,'#815f41');
  }
  box(0,0.86,0,2.10,0.116,0.62,'#8d6746');
  for (const x of [-0.91,0.91]) box(x,0.41,0,0.073,0.08,0.66,'#936c47');
  box(0,0.41,0,1.87,0.08,0.079,'#936c47');
  for (let i=0;i<5;i++) {
    box(0,tableTop-0.036,(i-2)*0.165,2.34,0.072,0.159,pick(boards));
  }
  for (const sz of [-1,1]) {
    const z=sz*0.72;
    for (const x of [-0.86,0.86]) {
      box(x,0.366,z,0.10,0.372,0.205,'#865e3d');
      box(x, floor+0.034,z,0.145,0.068,0.245,'#936b43');
    }
    box(0,0.49,z,1.92,0.092,0.09,'#865e3d');
    for (const dz of [-0.071,0.071]) box(0,0.565,z+dz,2.22,0.074,0.137,pick(boards));
  }
  // Narrow flax runner with woven selvedges and short hanging folds.
  const runnerX=-0.40, runnerW=0.57;
  const clothPath=[[-0.478,tableTop-0.16],[-0.458,tableTop-0.080],[-0.425,tableTop+0.001],[-0.395,tableTop+0.012],
    [0.395,tableTop+0.012],[0.425,tableTop+0.001],[0.452,tableTop-0.084],[0.444,tableTop-0.18]];
  function ribbon(x,width,path,color, raise=0) {
    for (let j=1;j<path.length;j++) {
      const [z1,y1]=path[j-1], [z2,y2]=path[j];
      const angle = Math.atan2(y2-y1,z2-z1);
      const dz = (z1+z2)/2-Math.sin(angle)*raise;
      const dy = (y1+y2)/2+Math.cos(angle)*raise;
      box(x,dy,dz,width,0.009,Math.hypot(z2-z1,y2-y1)+0.004,color,rotation(-angle));
    }
  }
  ribbon(runnerX,runnerW,clothPath,'#d7c5a1');
  for (const sx of [-1,1]) {
    ribbon(runnerX+sx*0.218,0.017,clothPath,'#a36048',0.006);
    ribbon(runnerX+sx*0.182,0.009,clothPath,'#a36048',0.006);
  }
  for (let i=0;i<12;i++) {
    const x=runnerX-runnerW/2+(i+0.5)*runnerW/12;
    rod(v(x,tableTop-0.18,0.444),v(x+0.004,tableTop-0.204-random()*0.011,0.444),0.0045,'#d4c19d');
  }

  const y0=tableTop+0.016;
  function cup(x,y,z) {
    cylinder(x,y+0.005,z,0.077,0.059,0.010,14,'#c2c8aa',pottery);
    turned(x,y+0.013,z,[[0.001,0],[0.035,0],[0.046,0.018],[0.049,0.063],
      [0.045,0.064],[0.041,0.024],[0.001,0.015]],14,'#d2d2b7',pottery);
    cylinder(x,y+0.063,z,0.044,0.044,0.003,12,'#65462d',pottery);
    const handle=[];
    for (let i=0;i<=9;i++) {
      const a=i/9*Math.PI;
      handle.push(v(x+0.044+Math.sin(a)*0.026,y+0.05+Math.cos(a)*0.019,z));
    }
    bentWire(handle,0.006,'#cdd0af',pottery);
  }
  cup(-0.57,y0,0.20); cup(0.09,tableTop,-0.19);
  const kx=-0.51,kz=-0.065;
  turned(kx,y0,kz,[[0.001,0],[0.063,0],[0.112,0.061],[0.105,0.116],[0.068,0.144],[0.001,0.144]],16,'#759583',pottery);
  turned(kx,y0+0.143,kz,[[0.001,0],[0.078,0],[0.064,0.015],[0.020,0.025],[0.001,0.026]],16,'#a7b69b',pottery);
  ellipsoid(kx,y0+0.18,kz,0.023,0.017,0.023,'#886c40',identity,metal);
  rod(v(kx-0.077,y0+0.058,kz),v(kx-0.136,y0+0.095,kz),0.034,'#759583',pottery);
  rod(v(kx-0.136,y0+0.095,kz),v(kx-0.167,y0+0.145,kz),0.023,'#829f8a',pottery);
  const kettleHandle=[];
  for (let i=0;i<=12;i++) {
    const a=Math.PI*i/12;
    kettleHandle.push(v(kx+0.089+0.063*Math.sin(a),y0+0.085+0.049*Math.cos(a),kz));
  }
  bentWire(kettleHandle,0.013,'#627f70',pottery);
  turned(-0.035,tableTop,0.13,[[0,0],[0.068,0],[0.128,0.032],[0.147,0.05],[0.143,0.056],[0.094,0.031],[0,0.023]],
    16,'#936a43',pottery);
  for (const [dx,dz,h,c] of [[-0.055,0,0.064,'#bb633c'],[0.015,0.047,0.067,'#ca823c'],
      [0.065,-0.024,0.065,'#ac6339'],[-0.013,-0.059,0.065,'#c5994e'],[-0.005,0,0.12,'#ba6c39']]) {
    const x=-0.035+dx,z=0.13+dz;
    ellipsoid(x,tableTop+h,z,0.044,0.041,0.043,c);
    rod(v(x,tableTop+h+0.032,z),v(x+0.005,tableTop+h+0.048,z+0.002),0.0037,'#73542e');
  }
  const vx=-0.96,vz=-0.16;
  turned(vx,tableTop,vz,[[0.001,0],[0.048,0],[0.065,0.072],[0.05,0.113],[0.026,0.15],[0.031,0.16],[0.020,0.162]],12,'#a97d57',pottery);

  function blossom(x,y,z,size,head,petalCount=5) {
    for (let i=0;i<petalCount;i++) {
      const a=i*Math.PI*2/petalCount;
      ellipsoid(x+Math.cos(a)*size*0.66,y,z+Math.sin(a)*size*0.66,size*0.65,size*0.26,size*0.40,head,rotation(0,-a,0));
    }
    ellipsoid(x,y+size*0.2,z,size*0.38,size*0.30,size*0.38,'#d8aa49');
  }
  for (let i=0;i<7;i++) {
    const a=i*2.4,r=0.032+0.045*random();
    const tip=v(vx+Math.cos(a)*r,tableTop+0.25+random()*0.065,vz+Math.sin(a)*r);
    rod(v(vx,tableTop+0.149,vz),tip,0.0033,'#728752');
    blossom(tip.x,tip.y,tip.z,0.025+random()*0.008,i%3===0?'#c98369':'#e1d6af');
  }
  // Hurricane lamp: turned brass reservoir, wick adjuster, bail and wire guards.
  const lx=0.56,lz=0.07,ly=tableTop+0.003;
  turned(lx,ly,lz,[[0.001,0],[0.095,0],[0.108,0.014],[0.107,0.027],[0.078,0.039],[0.077,0.058],
    [0.099,0.078],[0.094,0.105],[0.067,0.126],[0.063,0.142],[0.001,0.142]],20,'#977040',metal);
  turned(lx,ly+0.125,lz,[[0.001,0],[0.080,0],[0.087,0.012],[0.073,0.025],[0.034,0.03],[0.025,0.050],[0.001,0.051]],18,'#69563a',metal);
  box(lx,ly+0.181,lz,0.019,0.021,0.011,'#403226');
  rod(v(lx+0.071,ly+0.115,lz),v(lx+0.105,ly+0.115,lz),0.009,'#a98a4e',metal);
  ellipsoid(lx+0.108,ly+0.115,lz,0.008,0.018,0.018,'#ac8950',identity,metal);
  turned(lx,ly+0.348,lz,[[0.001,0],[0.074,0],[0.088,0.015],[0.079,0.027],[0.051,0.032],[0.052,0.053],
    [0.060,0.062],[0.046,0.072],[0.001,0.077]],18,'#806841',metal);
  for (const sx of [-1,1]) {
    bentWire([v(lx+sx*0.069,ly+0.065,lz),v(lx+sx*0.105,ly+0.097,lz),
      v(lx+sx*0.116,ly+0.277,lz),v(lx+sx*0.098,ly+0.33,lz),v(lx+sx*0.063,ly+0.374,lz)],0.012,'#8c704a');
    for (const sz of [-1,1]) bentWire([v(lx+sx*0.063,ly+0.139,lz+sz*0.028),v(lx+sx*0.039,ly+0.225,lz+sz*0.081),
      v(lx-sx*0.053,ly+0.346,lz+sz*0.036)],0.0048,'#a18654');
  }
  const bail=[];
  for(let i=0;i<=18;i++) {
    const a=Math.PI*i/18;
    bail.push(v(lx+Math.cos(a)*0.119,ly+0.292+Math.sin(a)*0.233,lz+Math.sin(a)*0.015));
  }
  bentWire(bail,0.0068,'#88734f');
  const glassProfile=[[0.055,0.145],[0.077,0.164],[0.085,0.205],[0.083,0.244],[0.068,0.298],[0.057,0.350]];
  const glassGeometry=new THREE.LatheGeometry(glassProfile.map(([r,h])=>new THREE.Vector2(r,h)),22);
  const glassMat=new THREE.MeshStandardMaterial({color:0xf6d89a,emissive:0xf5b44e,emissiveIntensity:0.10,
    transparent:true,opacity:0.24,side:THREE.DoubleSide,metalness:0.08,roughness:0.22,depthWrite:false});
  const glass=new THREE.Mesh(glassGeometry,glassMat);
  glass.position.set(lx,ly,lz);
  group.add(glass);
  const flameMat=new THREE.MeshBasicMaterial({color:0xffde80,transparent:true,toneMapped:false,depthWrite:false});
  const fireGeo=new THREE.LatheGeometry([[0.001,0],[0.009,0.006],[0.021,0.026],[0.018,0.046],[0.010,0.060],
    [0.001,0.089]].map(([r,h])=>new THREE.Vector2(r,h)),12);
  const flame=new THREE.Mesh(fireGeo,flameMat);
  flame.position.set(lx,ly+0.182,lz);
  group.add(flame);
  const haloCanvas=document.createElement('canvas');
  haloCanvas.width=haloCanvas.height=96;
  const ctx=haloCanvas.getContext('2d');
  const gradient=ctx.createRadialGradient(48,48,0,48,48,48);
  gradient.addColorStop(0,'rgba(255,244,174,0.78)');
  gradient.addColorStop(0.13,'rgba(255,202,102,0.46)');
  gradient.addColorStop(0.43,'rgba(255,174,73,0.15)');
  gradient.addColorStop(1,'rgba(255,158,52,0)');
  ctx.fillStyle=gradient;
  ctx.fillRect(0,0,96,96);
  const haloTex=new THREE.CanvasTexture(haloCanvas);
  haloTex.colorSpace=THREE.SRGBColorSpace;
  const haloMat=new THREE.SpriteMaterial({map:haloTex,transparent:true,blending:THREE.AdditiveBlending,
    depthWrite:false,toneMapped:false});
  const halo=new THREE.Sprite(haloMat);
  halo.position.set(lx,ly+0.226,lz);
  halo.scale.setScalar(0.76);
  group.add(halo);
  const light=new THREE.PointLight(0xffc078,3.2,4.4,2);
  light.name='Oil lamp pool of light';
  light.position.set(lx,ly+0.233,lz);
  group.add(light);

  // A long planter runs parallel to the west rail with 0.19m of clear soil
  // between its inner edge and the paving. The separate nursery is on the east.
  const bx=-2.52,bz=-0.08;
  for (const sx of [-1,1]) for (const sz of [-1,1]) {
    box(bx+sx*0.22,0.21,bz+sz*0.85,0.075,0.42,0.075,'#7f6649');
  }
  for (const sx of [-1,1]) for (const y of [0.145,0.291]) {
    box(bx+sx*0.216,y,bz,0.055,0.135,1.70,'#9e8157');
  }
  for (const sz of [-1,1]) box(bx,0.222,bz+sz*0.85,0.43,0.29,0.056,'#8c714b');
  box(bx,0.322,bz,0.386,0.054,1.66,'#5d4d36');
  for (let i=0;i<39;i++) {
    const x=bx+(random()-0.5)*0.30, z=bz+(random()-0.5)*1.55;
    const y=0.42+random()*0.17;
    rod(v(x,0.34,z),v(x+0.007,y,z+0.015),0.005,'#657342');
    for (let j=0;j<3;j++) {
      const a=random()*6.28;
      stamp(pebbled,pick(leaves),v(x+Math.cos(a)*0.033,0.41+0.100*random(),z+Math.sin(a)*0.033),
        v(0.031,0.059,0.020),rotation(0,a,0.67));
    }
    if (i%2===0) blossom(x+0.007,y,z+0.015,0.030+random()*0.013,pick(['#d9bb65','#ddcba5','#b98e9e','#c68d78']));
  }

  const wx=2.89,wz=-0.95, benchTop=0.88;
  for (const sx of [-1,1]) for (const sz of [-1,1]) {
    box(wx+sx*0.22,0.425,wz+sz*0.65,0.078,0.85,0.078,'#8c714e');
  }
  for (const y of [0.25,benchTop-0.035]) for (let i=0;i<3;i++) {
    box(wx+(i-1)*0.182,y,wz,0.174,0.07,1.48,pick(boards));
  }
  for (const sx of [-1,1]) box(wx+sx*0.218,0.78,wz,0.055,0.10,1.40,'#806647');
  function flowerPot(x,y,z,r,h,plant) {
    turned(x,y,z,[[0.001,0],[r*0.69,0],[r*0.91,h*0.82],[r,h*0.83],[r,h],[r*0.87,h],
      [r*0.83,h*0.92]],12,'#b47e5b');
    cylinder(x,y+h*0.94,z,r*0.85,r*0.85,0.012,12,'#574737');
    if (plant) {
      for (let k=0;k<8;k++) {
        const a=k*2.4;
        stamp(pebbled,pick(leaves),v(x+r*0.34*Math.cos(a),y+h+r*(0.25+random()*0.5),z+r*0.34*Math.sin(a)),
          v(r*0.25,r*0.73,r*0.39),rotation(0,-a,0.63));
      }
    }
  }
  for (let i=0;i<3;i++) flowerPot(wx+0.015,benchTop,wz-0.46+i*0.226,0.093,0.118,i!==1);
  flowerPot(wx-0.063,0.285,wz+0.34,0.128,0.152,false);
  flowerPot(wx+0.076,0.285,wz-0.11,0.082,0.108,false);
  box(wx,benchTop+0.029,wz+0.416,0.32,0.058,0.32,'#8b6b47');
  for(let i=0;i<3;i++) {
    const x=wx+(i-1)*0.086,z=wz+0.426+(i%2)*0.035;
    const q=rotation(-0.22,0.14*i,0);
    box(x,benchTop+0.129,z,0.098,0.137,0.016,'#c3ae85',q);
    box(x,benchTop+0.148,z+0.012,0.060,0.047,0.006,i===1?'#a57a55':'#82915e',q);
  }
  // Tools lean on the rear edge of the nursery table, clear of the side rail.
  const rakeTop=v(wx+0.18,1.26,wz-0.64), rakeBottom=v(wx+0.47,0.085,wz-1.04);
  rod(rakeBottom,rakeTop,0.021,'#a17d4c');
  rod(v(rakeBottom.x-0.145,0.09,rakeBottom.z),v(rakeBottom.x+0.145,0.09,rakeBottom.z),0.016,'#626759',metal);
  for (let i=0;i<7;i++) {
    const x=rakeBottom.x+(i-3)*0.044;
    rod(v(x,0.09,rakeBottom.z),v(x,0.012,rakeBottom.z+0.036),0.009,'#626759',metal);
  }
  const shovelTop=v(wx-0.11,1.12,wz-0.66), shovelBottom=v(wx+0.02,0.17,wz-1.03);
  rod(shovelBottom,shovelTop,0.024,'#9a754b');
  stamp(pebbled,'#788071',v(shovelBottom.x,0.12,shovelBottom.z),v(0.112,0.141,0.022),rotation(-0.24,0.14,0),metal);
  // Finalise static batches; only the flame, glass, sprite and light vary.
  for (const [material,data] of batches) {
    const geometry=new THREE.BufferGeometry();
    for (const name of ['position','normal','color']) {
      geometry.setAttribute(name,new THREE.Float32BufferAttribute(data[name],3));
    }
    geometry.computeBoundingSphere();
    const mesh=new THREE.Mesh(geometry,material);
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    group.add(mesh);
  }
  for (const geometry of ownedGeometry) geometry.dispose();
  let level=1;
  function setLight(value) {
    level=THREE.MathUtils.clamp(value,0,1);
    flame.visible=halo.visible=level>0.001;
    glassMat.emissiveIntensity=0.18*level;
    glassMat.opacity=0.12+0.16*level;
    flameMat.opacity=level;
    haloMat.opacity=level*0.72;
    light.intensity=level*3.2;
  }
  function update(seconds) {
    if (level<0.001) return;
    const flicker=0.97+0.021*Math.sin(seconds*8.1)+0.010*Math.sin(seconds*13.3);
    flame.scale.y=flicker;
    haloMat.opacity=level*0.72*flicker;
    light.intensity=level*3.2*flicker;
  }
  setLight(1);
  return {group,setLight,update};
}

