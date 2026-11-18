// Audio is constructed on the first explicit user gesture and kept suspended
// between visits to the soundscape. Everything is generated on-device.
let context;
let master;
let birdTimer;
let suspendTimer;
let revision = 0;
let active = false;
const singers = new Set();

function creekBuffer(ctx) {
  const rate = 24000;
  const samples = rate * 8;
  const overlap = Math.round(rate * 0.32);
  const buffer = ctx.createBuffer(2, samples, rate);
  for (let channel = 0; channel < 2; channel++) {
    const noise = new Float32Array(samples + overlap);
    let brown = 0, soft = 0;
    const phase = Math.random() * Math.PI * 2;
    for (let i = 0; i < noise.length; i++) {
      const white = Math.random() * 2 - 1;
      brown = (brown + white * 0.057) * 0.988;
      soft += (white - soft) * 0.14;
      const angle = 2 * Math.PI * i / samples;
      const current = 0.70 + 0.09 * Math.sin(angle * 5 + phase) + 0.08 * Math.sin(angle * 3 - phase);
      noise[i] = (brown * 0.28 + soft * 0.55 + white * 0.09) * current;
    }
    const stream = buffer.getChannelData(channel);
    stream.set(noise.subarray(0, samples));
    for (let i = 0; i < overlap; i++) {
      const blend = (1 - Math.cos(Math.PI * i / overlap)) * 0.5;
      stream[i] = noise[samples+i] * (1-blend) + noise[i] * blend;
    }
  }
  return buffer;
}

function initialize() {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) throw new Error('当前浏览器未提供环境音播放功能');
  context = new Audio({latencyHint: 'playback'});
  master = context.createGain();
  master.gain.value = 0;
  master.connect(context.destination);
  const current = context.createBufferSource();
  current.buffer = creekBuffer(context);
  current.loop = true;
  const lowCut = context.createBiquadFilter();
  lowCut.type = 'highpass';
  lowCut.frequency.value = 155;
  lowCut.Q.value = 0.55;
  const softTop = context.createBiquadFilter();
  softTop.type = 'lowpass';
  softTop.frequency.value = 3200;
  softTop.Q.value = 0.42;
  current.connect(lowCut).connect(softTop).connect(master);
  current.start();
}

function hold(param, now) {
  if (typeof param.cancelAndHoldAtTime === 'function') {
    param.cancelAndHoldAtTime(now);
  } else {
    const present = param.value;
    param.cancelScheduledValues(now);
    param.setValueAtTime(present, now);
  }
}

function callBird() {
  if (!active || context.state !== 'running') return;
  const pan = (Math.random()-0.5)*1.4;
  const fundamental = 1650 + Math.random()*1050;
  const count = Math.random() < 0.45 ? 2 : 3;
  let t = context.currentTime + 0.035;
  for (let i=0; i<count; i++) {
    const voice = context.createOscillator();
    const envelope = context.createGain();
    const position = context.createStereoPanner ? context.createStereoPanner() : null;
    const duration = 0.13 + Math.random()*0.13;
    const key = fundamental * (1 + Math.sin(i * 1.2)*0.12);
    voice.type = 'sine';
    voice.frequency.setValueAtTime(key*0.83,t);
    voice.frequency.exponentialRampToValueAtTime(key*1.12,t+duration*0.38);
    voice.frequency.exponentialRampToValueAtTime(key*(i===count-1?0.69:0.95),t+duration);
    envelope.gain.value = 0.0001;
    envelope.gain.setValueAtTime(0.0001,t);
    envelope.gain.exponentialRampToValueAtTime(0.036 + Math.random()*0.012,t+0.038);
    envelope.gain.exponentialRampToValueAtTime(0.0001,t+duration);
    voice.connect(envelope);
    if (position) {
      position.pan.value = pan;
      envelope.connect(position).connect(master);
    } else {
      envelope.connect(master);
    }
    const singer = {voice,envelope};
    singers.add(singer);
    voice.onended = () => {
      voice.disconnect();
      envelope.disconnect();
      if (position) position.disconnect();
      singers.delete(singer);
    };
    voice.start(t);
    voice.stop(t+duration+0.025);
    t += duration + 0.06 + Math.random()*0.105;
  }
}

function nextBird(ticket, first) {
  const delay = first ? 2700+Math.random()*2800 : 6900+Math.random()*10200;
  birdTimer = window.setTimeout(() => {
    if (ticket !== revision || !active) return;
    callBird();
    nextBird(ticket, false);
  }, delay);
}

export async function setAmbience(enabled) {
  const ticket = ++revision;
  active = Boolean(enabled);
  window.clearTimeout(birdTimer);
  window.clearTimeout(suspendTimer);
  if (!active && !context) return;
  if (!context) initialize();
  if (active) {
    // Always enqueue resume. This also handles a fresh click arriving while
    // the preceding suspend request is still in the browser's audio queue.
    await context.resume();
    if (ticket !== revision || !active) return;
    const now = context.currentTime;
    hold(master.gain, now);
    master.gain.setTargetAtTime(0.34,now,0.12);
    nextBird(ticket,true);
    return;
  }
  const now = context.currentTime;
  hold(master.gain, now);
  master.gain.setTargetAtTime(0,now,0.046);
  for (const {voice,envelope} of singers) {
    hold(envelope.gain,now);
    envelope.gain.setTargetAtTime(0,now,0.02);
    voice.stop(now+0.10);
  }
  suspendTimer = window.setTimeout(() => {
    if (ticket === revision && !active && context.state !== 'closed') {
      context.suspend().catch(() => {});
    }
  },310);
}

