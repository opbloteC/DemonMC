"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

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
uniform float u_time;
uniform float u_theme;
uniform float u_rain;
uniform float u_wind;
uniform float u_lightning;
uniform float u_lightningCenter;
uniform float u_lightningSpread;
uniform float u_lightningSeed;

uniform sampler2D u_cloudAtlas;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float rainLayer(vec2 uv, float aspect, float scale, float speed, float wind, float seed, float opacity) {
  vec2 p = vec2(uv.x * aspect, uv.y);
  float gust = sin(u_time * 0.38 + seed * 1.7) * 0.045 + sin(u_time * 0.17 + seed * 0.83) * 0.025;
  vec2 grid = (p + vec2(u_time * (wind + gust) * u_wind + seed, u_time * speed + seed * 0.37)) * vec2(scale, scale * 1.35);
  vec2 cell = floor(grid);
  vec2 local = fract(grid);
  float random = hash(cell + vec2(seed, seed * 1.91));
  float active = step(0.76, random);
  float center = 0.12 + hash(cell + seed * 2.17) * 0.76;
  float width = mix(0.012, 0.025, hash(cell + seed * 3.11));
  float length = mix(0.3, 0.82, hash(cell + seed * 4.07));
  float slant = (local.y - 0.5) * mix(0.1, 0.24, hash(cell + seed * 5.23)) + gust * 1.4;
  float distanceToDrop = abs(local.x - center + slant);
  float core = 1.0 - smoothstep(width, width + 0.007, distanceToDrop);
  float halo = (1.0 - smoothstep(width + 0.007, width + 0.024, distanceToDrop)) * 0.28;
  float head = smoothstep(0.03, 0.1, local.y);
  float tail = 1.0 - smoothstep(length, length + 0.09, local.y);
  float strength = mix(0.62, 1.0, hash(cell + seed * 6.19));
  return active * (core + halo) * head * tail * opacity * strength;
}

float lightningBolt(vec2 p, float strikeX) {
  float segment = floor(p.y * 34.0);
  float jitter = (hash(vec2(segment, u_lightningSeed)) - 0.5) * 0.055;
  float fineJitter = (hash(vec2(segment * 1.7, u_lightningSeed * 2.3)) - 0.5) * 0.018;
  float path = strikeX + jitter + fineJitter + sin(p.y * 11.0 + u_lightningSeed) * 0.006;
  float distanceToBolt = abs(p.x - path);
  float core = 1.0 - smoothstep(0.0015, 0.0045, distanceToBolt);
  float halo = 1.0 - smoothstep(0.0045, 0.016, distanceToBolt);
  float branchY = 0.26 + fract(u_lightningSeed * 0.37) * 0.3;
  float branchGate = smoothstep(branchY, branchY + 0.02, p.y) * (1.0 - smoothstep(branchY + 0.14, branchY + 0.18, p.y));
  float branchPath = strikeX + 0.025 + (p.y - branchY) * 0.22;
  float branchDistance = abs(p.x - branchPath);
  float branch = (1.0 - smoothstep(0.0015, 0.004, branchDistance)) * branchGate * 0.38;
  float gate = smoothstep(0.1, 0.22, p.y) * (1.0 - smoothstep(0.74, 0.9, p.y));
  float pulse = smoothstep(0.06, 0.26, u_lightning);
  return (core * 0.82 + halo * 0.22 + branch) * gate * pulse;
}

