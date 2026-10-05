import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const source = path.join(path.dirname(require.resolve('@vladmandic/face-api/package.json')), 'model');
const target = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'models');
const models = ['tiny_face_detector_model', 'face_landmark_68_model', 'face_recognition_model'];

mkdirSync(target, { recursive: true });
for (const model of models) {
  for (const file of [`${model}-weights_manifest.json`, `${model}.bin`]) {
    const to = path.join(target, file);
    if (!existsSync(to)) copyFileSync(path.join(source, file), to);
  }
}
console.log(`modelos faciales listos en ${path.relative(process.cwd(), target)}`);
