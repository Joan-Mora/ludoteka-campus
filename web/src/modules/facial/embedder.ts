import { FACIAL_MODEL_ID } from '../../shared/types/api'

const DIM = 128

/**
 * Lab on-device embedder: downsamples a local video frame to a fixed luminance
 * vector. Never uploads the image — only the number[] leaves the browser.
 * Swap for FaceMesh / face-api later; keep the same API contract + modelId.
 */
export function embeddingFromVideo(video: HTMLVideoElement): { embedding: number[]; modelId: string } {
  if (!video.videoWidth || !video.videoHeight) {
    throw new Error('Sin imagen de cámara')
  }
  const size = 16
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas no disponible')
  ctx.drawImage(video, 0, 0, size, size)
  const { data } = ctx.getImageData(0, 0, size, size)
  const raw: number[] = []
  for (let i = 0; i < data.length; i += 4) {
    raw.push((0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255)
  }
  // pad / trim to DIM
  const embedding = new Array<number>(DIM).fill(0)
  for (let i = 0; i < DIM; i++) embedding[i] = raw[i % raw.length] ?? 0
  // L2 normalize
  let norm = 0
  for (const v of embedding) norm += v * v
  norm = Math.sqrt(norm) || 1
  for (let i = 0; i < DIM; i++) embedding[i] = embedding[i] / norm
  return { embedding, modelId: FACIAL_MODEL_ID }
}