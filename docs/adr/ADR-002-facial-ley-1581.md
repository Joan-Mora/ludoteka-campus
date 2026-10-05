# ADR-002 — Facial de laboratorio, Ley 1581

**Estado:** aceptada · 2026-09-28  
**Hereda:** DEC-01 del prototipo anterior (el alcance legal no cambia; cambia el producto alrededor).  
**Actualizada por:** ADR-007 (2026-10-05). El modelo, el cifrado y el umbral de los puntos 5, 6 y 9 se rigen por ADR-007; el marco legal sigue aquí.

## Decisión

1. El rostro se procesa en el dispositivo. La API solo acepta `embedding[]` y `modelId`.
2. Cualquier campo `image`, `photo`, `selfie`, `picture`, `blob` o `base64` responde `400 IMAGE_NOT_ALLOWED`.
3. Hay consentimiento versionado (`FACIAL_POLICY_VERSION`). Sin la versión vigente, el enrolamiento responde `403 CONSENT_REQUIRED`.
4. La contraseña nunca se oculta ni se deshabilita. El facial no es el único factor.
5. El login facial es 1:1: correo + vector, umbral `FACIAL_MATCH_THRESHOLD`.
6. El usuario puede borrar su embedding. `FACIAL_RETENTION_DAYS = 0` significa que no hay purga automática.
7. No se escriben vectores en los logs.
8. Si `is_minor` y no hay `guardian_consent_at`, el facial responde `403 GUARDIAN_CONSENT_REQUIRED`.
9. El modelo de laboratorio es `eduquest-lab-landmarks-v1` (geometría de MediaPipe, no un comparador forense). La huella dactilar y el liveness anti-spoof quedan fuera.

## Por qué un modelo geométrico

No salen fotos del navegador y no hace falta una API de biometría en la nube. El costo es precisión: el umbral debe ser alto y el método se documenta como laboratorio, no como prueba de identidad legal.
