import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

interface LightPillarProps {
  topColor?: string;
  bottomColor?: string;
  intensity?: number;
  rotationSpeed?: number;
  interactive?: boolean;
  className?: string;
  glowAmount?: number;
  pillarWidth?: number;
  pillarHeight?: number;
  noiseIntensity?: number;
  mixBlendMode?: React.CSSProperties['mixBlendMode'];
  pillarRotation?: number;
  quality?: 'low' | 'medium' | 'high';
}

const LightPillar: React.FC<LightPillarProps> = ({
  topColor = '#5227FF',
  bottomColor = '#FF9FFC',
  intensity = 1.0,
  rotationSpeed = 0.3,
  interactive = false,
  className = '',
  glowAmount = 0.005,
  pillarWidth = 3.0,
  pillarHeight = 0.4,
  noiseIntensity = 0.5,
  mixBlendMode = 'screen',
  pillarRotation = 0,
  quality = 'high',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const geometryRef = useRef<THREE.PlaneGeometry | null>(null);
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2(0, 0));
  const timeRef = useRef<number>(0);
  const [webGLSupported, setWebGLSupported] = useState<boolean>(true);

  useEffect(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) setWebGLSupported(false);
  }, []);

  useEffect(() => {
    if (!containerRef.current || !webGLSupported) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isLowEnd = isMobile || (navigator.hardwareConcurrency != null && navigator.hardwareConcurrency <= 4);

    let effectiveQuality = quality;
    if (isLowEnd && quality === 'high') effectiveQuality = 'medium';
    if (isMobile && quality !== 'low') effectiveQuality = 'low';

    const qMap = {
      low:    { iter: 24, wave: 1, pr: 0.5,  step: 1.5 },
      medium: { iter: 40, wave: 2, pr: 0.65, step: 1.2 },
      high:   { iter: 80, wave: 4, pr: Math.min(window.devicePixelRatio, 2), step: 1.0 },
    };
    const q = qMap[effectiveQuality] ?? qMap.medium;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    cameraRef.current = camera;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: effectiveQuality === 'low' ? 'low-power' : 'high-performance', stencil: false, depth: false });
    } catch {
      setWebGLSupported(false);
      return;
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(q.pr);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const toVec3 = (hex: string) => { const c = new THREE.Color(hex); return new THREE.Vector3(c.r, c.g, c.b); };

    const vs = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position,1.0); }';

    const fs = `
      uniform float uTime; uniform vec2 uResolution; uniform vec2 uMouse;
      uniform vec3 uTopColor; uniform vec3 uBottomColor;
      uniform float uIntensity; uniform bool uInteractive;
      uniform float uGlowAmount; uniform float uPillarWidth; uniform float uPillarHeight; uniform float uNoiseIntensity;
      uniform float uRotCos; uniform float uRotSin; uniform float uPillarRotCos; uniform float uPillarRotSin;
      uniform float uWaveSin[4]; uniform float uWaveCos[4];
      varying vec2 vUv;
      const float PI=3.141592653589793; const float EPS=0.001; const float E=2.71828182845904523536;
      float noise(vec2 c){ vec2 r=E*sin(E*c); return fract(r.x*r.y*(1.0+c.x)); }
      void main(){
        vec2 fc=vUv*uResolution; vec2 uv=(fc*2.0-uResolution)/uResolution.y;
        uv=vec2(uv.x*uPillarRotCos-uv.y*uPillarRotSin, uv.x*uPillarRotSin+uv.y*uPillarRotCos);
        vec3 ori=vec3(0,0,-10); vec3 dir=normalize(vec3(uv,1));
        float maxD=50.0; float dep=0.1;
        float rc=uRotCos; float rs=uRotSin;
        if(uInteractive&&length(uMouse)>0.0){ float ma=uMouse.x*PI*2.0; rc=cos(ma); rs=sin(ma); }
        vec3 col=vec3(0);
        const int IT=${q.iter}; const int WI=${q.wave}; const float SM=${q.step.toFixed(1)};
        for(int i=0;i<IT;i++){
          vec3 p=ori+dir*dep;
          float nx=p.x*rc-p.z*rs; float nz=p.x*rs+p.z*rc; p.x=nx; p.z=nz;
          vec3 d=p; d.y*=uPillarHeight; d+=vec3(0,uTime,0);
          float freq=1.0; float amp=1.0;
          for(int j=0;j<WI;j++){
            float wx=d.x*uWaveCos[j]-d.z*uWaveSin[j]; float wz=d.x*uWaveSin[j]+d.z*uWaveCos[j];
            d.x=wx; d.z=wz;
            float ph=uTime*float(j)*2.0; vec3 osc=cos(d.zxy*freq-ph); d+=osc*amp;
            freq*=2.0; amp*=0.5;
          }
          vec2 cp=cos(d.xz); float fd=length(cp)-0.2;
          float rb=length(p.xz)-uPillarWidth; float k=4.0;
          float h=max(k-abs(-rb-(-fd)),0.0);
          fd=-(min(-rb,-fd)-h*h*0.25/k);
          fd=abs(fd)*0.15+0.01;
          vec3 gr=mix(uBottomColor,uTopColor,smoothstep(15.0,-15.0,p.y));
          col+=gr/fd;
          if(fd<EPS||dep>maxD) break;
          dep+=fd*SM;
        }
        float wn=uPillarWidth/3.0; col=tanh(col*uGlowAmount/wn);
        float rn=noise(gl_FragCoord.xy); col-=rn/15.0*uNoiseIntensity;
        gl_FragColor=vec4(col*uIntensity,1.0);
      }
    `;

    const wa = 0.4;
    const wSin = new Float32Array(4);
    const wCos = new Float32Array(4);
    for (let i = 0; i < 4; i++) { wSin[i] = Math.sin(wa); wCos[i] = Math.cos(wa); }

    const prRad = (pillarRotation * Math.PI) / 180;

    const material = new THREE.ShaderMaterial({
      vertexShader: vs, fragmentShader: fs,
      uniforms: {
        uTime: { value: 0 }, uResolution: { value: new THREE.Vector2(width, height) },
        uMouse: { value: mouseRef.current },
        uTopColor: { value: toVec3(topColor) }, uBottomColor: { value: toVec3(bottomColor) },
        uIntensity: { value: intensity }, uInteractive: { value: interactive },
        uGlowAmount: { value: glowAmount }, uPillarWidth: { value: pillarWidth },
        uPillarHeight: { value: pillarHeight }, uNoiseIntensity: { value: noiseIntensity },
        uRotCos: { value: 1 }, uRotSin: { value: 0 },
        uPillarRotCos: { value: Math.cos(prRad) }, uPillarRotSin: { value: Math.sin(prRad) },
        uWaveSin: { value: wSin }, uWaveCos: { value: wCos },
      },
      transparent: true, depthWrite: false, depthTest: false,
    });
    materialRef.current = material;

    const geo = new THREE.PlaneGeometry(2, 2);
    geometryRef.current = geo;
    scene.add(new THREE.Mesh(geo, material));

    let mmTimeout: number | null = null;
    const onMM = (ev: MouseEvent) => {
      if (!interactive || mmTimeout) return;
      mmTimeout = window.setTimeout(() => { mmTimeout = null; }, 16);
      const r = container.getBoundingClientRect();
      mouseRef.current.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    };
    if (interactive) container.addEventListener('mousemove', onMM, { passive: true });

    let last = performance.now();
    const fps = effectiveQuality === 'low' ? 30 : 60;
    const ft = 1000 / fps;

    const loop = (now: number) => {
      if (!materialRef.current || !rendererRef.current || !sceneRef.current || !cameraRef.current) return;
      const dt = now - last;
      if (dt >= ft) {
        timeRef.current += 0.016 * rotationSpeed;
        materialRef.current.uniforms.uTime.value = timeRef.current;
        const ra = timeRef.current * 0.3;
        materialRef.current.uniforms.uRotCos.value = Math.cos(ra);
        materialRef.current.uniforms.uRotSin.value = Math.sin(ra);
        rendererRef.current.render(sceneRef.current, cameraRef.current);
        last = now - (dt % ft);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    let rto: number | null = null;
    const onResize = () => {
      if (rto) clearTimeout(rto);
      rto = window.setTimeout(() => {
        if (!rendererRef.current || !materialRef.current || !containerRef.current) return;
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        rendererRef.current.setSize(w, h);
        materialRef.current.uniforms.uResolution.value.set(w, h);
      }, 150);
    };
    window.addEventListener('resize', onResize, { passive: true });

    return () => {
      window.removeEventListener('resize', onResize);
      if (interactive) container.removeEventListener('mousemove', onMM);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current.forceContextLoss();
        if (container.contains(rendererRef.current.domElement)) container.removeChild(rendererRef.current.domElement);
      }
      materialRef.current?.dispose();
      geometryRef.current?.dispose();
      rendererRef.current = null;
      materialRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      geometryRef.current = null;
      rafRef.current = null;
    };
  }, [topColor, bottomColor, intensity, rotationSpeed, interactive, glowAmount, pillarWidth, pillarHeight, noiseIntensity, pillarRotation, webGLSupported, quality]);

  if (!webGLSupported) {
    return (
      <div className={`w-full h-full absolute top-0 left-0 bg-black/10 ${className}`} style={{ mixBlendMode }} />
    );
  }

  return <div ref={containerRef} className={`w-full h-full absolute top-0 left-0 ${className}`} style={{ mixBlendMode }} />;
};

export default LightPillar;
