import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// All dimensions are in metres. Local +Z is the front of the house.
export function createCottage() {
  const group = new THREE.Group();
  group.name = 'The Alderbrook cottage';
  let seed = 42681;
  const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const choose = list => list[Math.floor(rand() * list.length)];
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  const Y = v(0, 1, 0);
  const one = v(1, 1, 1);
  const identity = new THREE.Quaternion();
  const tint = new THREE.Color();
  let frame = new THREE.Matrix4();
  const batches = new Map();
  const materials = {};
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const timber = ['#52372b', '#604332', '#654834', '#583b2e', '#75553b'];
  const pine = ['#92704d', '#9c7954', '#876743', '#846244', '#a3845e'];
  const foundation = ['#8e8371', '#918a78', '#a19783', '#787667', '#9c917b', '#827b6d'];
  const brick = ['#9b735b', '#a58066', '#b08b71', '#8e725f', '#aa816b'];
  const shingles = ['#926143', '#976247', '#a16a48', '#84553e', '#ad7250', '#9f6849', '#915c42', '#a46b4c'];

  function texture(kind) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const c = canvas.getContext('2d');
    c.fillStyle = '#faf8f2';
    c.fillRect(0, 0, 128, 128);
    if (kind === 'wood') {
      for (let i = 0; i < 72; i++) {
        const x = rand() * 128, bend = rand() * 4 - 2;
        c.beginPath();
        c.moveTo(x, -1);
        c.bezierCurveTo(x + bend * 3, 36, x - bend, 89, x, 129);
        c.strokeStyle = 'rgba(62,38,20,' + (.045 + rand() * .17) + ')';
        c.lineWidth = .3 + rand() * 1.4;
        c.stroke();
      }
    } else {
      for (let i = 0; i < 2700; i++) {
        c.fillStyle = 'rgba(83,65,42,' + (rand() * .14) + ')';
        c.fillRect(rand() * 128, rand() * 128, 1 + rand() * 2.2, 1 + rand() * 1.7);
      }
    }
    const result = new THREE.CanvasTexture(canvas);
    result.colorSpace = THREE.SRGBColorSpace;
    result.wrapS = result.wrapT = THREE.RepeatWrapping;
    return result;
  }
  function material(key, options = {}) {
    materials[key] = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .89, ...options });
  }
  material('solid');
  material('timber', {map: texture('wood')});
  material('plaster', {map: texture('plaster')});
  material('slate', {map: materials.plaster.map});
  material('glass', {emissive: 0xffbb5d, emissiveIntensity: .68, roughness: .52});
  material('iron', {metalness: .28, roughness: .66});
  material('flame', {emissive: 0xffa732, emissiveIntensity: 1.8});
  const shade = new THREE.Color();
  function shape(source, color, key = 'solid', pos = v(0, 0, 0), rot = identity, scale = one) {
    const geo = source.index ? source.toNonIndexed() : source.clone();
    const transform = new THREE.Matrix4().compose(pos, rot, scale).premultiply(frame);
    geo.applyMatrix4(transform);
    const count = geo.getAttribute('position').count;
    // All shapes in a batch have the same attributes, including hand-built faces.
    if (!geo.getAttribute('uv')) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(count * 2), 2));
    tint.set(color);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) tint.toArray(colors, 3 * i);
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(geo);
  }
  function box(x, y, z, w, h, d, color, key = 'solid') {
    shape(boxGeo, color, key, v(x, y, z), identity, v(w, h, d));
  }
  function beam(a, b, width, depth = width, color = choose(timber), key = 'timber') {
    const dir = b.clone().sub(a);
    const length = dir.length();
    const rot = new THREE.Quaternion().setFromUnitVectors(Y, dir.normalize());
    shape(boxGeo, color, key, a.clone().lerp(b, .5), rot, v(width, length, depth));
  }
  function rod(a, b, radius, color, key = 'solid', sides = 8, topRadius = radius) {
    const dir = b.clone().sub(a);
    const length = dir.length();
    const rot = new THREE.Quaternion().setFromUnitVectors(Y, dir.normalize());
    const geo = new THREE.CylinderGeometry(topRadius, radius, length, sides);
    shape(geo, color, key, a.clone().lerp(b, .5), rot);
    geo.dispose();
  }
  function scope(x, y, z, angle, fn) {
    const previous = frame;
    frame = previous.clone().multiply(new THREE.Matrix4().makeTranslation(x, y, z))
      .multiply(new THREE.Matrix4().makeRotationY(angle));
    fn();
    frame = previous;
  }
  // An XY polygon with a flat back, front face points towards +Z.
  function polygon(outline, depth, color, key = 'solid', z = 0) {
    const profile = new THREE.Shape(outline.map(p => new THREE.Vector2(...p)));
    const geo = new THREE.ExtrudeGeometry(profile, {depth, bevelEnabled: false, curveSegments: 1});
    shape(geo, color, key, v(0, 0, z));
    geo.dispose();
  }
  function facets(vertices, faces, color, key) {
    const xyz = [], uv = [];
    for (const face of faces) for (const i of face) {
      xyz.push(...vertices[i]);
      uv.push(vertices[i][0], vertices[i][2] + vertices[i][1]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(xyz, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    shape(geo, color, key);
    geo.dispose();
  }
  const topFaces = [[0,1,2],[0,2,3],[0,3,4],[0,4,5]];
  // Each course overlaps the one below it. Clipped toe corners and individual
  // heights catch a narrow highlight along the weathered lower shingle edges.
  function roofPlane(x0, x1, z0, z1, y0, y1, tileWidth = .45, tileLength = .39) {
    const dz = z1 - z0, dy = y1 - y0;
    const length = Math.hypot(dz, dy), side = Math.sign(z0 - z1);
    let base = [[x0,y0,z0],[x1,y0,z0],[x1,y1,z1],[x0,y1,z1]];
    facets(base, side === 1 ? [[0,1,2],[0,2,3]] : [[2,1,0],[3,2,0]], '#5b4030', 'timber');
    const rows = Math.ceil(length / tileLength);
    const width = (x1-x0) / Math.ceil((x1-x0) / tileWidth);
    for (let row = 0; row < rows; row++) {
      const p0 = row/rows;
      const p1 = Math.min(1.014, (row+1.26)/rows);
      const stagger = row % 2 ? .5 : 0;
      for (let raw = x0 - stagger*width; raw < x1-.02; raw += width) {
        const left = Math.max(x0,raw)+.004, right = Math.min(x1,raw+width)-.004;
        const p = p0 - rand()*.009, raised = .058 + rand()*.021;
        const corner = Math.min((right-left)*.14,.042);
        const corners = [[left, p+.010, raised], [left+corner, p, raised],
          [right-corner,p+.001,raised],[right,p+.011,raised],[right,p1,.013],[left,p1,.013]];
        const verts = corners.map(([x,f,h]) => [x,y0+f*dy+h,z0+f*dz]);
        verts.push(...verts.map(([x,y,z]) => [x,y-.045,z]));
        const faces = [...topFaces];
        for (let s=0;s<6;s++) { const next=(s+1)%6; faces.push([s,s+6,next+6],[s,next+6,next]); }
        facets(verts, side === 1 ? faces : faces.map(f=>[f[2],f[1],f[0]]), choose(shingles), 'slate');
      }
    }
    box((x0+x1)/2,y0-.045,z0,x1-x0+.04,.14,.13,choose(timber),'timber');
    for (const end of [x0,x1]) beam(v(end,y0-.028,z0),v(end,y1-.035,z1),.13,.13,'#74503b');
  }
  function roof(halfSpan, run, lower, upper, small = false) {
    for (const sign of [-1,1]) roofPlane(-halfSpan,halfSpan,sign*run,0,lower,upper,small?.32:.47,small?.29:.40);
    const pieces = Math.ceil(halfSpan*2 / (small?.40:.52));
    for (let i=0; i<pieces; i++) {
      const a=-halfSpan+i*2*halfSpan/pieces, b=a+2*halfSpan/pieces;
      rod(v(a-.012,upper+.065,0),v(b+.016,upper+.065,0),small?.088:.125,choose(shingles),'slate',8);
    }
  }
  function masonryFace(width, height, courses, palette) {
    const rowH = height/courses;
    for (let row=0;row<courses;row++) {
      const spacing = width/Math.ceil(width/(rowH*2.1));
      for (let cursor=-width/2-(row%2)*spacing*.48;cursor<width/2-.015;cursor+=spacing) {
        const lo=Math.max(-width/2,cursor), hi=Math.min(width/2,cursor+spacing);
        const depth=.038+rand()*.022;
        if (hi-lo>.035) box((lo+hi)/2,(row+.5)*rowH,depth*.45,hi-lo-.017,rowH-.014,depth,choose(palette),'plaster');
      }
    }
  }
  function stoneBase(w,d,h,palette=foundation) {
    box(0,h*.5,0,w,h,d,'#68675d','plaster');
    for (const side of [-1,1]) {
      scope(0,0,side*d/2,side>0?0:Math.PI,()=>masonryFace(w,h,2,palette));
      scope(side*w/2,0,0,side*Math.PI/2,()=>masonryFace(d,h,2,palette));
    }
    box(0,h+.015,0,w+.11,.09,d+.11,'#a69a82','plaster');
  }
  function horizontal(x0,x1,y,z,width=.12,depth=.13,color=choose(timber)) {
    // A roll about the beam's axis keeps the wood grain along its length.
    beam(v(x0,y,z),v(x1,y,z),width,depth,color);
  }
  function flowerPot(x,y,z,size,flora='#78874b') {
    rod(v(x,y,z),v(x,y+size*.74,z),size*.34,'#ab6e4b','plaster',9,size*.48);
    rod(v(x,y+size*.68,z),v(x,y+size*.83,z),size*.5,'#be7b51','plaster',9);
    rod(v(x,y+size*.82,z),v(x,y+size*.84,z),size*.42,'#4e4634','solid',9);
    for (let i=0;i<9;i++) {
      const a=rand()*Math.PI*2,r=size*(.1+rand()*.42);
      const end=v(x+Math.sin(a)*r,y+size*(1.03+rand()*.45),z+Math.cos(a)*r);
      rod(v(x,y+size*.8,z),end,size*.055,flora,'solid',4,size*.014);
      if(i%2===0) {
        const geo=new THREE.IcosahedronGeometry(size*.085,0);
        shape(geo,choose(['#e8cfa0','#d4a888','#c68880']),'solid',end);
        geo.dispose();
      }
    }
  }
  function windowUnit(x, bottom, z, width, height, shutters = false) {
    const cy=bottom+height/2, trim=Math.max(.047,width*.059);
    box(x,cy,z+.013,width+.16,height+.16,.12,'#463a2d','timber');
    box(x,cy,z+.084,width,height,.044,'#f4cf83','glass');
    // Curtains are tied to the woodwork and leave the lit panes visible.
    for (const sign of [-1,1]) {
      const a=x+sign*(width/2-.024), b=x+sign*(width*.36);
      polygon([[a,cy+height/2-.019],[b,cy+height/2-.019],
        [x+sign*width*.44,cy+.02],[x+sign*width*.43,bottom+.015],[a,bottom+.015]],.012,'#dfcba5','plaster',z+.113);
      box(x+sign*width/2,cy,z+.146,trim,height+.12,.11,choose(timber),'timber');
    }
    for(const yy of [bottom,bottom+height]) horizontal(x-width*.55,x+width*.55,yy,z+.145,trim,.12);
    box(x,cy,z+.152,trim*.69,height,.08,'#654630','timber');
    horizontal(x-width/2,x+width/2,cy+.07*height,z+.153,trim*.65,.08,'#654630');
    horizontal(x-width*.64,x+width*.64,bottom-.075,z+.16,.105,.36,'#9e8058');
    if(shutters) for(const sign of [-1,1]) {
      const sw=width*.25, mid=x+sign*(width/2+sw*.55+.06);
      for(let j=0;j<3;j++) box(mid+(j-1)*sw/3,cy,z+.11,sw/3-.008,height+.04,.085,choose(['#60715e','#69765f','#5c6a55']),'timber');
      for(const yy of [cy-height*.32,cy+height*.32]) horizontal(mid-sw*.50,mid+sw*.5,yy,z+.16,.053,.065,'#685b43');
    }
  }
  const lighting = [];
  const glows = [];
  let worldRatio = 1, dimmer = 1;
  function point(x,y,z,power,reach) {
    const light = new THREE.PointLight(0xffb257,power,reach,2);
    light.position.set(x,y,z).applyMatrix4(frame);
    group.add(light);
    lighting.push({light,power,reach});
  }
  function softMap(smoke) {
    const canvas=document.createElement('canvas');
    canvas.width=canvas.height=64;
    const ctx=canvas.getContext('2d');
    const gradient=ctx.createRadialGradient(32,32,1,32,32,31);
    gradient.addColorStop(0,smoke?'rgba(255,255,255,.82)':'rgba(255,240,200,.85)');
    gradient.addColorStop(.36,smoke?'rgba(255,255,255,.50)':'rgba(255,204,97,.30)');
    gradient.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=gradient; ctx.fillRect(0,0,64,64);
    return new THREE.CanvasTexture(canvas);
  }
  const haloMap=softMap(false);
  function glow(x,y,z,scale,power) {
    const mat=new THREE.SpriteMaterial({map:haloMap,color:0xffb875,transparent:true,opacity:power,
      depthWrite:false,blending:THREE.AdditiveBlending});
    const s=new THREE.Sprite(mat);
    s.position.set(x,y,z).applyMatrix4(frame);
    s.scale.setScalar(scale); group.add(s);
    glows.push({s,power});
  }

  // The central block and its right and left gabled ends.
  stoneBase(6.55,4.42,.49);
  box(0,1.83,0,6.47,2.68,4.34,'#e3d3b1','plaster');
  // Infill reaches the underside of the pitch at the wall line, inside the
  // projecting eaves. This closes the attic even when seen from below.
  scope(-3.23,0,0,Math.PI/2,()=>polygon([[-2.17,3.12],[2.17,3.12],
    [2.17,3.53],[0,5.75],[-2.17,3.53]],6.46,'#dfcfaf','plaster'));
  for (const direction of [-1,1]) {
    scope(direction*3.235,0,0,direction*Math.PI/2,()=>{
      polygon([[-2.17,3.11],[2.17,3.11],[2.17,3.53],[0,5.75],[-2.17,3.53]],.05,'#deccaa','plaster');
      for(const x of [-2.13,-1.17,1.17,2.13]) box(x,1.84,.055,.145,2.65,.15,choose(timber),'timber');
      for(const y of [.57,2.83,3.15]) horizontal(-2.17,2.17,y,.075,.14,.15);
      for(const sign of [-1,1]) {
        beam(v(sign*2.16,3.53,.095),v(0,5.75,.095),.14,.17);
        beam(v(sign*2.09,.62,.077),v(sign*1.21,1.54,.077),.1,.13);
        beam(v(sign*.13,3.22,.085),v(sign*1.08,4.14,.085),.11,.13);
        box(sign*1.0,3.67,.08,.105,1.04,.13,choose(timber),'timber');
      }
      box(0,4.46,.076,.145,2.58,.17,choose(timber),'timber');
      windowUnit(0,1.05,.09,1.14,1.18,true);
      if(direction===1) {
        for(let i=0;i<3;i++) {
          const x=(i-1)*.33;
          box(x,1.89,.292,.018,.23,.022,'#b9925b','iron');
        }
      }
    });
  }
  for(const direction of [-1,1]) scope(0,0,direction*2.175,direction>0?0:Math.PI,()=>{
    for(const x of [-3.18,-.47,1.12,3.18]) box(x,1.85,.052,.17,2.66,.16,choose(timber),'timber');
    for(const y of [.58,2.86,3.15]) horizontal(-3.23,3.23,y,.062,.14,.16);
    if(direction<0) {
      windowUnit(-1.90,1.18,.07,1.12,1.09,true);
      windowUnit(1.95,1.16,.07,.99,1.14,true);
      beam(v(-.37,.63,.08),v(.99,2.77,.08),.115,.13);
    }
  });
  roof(3.61,2.56,3.13,5.75);
  for(const side of [-1,1]) {
    for(let i=0;i<16;i++) {
      const x=-3.46+i*.46;
      beam(v(x,3.32,side*2.12),v(x,3.02,side*2.58),.095,.11,'#684631');
    }
    rod(v(-3.60,3.09,side*2.63),v(3.60,3.09,side*2.63),.055,'#626458','iron',8);
    const px=side>0?3.13:-3.13;
    rod(v(px,3.08,side*2.63),v(px,2.92,side*2.34),.053,'#606155','iron');
    rod(v(px,2.92,side*2.34),v(px,.38,side*2.34),.053,'#606155','iron');
  }

  // The front cross-gable projects in front of the main roof plane.
  scope(-1.68,0,2.25,0,()=>{
    stoneBase(2.68,.93,.49);
    box(0,1.83,0,2.6,2.68,.9,'#e8d9bf','plaster');
    polygon([[-1.30,3.11],[1.30,3.11],[1.30,3.40],[0,5.05],[-1.30,3.40]],.90,'#e4d4b7','plaster',-.45);
    const z=.485;
    for(const x of [-1.25,1.25]) box(x,1.83,z,.155,2.63,.14,choose(timber),'timber');
    for(const yy of [.6,2.73,3.14]) horizontal(-1.29,1.29,yy,z,.13,.15);
    for(const sign of [-1,1]) {
      beam(v(sign*1.28,3.42,z+.02),v(0,5.05,z+.02),.15,.16);
      beam(v(sign*1.17,.65,z),v(sign*.57,1.06,z),.087,.125);
      beam(v(sign*1.16,3.2,z),v(sign*.47,4.11,z),.084,.12);
      box(sign*.52,3.63,z,.09,.95,.13,choose(timber),'timber');
    }
    box(0,4.09,z,.135,1.92,.15,choose(timber),'timber');
    windowUnit(0,1.18,z+.06,1.38,1.22,true);
    // The flower box is mounted to the bay, well clear of all porch posts.
    box(0,.995,z+.25,1.52,.26,.34,'#846141','timber');
    for(const yy of [.916,1.089]) horizontal(-.79,.79,yy,z+.435,.057,.05,'#9e7851');
    for(let i=0;i<18;i++) {
      const x=-.68+i*.08, height=1.18+rand()*.14;
      rod(v(x,1.09,z+.24),v(x+(rand()-.5)*.16,height,z+.20+rand()*.14),.029,
        choose(['#667948','#7e884d','#586c43']),'solid',4,.006);
      if(i%2===0) {
        const geo=new THREE.IcosahedronGeometry(.047,0);
        shape(geo,choose(['#d4a18e','#e8c994','#bd7a76']),'solid',v(x,height,z+.28));
        geo.dispose();
      }
    }
  });
  scope(-1.68,0,1.83,Math.PI/2,()=>roof(1.16,1.53,3.10,5.05));

  // A second, smaller roof window fits into the right hand roof pitch.
  scope(1.41,0,1.55,0,()=>{
    box(0,4.06,-.08,1.28,.89,.88,'#decca7','plaster');
    polygon([[-.64,4.48],[.64,4.48],[.64,4.605],[0,5.31],[-.64,4.605]],.76,'#e4d2b0','plaster',-.40);
    windowUnit(0,3.795,.382,.76,.65);
    for(const sign of [-1,1]) {
      box(sign*.59,4.105,.394,.10,.78,.12,choose(timber),'timber');
      beam(v(sign*.62,4.62,.405),v(0,5.31,.405),.085,.12);
    }
    horizontal(-.63,.63,4.49,.41,.1,.14);
    box(0,4.90,.41,.075,.80,.12,'#6e4c34','timber');
    scope(0,0,-.3,Math.PI/2,()=>roof(.86,.79,4.44,5.31,true));
    glow(0,4.15,.54,.85,.14);
  });

  // Stone chimney bonded into the rear pitch with a terracotta double cap.
  const chimney = v(-2.37,0,-.56);
  scope(chimney.x,0,chimney.z,0,()=>{
    box(0,5.69,0,.72,2.24,.70,'#756957','plaster');
    for(const side of [-1,1]) {
      scope(0,4.57,side*.35,side===1?0:Math.PI,()=>masonryFace(.72,2.21,10,brick));
      scope(side*.36,4.57,0,side*Math.PI/2,()=>masonryFace(.70,2.21,10,brick));
    }
    box(0,6.81,0,.89,.16,.86,'#846c58','plaster');
    box(0,6.94,0,.81,.13,.79,'#a08669','plaster');
    for(const x of [-.19,.19]) {
      rod(v(x,6.98,0),v(x,7.2,0),.13,'#946949','slate',10,.147);
      rod(v(x,7.16,0),v(x,7.23,0),.162,'#a27654','slate',10);
      rod(v(x,7.225,0),v(x,7.232,0),.119,'#50463a','solid',10);
    }
  });

  // Porch, its paving, stairs and post-to-post railways.
  scope(1.50,0,2.71,0,()=>{
    const left=-1.48,right=1.54;
    box(.03,.195,.01,3.25,.39,1.21,'#797569','plaster');
    const floor=.448;
    for(let i=0;i<14;i++) box(-1.49+i*.235,floor-.042,.012,.228,.084,1.28,choose(pine),'timber');
    for(const x of [left,right]) {
      box(x,.545,.50,.225,.20,.225,'#a39982','plaster');
      box(x,1.48,.50,.159,1.71,.159,choose(timber),'timber');
      beam(v(x,1.90,.50),v(x+(x<0?.31:-.31),2.25,.50),.087,.09);
      beam(v(x,2.78,-.55),v(x,2.30,.50),.135,.135);
      beam(v(x,1.95,.50),v(x,2.46,.15),.086,.09);
    }
    horizontal(left,right,2.78,-.55,.14,.15);
    horizontal(left-.11,right+.11,2.31,.50,.147,.16);
    roofPlane(left-.22,right+.22,.741,-.64,2.32,2.91,.36,.31);
    for(let i=0;i<8;i++){
      const x=left-.10+i*.47;
      beam(v(x,2.85,-.56),v(x,2.25,.72),.074,.09);
    }
    // The break on the left aligns precisely to the door and stairs.
    const railStart=.12;
    box(railStart,.907,.50,.12,.92,.12,choose(timber),'timber');
    for(const yy of [.71,1.29]) {
      horizontal(railStart,right,yy,.50,.082,.094);
      beam(v(right,yy,-.47),v(right,yy,.50),.082,.09);
    }
    box(right,.902,-.47,.12,.91,.12,choose(timber),'timber');
    for(let i=1;i<5;i++) box(railStart+(right-railStart)*i/5,.95,.50,.049,.55,.05,choose(pine),'timber');
    for(const z of [-.21,.10]) box(right,.96,z,.05,.55,.05,choose(pine),'timber');
    for(let i=0;i<3;i++) {
      const h=(3-i)*.11;
      box(-.70,h/2,.79+i*.24,1.28,h,.255,choose(foundation),'plaster');
    }
  });
  // Arched oak door and a side window under the porch.
  const doorX=.76, doorZ=2.263;
  scope(doorX,.45,doorZ,0,()=>{
    polygon([[-.49,0],[.49,0],[.49,1.47],[.38,1.69],[.14,1.84],[-.13,1.84],[-.38,1.69],[-.49,1.47]],.10,'#503c2b','timber');
    polygon([[-.395,0],[.395,0],[.395,1.44],[.31,1.60],[.12,1.73],[-.12,1.73],[-.31,1.60],[-.395,1.44]],.033,'#8c6c46','timber',.105);
    for(let i=1;i<=4;i++) {
      const x=-.395+i*.158;
      box(x,.69,.141,.012,1.37,.008,'#6a5037');
    }
    windowUnit(0,1.05,.134,.39,.39);
    for(const yy of [.3,.87]) horizontal(-.365,-.103,yy,.157,.043,.033,'#514d3b');
    rod(v(.27,.72,.139),v(.27,.72,.22),.048,'#bb9959','iron',10);
  });
  windowUnit(2.29,1.10,2.251,.87,1.0);
  // Brass lantern hangs from the porch lintel beside the door.
  scope(1.52,1.92,2.50,0,()=>{
    beam(v(0,.18,-.28),v(0,.18,0),.042,.051,'#4c4b39','iron');
    rod(v(0,.078,0),v(0,.18,0),.016,'#514e3c','iron');
    rod(v(0,-.29,0),v(0,.002,0),.114,'#ffca78','flame',4,.10);
    rod(v(0,.005,0),v(0,.10,0),.157,'#524d3c','iron',4,.047);
    rod(v(0,-.32,0),v(0,-.28,0),.129,'#59513c','iron',4);
    for(let i=0;i<4;i++) {
      const a=i*Math.PI/2;
      rod(v(Math.sin(a)*.114,-.29,Math.cos(a)*.114),v(Math.sin(a)*.10,.002,Math.cos(a)*.10),.009,'#56503b','iron',4);
    }
    glow(0,-.15,.04,.84,.45);
  });
  point(1.47,1.82,2.84,7.5,4.1);
  point(-1.68,1.92,2.38,4.7,3.2);
  glow(-1.68,1.87,3.00,1.52,.13);
  flowerPot(-.25,0,3.61,.35,'#748353');
  flowerPot(2.88,.45,2.79,.31,'#5e774f');

  // Water butt at the downspout. Separate staves and four forged hoops.
  scope(3.55,0,1.61,0,()=>{
    const radii=[.285,.337,.36,.337,.285], heights=[0,.17,.43,.68,.84];
    for(let i=0;i<14;i++){
      const a=(i+.018)*Math.PI*2/14,b=(i+.982)*Math.PI*2/14;
      const verts=[];
      for(let k=0;k<radii.length;k++) for(const theta of [a,b]) verts.push([Math.sin(theta)*radii[k],heights[k],Math.cos(theta)*radii[k]]);
      const faces=[];
      for(let k=0;k<4;k++) faces.push([k*2,k*2+1,k*2+3],[k*2,k*2+3,k*2+2]);
      facets(verts,faces,choose(pine),'timber');
    }
    for(const [yy,rr] of [[.10,.327],[.3,.357],[.60,.351],[.76,.325]]) rod(v(0,yy,0),v(0,yy+.037,0),rr,'#545750','iron',14);
    rod(v(0,.824,0),v(0,.843,0),.283,'#795f42','timber',14);
  });
  // Firewood is protected by the eave, with the cut ends facing the right yard.
  for(let tier=0;tier<3;tier++) for(let n=0;n<6-tier;n++) {
    const z=-1.72+(n+tier*.5)*.237, y=.13+tier*.196;
    const x=3.97+rand()*.075;
    rod(v(3.28,y,z),v(x,y,z),.128,choose(timber),'timber',8,.121);
    rod(v(x,y,z),v(x+.006,y,z),.108,choose(['#b39464','#a88b5e','#be9c70']),'timber',8);
    if(n%2===0) rod(v(x+.007,y,z),v(x+.008,y,z),.053,'#9b7b50','timber',7);
  }
  scope(3.54,0,.72,.24,()=>{
    rod(v(0,.025,0),v(0,.318,0),.116,'#7a8d81','iron',10,.153);
    rod(v(0,.311,0),v(0,.326,0),.156,'#94a397','iron',10);
    rod(v(-.10,.105,0),v(-.325,.34,0),.048,'#82948a','iron',8,.035);
    rod(v(-.325,.34,0),v(-.355,.372,0),.052,'#97a69a','iron',8,.061);
    const path=[v(.11,.085,0),v(.224,.12,0),v(.24,.245,0),v(.152,.291,0)];
    for(let i=1;i<path.length;i++) rod(path[i-1],path[i],.017,'#71867b','iron',6);
  });

  for(const [key,geos] of batches) {
    const merged=mergeGeometries(geos);
    const mesh=new THREE.Mesh(merged,materials[key]);
    mesh.name='Cottage '+key;
    mesh.castShadow=key!=='glass' && key!=='flame';
    mesh.receiveShadow=true;
    group.add(mesh);
    for(const geo of geos) geo.dispose();
  }
  boxGeo.dispose();
  const smokeMap=softMap(true);
  const smoke=[];
  for(let i=0;i<7;i++){
    const mat=new THREE.SpriteMaterial({map:smokeMap,color:0xc1bdb0,transparent:true,depthWrite:false,opacity:0,rotation:rand()*Math.PI});
    const sprite=new THREE.Sprite(mat); group.add(sprite); smoke.push(sprite);
  }
  const refScale=v(1,1,1);
  const unlit=new THREE.Color('#56635c'), lit=new THREE.Color('#fff0ca');
  const wickOff=new THREE.Color('#645a48'), wickOn=new THREE.Color('#fff1b4');
  function adjustLights() {
    for(const {light,power,reach} of lighting) {
      light.intensity=power*dimmer*worldRatio*worldRatio;
      light.distance=reach*worldRatio;
    }
  }
  function setLight(value) {
    dimmer=THREE.MathUtils.clamp(value,0,1);
    materials.glass.color.copy(shade.copy(unlit).lerp(lit,dimmer));
    materials.glass.emissiveIntensity=dimmer*.83;
    materials.flame.color.copy(shade.copy(wickOff).lerp(wickOn,dimmer));
    materials.flame.emissiveIntensity=dimmer*1.55;
    for(const {s,power} of glows) s.material.opacity=power*dimmer;
    adjustLights();
  }
  function update(time) {
    group.getWorldScale(refScale);
    const scale=Math.max(refScale.x,refScale.y,refScale.z);
    if(Math.abs(scale-worldRatio)>.001) { worldRatio=scale; adjustLights(); }
    for(let i=0;i<smoke.length;i++){
      const p=(time*.115+i/smoke.length)%1;
      const sprite=smoke[i], size=.24+p*.83;
      sprite.position.set(chimney.x-.19-p*.72+Math.sin(7*p+time*.31)*p*.19,7.26+p*2.40,chimney.z+p*.31);
      sprite.scale.set(size,size*(1.17+p*.17),1);
      sprite.material.opacity=Math.sin(Math.PI*p)*.19;
    }
  }
  setLight(1);
  update(0);
  return {group,setLight,update};
}
