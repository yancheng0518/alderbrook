import * as THREE from 'three';

const TAU = Math.PI * 2;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const mix = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const creekZ = x => 6.65 + 1.05 * Math.sin(x * .17) + .46 * Math.sin(x * .37 + .35);
const creekHalf = x => 1.73 + .18 * Math.sin(x * .36) + .19 * Math.cos(x * .18);
const riverDistance = (x, z) => Math.abs(z - creekZ(x)) - creekHalf(x);
const crest = (x, z) => Math.sin(.088 * x + .017 * z) * .35 + Math.sin(.17 * z + .089 * x) * .22
  + Math.sin(.23 * x - .13 * z) * .12;

function landHeight(x, z) {
  const r = Math.hypot(x, z);
  const bank = riverDistance(x, z);
  const rolling = (.8 + crest(x, z) * 2) * smooth(10, 25, r);
  const hills = smooth(26, 69, r) * (4.3 + 3.5 * Math.sin(x * .058 + z * .061)
    + 1.9 * Math.cos(z * .102 - x * .035));
  const field = (.19 + crest(x, z) * .75) * smooth(5.5, 13, Math.hypot(x / 1.15, z / .92));
  // Both buildings sit on the same level clearing. The channel stays continuous through the hills.
  return (rolling + hills + field) * smooth(.05, 6.8, bank) - .72 * (1 - smooth(-.46, .56, bank));
}

function randomSource(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const rgbCache = new Map();
function rgb(hex) {
  if (!rgbCache.has(hex)) rgbCache.set(hex, new THREE.Color(hex).toArray());
  return rgbCache.get(hex);
}
function tint(c, k) {return [c[0] * k, c[1] * k, c[2] * k];}
function blend(a, b, k) {return [mix(a[0], b[0], k), mix(a[1], b[1], k), mix(a[2], b[2], k)];}
const point = (x, y, z) => [x, y, z];
function normalize(v) {
  const n = Math.hypot(...v) || 1;
  return v.map(c => c / n);
}
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];

class Paint {
  constructor(softNormals = false) { this.p = []; this.c = []; this.n = softNormals ? [] : null; this.uv = softNormals ? [] : null; }
  tri(a, b, c, ca, cb = ca, cc = ca, na, nb = na, nc = na, uv0, uv1, uv2) {
    this.p.push(...a, ...b, ...c);
    this.c.push(...ca, ...cb, ...cc);
    if (this.n) {
      const norm = na || normalize(cross(b.map((v,i)=>v-a[i]), c.map((v,i)=>v-a[i])));
      this.n.push(...norm, ...(nb || norm), ...(nc || norm));
      this.uv.push(...(uv0 || [.018,.035]), ...(uv1 || [.018,.035]), ...(uv2 || [.018,.035]));
    }
  }
  quad(a, b, c, d, color, end = color) {
    this.tri(a, b, d, color, color, end);
    this.tri(b, c, d, color, end, end);
  }
  // Two radius rings perpendicular to an arbitrary branch, rail or stem.
  stick(a, b, r0, r1, color, sides = 7, cap = true) {
    const dir = normalize(b.map((v, i) => v - a[i]));
    const e = normalize(cross(dir, Math.abs(dir[1]) < .9 ? [0, 1, 0] : [1, 0, 0]));
    const f = cross(dir, e);
    const lower = [], upper = [];
    for (let i = 0; i < sides; i++) {
      const th = i / sides * TAU + .19;
      const v = e.map((n, k) => n * Math.cos(th) + f[k] * Math.sin(th));
      lower.push(a.map((n, k) => n + r0 * v[k]));
      upper.push(b.map((n, k) => n + r1 * v[k]));
    }
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      this.quad(lower[i], lower[j], upper[j], upper[i], tint(color, .89 + .11 * Math.sin(i * 2.4)));
      if (cap) this.tri(upper[i], upper[j], b, color);
    }
  }
  mesh(group, name, material, cast = true) {
    if (!this.p.length) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    if (this.n) {
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    }
    else geo.computeVertexNormals();
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, material);
    m.name = name;
    m.castShadow = cast;
    m.receiveShadow = true;
    group.add(m);
    this.p.length = this.c.length = 0;
    if (this.n) this.n.length = this.uv.length = 0;
    return m;
  }
}

function oval(p, x, y, z, rx, ry, rz, c, random, n = 8, twist = 0) {
  const bottom = point(x, y - ry * .69, z), top = point(x + rx * .1, y + ry, z);
  const waist = [], shoulder = [];
  for (let i = 0; i < n; i++) {
    const angle = twist + i * TAU / n;
    const extent = .86 + random() * .2;
    waist.push(point(x + Math.cos(angle) * rx * extent, y + ry * (random() * .20 - .17), z + Math.sin(angle) * rz * extent));
    shoulder.push(point(x + Math.cos(angle + .13) * rx * extent * .73, y + ry * (.49 + random() * .18), z + Math.sin(angle + .13) * rz * extent * .73));
  }
  for (let i = 0; i < n; i++) {
    const j = (i+1)%n;
    const v = tint(c, .89 + random() * .19);
    p.tri(bottom, waist[i], waist[j], tint(v, .7));
    p.quad(waist[j], waist[i], shoulder[i], shoulder[j], v, tint(v, 1.04));
    p.tri(shoulder[j], shoulder[i], top, tint(v, 1.07));
  }
}