vec4 cloudLayer(vec2 p, float strikeX, vec2 spacing, float speed, vec2 offset, float seed, float occupancy, float opacity, float size) {
  vec2 grid = (p + offset + vec2(u_time * speed * u_wind, 0.0)) / spacing;
  vec2 cell = floor(grid);
  float cloudId = hash(cell + vec2(seed, seed * 1.37));
  if (cloudId > occupancy) return vec4(0.0);
  vec2 local = (fract(grid) - 0.5) * spacing;
  vec2 spriteUv = local / (vec2(1.0, 0.6666667) * size) + 0.5;
  if (any(lessThan(spriteUv, vec2(0.0))) || any(greaterThan(spriteUv, vec2(1.0)))) return vec4(0.0);
  float sprite = floor(hash(cell + seed * 3.7) * 4.0);
  vec2 tile = vec2(mod(sprite, 2.0), floor(sprite / 2.0));
  vec2 atlasUv = (tile + spriteUv) * 0.5;
  vec4 sampleColor = texture2D(u_cloudAtlas, atlasUv);
  vec2 texel = vec2(1.0 / 1536.0, 1.0 / 1024.0) * 2.0;
  float outsideAlpha = min(
    min(texture2D(u_cloudAtlas, atlasUv - vec2(texel.x, 0.0)).a, texture2D(u_cloudAtlas, atlasUv + vec2(texel.x, 0.0)).a),
    min(texture2D(u_cloudAtlas, atlasUv - vec2(0.0, texel.y)).a, texture2D(u_cloudAtlas, atlasUv + vec2(0.0, texel.y)).a)
  );
  float alpha = sampleColor.a * opacity;
  float rim = smoothstep(0.025, 0.14, sampleColor.a - outsideAlpha);
  float softEdge = smoothstep(0.02, 0.16, sampleColor.a) * (1.0 - smoothstep(0.62, 0.96, sampleColor.a));
  float edge = max(rim, softEdge * 0.65);
  float outlineShade = smoothstep(0.01, 0.07, sampleColor.a) * (1.0 - smoothstep(0.16, 0.46, sampleColor.a));
  float luma = dot(sampleColor.rgb, vec3(0.299, 0.587, 0.114));
  float vertical = clamp(local.y / (0.6666667 * size) + 0.5, 0.0, 1.0);
  float topLight = smoothstep(0.04, 0.92, vertical);
  float depth = mix(0.56, 1.08, topLight);

  vec3 daylight = sampleColor.rgb * mix(0.88, 1.04, topLight);
  daylight += vec3(0.045) * edge;
  daylight -= vec3(0.042) * outlineShade;

  vec3 moonlit = sampleColor.rgb * vec3(0.72, 0.75, 0.88) + vec3(0.018, 0.02, 0.028);
  moonlit *= mix(0.78, 1.04, topLight);
  moonlit += vec3(0.075, 0.085, 0.1) * edge;
  moonlit -= vec3(0.035) * outlineShade;

  vec3 storm = vec3(clamp((0.28 + luma * 0.46) * depth + edge * 0.2, 0.0, 0.94));
  storm *= mix(0.76, 1.06, topLight);
  storm += vec3(0.1) * edge;
  storm -= vec3(0.07) * outlineShade;
  float burstWidth = mix(8.0, 2.35, clamp(u_lightningSpread, 0.0, 1.0));
  float burst = exp(-abs(p.x - strikeX) * burstWidth);
  float burstNoise = 0.76 + 0.24 * hash(floor(p * 6.0) + vec2(u_lightningSeed, u_lightningSeed * 1.7));
  float burstLight = u_lightning * burst * burstNoise * mix(0.38, 1.0, topLight) * (0.12 + edge * 0.52);
  storm += vec3(0.58) * burstLight;

  vec3 color = mix(mix(daylight, moonlit, u_theme), storm, u_rain);
  return vec4(color * alpha, alpha);
}

