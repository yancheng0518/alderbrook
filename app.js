import { setAmbience } from './audio.js';

const byId=id=>document.getElementById(id);
const stage=byId('stage'),host=byId('world'),notice=byId('notice');
const views=[...document.querySelectorAll('[data-view]')];
const switches=[...document.querySelectorAll('[data-light]')];
const times=[...document.querySelectorAll('[data-time]')];
const timeButton=byId('time-button'),timeMenu=byId('times');
const guide=byId('guide'),sound=byId('sound'),fullscreen=byId('fullscreen');
const timeIcons={morning:'dawn',afternoon:'sun',evening:'moon'};
let world, current='overview', stills=false, timer=0;
host.style.backgroundImage='url("'+views[0].querySelector('img').src+'")';
function tell(message){
  clearTimeout(timer);notice.textContent=message;notice.hidden=false;
  timer=setTimeout(()=>{notice.hidden=true;},2300);
}
function selectView(id){
  current=id;
  views.forEach(b=>{const active=b.dataset.view===id;b.setAttribute('aria-pressed',String(active));b.classList.toggle('selected',active);});
  if(world)world.frame(id);
  else if(stills)host.style.backgroundImage='url("'+views.find(b=>b.dataset.view===id).querySelector('img').src+'")';
}
views.forEach(b=>b.addEventListener('click',()=>selectView(b.dataset.view)));
switches.forEach(b=>b.addEventListener('click',()=>{
  const on=b.getAttribute('aria-checked')!=='true';
  b.setAttribute('aria-checked',String(on));world?.setLight(b.dataset.light,on);
}));
function closeTimes(){timeMenu.hidden=true;timeButton.setAttribute('aria-expanded','false');}
timeButton.addEventListener('click',()=>{
  const opening=timeMenu.hidden;timeMenu.hidden=!opening;timeButton.setAttribute('aria-expanded',String(opening));
  if(opening)timeMenu.querySelector('[aria-pressed=true]').focus({preventScroll:true});
});
times.forEach(b=>b.addEventListener('click',()=>{
  times.forEach(item=>item.setAttribute('aria-pressed',String(item===b)));
  byId('time-label').textContent=b.textContent;
  byId('time-icon').setAttribute('href','#i-'+timeIcons[b.dataset.time]);
  world?.setTime(b.dataset.time);closeTimes();timeButton.focus({preventScroll:true});
}));
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.time-group'))closeTimes();});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&!timeMenu.hidden){closeTimes();timeButton.focus();}
  if(e.key==='Escape'&&stage.classList.contains('full-window')){stage.classList.remove('full-window');fullState();}
});
byId('reset').addEventListener('click',()=>{world?.frame(current);tell('已复位当前镜头');});
function fullState(){
  const active=Boolean(document.fullscreenElement)||stage.classList.contains('full-window');
  fullscreen.setAttribute('aria-label',active?'退出全屏':'全屏查看');fullscreen.title=fullscreen.getAttribute('aria-label');
  fullscreen.querySelector('use').setAttribute('href',active?'#i-collapse':'#i-expand');
}
fullscreen.addEventListener('click',async()=>{
  if(document.fullscreenElement)await document.exitFullscreen();
  else if(stage.classList.contains('full-window'))stage.classList.remove('full-window');
  else if(stage.requestFullscreen){try{await stage.requestFullscreen();}catch{stage.classList.add('full-window');}}
  else stage.classList.add('full-window');
  fullState();
});
document.addEventListener('fullscreenchange',fullState);
byId('help').addEventListener('click',()=>guide.showModal());
byId('close-guide').addEventListener('click',()=>guide.close());
guide.addEventListener('click',e=>{if(e.target===guide){const box=guide.getBoundingClientRect();if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)guide.close();}});
let audioRequest=0;
sound.addEventListener('click',async()=>{
  const token=++audioRequest,on=sound.getAttribute('aria-pressed')!=='true';
  sound.setAttribute('aria-pressed',String(on));sound.querySelector('use').setAttribute('href',on?'#i-sound':'#i-mute');
  try{await setAmbience(on);}
  catch{if(token===audioRequest){sound.setAttribute('aria-pressed','false');sound.querySelector('use').setAttribute('href','#i-mute');tell('当前浏览器无法播放环境音');}}
});
async function start(){
  try{
    const {createWorld}=await import('./world.js');
    world=createWorld(host,closeTimes);
    byId('render-status').textContent='实时 3D';
    if(current!=='overview')world.frame(current,true);
    for(const b of switches)world.setLight(b.dataset.light,b.getAttribute('aria-checked')==='true');
    world.setTime(times.find(b=>b.getAttribute('aria-pressed')==='true').dataset.time,true);
    // A snapshot supplies rendering diagnostics without exposing mutable scene objects.
    if(location.hostname==='127.0.0.1'||location.hostname==='localhost')window.sceneSnapshot=world.inspect;
    host.querySelector('canvas').addEventListener('webglcontextlost',e=>{
      e.preventDefault();byId('render-status').textContent='图形设备已暂停';tell('图形上下文已丢失，正在等待恢复');
    });
    host.querySelector('canvas').addEventListener('webglcontextrestored',()=>location.reload());
  }catch(error){
    console.warn('3D scene unavailable',error);stills=true;byId('render-status').textContent='静态取景';
    selectView(current);for(const b of [...switches,timeButton,byId('reset')])b.disabled=true;
    host.setAttribute('aria-label','静态场景预览');host.tabIndex=-1;tell('当前设备无法启用 WebGL，可切换下方取景');
  }
}
start();
