// Frame-time probe: paste into the console (or page.evaluate) on a running build, then `await probe(10)`.
// Splits each frame into sim / view / ui / render CPU time, counts canvas texture uploads,
// reads draw calls and triangles, and times the GPU when EXT_disjoint_timer_query_webgl2 exists.
window.probe = async (seconds = 10) => {
  const g = window.app.game;
  const r = g.stage.renderer;
  const gl = r.getContext();
  const ms = [];
  const acc = { view: 0, ui: 0, render: 0, upload: 0, uploads: 0, uploadPx: 0, calls: 0, tris: 0, gpu: [] };
  const timer = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const pending = [];
  const orig = { frame: g.frame, update: g.view.update, onFrame: g.onFrame, render: g.stage.render, tex: gl.texImage2D, sub: gl.texSubImage2D };
  const time = (key, fn) => function (...a) {
    const t = performance.now();
    const out = fn.apply(this, a);
    acc[key] += performance.now() - t;
    return out;
  };
  const upload = (fn) => function (...a) {
    const src = a[a.length - 1];
    const t = performance.now();
    const out = fn.apply(this, a);
    if (src instanceof HTMLCanvasElement || src instanceof OffscreenCanvas) {
      acc.upload += performance.now() - t;
      acc.uploads++;
      acc.uploadPx += src.width * src.height;
    }
    return out;
  };
  g.view.update = time('view', orig.update);
  g.onFrame = time('ui', orig.onFrame);
  g.stage.render = function (dt) {
    let q;
    if (timer) {
      q = gl.createQuery();
      gl.beginQuery(timer.TIME_ELAPSED_EXT, q);
    }
    const t = performance.now();
    orig.render.call(this, dt);
    acc.render += performance.now() - t;
    if (q) {
      gl.endQuery(timer.TIME_ELAPSED_EXT);
      pending.push(q);
    }
    acc.calls += r.info.render.calls;
    acc.tris += r.info.render.triangles;
    while (pending.length && gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)) {
      const p = pending.shift();
      if (!gl.getParameter(timer.GPU_DISJOINT_EXT)) acc.gpu.push(gl.getQueryParameter(p, gl.QUERY_RESULT) / 1e6);
      gl.deleteQuery(p);
    }
  };
  gl.texImage2D = upload(orig.tex);
  gl.texSubImage2D = upload(orig.sub);
  let last = 0;
  const gaps = [];
  g.frame = function (now) {
    if (last) gaps.push(now - last);
    last = now;
    const t = performance.now();
    orig.frame.call(this, now);
    ms.push(performance.now() - t);
  };
  await new Promise((res) => setTimeout(res, seconds * 1000));
  Object.assign(g, { frame: orig.frame, onFrame: orig.onFrame });
  g.view.update = orig.update;
  g.stage.render = orig.render;
  gl.texImage2D = orig.tex;
  gl.texSubImage2D = orig.sub;

  const n = ms.length;
  const sum = (a) => a.reduce((s, x) => s + x, 0);
  const pct = (a, p) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] ?? 0;
  const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
  const frameCpu = sum(ms) / n;
  const per = (x) => round(x / n);
  return {
    seconds,
    fps: round(n / seconds, 1),
    frameGapP50: round(pct(gaps, 0.5)),
    frameGapP95: round(pct(gaps, 0.95)),
    cpuFrameAvg: round(frameCpu),
    cpuFrameP95: round(pct(ms, 0.95)),
    simAvg: round(frameCpu - (acc.view + acc.ui + acc.render) / n),
    viewAvg: per(acc.view),
    uiAvg: per(acc.ui),
    renderSubmitAvg: per(acc.render),
    gpuAvg: acc.gpu.length ? round(sum(acc.gpu) / acc.gpu.length) : 'n/a (no timer query)',
    canvasUploadsPerSec: round(acc.uploads / seconds, 1),
    canvasUploadMsPerSec: round(acc.upload / seconds),
    canvasUploadMPxPerSec: round(acc.uploadPx / seconds / 1e6),
    drawCalls: Math.round(acc.calls / n),
    triangles: Math.round(acc.tris / n),
    pixelRatio: r.getPixelRatio(),
    drawingBuffer: `${gl.drawingBufferWidth}x${gl.drawingBufferHeight}`,
    shadowMap: g.stage.sun.shadow.mapSize.x,
    shadowType: r.shadowMap.type,
    paused: g.paused,
    customers: g.world.customers?.length,
    programs: r.info.programs?.length,
    geometries: r.info.memory.geometries,
    textures: r.info.memory.textures,
  };
};
