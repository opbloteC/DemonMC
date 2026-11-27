"use client";

import { useEffect, useRef } from "react";

const VERTEX_SHADER = `attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform vec2 u_texSize;
uniform vec2 u_posDay;
uniform vec2 u_posNight;
uniform float u_time;
uniform float u_night;
uniform float u_nightGrade;
uniform float u_rain;
uniform float u_lite;
uniform float u_flash;
uniform float u_flashX;
uniform vec4 u_fallsDay[8];
uniform vec4 u_fallsNight[8];
uniform sampler2D u_dayTex;
uniform sampler2D u_nightTex;

// object-fit: cover + object-position, matching the CSS layers exactly.
vec2 imageUv(vec2 frag, vec2 pos) {
  float cover = max(u_resolution.x / u_texSize.x, u_resolution.y / u_texSize.y);
  vec2 drawn = u_texSize * cover;
  vec2 offset = (u_resolution - drawn) * pos;
  return vec2(
    (frag.x - offset.x) / drawn.x,
    (u_resolution.y - frag.y - offset.y) / drawn.y
  );
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Downward-flowing white-water streaks inside a painted waterfall.
float fallWater(vec2 uv, vec4 f) {
  float w = max(f.y - f.x, 0.0001);
  float h = max(f.w - f.z, 0.0001);
  float fx = (uv.x - f.x) / w;
  float fy = (uv.y - f.z) / h;
  float inside = step(0.0, fx) * step(fx, 1.0) * step(0.0, fy) * step(fy, 1.0);
  float edges = smoothstep(0.0, 0.26, fx) * (1.0 - smoothstep(0.74, 1.0, fx));
  float ends = smoothstep(0.0, 0.1, fy) * (1.0 - smoothstep(0.84, 1.0, fy));
  float scroll = fy * h * 104.0 - u_time * 1.55 + f.x * 37.0;
  float n = vnoise(vec2(fx * 21.0, scroll));
  float n2 = vnoise(vec2(fx * 47.0 + 11.0, scroll * 1.9 + 5.0));
  float lanes = 0.5 + 0.5 * sin(fx * 23.0 + f.x * 31.0 + scroll * 0.4);
  float streak = smoothstep(0.4, 0.78, n * 0.54 + n2 * 0.34 + lanes * 0.12);
  return inside * edges * ends * streak;
}

// Foam where the fall meets the clouds or rock below.
float fallSplash(vec2 uv, vec4 f) {
  vec2 d = vec2((uv.x - (f.x + f.y) * 0.5) * 2.8, (uv.y - f.w) * 0.85);
  return exp(-dot(d, d) / 0.0016);
}

// Gentle ripples on the pool each waterfall starts from.
float poolRipple(vec2 uv, vec4 f) {
  vec2 rel = vec2(
    (uv.x - (f.x + f.y) * 0.5) / max((f.y - f.x) * 1.8, 0.02),
    (uv.y - f.z - (f.w - f.z) * 0.01) / 0.013
  );
  float mask = exp(-dot(rel, rel) * 1.7);
  float rings = 0.5 + 0.5 * sin(rel.x * 9.0 - u_time * 1.35 + sin(rel.y * 5.0 + u_time * 0.7) * 1.6);
  return mask * rings * rings;
}

void main() {
  vec2 dayUv = imageUv(gl_FragCoord.xy, u_posDay);
  vec2 nightUv = imageUv(gl_FragCoord.xy, u_posNight);

  // The artwork itself never moves; only the water is animated.
  vec3 day = texture2D(u_dayTex, dayUv).rgb;
  vec3 night = texture2D(u_nightTex, nightUv).rgb;
  vec3 color = mix(day, night, u_night);

  vec2 waterUv = mix(dayUv, nightUv, u_night);
  float water = 0.0;
  float splash = 0.0;
  float pools = 0.0;
  for (int i = 0; i < 8; i++) {
    vec4 f = mix(u_fallsDay[i], u_fallsNight[i], u_night);
    if (f.z > 1.0) continue;
    water += fallWater(waterUv, f);
    splash += fallSplash(waterUv, f);
    pools += poolRipple(waterUv, f);
  }
  water = min(water, 1.0);
  splash = min(splash, 1.5);
  pools = min(pools, 1.0);

  // If the night art failed to load, grade the day art darker so dark and
  // rainy themes can never fall back to a bright daylight background.
  color = mix(color, color * vec3(0.2, 0.3, 0.55) + vec3(0.01, 0.015, 0.045), u_nightGrade);

  float flash = clamp(u_flash, 0.0, 1.0);
  vec3 waterTint = mix(vec3(0.7, 0.88, 1.0), vec3(0.36, 0.58, 0.92), u_night);
  waterTint = mix(waterTint, vec3(0.62, 0.72, 0.82), u_rain * 0.7);
  float strength = mix(0.2, 0.26, u_night) * (1.0 + u_rain * 0.25) * (1.0 - u_lite * 0.35);
  color += waterTint * water * strength;
  color += vec3(0.86, 0.93, 1.0) * (splash * 0.065 + pools * 0.07) * (1.0 - u_lite * 0.4);
  color += waterTint * (water + splash * 0.5 + pools * 0.5) * flash * 0.28;

  // Lightning spills onto the islands and clouds from the storm center.
  float proximity = exp(-pow((dayUv.x - u_flashX) * 2.2, 2.0));
  color += vec3(0.64, 0.74, 0.94) * flash * (0.07 + 0.15 * proximity) * (0.5 + 0.5 * u_night);

  gl_FragColor = vec4(color, 1.0);
}`;