function makeSoil(group, random, material) {
  // Cross sections follow the bends, preserving the shoreline even in the distant mesh.
  const xs = [], zs = [];
  for (let x = -122; x <= 122; x += Math.abs(x) > 33 ? 2.6 : .75) xs.push(x);
  for (let v = -124; v <= 118; v += Math.abs(v) > 28 ? 2.6 : Math.abs(v) > 5 ? .72 : .25) zs.push(v);
  const pos = [], colors = [], idx = [];
  const meadow = rgb('#849452'), shade = rgb('#516e4b'), bank = rgb('#b6a587'), dirt = rgb('#918b72');
  for (let i = 0; i < xs.length; i++) {
    for (let j = 0; j < zs.length; j++) {
      const jitter = (random() - .5) * .12;
      const x = xs[i] + jitter, z = zs[j] + creekZ(x);
      const d = riverDistance(x, z), y = landHeight(x, z);
      const patch = smooth(-1, 1, Math.sin(x * .91 + z * .76) * .32 + Math.sin(z * .39 - x * .49) * .33 + Math.cos(x * .39 + z * .28) * .38);
      const forest = smooth(8, 20, Math.hypot(x, z)) * .63;
      const lawn = blend(meadow, shade, clamp(patch * .7 + forest, 0, 1));
      const color = blend(blend(dirt, bank, smooth(-1.1, .28, d)), lawn, smooth(.12, 1.05 + .19 * Math.sin(x * 3.4), d));
      colors.push(...tint(color, .97 + random() * .06));
      pos.push(x, y, z);
      if (i && j) {
        const a = i * zs.length + j, b = a - zs.length;
        if ((i + j) % 2) idx.push(a, a-1, b, a-1, b-1, b);
        else idx.push(a, a-1, b-1, a, b-1, b);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, material);
  mesh.name = '溪谷草地与河床';
  mesh.receiveShadow = true;
  group.add(mesh);
}

const pathSegments = [];
function addTrail(p, random, points, width) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x,z]) => new THREE.Vector3(x,0,z)));
  const sections = Math.ceil(curve.getLength() / .28);
  let last;
  for (let i = 0; i <= sections; i++) {
    const t = i / sections;
    const center = curve.getPointAt(t), dir = curve.getTangentAt(t);
    const half = width * (.95 + .1 * Math.sin(t * 7)) / 2;
    const rim = half + random() * .09;
    const edge = offset => {
      const x = center.x + dir.z * offset, z = center.z - dir.x * offset;
      return point(x, landHeight(x,z) + .032, z);
    };
    const row = [-rim, -half*.76, half*.76, rim].map(edge);
    if (last) {
      for (let s = 0; s < 3; s++) {
        const v = tint(rgb(s === 1 ? '#b69a70' : '#9e8c61'), .96 + random() * .075);
        p.quad(last.row[s], row[s], row[s+1], last.row[s+1], v);
      }
      pathSegments.push([last.x, last.z, center.x, center.z, half + .1]);
    }
    last = {row, x: center.x, z: center.z};
  }
}

function onTrail(x, z, extra = 0) {
  for (const [x1,z1,x2,z2,r] of pathSegments) {
    if (Math.abs(x1-x) > r+.5+extra || Math.abs(z1-z) > r+.5+extra) continue;
    const dx = x2-x1, dz = z2-z1;
    const t = clamp(((x-x1)*dx+(z-z1)*dz)/(dx*dx+dz*dz || 1),0,1);
    if (Math.hypot(x-x1-dx*t,z-z1-dz*t) < r+extra) return true;
  }
  return false;
}

