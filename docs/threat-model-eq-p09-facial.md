# Threat model minimo — EQ-P09 Facial (EduQuest)

**Autor:** Bastion (seguridad)  
**Fecha:** 2026-09-28  
**Alcance:** auth facial on-device + embeddings + consentimiento (Ley 1581 Colombia)  
**Fuera de alcance:** exploits ofensivos, huella, liveness cloud, proctoring ML

## Activos

1. Embeddings faciales (dato biometrico / dato sensible)
2. Registros de consentimiento (prueba de tratamiento licito)
3. Credenciales password (fallback obligatorio)
4. Tokens JWT de sesion
5. Identidad alumno/docente (cuenta personal)

## Superficie

- Cliente: camara, modelo on-device, UI consentimiento/enroll/login/delete
- API: `POST /api/facial/consent|enroll|login`, `DELETE /api/facial/enroll`, `GET /api/facial/consent`
- BD: `facial_consents`, `facial_embeddings` (vector + modelId; **sin foto**)
- Secretos: `JWT_*`, `DATABASE_URL`, `FACIAL_MATCH_THRESHOLD`, `FACIAL_POLICY_VERSION`

## Amenazas y mitigaciones (Must)

| ID | Amenaza | Impacto | Mitigacion Must |
|----|---------|---------|-----------------|
| T1 | Foto/blob crudo llega a API o BD | Alto (Ley 1581 / minimizacion) | Contrato: solo `embedding[]` + `modelId`. Validar Content-Type/body; rechazar campos de imagen. RNF: sin columnas de imagen. |
| T2 | Enrolar sin consentimiento valido | Alto (ilicito) | Enroll exige consent previo con `policyVersion` vigente. 403 `CONSENT_REQUIRED`. UX consentimiento en registro/enrolamiento. |
| T3 | Consentimiento no auditable | Alto | Persistir `user_id`, `policy_version`, `accepted_at`. Version de politica en env `FACIAL_POLICY_VERSION`; nuevo version = re-consent. |
| T4 | Retencion indefinida de embeddings | Alto | Politica de retencion + `DELETE /api/facial/enroll` (usuario). Job/proceso de borrado al bajas cuenta o plazo documentado en RF. |
| T5 | Login facial 1:N abierto (enumeracion) | Medio | MVP: `email` + embedding (ya en contrato). Rate limit en `/facial/login` y `/auth/login`. |
| T6 | Spoofing / foto impresa (lab) | Medio | Aceptado como limite lab Must; liveness = Nice. UI comunica que es demo/lab. Password siempre disponible. |
| T7 | Umbral debil (falsos positivos) | Medio | `FACIAL_MATCH_THRESHOLD` calibrado; logs de `NO_MATCH` sin filtrar vector. Fallo → ofrecer password. |
| T8 | Embedding filtrado en logs/errores | Alto | Nunca loguear vector completo; errores genericos. |
| T9 | JWT/secretos en Front o repo | Critico | Solo `api/.env`; `.env.example` vacio; `.gitignore`; Render env vars. |
| T10 | Facial como unico factor | Alto | Password fallback obligatorio en UI y API; no deshabilitar login password. |
| T11 | Menores / colegio sin base legal clara | Critico (contexto escolar) | Consentimiento informado + tratamiento documentado (Ley 1581); roles alumno/docente; copy legal en UI alineado a RF Cronista. |

## Controles a verificar en hardening (post-RF)

1. No hay rutas que acepten multipart imagen para facial.
2. Consent + version politica alineados Front/API.
3. Delete embedding funciona y se prueba en smoke.
4. Password login nunca se oculta ni se rompe si falla facial.
5. `api/.gitignore` cubre `.env`; secretos solo en Render/Cockroach.
6. Rate limiting basico en endpoints de auth/facial (recomendado Must lab).

## Residual (aceptar o Nice)

- Sin liveness anti-spoof robusto (Nice).
- Embedding reversible parcialmente con ataques de inversion (riesgo residual; minimiza no guardando foto).
- Modelo lab `eduquest-lab-luma-v1`: documentar que no es produccion forense.

## Decision

Continuar Must facial bajo DEC-01 **si** RF/RNF de Cronista fija: texto Ley 1581, UX consentimiento, retencion/borrado. Build Cursor sigue hold hasta ese RF + parche Atlas si aplica.