// x0, x1, y0, y1 in image coordinates. Daylight and night art are framed
// differently, so each keeps its own waterfall rectangles.
const FALLS_DAY: Array<[number, number, number, number]> = [
  [0.126, 0.165, 0.245, 0.56],
  [0.186, 0.222, 0.79, 0.935],
  [0.205, 0.224, 0.535, 0.655],
  [0.925, 0.962, 0.365, 0.67],
  [0.718, 0.742, 0.59, 0.78],
  [0.862, 0.895, 0.785, 0.935],
  [2, 2, 2, 2],
  [2, 2, 2, 2],
];

const FALLS_NIGHT: Array<[number, number, number, number]> = [
  [0.115, 0.15, 0.235, 0.42],
  [0.205, 0.225, 0.27, 0.36],
  [0.195, 0.225, 0.46, 0.555],
  [0.355, 0.372, 0.63, 0.72],
  [0.885, 0.918, 0.375, 0.61],
  [0.727, 0.747, 0.6, 0.7],
  [0.875, 0.905, 0.855, 0.97],
  [0.195, 0.225, 0.78, 0.87],
];

const FRAME_INTERVAL_MS = 1000 / 30;
const MAX_PIXELS = 1_100_000;
const MIN_QUALITY = 0.55;
const THEME_FADE_MS = 520;

let sharedGl: WebGLRenderingContext | null | undefined;