vec4 overCloud(vec4 top, vec4 bottom) {
  return vec4(top.rgb + bottom.rgb * (1.0 - top.a), top.a + bottom.a * (1.0 - top.a));
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y);
  float scale = mix(0.64, 1.0, smoothstep(0.7, 1.5, aspect));
  p /= scale;
  float strikeX = (u_lightningCenter - 0.5) * aspect / scale;
  vec4 farCloud = cloudLayer(p, strikeX, vec2(0.88, 0.74), 0.005, vec2(0.13, 0.28), 11.0, 0.56, 0.84, 0.75);
  vec4 middleCloud = cloudLayer(p, strikeX, vec2(1.3, 0.96), 0.010, vec2(0.58, 0.06), 19.0, 0.72, 0.95, 1.15);
  vec4 nearCloud = cloudLayer(p, strikeX, vec2(1.7, 1.16), 0.016, vec2(0.06, 0.08), 29.0, 1.0, 0.98, 1.45);

  vec4 clouds = vec4(0.0);
  if (u_rain > 0.001) {
    vec4 stormFar = cloudLayer(p, strikeX, vec2(0.58, 0.46), 0.0075, vec2(0.21, 0.46), 37.0, 0.86, 0.68, 0.5);
    vec4 stormMiddle = cloudLayer(p, strikeX, vec2(0.86, 0.64), 0.0125, vec2(0.34, 0.25), 43.0, 0.92, 0.8, 0.72);
    vec4 stormNear = cloudLayer(p, strikeX, vec2(1.28, 0.9), 0.019, vec2(0.77, 0.02), 53.0, 0.98, 0.9, 1.08);
    clouds = overCloud(stormFar, clouds);
    clouds = overCloud(farCloud, clouds);
    clouds = overCloud(stormMiddle, clouds);
    clouds = overCloud(middleCloud, clouds);
    clouds = overCloud(stormNear, clouds);
    clouds = overCloud(nearCloud, clouds);
  } else {
    clouds = overCloud(farCloud, clouds);
    clouds = overCloud(middleCloud, clouds);
    clouds = overCloud(nearCloud, clouds);
  }

  vec3 color = clouds.rgb;
  float alpha = clouds.a;

  float sideWeight = smoothstep(0.12, 0.42, abs(uv.x - 0.5));
  float topWeight = smoothstep(0.78, 0.94, uv.y);
  float clearReadingSpace = mix(mix(0.26, 0.12, u_theme), 1.0, max(sideWeight, topWeight));
  float stormReadingSpace = mix(0.42, 1.0, max(sideWeight, topWeight));
  float readingSpace = mix(clearReadingSpace, stormReadingSpace, u_rain);
  float edgeFade = smoothstep(0.0, 0.18, uv.y) * (1.0 - smoothstep(0.95, 1.0, uv.y));
  float visibility = edgeFade * readingSpace;
  color *= visibility;
  alpha *= visibility;

  if (u_rain > 0.001) {
    float bolt = lightningBolt(p, strikeX);
    float boltMask = 0.16 + alpha * 0.84;
    color = mix(color, vec3(0.93, 0.95, 1.0), bolt * boltMask);
    alpha = max(alpha, bolt * boltMask * 0.72);

    float rainAlpha = rainLayer(uv, aspect, 24.0, 0.78, 0.07, 2.0, 0.15);
    rainAlpha += rainLayer(uv, aspect, 34.0, 1.12, 0.09, 7.0, 0.12);
    rainAlpha += rainLayer(uv, aspect, 46.0, 1.58, 0.11, 13.0, 0.09);
    rainAlpha = clamp(rainAlpha * u_rain * edgeFade, 0.0, 0.42);
    float strikeGlow = exp(-abs(uv.x - u_lightningCenter) * 5.0);
    vec3 rainColor = vec3(0.76) + vec3(0.2) * u_lightning * (0.55 + strikeGlow * 0.45);
    color = rainColor * rainAlpha + color * (1.0 - rainAlpha);
    alpha = rainAlpha + alpha * (1.0 - rainAlpha);
  }

  float flash = u_lightning * 0.075;
  color = vec3(flash) + color * (1.0 - flash);
  alpha = flash + alpha * (1.0 - flash);
  gl_FragColor = vec4(color, alpha);
}
`;

const THEME_TRANSITION_MS = 520;
const RAINY_WIND_SCALE = 2.15;
const LIGHTNING_INTERVAL_SECONDS = 15;
const FRAME_INTERVAL_MS = 1000 / 30;
const REDUCED_FRAME_INTERVAL_MS = 1000 / 20;
const MAX_PIXELS = 1_000_000;
const MIN_QUALITY_SCALE = 0.42;

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
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

function mountClouds(canvas: HTMLCanvasElement, gl: WebGLRenderingContext): (() => void) | null {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!vertexShader || !fragmentShader || !program) {
    if (vertexShader) gl.deleteShader(vertexShader);
    if (fragmentShader) gl.deleteShader(fragmentShader);
    return null;
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  gl.disable(gl.BLEND);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const uResolution = gl.getUniformLocation(program, "u_resolution");
  const uTime = gl.getUniformLocation(program, "u_time");
  const uTheme = gl.getUniformLocation(program, "u_theme");
  const uRain = gl.getUniformLocation(program, "u_rain");
  const uWind = gl.getUniformLocation(program, "u_wind");
  const uLightning = gl.getUniformLocation(program, "u_lightning");
  const uLightningCenter = gl.getUniformLocation(program, "u_lightningCenter");
  const uLightningSpread = gl.getUniformLocation(program, "u_lightningSpread");
  const uLightningSeed = gl.getUniformLocation(program, "u_lightningSeed");
  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1i(gl.getUniformLocation(program, "u_cloudAtlas"), 0);
  const atlas = new Image();
  let textureReady = false;

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let motionScale = motionQuery.matches ? 0.25 : 1;

  let themeValue = document.documentElement.getAttribute("data-theme") === "dark" ? 1 : 0;
  let themeFrom = themeValue;
  let themeTarget = themeValue;
  let rainValue = document.documentElement.getAttribute("data-weather") === "rainy" ? 1 : 0;
  let rainFrom = rainValue;
  let rainTarget = rainValue;
  let themeStart = 0;
  let elapsed = 0;
  let lastFrame = 0;
  let frameId = 0;
  let running = false;
  let inView = true;
  let ready = false;
  let resizeTimer = 0;
  let qualityScale = 1;
  let slowFrames = 0;
  let averageFrameMs = 0;
  let renderedTheme = -1;
  let renderedRain = -1;
  let renderedWind = -1;
  let lightning = 0;
  let lightningStart = -1;
  let lightningEventIndex = 0;
  let nextLightningAt = LIGHTNING_INTERVAL_SECONDS;
  let lightningPeak = 0.62;
  let lightningEchoDelay = 0.17;
  let lightningEchoStrength = 0.14;
  let lightningCenter = 0.5;
  let lightningSpread = 0;
  let lightningSeed = 1;

  function updateLightning() {
    lightning = 0;
    lightningSpread = 0;
    if (rainValue < 0.85 || motionQuery.matches) {
      lightningStart = -1;
      return;
    }
    if (lightningStart < 0 && elapsed >= nextLightningAt) {
      lightningStart = elapsed;
      lightningPeak = 0.5 + Math.random() * 0.18;
      lightningEchoDelay = 0.13 + Math.random() * 0.12;
      lightningEchoStrength = 0.1 + Math.random() * 0.09;
      const sequence = lightningEventIndex++;
      const strikePosition = 0.5 + ((sequence * 0.61803398875) % 1 - 0.5) * 0.68;
      lightningCenter = Math.min(0.88, Math.max(0.12, strikePosition + (Math.random() - 0.5) * 0.035));
      lightningSeed = sequence * 17.31 + Math.random() * 9;
      nextLightningAt = elapsed + LIGHTNING_INTERVAL_SECONDS;
      window.dispatchEvent(
        new CustomEvent("demonmc:lightning", {
          detail: {
            peak: lightningPeak,
            echoDelay: lightningEchoDelay,
            echoStrength: lightningEchoStrength,
            center: lightningCenter,
          },
        }),
      );
    }
    if (lightningStart < 0) return;
    const local = elapsed - lightningStart;
    if (local >= 1.05) {
      lightningStart = -1;
      return;
    }
    const spreadProgress = Math.min(1, local / 0.72);
    lightningSpread = spreadProgress * spreadProgress * (3 - 2 * spreadProgress);
    const primary = Math.exp(-local * 7.5) * lightningPeak;
    const echo = Math.exp(-Math.pow((local - lightningEchoDelay) / 0.055, 2)) * lightningEchoStrength;
    const afterglow = Math.exp(-Math.max(0, local - 0.22) * 3.2) * lightningPeak * 0.08;
    lightning = Math.min(0.86, primary + echo + afterglow);
  }

  function paint(now: number, delta: number) {
    elapsed += delta * motionScale;
    if (themeValue !== themeTarget || rainValue !== rainTarget) {
      const progress = Math.min(1, (now - themeStart) / THEME_TRANSITION_MS);
      const eased = progress * progress * (3 - 2 * progress);
      themeValue = themeFrom + (themeTarget - themeFrom) * eased;
      rainValue = rainTarget === 0 ? 0 : rainFrom + (rainTarget - rainFrom) * eased;
      if (progress >= 1) {
        themeValue = themeTarget;
        rainValue = rainTarget;
        themeFrom = themeTarget;
        rainFrom = rainTarget;
      }
    }
    updateLightning();
    const windValue = 1 + (RAINY_WIND_SCALE - 1) * rainValue;
    gl.uniform1f(uTime, elapsed);
    if (themeValue !== renderedTheme) {
      gl.uniform1f(uTheme, themeValue);
      renderedTheme = themeValue;
    }
    if (rainValue !== renderedRain) {
      gl.uniform1f(uRain, rainValue);
      renderedRain = rainValue;
    }
    if (windValue !== renderedWind) {
      gl.uniform1f(uWind, windValue);
      renderedWind = windValue;
    }
    gl.uniform1f(uLightning, lightning);
    gl.uniform1f(uLightningCenter, lightningCenter);
    gl.uniform1f(uLightningSpread, lightningSpread);
    gl.uniform1f(uLightningSeed, lightningSeed);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!ready) {
      ready = true;
      document.documentElement.setAttribute("data-clouds", "webgl");
    }
  }

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    const mobile = bounds.width < 768;
    const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.15 : 1.3);
    const baseQuality = mobile ? 0.75 : 0.8;
    let width = Math.round(bounds.width * dpr * baseQuality * qualityScale);
    let height = Math.round(bounds.height * dpr * baseQuality * qualityScale);
    if (width * height > MAX_PIXELS) {
      const scale = Math.sqrt(MAX_PIXELS / (width * height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    width = Math.max(2, width);
    height = Math.max(2, height);
    if (width === canvas.width && height === canvas.height) return;
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
    gl.uniform2f(uResolution, width, height);
  }

  function frame(now: number) {
    if (!running) return;
    if (document.hidden) {
      lastFrame = now;
      frameId = requestAnimationFrame(frame);
      return;
    }
    const reducedMotion = motionQuery.matches;
    motionScale = reducedMotion ? 0.25 : 1;
    const interval = reducedMotion ? REDUCED_FRAME_INTERVAL_MS : FRAME_INTERVAL_MS;
    if (lastFrame !== 0 && now - lastFrame < interval - 0.75) {
      frameId = requestAnimationFrame(frame);
      return;
    }
    const frameMs = lastFrame === 0 ? 0 : now - lastFrame;
    const delta = lastFrame === 0 ? 0 : Math.min(frameMs / 1000, 0.12);
    lastFrame = now;
    paint(now, delta);

    if (frameMs > 0) {
      averageFrameMs += (frameMs - averageFrameMs) * 0.08;
    }
    const frameBudget = reducedMotion ? 58 : 40;
    if (averageFrameMs > frameBudget) {
      slowFrames += 1;
    } else {
      slowFrames = Math.max(0, slowFrames - 1);
    }
    if (slowFrames >= 16 && qualityScale > MIN_QUALITY_SCALE) {
      qualityScale = Math.max(MIN_QUALITY_SCALE, qualityScale * 0.84);
      averageFrameMs = 0;
      slowFrames = 0;
      resize();
    }
    frameId = requestAnimationFrame(frame);
  }

  function start() {
    if (running || !textureReady) return;
    running = true;
    lastFrame = 0;
    frameId = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(frameId);
  }

  function onThemeChange() {
    const nextTheme = document.documentElement.getAttribute("data-theme") === "dark" ? 1 : 0;
    const nextRain = document.documentElement.getAttribute("data-weather") === "rainy" ? 1 : 0;
    if (nextTheme === themeTarget && nextRain === rainTarget) return;
    themeFrom = themeValue;
    themeTarget = nextTheme;
    rainFrom = rainValue;
    rainTarget = nextRain;
    themeStart = performance.now();
    lightning = 0;
    lightningSpread = 0;
    lightningStart = -1;
    if (nextRain === 0) rainValue = 0;
    if (nextRain === 1) nextLightningAt = elapsed + LIGHTNING_INTERVAL_SECONDS;
  }

  function onMotionChange() {
    if (motionQuery.matches) {
      lightning = 0;
      lightningSpread = 0;
      lightningStart = -1;
      return;
    }
    if (rainTarget === 1) nextLightningAt = elapsed + LIGHTNING_INTERVAL_SECONDS;
  }

  function syncRunning() {
    if (inView && !document.hidden) start();
    else stop();
  }

  function onVisibilityChange() {
    syncRunning();
  }

  function onResize() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(resize, 120);
  }

  function onContextLost(event: Event) {
    event.preventDefault();
    stop();
    document.documentElement.removeAttribute("data-clouds");
  }

  const observer = new MutationObserver(onThemeChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "data-weather"],
  });
  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", onVisibilityChange);
  motionQuery.addEventListener("change", onMotionChange);
  canvas.addEventListener("webglcontextlost", onContextLost);

  const resizeObserver = "ResizeObserver" in window ? new ResizeObserver(onResize) : null;
  resizeObserver?.observe(canvas);
  const intersectionObserver = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => {
        inView = entries[0]?.isIntersecting ?? true;
        syncRunning();
      }, { rootMargin: "80px 0px", threshold: 0 })
    : null;
  intersectionObserver?.observe(canvas);

  resize();
  atlas.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
    textureReady = true;
    syncRunning();
  };
  atlas.src = "/images/clouds-reference-v2.webp";

  return () => {
    atlas.onload = null;
    stop();
    window.clearTimeout(resizeTimer);
    observer.disconnect();
    resizeObserver?.disconnect();
    intersectionObserver?.disconnect();
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    motionQuery.removeEventListener("change", onMotionChange);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    gl.deleteTexture(texture);
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    document.documentElement.removeAttribute("data-clouds");
  };
}

function CloudBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
      desynchronized: true,
    });
    if (!gl) return;
    return mountClouds(canvas, gl) ?? undefined;
  }, []);

  return <canvas ref={canvasRef} className="site-cloud-canvas" aria-hidden="true" />;
}

const PRIVATE_ROUTES = ["/admin", "/owner", "/staff"];

export function SiteClouds() {
  const pathname = usePathname();
  const layerRef = useRef<HTMLDivElement>(null);
  const privateRoute = PRIVATE_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  useEffect(() => {
    if (privateRoute) return;
    const layer = layerRef.current;
    const header = document.querySelector<HTMLElement>("header");
    if (!layer || !header) return;

    const updateOffset = () => {
      layer.style.setProperty("--site-cloud-top", `${header.offsetTop + header.offsetHeight}px`);
    };
    updateOffset();

    const observer = "ResizeObserver" in window ? new ResizeObserver(updateOffset) : null;
    observer?.observe(header);
    window.addEventListener("resize", updateOffset);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateOffset);
    };
  }, [pathname, privateRoute]);

  if (privateRoute) return null;

  return (
    <div ref={layerRef} className="site-clouds" aria-hidden="true">
      <CloudBackground />
    </div>
  );
}
