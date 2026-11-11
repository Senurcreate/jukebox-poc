import { useCallback, useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import { AudioLines, BookOpen, ChevronRight, CircleAlert, ImagePlus, Info, Pause, Play, RotateCcw, Volume2, Waves } from 'lucide-react';
import { analyzeFrame, type FrameFeatures } from './analyzeFrame';
import { mapMusic, type MusicalMapping } from './mapping';

type Source = { title:string; src:string; origin:'reference'|'uploaded' };
type Engine = {
  melody: Tone.FMSynth;
  pad: Tone.PolySynth;
  bass: Tone.Synth;
  accent: Tone.MembraneSynth;
  filter: Tone.Filter;
  master: Tone.Volume;
};
const reference:Source = {title:'Reference heatmap',src:'/reference-heatmap.jpg',origin:'reference'};
const pct=(x:number) => `${Math.round(x*100)}%`;
const volumeDb=(v:number)=>v===0?-Infinity:-43+v*.38;

export default function App(){
  const [source,setSource] = useState<Source>(reference);
  const [features,setFeatures] = useState<FrameFeatures|null>(null);
  const [mapping,setMapping] = useState<MusicalMapping|null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState<string|null>(null);
  const [playing,setPlaying] = useState(false);
  const [position,setPosition] = useState(0);
  const [volume,setVolume] = useState(58);
  const [method,setMethod] = useState(false);
  const [loops,setLoops] = useState(true);
  const [harmony,setHarmony] = useState(true);
  const engineRef=useRef<Engine|null>(null);
  const timerRef=useRef<number|null>(null);
  const playingRef=useRef(false);
  const stepRef=useRef(0);
  const mappingRef=useRef<MusicalMapping|null>(null);
  const harmonyRef=useRef(true);
  const loopRef=useRef(true);
  const fileRef=useRef<HTMLInputElement|null>(null);
  const blobUrlRef=useRef<string|null>(null);
  useEffect(()=>{harmonyRef.current=harmony;},[harmony]);
  useEffect(()=>{loopRef.current=loops;},[loops]);
  useEffect(()=>{if(engineRef.current)engineRef.current.master.volume.value=volumeDb(volume);},[volume]);
  const silence=useCallback(()=>{
    playingRef.current=false;setPlaying(false);
    if(timerRef.current!==null){window.clearTimeout(timerRef.current);timerRef.current=null;}
    const e=engineRef.current;
    if(e){e.melody.triggerRelease();e.pad.releaseAll();e.bass.triggerRelease();}
  },[]);
  useEffect(()=>{
    let canceled=false;
    silence();setFeatures(null);setMapping(null);mappingRef.current=null;
    setLoading(true);setError(null);setPosition(0);stepRef.current=0;
    analyzeFrame(source.src).then(f=>{
      if(canceled)return;
      const result=mapMusic(f);setFeatures(f);setMapping(result);mappingRef.current=result;
    }).catch(err=>{if(!canceled)setError(err instanceof Error?err.message:'Image analysis failed.');}).finally(()=>{if(!canceled)setLoading(false);});
    return ()=>{canceled=true;};
  },[source,silence]);
  useEffect(()=>()=>{
    if(timerRef.current!==null)window.clearTimeout(timerRef.current);
    const e=engineRef.current;
    if(e){e.melody.dispose();e.pad.dispose();e.bass.dispose();e.accent.dispose();e.filter.dispose();e.master.dispose();}
    if(blobUrlRef.current)URL.revokeObjectURL(blobUrlRef.current);
  },[]);
  const getEngine=():Engine=>{
    if(engineRef.current)return engineRef.current;
    const master=new Tone.Volume(volumeDb(volume)).toDestination();
    const filter=new Tone.Filter({type:'lowpass',frequency:1500,Q:0.6}).connect(master);
    const melody=new Tone.FMSynth({
      harmonicity:2.5,modulationIndex:1.5,
      oscillator:{type:'sine'},modulation:{type:'sine'},
      envelope:{attack:.05,decay:.22,sustain:.32,release:.6},
      modulationEnvelope:{attack:.03,decay:.15,sustain:.20,release:.4}
    }).connect(filter);
    melody.volume.value=-9;
    const pad=new Tone.PolySynth(Tone.Synth,{
      oscillator:{type:'triangle'},
      envelope:{attack:1.2,decay:.8,sustain:.3,release:1.7}
    }).connect(filter);
    pad.volume.value=-21;
    const bass=new Tone.Synth({oscillator:{type:'sine'},envelope:{attack:.15,decay:.25,sustain:.2,release:1}}).connect(master);
    bass.volume.value=-20;
    const accent=new Tone.MembraneSynth({pitchDecay:.09,octaves:2.5,envelope:{attack:.005,decay:.11,sustain:0,release:.09}}).connect(master);
    accent.volume.value=-33;
    engineRef.current={melody,pad,bass,accent,filter,master};
    return engineRef.current;
  };
  const scheduleTick=()=>{
    if(!playingRef.current)return;
    const m=mappingRef.current;
    if(!m?.steps.length){silence();return;}
    const e=engineRef.current;
    if(!e){silence();return;}
    const i=stepRef.current;
    const step=m.steps[i];
    const now=Tone.now();
    try{
      e.filter.frequency.setTargetAtTime(step.filterHz,now,.18);
      e.melody.triggerAttackRelease(step.note,Math.max(.16,step.durationMs/1000*.62),now);
      if(i%3===0 && harmonyRef.current){
        e.pad.releaseAll(now);
        e.pad.triggerAttackRelease(step.chord, Math.max(1.2,step.durationMs/1000*3.2),now);
        e.bass.triggerAttackRelease(step.bass,.65,now);
      }
      if(step.accent && i%2===0)e.accent.triggerAttackRelease('C2','16n',now);
    } catch(err){silence();setError(err instanceof Error?err.message:'Audio playback failed.');return;}
    setPosition(i);
    const next=i+1;
    if(next>=m.steps.length && !loopRef.current){
      timerRef.current=window.setTimeout(()=>silence(),step.durationMs+100);return;
    }
    stepRef.current=next%m.steps.length;
    timerRef.current=window.setTimeout(scheduleTick,step.durationMs);
  };
  const toggle=async()=>{
    if(playingRef.current){silence();return;}
    if(!mappingRef.current)return;
    setError(null);
    try{
      await Tone.start();
      if(playingRef.current)return;
      getEngine();playingRef.current=true;setPlaying(true);
      scheduleTick();
    }catch(err){silence();setError(err instanceof Error?err.message:'Browser audio could not start.');}
  };
  const jump=(i:number)=>{
    silence();stepRef.current=i;setPosition(i);
  };
  const upload=(files:FileList|null)=>{
    const f=files?.[0];if(!f)return;
    if(!f.type.startsWith('image/')){setError('Please select an image (JPG, PNG, WebP).');return;}
    silence();
    if(blobUrlRef.current)URL.revokeObjectURL(blobUrlRef.current);
    const url=URL.createObjectURL(f);blobUrlRef.current=url;
    setSource({title:f.name,src:url,origin:'uploaded'});
    if(fileRef.current)fileRef.current.value='';
  };
  const reset=()=>{silence();setSource(reference);};
  const active=mapping?.steps[position];
  return <div className="app-shell">
    <header className="top-bar"><div className="logo"><span className="logo-mark"><Waves size={18}/></span>AEVYRA <span className="tiny-separator"/><small>MUSICAL SONIFICATION LAB</small></div><div className="header-right"><span className="status-dot"/> BROWSER-GENERATED AUDIO <span className="top-number">POC 02</span></div></header>
    <main>
      <section className="intro"><div className="pill"><span className="small-dot"/> VISUAL FRAME → LIVING MUSIC</div><h1>Hear the colors.<br/><span>Explore the patterns.</span></h1><p>A single reference heatmap becomes a twelve-step musical journey. Canvas 2D extracts visual features; Tone.js transforms them into an evolving melody, warm chords and gentle accents.</p></section>
      <section className="main-layout">
        <div className="view-panel">
          <div className="panel-head"><div><span className="overline">01 — VISUAL INPUT</span><h2>Heatmap explorer</h2></div><span className="subtle-note">12 vertical regions</span></div>
          <div className="image-wrap heatmap-frame">
            <img src={source.src} alt="Reference world heatmap showing blue, cyan, yellow, orange and red regions"/>
            <div className="image-top-label"><span className="chip">{source.origin==='reference'?'USER-PROVIDED REFERENCE':'USER-UPLOADED IMAGE'}</span><span>REGION {String(position+1).padStart(2,'0')} / 12</span></div>
            <div className="scanner" style={{left:`${position/12*100}%`,width:`${100/12}%`}} aria-hidden="true"/>
          </div>
          <div className="region-label"><span>← WEST</span><span>SCAN DIRECTION</span><span>EAST →</span></div>
          <div className="strip-selector" aria-label="Choose a scan region">{Array.from({length:12},(_,i)=><button key={i} title={`Region ${i+1}`} aria-label={`Select region ${i+1}`} aria-pressed={position===i} className={position===i?'selected':''} onClick={()=>jump(i)}>{i+1}</button>)}</div>
          <div className="upload-row"><button className="secondary-btn" onClick={()=>fileRef.current?.click()}><ImagePlus size={17}/> Try another image</button><button className="text-btn" onClick={reset}><RotateCcw size={16}/> Reset heatmap</button><input ref={fileRef} type="file" accept="image/*" hidden onChange={e=>upload(e.target.files)}/></div>
          <p className="micro-disclaimer">This uploaded reference is not yet verified as a NASA EIC source. Colors are analyzed as visual properties only—not calibrated temperatures.</p>
        </div>
        <aside className="sound-panel">
          <div className="panel-head"><div><span className="overline">02 — MUSIC ENGINE</span><h2>Ambient Earth</h2></div><AudioLines size={23} className="accent"/></div>
          <div className="sound-body">
            <div className="status-line"><span className={`play-indicator ${playing?'on':''}`}/>{loading?'READING PIXELS':playing?'GENERATING LIVE MUSIC':'READY TO LISTEN'}<span className="engine-tag">TONE.JS</span></div>
            <div className="visualizer"><div className={playing?'bars animated':'bars'}>{Array.from({length:27},(_,i)=><span key={i} style={{height:`${16+Math.abs(Math.sin(i*1.6)*Math.cos(i*.41))*76}%`,animationDelay:`${-i*.05}s`}}/>)}</div></div>
            <button className="primary-btn" disabled={loading||!mapping} onClick={()=>void toggle()}>{playing?<Pause size={19} fill="currentColor"/>:<Play size={19} fill="currentColor"/>}{playing?'Pause the soundscape':'Play ambient soundscape'}</button>
            <div className="volume-row"><Volume2 size={17}/><label htmlFor="volume">Volume</label><input id="volume" type="range" min="0" max="100" value={volume} onChange={e=>setVolume(Number(e.target.value))}/><span>{volume}%</span></div>
            <div className="audio-options"><label><input type="checkbox" checked={harmony} onChange={e=>setHarmony(e.target.checked)}/> Chords + bass</label><label><input type="checkbox" checked={loops} onChange={e=>setLoops(e.target.checked)}/> Loop the image</label></div>
            <div className="stats-title">EXTRACTED FEATURES — ENTIRE IMAGE</div>
            <div className="stats-grid"><div><span>Warm-colored pixels</span><strong>{features?pct(features.warmth):'—'}</strong></div><div><span>Cool-colored pixels</span><strong>{features?pct(features.coolness):'—'}</strong></div><div><span>Mean brightness</span><strong>{features?pct(features.brightness):'—'}</strong></div><div><span>Visual contrast</span><strong>{features?pct(features.contrast):'—'}</strong></div></div>
            <div className="mapping-preview"><div className="mapping-head">GENERATED MELODY <span>{active?.durationMs??'—'} MS / STEP</span></div><div className="notes twelve">{mapping?.steps.map((s,i)=><span key={i} className={position===i?'current':''}>{s.note}</span>)??'—'}</div></div>
            <div className="current-layer"><span>CHORD</span><strong>{active?.chord.join(' · ')??'—'}</strong><span>FILTER</span><strong>{active?.filterHz??'—'} Hz</strong></div>
            {error&&<div role="alert" className="error"><CircleAlert size={17}/>{error}</div>}
          </div>
        </aside>
      </section>
      <section className="explain"><div><div className="overline">03 — INTERPRETATION</div><h2>How does an image become music?</h2><p>The image is divided into 12 vertical strips. Each strip controls one melodic note in a <strong>C major pentatonic scale</strong>. Three-note chords change every three steps, bass supports the harmony, and a quiet rhythmic accent responds to contrast between neighboring regions.</p><button className="learn-link" onClick={()=>setMethod(!method)} aria-expanded={method}><BookOpen size={17}/>{method?'Hide the mapping rules':'See exact mapping rules'} <ChevronRight size={16}/></button></div><div className="pipeline"><div><span>01</span><strong>Image pixels</strong><small>Canvas 2D</small></div><ChevronRight/><div><span>02</span><strong>12 regions</strong><small>Hue + luminance</small></div><ChevronRight/><div><span>03</span><strong>Musical rules</strong><small>Notes + chords</small></div><ChevronRight/><div><span>04</span><strong>Live sound</strong><small>Tone.js</small></div></div></section>
      {method&&<section className="method"><h3>Actual mapping implemented in this POC</h3><div className="method-grid"><div><h4>Melody</h4><p>Analyze each strip's mean brightness, warm-pixel fraction and visual contrast. Convert their weighted score (55% / 35% / 10%) to one of nine notes from C major pentatonic.</p></div><div><h4>Harmony</h4><p>Cycle C, Am, F and G chord groups every three strips. The progression is a fixed artistic structure; the frame-derived melody and filter are the data-linked parts.</p></div><div><h4>Motion & accents</h4><p>Neighboring-strip differences affect note duration (roughly 355–510 ms). Sufficiently large differences trigger a quiet percussion-like accent. Warmth affects the filter cutoff.</p></div></div><div className="method-note"><Info size={18}/> An attractive composition does not prove scientific accuracy. For official submission, replace this test image with verified EIC frames, document the map legend, and ensure the mapping matches the scientific meaning.</div></section>}
      <footer><div className="footer-brand">AEVYRA <span>—</span> HEAR THE EARTH. FEEL THE CHANGE.</div><div className="footer-right">TECHNICAL POC <span>·</span> NO DATABASE <span>·</span> NO PYTHON REQUIRED</div></footer>
    </main>
  </div>;
}
