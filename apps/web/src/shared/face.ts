import type { LivenessAction } from '@eduquest/contracts';

type FaceApi = typeof import('@vladmandic/face-api');
type Point = { x: number; y: number };

let loading: Promise<FaceApi> | null = null;

export function loadFaceApi(): Promise<FaceApi> {
  if (!loading) {
    loading = (async () => {
      const faceapi = await import('@vladmandic/face-api');
      const tf = faceapi.tf as unknown as { setBackend(name: string): Promise<boolean>; ready(): Promise<void> };
      const webgl = await tf.setBackend('webgl').catch(() => false);
      if (!webgl) await tf.setBackend('cpu');
      await tf.ready();
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
      ]);
      return faceapi;
    })().catch((error) => {
      loading = null;
      throw error;
    });
  }
  return loading;
}

export async function openCamera(video: HTMLVideoElement) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador no permite usar la cámara.');
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
  await new Promise((resolve) => setTimeout(resolve, 300));
  return () => stream.getTracks().forEach((track) => track.stop());
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Eye aspect ratio over the 68-point layout (36-41 and 42-47). Drops sharply when the eyes close. */
export function eyeAspectRatio(points: Point[]) {
  const ear = (p: Point[]) => (dist(p[1]!, p[5]!) + dist(p[2]!, p[4]!)) / (2 * dist(p[0]!, p[3]!));
  return (ear(points.slice(36, 42)) + ear(points.slice(42, 48))) / 2;
}

/** Nose position between the outer eye corners on the raw (unmirrored) frame: 0.5 is frontal, higher means the person turned to their left. */
export function yawRatio(points: Point[]) {
  const left = points[36]!;
  const right = points[45]!;
  return (points[30]!.x - left.x) / Math.max(1, right.x - left.x);
}

function drawPoints(canvas: HTMLCanvasElement | null, video: HTMLVideoElement, points: Point[], color: string) {
  if (!canvas) return;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = color;
  for (const p of points) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

export const livenessCopy: Record<LivenessAction, string> = {
  blink: 'Parpadea dos veces despacio',
  turn_left: 'Gira la cabeza hacia tu izquierda',
  turn_right: 'Gira la cabeza hacia tu derecha',
};

export async function runLiveness(
  faceapi: FaceApi,
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement | null,
  action: LivenessAction,
  onProgress: (value: number) => void,
  timeoutMs = 12_000,
) {
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
  const started = performance.now();
  const ears: number[] = [];
  let closed = false;
  let blinks = 0;
  while (performance.now() - started < timeoutMs) {
    const result = await faceapi.detectSingleFace(video, options).withFaceLandmarks();
    if (result) {
      const points = result.landmarks.positions;
      drawPoints(canvas, video, points, '#3ee0b4');
      if (action === 'blink') {
        const ear = eyeAspectRatio(points);
        ears.push(ear);
        const baseline = [...ears].sort((a, b) => b - a)[Math.floor(ears.length * 0.2)] ?? ear;
        if (ears.length > 4 && !closed && ear < baseline * 0.72) closed = true;
        if (closed && ear > baseline * 0.88) {
          closed = false;
          blinks += 1;
          onProgress(Math.min(1, blinks / 2));
          if (blinks >= 2) return;
        }
      } else {
        const ratio = yawRatio(points);
        const progress = action === 'turn_left' ? (ratio - 0.5) / 0.17 : (0.5 - ratio) / 0.17;
        onProgress(Math.max(0, Math.min(1, progress)));
        if (progress >= 1) return;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  throw new Error('No detectamos el gesto a tiempo. Busca buena luz y vuelve a intentarlo.');
}

export async function captureDescriptors(
  faceapi: FaceApi,
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement | null,
  count: number,
  onSample: (taken: number) => void,
) {
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.6 });
  const samples: number[][] = [];
  let misses = 0;
  while (samples.length < count) {
    const faces = await faceapi.detectAllFaces(video, options).withFaceLandmarks().withFaceDescriptors();
    if (faces.length > 1) throw new Error('Hay más de un rostro frente a la cámara. Debe aparecer solo una persona.');
    const face = faces[0];
    if (!face) {
      misses += 1;
      if (misses > 25) throw new Error('Perdimos tu rostro. Mira de frente a la cámara con buena luz.');
      await new Promise((resolve) => setTimeout(resolve, 120));
      continue;
    }
    drawPoints(canvas, video, face.landmarks.positions, '#ffd66b');
    samples.push(Array.from(face.descriptor));
    onSample(samples.length);
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  return samples;
}

export function mean(samples: number[][]) {
  const out = new Array<number>(samples[0]?.length ?? 0).fill(0);
  for (const sample of samples) sample.forEach((value, i) => (out[i]! += value / samples.length));
  return out;
}