function makeCreek(group, random) {
  const p = [], uv = [], indices = [], rows = 5;
  for (let i = 0; i <= 340; i++) {
    const x = -123 + i * .72;
    const middle = creekZ(x), h = creekHalf(x);
    // Extend just into the sloping banks, avoiding a seam at changing water levels.
    for (let j = 0; j <= rows; j++) {
      const v = j / rows * 2 - 1;
      p.push(x, -.375, middle + v * (h + .13));
      uv.push(x, v);
      if (i && j) {
        const a = i * (rows+1) + j, b = a-(rows+1);
        indices.push(a,a-1,b-1,a,b-1,b);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(p,3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const unis = {
    uTime:{value:0}, deep:{value:new THREE.Color('#3b8385')}, shallow:{value:new THREE.Color('#a7b49a')},
    skyTint:{value:new THREE.Color('#b7cdad')}, glint:{value:new THREE.Color('#dce1b9')},
  };
  // Modify the albedo only: the water still inherits shadows, fog and time-of-day illumination.
  const waterMaterial = new THREE.MeshLambertMaterial();
  waterMaterial.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, unis);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      varying vec2 vUvWater; varying vec3 vWorld;`).replace('#include <begin_vertex>', `#include <begin_vertex>
      vUvWater=uv; vWorld=(modelMatrix*vec4(position,1.)).xyz;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      uniform float uTime; uniform vec3 deep,shallow,skyTint,glint;
      varying vec2 vUvWater; varying vec3 vWorld;`).replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec2 p=vWorld.xz;
        float bend=sin(p.x*1.15 + p.y*.81 + uTime*.21)*.6 + sin(p.x*.4-uTime*.16)*.5;
        float wave=sin(p.y*16.+p.x*1.9+bend*2.-uTime*.9);
        float secondary=sin(p.x*3.2+p.y*2.3+uTime*.29);
        float edge=smoothstep(.42,1.,abs(vUvWater.y));
        float pebble=fract(sin(dot(floor(p*22.),vec2(42.31,17.87)))*4371.23);
        vec3 c=mix(deep,shallow,edge*.93+.033*(wave+1.));
        c *= 1.+edge*edge*(pebble-.5)*.12;
        vec3 eye=normalize(cameraPosition-vWorld);
        c=mix(c,skyTint,pow(1.-abs(eye.y),3.)*.35);
        float stripe=smoothstep(.89,.993,wave)*smoothstep(.15,.94,secondary)*(.34+.35*edge);
        c=mix(c,glint,stripe*.52);
        diffuseColor.rgb = c;
      }`);
  };
  const creek = new THREE.Mesh(geo,waterMaterial);
  creek.name='林间流动的溪水';
  creek.receiveShadow=true;
  group.add(creek);
  return t => {unis.uTime.value=t;};
}

const treeColors = ['#3e6353','#456855','#50766b','#476d62','#57775f','#5a795a','#42665a'];
const leafColors = ['#83974e','#8c9f61','#a5a05a','#7d975a','#9caa64','#6c8e65','#aca25c'];
const crownShapes = [0, 1].map(level => {
  const shape = new THREE.IcosahedronGeometry(1,level);
  const positions = shape.attributes.position.array.slice();
  shape.dispose();
  return positions;
});

// Crownlets use softly rounded normals but retain small facets in the clumped leaf masses.
function crownlet(p,x,y,z,rx,ry,rz,c,phase,detail) {
  const shape = crownShapes[detail], cs = Math.cos(phase), sn = Math.sin(phase);
  const vertices=[], normals=[], colors=[], uvs=[];
  for(let i=0;i<shape.length;i+=3) {
    const nx=shape[i]*cs-shape[i+2]*sn, ny=shape[i+1], nz=shape[i]*sn+shape[i+2]*cs;
    const grain=Math.sin(nx*7.9+ny*3.8+phase)*Math.cos(nz*5.7-ny*4.2+phase);
    const scale=1.+grain*.092;
    vertices.push([x+nx*rx*scale,y+ny*ry*scale,z+nz*rz*scale]);
    normals.push(normalize([nx/rx,ny/ry,nz/rz]));
    colors.push(tint(c,.93+ny*.095+grain*.05));
    uvs.push([.75+.19*Math.sin(phase+nx*1.64+nz*.85),.5+.42*Math.sin(ny*1.68+nz*.35)]);
    if(vertices.length===3){
      const [a,b,d]=vertices;
      const face=normalize(cross(b.map((v,j)=>v-a[j]),d.map((v,j)=>v-a[j])));
      const n=normals.map(nr=>normalize(blend(nr,face,.20)));
      p.tri(a,b,d,...colors,...n,...uvs);
      vertices.length=normals.length=colors.length=uvs.length=0;
    }
  }
}

function firSprigTexture() {
  const size=160, pixels=new Uint8Array(size*size*4), random=randomSource(7281);
  function stroke(x1,y1,x2,y2,r1,r2,light) {
    const dx=x2-x1,dy=y2-y1,len2=dx*dx+dy*dy||1,pad=Math.max(r1,r2)+1;
    const x0=Math.max(0,Math.floor(Math.min(x1,x2)-pad)),xMax=Math.min(size-1,Math.ceil(Math.max(x1,x2)+pad));
    const y0=Math.max(0,Math.floor(Math.min(y1,y2)-pad)),yMax=Math.min(size-1,Math.ceil(Math.max(y1,y2)+pad));
    for(let y=y0;y<=yMax;y++)for(let x=x0;x<=xMax;x++){
      const t=clamp(((x-x1)*dx+(y-y1)*dy)/len2,0,1),d=Math.hypot(x-x1-t*dx,y-y1-t*dy);
      const a=clamp(mix(r1,r2,t)+.65-d,0,1);
      if(a<=0)continue;
      const idx=(y*size+x)*4, s=Math.round(light+t*9);
      pixels[idx]=s;pixels[idx+1]=Math.min(255,s+3);pixels[idx+2]=s;pixels[idx+3]=Math.max(pixels[idx+3],Math.round(a*255));
    }
  }
  // A painted stem branches twice into overlapping needle sprays. Its silhouette survives mipmapping.
  stroke(80,4,82,151,4.1,.9,205);
  for(let j=0;j<17;j++)for(const side of [-1,1]){
    const t=j/17,sy=6+t*131,reach=(17+49*Math.sin(Math.PI*(.1+.91*t)))*(.89+random()*.12)*(1-.27*t);
    const endY=sy+23*(1-t)+10;
    const x1=80+Math.sin(t*5)*1.5,x2=x1+side*reach;
    stroke(x1,sy,x2,endY,6.2*(1-t*.54),.7,219+random()*17);
    for(let k=0;k<13;k++){
      const f=k/13,xx=mix(x1,x2,f),yy=mix(sy,endY,f);
      const leaf=(1-f*.63)*(1-t*.52);
      for(const lateral of [-1,1]){
        const endX=xx+side*(6+random()*4)*leaf;
        const tipY=yy+lateral*(6+random()*5)*leaf+4*leaf;
        stroke(xx,yy,endX,tipY,(2.3+random()*1.3)*leaf+.3,.37,210+random()*35);
      }
    }
  }
  // A solid swatch lets tree trunks and round-leaf canopies share the same draw batch.
  for(let y=0;y<13;y++)for(let x=0;x<13;x++)pixels.fill(255,(y*size+x)*4,(y*size+x)*4+4);
  // The other tile holds dappled leaves. It adds smaller-scale structure across the larger crowns.
  const atlas=new Uint8Array(size*size*8);
  for(let y=0;y<size;y++) {
    atlas.set(pixels.subarray(y*size*4,(y+1)*size*4),y*size*8);
    for(let x=0;x<size;x++) {
      const i=((y*size*2)+size+x)*4;
      const val=223+Math.sin(x*.14+y*.085)*6+Math.cos(x*.095-y*.15)*6;
      atlas[i]=val;atlas[i+1]=val+2;atlas[i+2]=val;atlas[i+3]=255;
    }
  }
  for(let k=0;k<1380;k++){
    const cx=random()*size,cy=random()*size,a=random()*TAU,cs=Math.cos(a),sn=Math.sin(a);
    const long=1.8+random()*3.8,short=.7+random()*1.6,tone=208+random()*44;
    for(let y=Math.max(0,Math.floor(cy-long));y<Math.min(size,cy+long);y++)for(let x=Math.max(0,Math.floor(cx-long));x<Math.min(size,cx+long);x++) {
      const dx=x-cx,dy=y-cy,along=dx*cs+dy*sn,across=-dx*sn+dy*cs;
      if(Math.abs(along/long)+Math.abs(across/short)>1)continue;
      const i=(y*size*2+size+x)*4, value=Math.min(254,tone+(across>0?6:0));
      atlas[i]=value;atlas[i+1]=value;atlas[i+2]=value-3;
    }
  }
  const map=new THREE.DataTexture(atlas,size*2,size);
  map.colorSpace=THREE.SRGBColorSpace; map.magFilter=THREE.LinearFilter; map.minFilter=THREE.LinearMipmapLinearFilter;
  map.generateMipmaps=true; map.needsUpdate=true;
  return map;
}

function spruce(p, random, x, y, z, h, radius, color, far) {
  const lean=(random()-.5)*h*.082, bark=rgb(random()>.44?'#806b51':'#78634e');
  const floor=.13+random()*.16, layers=far?6:10, phase=random()*TAU;
  const skyline=Math.hypot(x,z)>38;
  p.stick([x,y-.1,z],[x+lean,y+h*.98,z+.045],h*.025,h*.004,bark,far?5:7,false);
  for(let k=0;k<layers;k++){
    const t=k/layers, base=floor+(1-floor)*t;
    const cx=x+lean*base,cz=z+.04*Math.sin(phase+k),y0=y+h*base;
    const radial=radius*Math.pow(1-t,.80)*(.89+random()*.14);
    const cap=k===layers-1, rise=cap?h*(1-base):h*(.12+.055*(1-t));
    const n=far?6:8, turn=phase+k*2.39,outline=[];
    for(let j=0;j<n;j++){
      const a=turn+(j+random()*.29)/n*TAU,u=Math.cos(a),v=Math.sin(a);
      const radiusHere=radial*(.85+random()*.26),wide=radiusHere*(far?.70:.62);
      const drop=rise*(.93+random()*.19),shift=rise*(random()-.5)*.33;
      const right=[-v,0,u], body=tint(blend(color,rgb('#a2b696'),.06+.13*t),.95+random()*.17);
      const tipColor=tint(body,1.14), innerColor=tint(body,.88);
      const at=(length,width,level)=>[cx+u*length+right[0]*width,level,cz+v*length+right[2]*width];
      const root=y0+rise+shift,mid=root-drop*.70,tip=root-drop*.93;
      // On the horizon individual needles become subpixel noise. The same whorls
      // form a contiguous, opaque silhouette with a slightly scalloped edge.
      if(skyline){
        outline.push(at(radiusHere*.97,0,tip),at(radiusHere*.74,radiusHere*.32,tip+rise*.085));
        continue;
      }
      const pair=(length,half,level)=>[at(length,-half,level),at(length,half,level)];
      const rows=[pair(.012*radiusHere,wide*.62,root),pair(.53*radiusHere,wide,mid),pair(radiusHere*1.08,wide*.80,tip)];
      const n0=normalize([u*.64,1,v*.64]), nM=normalize([u*.47,1,v*.47]), nT=normalize([u*.24,1,v*.24]);
      const norms=[n0,nM,nT],colors=[innerColor,body,tipColor],uvs=[.095,.53,.99];
      for(let s=0;s<2;s++){
        const [l,r]=rows[s],[l2,r2]=rows[s+1],a=norms[s],b=norms[s+1],c=colors[s],d=colors[s+1];
        p.tri(l,r,l2,c,c,d,a,a,b,[.0025,uvs[s]],[.4975,uvs[s]],[.0025,uvs[s+1]]);
        p.tri(r,r2,l2,c,d,d,a,b,b,[.4975,uvs[s]],[.4975,uvs[s+1]],[.0025,uvs[s+1]]);
      }
      if(!far&&k<3&&j%3===0)p.stick([cx,root-.04,cz],at(radiusHere*.68,0,mid-.03),h*.008,h*.002,bark,4,false);
    }
    if(skyline){
      const top=[cx,y0+rise*1.12,cz],base=[cx,y0-.02*h,cz],c=blend(color,rgb('#779389'),.28);
      for(let j=0;j<outline.length;j++){
        const a=outline[j],b=outline[(j+1)%outline.length];
        p.tri(top,b,a,tint(c,1.08),c,c);
        p.tri(base,a,b,tint(c,.77));
      }
    }
  }
}


function broadleaf(p,random,x,y,z,h,r,color,far) {
  const birch=random()>.55, bark=rgb(birch?'#b7ac88':'#7e7359');
  const torsion=(random()-.5)*.55;
  p.stick([x,y-.1,z],[x+torsion,y+h*.76,z+.12],h*(birch?.022:.03),h*.015,bark,far?6:8,false);
  if(birch&&!far){
    for(let j=0;j<12;j++){
      const t=.06+random()*.48,a=random()*TAU,rr=h*(.023-t*.011), yy=y+h*t;
      const around=(theta,dy)=>[x+torsion*t/.76+rr*Math.cos(theta),yy+dy,z+.12*t/.76+rr*Math.sin(theta)];
      p.tri(around(a,0),around(a+.97,.016),around(a+.31,.046),rgb('#776e59'));
    }
  }
  const phase=random()*TAU,lobes=far?6:8;
  for(let k=0;k<lobes;k++){
    const th=phase+k*2.4, tip=k===lobes-1;
    const reach=r*(tip?.14:.48+random()*.30);
    const bx=x+Math.cos(th)*reach,bz=z+Math.sin(th)*reach;
    const by=y+h*(tip?.84:.52+random()*.22);
    const c=tint(color,.9+random()*.19);
    if(!far)p.stick([x+torsion*.45,y+h*(.30+random()*.16),z],[bx,by,bz],h*.018,h*.007,bark,5,false);
    const rx=r*(.46+random()*.25), ry=h*(.113+random()*.067);
    crownlet(p,bx,by,bz,rx,ry,rx*(.80+random()*.21),c,th,far?0:1);
    if(!far)for(let s=0;s<3;s++){
      const a=th+s*2.1, ext=rx*(.70+random()*.18);
      crownlet(p,bx+Math.cos(a)*ext,by+ry*(random()-.43),bz+Math.sin(a)*ext,rx*.46,ry*.56,rx*.48,
        tint(c,.91+random()*.16),a,0);
    }
  }
}


function makeForest(group, random, material) {
  const foliage=material.clone(); foliage.map=firSprigTexture(); foliage.alphaTest=.32;
  // The shadow pass keeps the full forest. Only the viewer's color pass cuts away obstructing trees.
  foliage.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
      attribute float treeVisibility; varying float vTreeVisibility;`)
      .replace('#include <project_vertex>',`#include <project_vertex>
        vTreeVisibility=treeVisibility;
        if(treeVisibility==0.) gl_Position=vec4(2.,2.,2.,1.);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      varying float vTreeVisibility;`).replace('#include <alphatest_fragment>',`#include <alphatest_fragment>
        if(vTreeVisibility<1.) {
          float threshold=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
          if(threshold>=vTreeVisibility) discard;
        }`);
  };
  const chunks=new Map(), treePositions=[];
  function stand(x,z,forced=false) {
    const r=Math.hypot(x,z);
    if(!forced && (x > -9.8 && x < 10.8 && z > -7.1 && z < 6)) return;
    // Broad central sightline on the near bank, with taller framing trunks out at the sides.
    if(!forced && z > 0 && z < 29 && x > -9.4 + z * .24 && x < 9.8 + z * .48) return;
    if(riverDistance(x,z)<.9 || onTrail(x,z,.7)) return;
    const far=r>27;
    const spacing=far?2.6:2;
    for(const [tx,tz] of treePositions) if((x-tx)**2+(z-tz)**2 < spacing**2) return;
    treePositions.push([x,z]);
    const key=Math.floor(x/20)+','+Math.floor(z/20);
    if(!chunks.has(key))chunks.set(key,{paint:new Paint(true),near:r<27,stands:[]});
    const c=chunks.get(key); c.near||=r<27;
    const first=c.paint.p.length/3;
    const y=landHeight(x,z);
    const scale=(.75+random()*.54)*(r<16?.92:1);
    if(random()<.77) {
      const h=(6.2+random()*4.0)*scale;
      spruce(c.paint,random,x,y,z,h,h*(.19+random()*.075),rgb(treeColors[Math.floor(random()*treeColors.length)]),far);
    } else {
      const h=(4.8+random()*3.5)*scale;
      broadleaf(c.paint,random,x,y,z,h,h*(.26+random()*.10),rgb(leafColors[Math.floor(random()*leafColors.length)]),far);
    }
    if(r<48){
      let radius=0,low=Infinity,high=-Infinity;
      for(let i=first*3;i<c.paint.p.length;i+=3){
        const xx=c.paint.p[i]-x,yy=c.paint.p[i+1],zz=c.paint.p[i+2]-z;
        radius=Math.max(radius,xx*xx+zz*zz);low=Math.min(low,yy);high=Math.max(high,yy);
      }
      c.stands.push({x,z,radius:Math.sqrt(radius),low,high,first,count:c.paint.p.length/3-first,value:255,goal:255});
    }
  }
  // Tighter groups with gaps between them read as individual woodland stands.
  [[-9,-2],[-11,-5],[-12,.5],[-6.5,-7.5],[2.2,-9],[7.9,-7.3],[10,-5],[-11,9],[14,3]].forEach(([x,z])=>stand(x,z,true));
  for(let i=0;i<1250;i++) {
    const a=random()*TAU, r=7+Math.sqrt(random())*58;
    stand(Math.cos(a)*r,Math.sin(a)*r);
  }
  for(let i=0;i<130;i++){
    const x=(random()-.5)*43,z=(random()-.5)*47;
    stand(x,z);
  }
  const stands=[];
  for(const c of chunks.values()){
    const mesh=c.paint.mesh(group,'混交林树冠与枝干',foliage,c.near);
    const opacity=new THREE.Uint8BufferAttribute(new Uint8Array(mesh.geometry.attributes.position.count).fill(255),1,true);
    opacity.setUsage(THREE.DynamicDrawUsage);
    mesh.geometry.setAttribute('treeVisibility',opacity);
    for(const tree of c.stands)stands.push({...tree,opacity});
  }
  const lastEye=new THREE.Vector3(Infinity,0,0),lastAim=lastEye.clone(),fades=new Set();
  const duration=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches?0:160;
  return (eye,aim)=>{
    const now=performance.now();
    if(eye.distanceToSquared(lastEye)+aim.distanceToSquared(lastAim)>.000001){
      lastEye.copy(eye);lastAim.copy(aim);
      const dx=aim.x-eye.x,dy=aim.y-eye.y,dz=aim.z-eye.z,alongSq=dx*dx+dz*dz;
      const length=Math.sqrt(alongSq),reach=clamp(length*.28,1.45,5.5);
      for(const tree of stands){
        let t0=0,t1=1,goal=255;
        if(Math.abs(dy)>.0001){
          const a=(tree.low-1.5-eye.y)/dy,b=(tree.high+1.5-eye.y)/dy;
          t0=Math.max(0,Math.min(a,b));t1=Math.min(1,Math.max(a,b));
        }else if(eye.y<tree.low-1.5||eye.y>tree.high+1.5)t1=-1;
        const s=alongSq>.00001?((tree.x-eye.x)*dx+(tree.z-eye.z)*dz)/alongSq:.5;
        if(t0<=t1&&(s-1)*length<tree.radius&&-s*length<tree.radius+1.5){
          const t=clamp(s,t0,t1),x=eye.x+t*dx-tree.x,z=eye.z+t*dz-tree.z;
          const clearance=Math.hypot(x,z)-tree.radius-mix(1.5,reach,t);
          // Two thresholds prevent repeated toggles along the boundary of the view.
          if(clearance<(tree.goal===0?.95:.25))goal=0;
        }
        if(tree.goal!==goal){
          tree.from=tree.value;tree.goal=goal;tree.changed=now;fades.add(tree);
        }
      }
    }
    // Fades finish even after the camera stops, keeping stationary silhouettes solid.
    for(const tree of fades){
      const t=duration?clamp((now-tree.changed)/duration,0,1):1;
      const opacity=Math.round(mix(tree.from,tree.goal,t*t*(3-2*t)));
      if(tree.value!==opacity){
        const attr=tree.opacity;
        attr.array.fill(opacity,tree.first,tree.first+tree.count);
        const range=attr.updateRanges[0];
        if(range){
          const end=Math.max(range.start+range.count,tree.first+tree.count);
          range.start=Math.min(range.start,tree.first);range.count=end-range.start;
        }else attr.addUpdateRange(tree.first,tree.count);
        attr.needsUpdate=true;tree.value=opacity;
      }
      if(t===1)fades.delete(tree);
    }
  };
}

function makeHighlands(p, random) {
  for (let band = 0; band < 2; band++) {
    const steps = 132, radius = 70 + band * 26;
    const rows = [];
    for (let i = 0; i < steps; i++) {
      const a = i / steps * TAU;
      const summit = (12 + band * 7 + Math.sin(a * 7 + band) * 3.8 +
        Math.sin(a * 12 - .6 + band) * 2.5 + Math.sin(a * 19 + 2.2) * 1.15 + random() * .9);
      const r = radius + 3.5 * Math.sin(a * 6 + band) + random();
      rows.push([[Math.cos(a)*(r-11), -.8, Math.sin(a)*(r-11)],
        [Math.cos(a)*(r-5), summit*.56, Math.sin(a)*(r-5)], [Math.cos(a)*r, summit, Math.sin(a)*r]]);
    }
    const c = rgb(band ? '#9baba0' : '#80978a');
    for (let i = 0; i < steps; i++) {
      const a=rows[i], b=rows[(i+1)%steps];
      p.quad(a[0],b[0],b[1],a[1],tint(c,.75),tint(c,.93));
      p.quad(a[1],b[1],b[2],a[2],tint(c,.93),tint(c,1+random()*.055));
    }
  }
}

function makeBridge(p, random) {
  const x=-4.15, middle=creekZ(x), reach=creekHalf(x)+.61;
  const knot=rgb('#7b6450'), heart=rgb('#c1a071');
  const section=[];
  for(let j=0;j<12;j++){
    const angle=j/12*TAU;
    section.push([Math.sin(angle)*.55, Math.min(.24,.005+Math.cos(angle)*.405)]);
  }
  let old;
  for(let i=0;i<=12;i++){
    const t=i/12, z=middle+mix(-reach,reach,t);
    const midx=x+.14*(t-.5)+.06*Math.sin(t*Math.PI);
    const arch=Math.sin(t*Math.PI)*.145;
    const row=section.map(([dx,dy])=>[midx+dx*(.96+.06*Math.sin(t*8)),dy+arch,z]);
    if(old)for(let j=0;j<row.length;j++){
      const k=(j+1)%row.length, top=row[j][1]>.23+arch && row[k][1]>.23+arch;
      p.quad(old[j],row[j],row[k],old[k],tint(top?heart:knot,.88+.10*Math.sin(j*2.2)+random()*.07));
    }
    if(i===0||i===12){
      for(let j=0;j<row.length;j++)p.tri(row[j],row[(j+1)%row.length],[midx,arch,z],rgb('#b59367'));
      const front=z+(i===0?-.003:.003);
      const ringPoint=(a,r)=>[midx+Math.sin(a)*r*.50,arch-.06+Math.cos(a)*r*.34,front];
      for(let ring=1;ring<=4;ring++)for(let n=0;n<20;n++) {
        const a=n/20*TAU+.18, b=(n+1)/20*TAU+.18, r=ring*.198;
        p.quad(ringPoint(a,r),ringPoint(b,r),ringPoint(b,r+.017),ringPoint(a,r+.017),rgb('#917653'));
      }
    }
    old=row;
  }
  // The cut top carries wood grain; the side of the log retains its bark.
  for(let j=0;j<25;j++){
    const offset=(random()-.5)*.8, t=random()*.85, span=.035+random()*.10;
    function grain(s,d){
      return [x+.14*(s-.5)+.06*Math.sin(s*Math.PI)+offset+d,.245+Math.sin(s*Math.PI)*.145,middle+mix(-reach,reach,s)];
    }
    p.tri(grain(t,0),grain(t+span*.43,.011),grain(t+span,.006),rgb('#977549'));
  }
  for(const side of [-1,1])for(let j=0;j<20;j++){
    const t=random()*.80, span=.07+random()*.14, theta=.22+random()*.73;
    const ridge=(s,d)=>[x+.14*(s-.5)+.06*Math.sin(s*Math.PI)+side*.552*Math.cos(theta+d)*(.96+.06*Math.sin(s*8)),
      .005-.405*Math.sin(theta+d)+Math.sin(s*Math.PI)*.145,middle+mix(-reach,reach,s)];
    p.tri(ridge(t,0),ridge(t+span*.45,.055),ridge(t+span,0),rgb(j%3?'#5f5142':'#978066'));
  }
  // A single handrail on bank-anchored stakes keeps the log readable from the clearing.
  const anchors=[];
  for(const s of [-1,1]){
    const z=middle+s*(reach-.13), xx=x-.55+s*.07, foot=landHeight(xx,z);
    const a=[xx,foot-.08,z], b=[xx-.05,1.12,z+s*.06];
    p.stick(a,b,.075,.055,knot,8);
    anchors.push([b[0],1.04,b[2]]);
    for(let i=0;i<3;i++)
      p.stick([b[0],.99+i*.037,b[2]],[b[0],1.014+i*.037,b[2]],.083,.083,rgb('#c3a97c'),8,false);
  }
  let prev=anchors[0];
  for(let i=1;i<=9;i++){
    const t=i/9;
    const next=[mix(anchors[0][0],anchors[1][0],t),1.04-.16*Math.sin(t*Math.PI),mix(anchors[0][2],anchors[1][2],t)];
    p.stick(prev,next,.025,.025,rgb('#b8a078'),5,false);
    prev=next;
  }
  for(const s of [-1,1]){
    const z=middle+s*(reach+.15);
    oval(p,x,landHeight(x,z)+.075,z,.56,.14,.29,rgb('#aaa38b'),random,9);
    const z2=z+s*.33;
    oval(p,x+.07,landHeight(x,z2)+.028,z2,.36,.06,.22,rgb('#a69f86'),random,8);
  }
}

function makeWell(p,random) {
  const cx=-6.85,cz=2.05,base=landHeight(cx,cz);
  const stone=['#827e6b','#9d9680','#aaa08b','#8f8b76','#a9a390'];
  const at=(angle,r,h)=>[cx+Math.cos(angle)*r,base+h,cz+Math.sin(angle)*r];
  for(let row=0;row<4;row++)for(let i=0;i<10;i++) {
    const a=(i+row%2*.5)/10*TAU+.007, b=a+TAU/10-.017;
    const radius=row===3?.70:.66, low=.005+row*.175, high=low+.169;
    const c=rgb(stone[Math.floor(random()*stone.length)]);
    const bo=at(a,radius,low),b1=at(b,radius,low),t0=at(a,radius,high),t1=at(b,radius,high);
    const i0=at(a,.45,high),i1=at(b,.45,high);
    p.quad(b1,bo,t0,t1,c);p.quad(t0,i0,i1,t1,tint(c,1.06));
    p.quad(at(a,.45,low),at(b,.45,low),i1,i0,tint(c,.65));
    p.quad(t0,bo,at(a,.45,low),i0,tint(c,.84));
  }
  const wood=rgb('#765a3e'), boards=rgb('#937451');
  for(const s of [-1,1])p.stick([cx+s*.60,base+.67,cz],[cx+s*.60,base+2.14,cz],.079,.068,wood,5);
  p.stick([cx-.76,base+1.36,cz],[cx+.78,base+1.36,cz],.074,.074,boards,8);
  p.stick([cx+.78,base+1.36,cz],[cx+.78,base+1.14,cz],.026,.026,wood,6);
  p.stick([cx+.78,base+1.14,cz],[cx+.90,base+1.14,cz],.032,.032,wood,6);
  for(let i=0;i<9;i++)p.stick([cx-.14+i*.031,base+1.36,cz],[cx-.115+i*.031,base+1.36,cz],.096,.096,rgb('#b7a075'),8,false);
  p.stick([cx,base+1.36,cz+.085],[cx,base+.30,cz+.085],.013,.013,rgb('#b7a075'),5,false);
  for(const sign of [-1,1]) {
    const ridge=base+2.16;
    for(let i=0;i<7;i++){
      const x=cx-.92+i*.263, x2=x+.258;
      const d=.65+random()*.04;
      p.quad([x,ridge,cz],[x2,ridge,cz],[x2,ridge-.43,cz+sign*d],[x,ridge-.43,cz+sign*d],tint(boards,.80+random()*.22));
      p.quad([x,ridge-.43,cz+sign*d],[x2,ridge-.43,cz+sign*d],[x2,ridge-.47,cz+sign*d],[x,ridge-.47,cz+sign*d],wood);
    }
  }
  p.stick([cx-.97,base+2.15,cz],[cx+.97,base+2.15,cz],.057,.057,wood,6);
}

function blade(p,x,y,z,ang,h,w,reach,c,bottom) {
  const u=Math.cos(ang),v=Math.sin(ang);
  const a=[x+v*w*.45,y,z-u*w*.45], b=[x-v*w*.45,y,z+u*w*.45];
  const m=[x+u*reach*.39+v*w*.31,y+h*.65,z+v*reach*.39-u*w*.31];
  const tip=[x+u*reach,y+h,z+v*reach];
  p.tri(a,b,m,bottom,bottom,c);
  p.tri(b,tip,m,bottom,tint(c,1.18),c);
}

function fern(p,random,x,y,z,size) {
  const phase=random()*TAU, colors=['#557540','#718a49','#697f40','#81914a'];
  for(let k=0;k<7;k++) {
    const th=phase+k*TAU/7+(random()-.5)*.34;
    const len=size*(.73+random()*.42), c=rgb(colors[k%4]);
    const u=Math.cos(th),v=Math.sin(th);
    const along=(t,side)=>[x+u*len*t-v*side,y+len*(Math.sin(t*Math.PI*.83)*.55+t*.08),z+v*len*t+u*side];
    const n=7;
    for(let j=0;j<n;j++) {
      const t=j/n, width=.18*len*Math.sin((t+.09)*Math.PI)*(.96-t*.26);
      const stem=along(t,0), next=along((j+1)/n,0);
      p.tri(stem,along(t+.07,.015*len),next,c);
      for(const sign of [-1,1]){
        p.tri(stem,along(t+.17,sign*width),along(t+.105,0),tint(c,.81),tint(c,1.13),c);
      }
    }
  }
}

function flower(p,random,x,y,z,kind) {
  const stem=rgb('#637846'), h=.20+random()*.30;
  const dx=(random()-.5)*.085,dz=(random()-.5)*.07;
  const at=[x+dx,y+h,z+dz];
  blade(p,x,y,z,random()*TAU,h*.64,.048,.085,rgb('#82904c'),stem);
  p.quad([x-.008,y,z],[x+.008,y,z],[at[0]+.006,at[1],at[2]],[at[0]-.006,at[1],at[2]],stem);
  const faces=['#f0e6c1','#e6c04e','#a095bc','#cf8d82'];
  const c=rgb(faces[kind]), gold=rgb(kind===2?'#ddc489':'#dba341');
  if(kind>=2) {
    for(let j=0;j<5;j++){
      const a=j*2.4, f=1-j*.125, cx=at[0]+Math.sin(a)*.025*f,cy=at[1]-.11+j*.031,cz=at[2]+Math.cos(a)*.022*f;
      p.tri([cx-.032*f,cy,cz],[cx+.032*f,cy,cz],[cx,cy+.052*f,cz],c);
      p.tri([cx,cy,cz-.027*f],[cx,cy,cz+.027*f],[cx,cy+.052*f,cz],tint(c,1.1));
    }
  } else {
    const center=[at[0],at[1]+.004,at[2]],r=.048+random()*.02;
    for(let i=0;i<6;i++){
      const a=TAU*i/6;
      const pos=(off,rad,lift)=>[at[0]+Math.cos(a+off)*rad,at[1]+lift,at[2]+Math.sin(a+off)*rad];
      p.tri(pos(0,.011,0),pos(.27,r,.017),pos(-.27,r,.017),c);
      p.tri(center,pos(.52,.018,.009),pos(-.52,.018,.009),gold);
    }
  }
}

function daisiesAndSpikes(p,random,x,y,z,kind,scale) {
  // Several distinct stems share one rosette in the most visible meadow patches.
  const stem=rgb('#658249'),bloom=rgb(kind?'#ada0c4':'#fff3d0');
  for(let j=0;j<3;j++) {
    const a=j*2.4+random()*.7, u=Math.cos(a),v=Math.sin(a);
    const bend=(.08+random()*.08)*scale, h=(.25+random()*.25)*scale;
    const xx=x+bend*u,zz=z+bend*v, yy=y+h;
    p.quad([x-.009,y,z],[x+.009,y,z],[xx+.007,yy,zz],[xx-.007,yy,zz],stem);
    blade(p,x,y,z,a,.24*scale,.046,.15*scale,rgb('#829656'),stem);
    if(!kind){
      for(let k=0;k<8;k++){
        const a=k/8*TAU+j;
        const top=(ang,r,dy)=>[xx+Math.cos(ang)*r*scale,yy+dy+.029*Math.sin(ang),zz+Math.sin(ang)*r*scale];
        p.quad(top(a,.013,0),top(a-.22,.065,.009),top(a,.082,.014),top(a+.22,.065,.009),bloom);
        p.tri([xx,yy+.013,zz],top(a-.40,.025,.004),top(a+.40,.025,.004),rgb('#dcac45'));
      }
    } else {
      for(let k=0;k<5;k++){
        const a=k*2.4, r=(.043-k*.0035)*scale, cx=xx+Math.cos(a)*.018, cz=zz+Math.sin(a)*.018, cy=yy+k*.037*scale;
        p.quad([cx-r,cy,cz],[cx-r*.45,cy+.031,cz+.012],[cx+r*.35,cy+.043,cz],[cx+r,cy+.008,cz-.013],k%2?bloom:rgb('#9183aa'));
        p.tri([cx,cy+.003,cz-r],[cx+.015,cy+.038,cz],[cx,cy+.004,cz+r],bloom);
      }
    }
  }
}

function makeGarden(p,random) {
  const gx=7.90,gz=2.33,wood=rgb('#978260'),soil=rgb('#705b43');
  for(let row=0;row<3;row++) {
    const x=gx+(row-1)*.49;
    for(let j=0;j<12;j++){
      const z=gz-.89+j*.15, y=landHeight(x,z);
      oval(p,x,y+.012,z,.29,.09,.21,tint(soil,.9+random()*.15),random,6);
    }
    for(let j=0;j<5;j++){
      const z=gz-.70+j*.36, y=landHeight(x,z)+.065;
      for(let k=0;k<8;k++){
        const a=k*2.4+j;
        const c=rgb((row===0?['#6f8243','#829650']:row===1?['#869756','#a1a762']:['#567649','#6e8a56'])[k%2]);
        const r=.13+random()*.08;
        blade(p,x,y,z,a,.13+random()*.17,row===2?.05:.14,r,c,tint(c,.68));
      }
      if(row!==2)oval(p,x,y+.09,z,.12,.10,.12,rgb(row?'#8fa05f':'#74894e'),random,6);
    }
  }
  for(const s of [-1,1]){
    const z=gz+s*.98;
    p.stick([gx-.84,landHeight(gx-.84,z)+.07,z],[gx+.84,landHeight(gx+.84,z)+.07,z],.06,.06,wood,5);
  }
  for(const s of [-1,1]){
    const x=gx+s*.84;
    p.stick([x,landHeight(x,gz-.98)+.07,gz-.98],[x,landHeight(x,gz+.98)+.07,gz+.98],.06,.06,wood,5);
  }
  const x=gx+.57,z=gz+.93,y=landHeight(x,z);
  p.stick([x,y,z],[x,y+.42,z-.055],.026,.024,wood,4);
  p.quad([x-.12,y+.24,z-.02],[x+.12,y+.24,z-.02],[x+.12,y+.42,z-.055],[x-.12,y+.42,z-.055],rgb('#c6af82'));
}

function makeUnderstory(group,random,material) {
  const ground=new Paint(),growth=new Paint(),stones=new Paint();
  const grass=['#819051','#83964f','#9da25d','#83974f','#6b844a','#a0a762','#667e45'];
  const stone=['#8d9686','#9d9a86','#7f887c','#a6a593','#899184','#aba997'];
  const buildings=(x,z)=>(x>-5.7&&x<1.70&&z>-3.6&&z<2.62)||
    (x>-2.22&&x<-.18&&z>2.3&&z<3.18)||
    (x>2.57&&x<9.18&&z>-4.15&&z<.64)||(x>6.85&&x<8.93&&z>1.25&&z<3.42)||
    Math.hypot(x+6.85,z-2.05)<.88;
  const clear=(x,z)=>!buildings(x,z)&&!onTrail(x,z)&&riverDistance(x,z)>.12;
  // Vary the density with large patches and tie the shortest leaves to the banks.
  for(let i=0;i<4380;i++){
    const x=(random()-.5)*43,z=(random()-.5)*37+2, d=riverDistance(x,z);
    if(!clear(x,z)||Math.abs(x+4.15)<.75&&Math.abs(z-creekZ(x))<creekHalf(x)+.8)continue;
    const weight=Math.sin(x*.93+z*.21)*.24+Math.cos(z*.91-x*.32)*.20+.51;
    if(random()*.76>weight+.13+(d<1.4?.25:0))continue;
    const y=landHeight(x,z),size=(.13+random()*.18)*(d<1?.82:1);
    const c=rgb(grass[Math.floor(random()*grass.length)]);
    const n=3+Math.floor(random()*4);
    for(let k=0;k<n;k++){
      const a=random()*TAU, spread=random()*.08;
      blade(growth,x+Math.cos(a)*spread,y-.012,z+Math.sin(a)*spread,a,size*(.66+random()*.65),.027+random()*.029,size*(.26+random()*.68),tint(c,.92+random()*.17),tint(c,.7));
    }
  }
  // Small islands of flowers leave visible open lawn between the meadow edges.
  for(let i=0;i<110;i++){
    const x=(random()-.5)*31,z=(random()-.5)*24+3,kind=Math.floor(random()*4);
    if(!clear(x,z))continue;
    for(let j=0;j<6+random()*9;j++){
      const a=random()*TAU,r=random()*.74,xx=x+Math.cos(a)*r,zz=z+Math.sin(a)*r;
      if(clear(xx,zz))flower(growth,random,xx,landHeight(xx,zz),zz,kind);
    }
  }
  for(let i=0;i<105;i++) {
    const x=(random()-.5)*37,z=(random()-.5)*28+3;
    if(!clear(x,z)||riverDistance(x,z)>2.3 && Math.hypot(x,z)<7)continue;
    fern(growth,random,x,landHeight(x,z),z,.28+random()*.40);
  }
  const pockets=[[-5.25,3.62,0,8],[-6.10,6.98,0,7],[-3.12,7.83,1,9],[-1.72,8.37,0,7],
    [.42,4.64,0,11],[1.43,4.67,1,9],[3.46,4.42,0,9],[5.92,5.63,1,10],[8.87,4.05,0,6]];
  for(const [px,pz,kind,count] of pockets){
    for(let i=0;i<count;i++){
      const a=random()*TAU, r=Math.sqrt(random())*.63, xx=px+Math.cos(a)*r,zz=pz+Math.sin(a)*r*.67;
      if(clear(xx,zz))daisiesAndSpikes(growth,random,xx,landHeight(xx,zz),zz,kind,.80+random()*.32);
    }
  }
  for(const [x,z,size] of [[-.40,4.56,.80],[2.78,4.90,.85],[6.6,5.5,.65],[-5.68,7.88,.83],[-2.50,8.42,.76],[-6.07,3.43,.63]]){
    if(clear(x,z))fern(growth,random,x,landHeight(x,z),z,size);
  }
  // Uneven boulders punctuate the stream. Bare stretches let the bank read as one continuous edge.
  for(let i=0;i<460;i++) {
    const x=(random()-.5)*55,sign=random()>.5?1:-1;
    const d=(random()-.5)*1.17;
    const z=creekZ(x)+sign*(creekHalf(x)+d);
    if(Math.abs(x+4.15)<1||onTrail(x,z))continue;
    const rock=.09+Math.pow(random(),2)*.42, y=landHeight(x,z);
    const c=rgb(stone[Math.floor(random()*stone.length)]);
    oval(stones,x,y+.015,z,rock*(1+random()*.56),rock*(.55+random()*.35),rock,c,random,6+Math.floor(random()*2),random()*TAU);
  }
  // Pale gravel tongues carry a little of the dry bank color under the shallow water.
  for(const px of [-8.3,-6.7,-2.6,.6,3.9,6.8,9.4])for(const sign of [-1,1]){
    for(let i=0;i<22;i++) {
      const x=px+(random()-.5)*1.72, d=random()*.70-.15;
      const z=creekZ(x)+sign*(creekHalf(x)+d);
      const r=.034+random()*.087, y=landHeight(x,z)+r*.12;
      oval(stones,x,y,z,r*1.33,r*.47,r*.83,rgb(stone[i%stone.length]),random,5);
    }
  }
  for(let i=0;i<105;i++){
    const x=(random()-.5)*33,z=(random()-.5)*27;
    if(!clear(x,z)||Math.hypot(x,z)<7.6)continue;
    const size=.14+Math.pow(random(),2)*.62,y=landHeight(x,z);
    const c=rgb(stone[Math.floor(random()*stone.length)]);
    oval(stones,x,y,z,size,size*.67,size*.82,c,random,7,random()*TAU);
    if(random()>.46)oval(stones,x-.04,y+size*.34,z+.01,size*.74,size*.30,size*.59,rgb('#83915a'),random,7);
  }
  for(let i=0;i<1200;i++){
    const x=(random()-.5)*22,z=(random()-.5)*24+3;
    if(!onTrail(x,z,-.03)||buildings(x,z))continue;
    const y=landHeight(x,z)+.038, s=.024+random()*.052;
    ground.tri([x-s,y,z],[x+s,y+.005,z-.018],[x+s*.25,y,z+.045],rgb(random()>.5?'#c8b58b':'#a38f6e'));
  }
  ground.mesh(group,'泥径上的砾石',material,false);
  stones.mesh(group,'苔石与河岸岩块',material);
  growth.mesh(group,'野花、蕨叶与草丛',material,false);
}

export function createWoodland() {
  const group=new THREE.Group();
  group.name='林溪庭院';
  const random=randomSource(713801);
  const painted=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide});
  painted.name='林地手绘色';
  const earth=painted.clone();
  const paths=new Paint(), detail=new Paint(), hills=new Paint();
  makeSoil(group,random,earth);
  const update=makeCreek(group,random);
  const bx=-4.15,middle=creekZ(bx),reach=creekHalf(bx)+.60;
  pathSegments.length=0;
  addTrail(paths,random,[[bx,middle-reach],[-3.57,3.48],[-2.40,3.67],[-1.2,3.11]],1.05);
  addTrail(paths,random,[[-2.48,3.65],[-1.10,3.75],[.8,2.87],[2.72,2.03],[4.0,1.22],[5.4,.05]],.82);
  addTrail(paths,random,[[-3.4,3.36],[-4.74,3.31],[-5.67,2.99],[-6.37,2.63]],.67);
  addTrail(paths,random,[[bx,middle+reach],[-3.04,9.29],[-.64,11.14],[.04,13.02],[-1.5,16],[-3.9,18.8],[-4.5,23.5]],1.12);
  paths.mesh(group,'蜿蜒泥径',painted,false);
  makeBridge(detail,random);makeWell(detail,random);makeGarden(detail,random);
  detail.mesh(group,'独木桥、菜畦与水井',painted);
  const updateSightline=makeForest(group,random,painted);
  makeUnderstory(group,random,painted);
  makeHighlands(hills,random);
  hills.mesh(group,'溪谷远山',painted,false);
  return {group,update,updateSightline};
}
