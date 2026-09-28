# ADR-002 — Facial on-device + IA práctica (DEC-01 + RNF-F)

**Estado:** Aceptado (rev. Ley 1581 / P09.1–P09.9)  
**Fecha:** 2026-09-28  
**Fuentes:** Darwin · RF Cronista · threat model Bastión

## Decisión

1. Facial Must teacher+student; on-device; API solo `embedding[]` + `modelId` (**RNF-F01**). Rechazar cualquier campo de imagen.
2. Consentimiento Ley 1581 auditable + `policyVersion`; re-consent si cambia `FACIAL_POLICY_VERSION` (**RNF-F02/F07**).
3. Password siempre fallback (**RNF-F04**).
4. Login: `email` + vector; no 1:N abierto; rate limit recomendado (**RNF-F05**).
5. Retención: política documentada; `DELETE /api/facial/enroll`; borrar embeddings al baja de cuenta; plazo opcional `FACIAL_RETENTION_DAYS` (**RNF-F03**).
6. No loguear embeddings (**RNF-F06**). Modelo lab documentado (**RNF-F08**).
7. EQ-P10 practice chat con gate `KIOSK_ACTIVE`.
8. Huella / liveness = Nice.

## Consecuencias

Pulse: copy Ley 1581 + UX consent; Forge: validaciones/borrado/retención; Bastión: hardening checklist del threat model.