function getContext(canvas: HTMLCanvasElement): WebGLRenderingContext | null {
  if (sharedGl !== undefined) return sharedGl;
  const options: WebGLContextAttributes = {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    powerPreference: "low-power",
  };
  try {
    sharedGl =
      (canvas.getContext("webgl", options) as WebGLRenderingContext | null) ??
      (canvas.getContext("experimental-webgl", options) as WebGLRenderingContext | null);
  } catch {
    sharedGl = null;
  }
  return sharedGl;
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

type Flash = {
  start: number;
  peak: number;
  echoDelay: number;
  echoStrength: number;
  center: number;
};

export function LivingSky() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motionQuery.matches) return;

    const gl = getContext(canvas);
    if (!gl) return;

    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!vs || !fs || !program) {
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
      return;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return;
    }
    gl.useProgram(program);
    gl.disable(gl.BLEND);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const U = {
      resolution: gl.getUniformLocation(program, "u_resolution"),
      texSize: gl.getUniformLocation(program, "u_texSize"),
      posDay: gl.getUniformLocation(program, "u_posDay"),
      posNight: gl.getUniformLocation(program, "u_posNight"),
      time: gl.getUniformLocation(program, "u_time"),
      night: gl.getUniformLocation(program, "u_night"),
      nightGrade: gl.getUniformLocation(program, "u_nightGrade"),
      rain: gl.getUniformLocation(program, "u_rain"),
      lite: gl.getUniformLocation(program, "u_lite"),
      flash: gl.getUniformLocation(program, "u_flash"),
      flashX: gl.getUniformLocation(program, "u_flashX"),
      fallsDay: gl.getUniformLocation(program, "u_fallsDay[0]"),
      fallsNight: gl.getUniformLocation(program, "u_fallsNight[0]"),
    };
    gl.uniform4fv(U.fallsDay, new Float32Array(FALLS_DAY.flat()));
    gl.uniform4fv(U.fallsNight, new Float32Array(FALLS_NIGHT.flat()));
    gl.uniform1i(gl.getUniformLocation(program, "u_dayTex"), 0);
    gl.uniform1i(gl.getUniformLocation(program, "u_nightTex"), 1);

    function makeTexture() {
      const texture = gl!.createTexture();
      gl!.bindTexture(gl!.TEXTURE_2D, texture);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
      return texture;
    }
    const dayTexture = makeTexture();
    const nightTexture = makeTexture();
    let texSize = { width: 1792, height: 1024 };
    let dayReady = false;
    let nightReady = false;
    let nightFallback = false;

    const dayImage = new Image();
    const nightImage = new Image();
    let uploadedDay = false;
    let uploadedNight = false;

    function upload() {
      if (dayReady && !uploadedDay) {
        gl!.activeTexture(gl!.TEXTURE0);
        gl!.bindTexture(gl!.TEXTURE_2D, dayTexture);
        gl!.pixelStorei(gl!.UNPACK_FLIP_Y_WEBGL, false);
        gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, dayImage);
        gl!.uniform2f(U.texSize, texSize.width, texSize.height);
        uploadedDay = true;
      }
      if (nightReady && !uploadedNight) {
        gl!.activeTexture(gl!.TEXTURE1);
        gl!.bindTexture(gl!.TEXTURE_2D, nightTexture);
        gl!.pixelStorei(gl!.UNPACK_FLIP_Y_WEBGL, false);
        gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, nightImage);
        uploadedNight = true;
      }
      if (uploadedDay && (uploadedNight || nightFallback)) start();
    }

    let running = false;
    let inView = true;
    let frameId = 0;
    let lastFrame = 0;
    let elapsed = 0;
    const initialRain = document.documentElement.getAttribute("data-weather") === "rainy";
    let themeValue =
      document.documentElement.getAttribute("data-theme") === "dark" || initialRain ? 1 : 0;
    let nightFrom = themeValue;
    let nightTarget = themeValue;
    let rainValue = initialRain ? 1 : 0;
    let rainFrom = rainValue;
    let rainTarget = rainValue;
    let themeStart = 0;
    let transitioning = false;
    let announced = false;
    let qualityScale = 1;
    let slowFrames = 0;
    let averageFrameMs = 0;
    let resizeTimer = 0;
    let flash: Flash | null = null;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const mobile = window.innerWidth < 768;
      let width = Math.round(window.innerWidth * dpr * (mobile ? 0.7 : 0.85) * qualityScale);
      let height = Math.round(window.innerHeight * dpr * (mobile ? 0.7 : 0.85) * qualityScale);
      if (width * height > MAX_PIXELS) {
        const scale = Math.sqrt(MAX_PIXELS / (width * height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      width = Math.max(2, width);
      height = Math.max(2, height);
      if (width === canvas!.width && height === canvas!.height) return;
      canvas!.width = width;
      canvas!.height = height;
      gl!.viewport(0, 0, width, height);
      gl!.uniform2f(U.resolution, width, height);
      gl!.uniform1f(U.lite, mobile ? 1 : 0);
      const narrow = window.innerWidth <= 640;
      gl!.uniform2f(U.posDay, narrow ? 0.56 : 0.5, narrow ? 0.34 : 0.38);
      gl!.uniform2f(U.posNight, narrow ? 0.84 : 0.76, narrow ? 0.2 : 0.22);
    }

    function flashAmount(now: number) {
      if (!flash) return 0;
      const local = (now - flash.start) / 1000;
      if (local >= 1.05) {
        flash = null;
        return 0;
      }
      const primary = Math.exp(-local * 7.5) * flash.peak;
      const echo =
        Math.exp(-Math.pow((local - flash.echoDelay) / 0.055, 2)) * flash.echoStrength;
      const afterglow = Math.exp(-Math.max(0, local - 0.22) * 3.2) * flash.peak * 0.08;
      return Math.min(0.86, primary + echo + afterglow);
    }

    function paint(now: number, delta: number) {
      elapsed += delta;
      if (transitioning) {
        const progress = Math.min(1, Math.max(0, (now - themeStart) / THEME_FADE_MS));
        const eased = progress * progress * (3 - 2 * progress);
        themeValue = nightFrom + (nightTarget - nightFrom) * eased;
        rainValue = rainFrom + (rainTarget - rainFrom) * eased;
        if (progress >= 1) {
          themeValue = nightTarget;
          rainValue = rainTarget;
          transitioning = false;
        }
      }
      gl!.uniform1f(U.time, elapsed);
      gl!.uniform1f(U.night, nightFallback ? 0 : themeValue);
      gl!.uniform1f(U.nightGrade, nightFallback ? themeValue : 0);
      gl!.uniform1f(U.rain, rainValue);
      gl!.uniform1f(U.flash, flashAmount(now));
      gl!.uniform1f(U.flashX, flash ? flash.center : 0.5);
      gl!.activeTexture(gl!.TEXTURE0);
      gl!.bindTexture(gl!.TEXTURE_2D, dayTexture);
      gl!.activeTexture(gl!.TEXTURE1);
      gl!.bindTexture(gl!.TEXTURE_2D, nightTexture);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
      if (!announced) {
        announced = true;
        document.documentElement.setAttribute("data-sky", "webgl");
      }
    }

    function frame(now: number) {
      if (!running) return;
      if (document.hidden) {
        lastFrame = now;
        frameId = requestAnimationFrame(frame);
        return;
      }
      if (lastFrame !== 0 && now - lastFrame < FRAME_INTERVAL_MS - 0.75) {
        frameId = requestAnimationFrame(frame);
        return;
      }
      const frameMs = lastFrame === 0 ? 0 : now - lastFrame;
      const delta = lastFrame === 0 ? 0 : Math.min(frameMs / 1000, 0.12);
      lastFrame = now;
      paint(now, delta);
      if (frameMs > 0) averageFrameMs += (frameMs - averageFrameMs) * 0.08;
      if (averageFrameMs > 46) slowFrames += 1;
      else slowFrames = Math.max(0, slowFrames - 1);
      if (slowFrames >= 20 && qualityScale > MIN_QUALITY) {
        qualityScale = Math.max(MIN_QUALITY, qualityScale * 0.82);
        averageFrameMs = 0;
        slowFrames = 0;
        resize();
      }
      frameId = requestAnimationFrame(frame);
    }

    function start() {
      if (running || !uploadedDay || !(uploadedNight || nightFallback)) return;
      if (motionQuery.matches) return;
      running = true;
      lastFrame = 0;
      frameId = requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      cancelAnimationFrame(frameId);
    }

    function syncRunning() {
      if (inView && !document.hidden && !motionQuery.matches) start();
      else stop();
    }

    function onThemeChange() {
      const dark = document.documentElement.getAttribute("data-theme") === "dark";
      const rainy = document.documentElement.getAttribute("data-weather") === "rainy";
      const nextNight = dark || rainy ? 1 : 0;
      const nextRain = rainy ? 1 : 0;
      if (nextNight === nightTarget && nextRain === rainTarget) return;
      nightFrom = themeValue;
      rainFrom = rainValue;
      nightTarget = nextNight;
      rainTarget = nextRain;
      themeStart = performance.now();
      transitioning = true;
      flash = null;
    }

    function onMotionChange() {
      if (motionQuery.matches) stop();
      else syncRunning();
    }

    function onVisibilityChange() {
      syncRunning();
    }

    function onResize() {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, 120);
    }

    function onLightning(event: Event) {
      const detail = (event as CustomEvent).detail as Partial<Flash> | undefined;
      flash = {
        start: performance.now(),
        peak: typeof detail?.peak === "number" ? detail.peak : 0.6,
        echoDelay: typeof detail?.echoDelay === "number" ? detail.echoDelay : 0.17,
        echoStrength: typeof detail?.echoStrength === "number" ? detail.echoStrength : 0.14,
        center: typeof detail?.center === "number" ? detail.center : 0.5,
      };
    }

    function onContextLost(event: Event) {
      event.preventDefault();
      stop();
      document.documentElement.removeAttribute("data-sky");
    }

    const observer = new MutationObserver(onThemeChange);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-weather"],
    });
    const resizeObserver = "ResizeObserver" in window ? new ResizeObserver(onResize) : null;
    resizeObserver?.observe(canvas);
    const intersectionObserver =
      "IntersectionObserver" in window
        ? new IntersectionObserver(
            (entries) => {
              inView = entries[0]?.isIntersecting ?? true;
              syncRunning();
            },
            { rootMargin: "80px 0px" },
          )
        : null;
    intersectionObserver?.observe(canvas);

    window.addEventListener("resize", onResize);
    window.addEventListener("demonmc:lightning", onLightning);
    document.addEventListener("visibilitychange", onVisibilityChange);
    motionQuery.addEventListener("change", onMotionChange);
    canvas.addEventListener("webglcontextlost", onContextLost);

    resize();

    dayImage.onload = () => {
      texSize = {
        width: dayImage.naturalWidth || 1792,
        height: dayImage.naturalHeight || 1024,
      };
      dayReady = true;
      upload();
    };
    nightImage.onload = () => {
      nightReady = true;
      upload();
    };
    nightImage.onerror = () => {
      nightFallback = true;
      upload();
    };
    dayImage.src = "/images/sky-islands.webp";
    nightImage.src = "/images/sky-islands-night.webp";

    return () => {
      dayImage.onload = null;
      nightImage.onload = null;
      nightImage.onerror = null;
      stop();
      window.clearTimeout(resizeTimer);
      observer.disconnect();
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("demonmc:lightning", onLightning);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      motionQuery.removeEventListener("change", onMotionChange);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      document.documentElement.removeAttribute("data-sky");
      gl.deleteTexture(dayTexture);
      gl.deleteTexture(nightTexture);
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
    };
  }, []);

  return (
    <canvas ref={canvasRef} className="site-sky-canvas" data-parallax aria-hidden="true" />
  );
}
