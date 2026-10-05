# ADR-007 — Acceso facial con face-api y plantilla cifrada

**Estado:** aceptada · 2026-10-05  
**Reemplaza:** el punto 9 de ADR-002 (modelo geométrico `eduquest-lab-landmarks-v1`). El resto de ADR-002 (Ley 1581, consentimiento, sin fotos, contraseña siempre disponible, menores con acudiente) sigue vigente.

## Contexto

El modelo de laboratorio basado en geometría de puntos tenía poca precisión y no distinguía bien entre personas. El parcial pide un login facial demostrable sin enviar fotos a la nube ni guardar imágenes.

## Decisión

1. **Modelo en el navegador:** `@vladmandic/face-api` (TinyFaceDetector, 68 puntos y FaceRecognitionNet) calcula un descriptor de 128 dimensiones en el dispositivo. Los pesos se sirven desde `/models`. La API sigue rechazando cualquier campo de imagen (`400 IMAGE_NOT_ALLOWED`).
2. **Prueba de vida:** la API emite un reto de un solo uso con vencimiento (parpadear o girar la cabeza a la izquierda o a la derecha). El navegador solo captura muestras mientras se cumple el gesto. Un reto vencido o reutilizado responde `400 LIVENESS`.
3. **Registro:** 5 muestras. La API calcula el promedio y la dispersión; si las muestras no se parecen entre sí responde `400 QUALITY`.
4. **Almacenamiento:** el vector promedio se cifra con AES-256-GCM (IV aleatorio y etiqueta de autenticación) y se guarda en `face_templates` (`ciphertext`, `iv`, `tag`, `model_id`). La llave sale de `FACIAL_ENC_KEY` (o se deriva de `JWT_SECRET`) y debe ser la misma en todos los entornos que comparten la base.
5. **Comparación:** distancia euclidiana contra el umbral `FACIAL_MAX_DISTANCE` (0,5). En modo identificación sin correo, si dos cuentas quedan cerca la API responde `AMBIGUOUS` y pide el correo.
6. **Bloqueo:** 5 fallos (`FACIAL_LOCK_ATTEMPTS`) bloquean el acceso facial de la cuenta o del equipo por 15 minutos (`423 FACE_LOCKED`). La contraseña sigue disponible.
7. **Auditoría:** cada intento queda en `face_attempts` (modo, éxito, motivo, distancia, IP y hash del correo). Nunca se registra el vector.

## Consecuencias

- La base guarda un vector cifrado que no permite reconstruir el rostro; sin la llave no sirve ni para comparar.
- Cambiar de modelo invalida las plantillas viejas: `model_id` distinto equivale a "sin registro" y el usuario vuelve a enrolarse.
- La prueba de vida por gesto frena una foto impresa, pero no un video. Se documenta como control de laboratorio, no como identificación legal.
