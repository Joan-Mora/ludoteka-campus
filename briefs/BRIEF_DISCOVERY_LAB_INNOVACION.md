# BRIEF DE DISCOVERY — Lab Innovación / Mercado
**Proyecto:** Colegio Francisco Arango + Parcial Gestión y Operación de BD  
**Agente:** Mercado (Darwin)  
**Fecha:** 2026-09-28 (America/Bogota)  
**Fuentes primarias de alcance:** `briefs/BRIEF_NEXUS.md`, `briefs/parcial-gestion-bd.docx`, `briefs/propuesta-rectoria.pptx`  
**Nombre de producto/carpeta:** pendiente (Darwin: EduQuest u otro)

---

## 0) Lectura dual-track (no mezclar Must)

| Track | Qué es | Quién lo exige |
|-------|--------|----------------|
| **A — Colegio / Rectoría** | PWA gamificación mates, MVP **sexto**, Kahoot-like, anti-fraude fullscreen/kiosco, certificado/insignia con aval rector | Nexus + propuesta rectoría |
| **B — Parcial Gestión BD** | App web + **CockroachDB** + auth tradicional (hash, roles, recovery email) + PDF/Excel dinámicos + deploy URL pública (no ngrok) + Confluence + ER/CRUD/SQL + evidencias | Docente (`parcial-gestion-bd.docx`) |

**Plazo único:** ~17 días. Una sola app debe servir ambos tracks.

**Deploy (Nexus + realidad de plataforma):** Render **no** hospeda Cockroach → **app en Render** + **Cockroach Cloud** (wire protocol Postgres). Render Postgres **no** cumple el enunciado.

---

## 1) Must vs Nice en 17 días

### Criterio
Priorizar lo que **demuestra**: (i) integridad académica del colegio + (ii) requisitos BD/auth/reportes/deploy del parcial + (iii) PWA usable, **sin inflar** Fase 2–3 de la propuesta rectoría.

### 1.A Must — Parcial (enunciado base, sección “Requisitos mínimos obligatorios”)

Del docx del profesor, **obligatorios explícitos**:

| # | Must parcial (base) | Evidencia esperada |
|---|---------------------|--------------------|
| 1 | App web funcional | URL pública |
| 2 | BD **distribuida CockroachDB** (única opción permitida) | Cluster real + scripts SQL |
| 3 | Modelo ER + tablas + PK/FK + restricciones + relaciones | Diagrama + SQL |
| 4 | CRUD + consultas SQL + integridad de datos | Demo + capturas |
| 5 | Auth tradicional: registro, login, logout | Demo |
| 6 | Roles/perfiles + rutas protegidas | Demo por rol |
| 7 | Contraseñas con **hash** (nunca texto plano) | Código + explicación seguridad |
| 8 | Recuperación de contraseña **por correo** | Flujo end-to-end |
| 9 | ≥2 reportes **PDF y/o Excel** dinámicos desde BD (título, fecha, datos BD, estructura, ID/numeración) | Descarga en vivo |
| 10 | Deploy en internet (**no ngrok** ni similares) | URL estable |
| 11 | Documentación en **Confluence** | Espacio del equipo |
| 12 | Repo Git + scripts SQL crear/poblar BD | Enlaces |
| 13 | Sustentación (problema, solución, arquitectura, BD, seguridad, demo, deploy) | Oral |

### 1.B Must — Colegio (producto, 17 días / MVP sexto)

Alineado a Nexus + Fase 1 propuesta rectoría, **recortado** a demostrable:

| # | Must colegio (MVP sexto) | Nota |
|---|--------------------------|------|
| 1 | PWA (instalable / offline-light o al menos `manifest` + service worker básico) | Constraint Nexus |
| 2 | Evaluaciones tipo **Kahoot-like** (sesión, preguntas mates sexto, timer/puntos, calificación automática) | Dominio |
| 3 | Banco mínimo de preguntas matemáticas (sexto) | Contenido voluntariado |
| 4 | Roles mínimos: estudiante, docente (+ admin/equipo) | Cruza con parcial |
| 5 | **Anti-fraude kiosco:** fullscreen obligatorio + detección pérdida de foco / cambio de pestaña / Esc → log de evento + alerta a docente y/o suspensión | Propuesta slide 6; integridad del deck |
| 6 | Certificado PDF + insignia (plantilla con firma/aval rector **placeholder** hasta aprobación formal) + QR/ID | Propuesta slide 9; sirve también como reporte PDF del parcial |
| 7 | Persistencia real en Cockroach (usuarios, sesiones, intentos, eventos integridad, certificados) | Cruza con parcial |

### 1.C Facial + IA — dos capas de Must (decisión Darwin/Nexus)

El docx tiene **ambigüedad estructural**. Hay que tratarlas por separado:

#### Capa 1 — Enunciado base (“Requisitos mínimos obligatorios”)
**NO lista** como obligatorio: captura de voz, chatbot IA, ni auth facial.  
Must base = auth tradicional + BD Cockroach + PDF/Excel + deploy + Confluence.

#### Capa 2 — “Parcial alternativo” + Deploy / Evidencias / Sustentación
El mismo docx, en:

- **Requerimientos de parcial alternativo:** voz + chatbot IA + auth facial  
- **Deploy — “Además, deberá demostrar”:** reconocimiento facial funcionando + IA funcionando  
- **Evidencias:** Login facial + funcionalidad de IA  
- **Sustentación:** punto “5. IA — ¿Qué problema resuelve la IA?”  
- **Especificación detallada** de login facial (registro facial, comparación, privacidad) e IA de dominio  

…trata facial + IA como **exigibles para aprobar la demo/rúbrica del parcial alternativo**.

| Escenario | Facial + IA | Implicación 17 días |
|-----------|-------------|---------------------|
| **B-base** (solo requisitos mínimos obligatorios literales) | **Nice / post** | Menos riesgo; riesgo de que el docente igual pida demo facial/IA en sustentación |
| **B-alternativo / rúbrica demo** (Deploy+Evidencias+Sustentación del mismo docx) | **Must** | Hay que meter MVP fino de facial + IA de dominio |

**Recomendación de Mercado (ver §3 y §5):** asumir **B-alternativo = Must de parcial** porque Deploy/Evidencias/Sustentación del propio enunciado lo piden demostrar; implementar **MVP mínimo** (§3), no proctoring completo. Confirmar con docente en día 1 si “parcial alternativo” es obligatorio para todos o solo si el equipo lo elige.

### 1.D Nice (explícitamente FUERA del Must de 17 días)

| Nice / post-parcial | Origen | Por qué fuera |
|---------------------|--------|---------------|
| Minijuegos de refuerzo, rachas, medallas complejas | Fase 2 rectoría | No bloquea parcial ni demo sexto |
| Panel analítica Rectoría / dashboard rico | Fase 3 | Sustituir por 1–2 reportes Excel/PDF |
| Alertas realtime websockets multi-docente a escala | Propuesta anti-fraude | Basta log + banner/estado en sesión |
| Proctoring continuo cloud, segunda cámara, screen share forzado | Mercado proctoring | Fuera de plazo y privacidad |
| Captura de voz | Alternativo docx | Solo si sobra capacidad tras facial+IA |
| Multi-grado / todo el colegio | Visión | MVP = **solo sexto** |
| Firma digital criptográfica del Rector | Certificados | Placeholder imagen + ID/QR basta para demo |
| Render Postgres como BD principal | — | **PROHIBIDO** por enunciado (debe ser Cockroach) |

### 1.E Exclusiones explícitas (NO cabe en 17 días)

- Motor anti-fraude “enterprise” (bloqueo OS, process list, LLM-cheating detector).  
- Reconocimiento facial forense / liveness anti-spoof robusto / cloud biometrics pagos.  
- Multi-tenant multi-colegio.  
- App nativa iOS/Android (PWA sí).  
- Migrar a otro motor SQL “porque es más fácil” (viola Cockroach obligatorio).

---

## 2) Deploy: Cockroach Cloud + app Render (wire Postgres)

### 2.1 Arquitectura objetivo

```
[Navegador / PWA]
       │ HTTPS
       ▼
[Web Service Render]  ← código app, env secrets
       │ Postgres wire + SSL
       ▼
[CockroachDB Cloud]   ← BD distribuida (Basic o Standard con trial)
```

- **App:** Render Web Service (Free o paid bajo).  
- **BD:** Cockroach Cloud (plan **Basic** usage-based, o **Standard** con créditos de trial).  
- **No usar** Render Postgres como BD del parcial (no es Cockroach).

### 2.2 Cómo conectar (verificado en docs)

1. Crear org/cluster en Cockroach Cloud; crear SQL user; copiar **General connection string** (`postgresql://...`).  
   Docs: [Quickstart](https://www.cockroachlabs.com/docs/cockroachcloud/quickstart), [Connect to cluster](https://www.cockroachlabs.com/docs/cockroachcloud/connect-to-your-cluster).  
2. Connection string típica (forma):  
   `postgresql://USER:PASSWORD@HOST:26257/DB?sslmode=verify-full`  
   (+ CA / `sslrootcert` según consola; en serverless legacy a veces `options=--cluster=...` — usar **exactamente** lo que entrega la consola actual).  
3. En Cockroach Cloud: **IP Allowlist**. Para demo universitaria suele usarse `0.0.0.0/0` con usuario SQL de privilegios mínimos (inseguro pero pragmático); ideal: restringir cuando se conozcan IPs. Render Free **no** ofrece IP egress fija → allowlist amplia o revisar docs de IPs de Render si el plan lo permite.  
4. En Render → Environment: `DATABASE_URL=<connection-string>`. App usa driver Postgres (`pg`, Prisma, SQLAlchemy+psycopg, etc.) con SSL requerido.  
5. Migraciones/scripts SQL contra Cockroach (cuidado con SQL dialect quirks: evitar features solo-Postgres no soportadas).

### 2.3 Límites freemium relevantes (parcial ~17 días) — con fuentes

**Cockroach Cloud** ([Costs](https://www.cockroachlabs.com/docs/cockroachcloud/costs), [Free trial](https://www.cockroachlabs.com/docs/cockroachcloud/free-trial)):

- Org nueva: créditos de trial (**$400** free trial credits, docs oficiales).  
- Cuentas pay-as-you-go con clusters **Basic**: crédito mensual de **$15** ≈ **50M Request Units** + **10 GiB** storage (docs).  
- Para el beneficio mensual Basic suele pedirse método de pago (solo cobra exceso; ver free-trial docs).  
- Si el trial termina sin pago: grace ~30 días con throttle; luego borrado de clusters (docs).  
- **Suficiente** para parcial si el equipo no hace load tests agresivos.

**Render Free** ([Deploy for Free](https://render.com/docs/free)):

- Web service Free: spin-down tras **15 min** idle; cold start ~1 min; **750** instance-hours/mes/workspace; filesystem efímero.  
- Free Postgres: 1 GB, **expira a 30 días** — **irrelevante como BD del parcial** (igual no es Cockroach).  
- Implicación demo: ping/cron o “wake” antes de sustentación; no depender de uptime 24/7.

### 2.4 Si Cockroach Cloud + Render falla

| Alternativa | ¿Cumple enunciado? | Uso |
|-------------|--------------------|-----|
| **Cockroach Cloud** (otra región/plan) + Render paid mínimo | Sí | Preferida |
| App en **otro PaaS** (Railway, Fly.io, etc.) + Cockroach Cloud | Sí (URL pública, BD=Cockroach) | Plan B deploy app |
| **Cockroach local/Docker** solo en laptop | **No** para “deploy internet + BD funcionando en producción” | Solo desarrollo / backup demo local |
| **Render Postgres** | **No** — enunciado: “solo será en CockRoach DB” | Prohibido como BD principal |
| Cockroach self-hosted en VPS | Sí técnicamente; más ops | Solo si Cloud bloquea cuentas |

### 2.5 Checklist wire mínimo

- [ ] Cluster Cockroach creado + SQL user + password guardado  
- [ ] IP allowlist configurada  
- [ ] `DATABASE_URL` en Render (secret, no en Git)  
- [ ] SSL (`sslmode=verify-full` o equivalente que exija Cloud)  
- [ ] Scripts SQL / migraciones versionadas en repo  
- [ ] Seed de datos demo (sexto, roles, preguntas)  
- [ ] Healthcheck HTTP (`/health` o `/api/health`) que verifique ping a BD  
- [ ] Recovery email: proveedor (Resend/SendGrid/Mailgun/SMTP) + secrets  
- [ ] Smoke test post-deploy: login, CRUD, PDF, Excel, recovery  
- [ ] URL pública en Confluence + README  
- [ ] Plan “wake before demo” (hit URL 2 min antes)

---

## 3) Facial + IA — MVP si van en Must del parcial

### 3.1 Recomendación Must facial en 17 días

| Pregunta | Respuesta |
|----------|-----------|
| ¿Facial en Must del **enunciado base** literal? | **No** |
| ¿Facial en Must si se toma **parcial alternativo / rúbrica Deploy+Evidencias**? | **Sí** |
| ¿Recomendación Mercado para el equipo? | **Sí incluir MVP facial + IA de dominio** como Must de parcial (capa 2), porque el propio docx exige demostrarlos en deploy/evidencias/sustentación. Alcance **mínimo**, no proctoring. |
| ¿Anti-fraude kiosco del colegio? | **Must de producto colegio (Track A)**, independiente del facial. Documentarlo como “integridad académica” en Confluence y sustentación. |

### 3.2 MVP facial realista (si Must) — no proctoring completo

El docx exige: registro facial, auth por rostro, comparación real (no solo foto), explicación tech/privacidad.

| Opción | Qué es | Pros | Contras | ¿MVP 17d? |
|--------|--------|------|---------|-----------|
| **A. MediaPipe Face Detector + embeddings locales (face-api.js / similar)** | Detecta rostro; guarda descriptor; compara distancia en login | Cumple “comparación”; on-device; docs Google | No es anti-spoof fuerte; falsos +/- | **Recomendada** |
| **B. Solo `FaceDetector` Shape Detection API** | API experimental Chrome | Muy simple | Soporte incompleto / flags; no da embedding de identidad fiable | No como única |
| **C. API cloud (AWS Rekognition, Azure Face, etc.)** | Match managed | Robusto | Costo, keys, datos biométricos fuera; setup legal | Evitar en parcial |
| **D. Liveness foto única al inicio sin match** | Selfie gate | Rápido | **No cumple** docx (“no basta tomar fotografía”) | Rechazada |
| **E. Continuous proctoring cámara** | Monitoreo toda la prueba | Mercado | Fuera de plazo + privacidad menores | Nice post |

**MVP Must facial (definición de hecho):**

1. Registro: usuario autenticado captura N frames → se calcula embedding → se guarda asociado a `user_id` (en BD: vector/array; **no** guardar fotos crudas si se puede evitar).  
2. Login facial: captura live → embedding → distancia vs stored → umbral → sesión.  
3. Fallback: login tradicional (hash) siempre disponible.  
4. Errores: sin rostro, múltiples rostros, no match, cámara denegada.  
5. Confluence: librería, flujo, privacidad, limitaciones.  
6. Evidencia: video login facial + SQL mostrando vínculo user↔embedding.

**Stack sugerido:** `@mediapipe/tasks-vision` Face Detector ([docs Google](https://developers.google.com/edge/mediapipe/solutions/vision/face_detector/web_js)) + librería de descriptors (p.ej. face-api.js) **o** pipeline documentado equivalente que haga match numérico.

### 3.3 MVP IA adicional (docx: “además del facial”, de dominio)

Dominio colegio = mates sexto / evaluaciones.

| Opción IA | Función real en la app | Esfuerzo |
|-----------|------------------------|----------|
| **Chatbot tutor mates sexto** (FAQ + LLM con system prompt acotado a banco/temario) | Resuelve “duda de práctica” fuera de examen seguro | Medio — **recomendada** |
| Generación de pistas (no respuestas) en modo práctica | Pedagógico | Medio |
| NL → filtro de reportes (“estudiantes bajo 60%”) | Wow BD+IA | Alto riesgo plazo |

**Fuera de examen kiosco:** la IA **no** debe ayudar durante evaluación segura (integridad). Modo práctica / post-intento sí.

### 3.4 Privacidad / menores (Colombia) — alto nivel

- Datos biométricos = **datos sensibles** bajo régimen de **Ley 1581 de 2012** (habeas data). Requieren autorización previa, expresa e informada; finalidad clara; seguridad.  
  Referencia normativa: [Ley 1581 / Función Pública](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=49981).  
- Para demo de parcial con datos de **prueba del equipo** (mayores): consentimiento escrito en Confluence + no usar rostros de menores reales del colegio hasta marco legal/Rectoría.  
- Producto colegio real (sexto): **bloquear** facial en producción institucional hasta aval jurídico/Rectoría; en demo académica usar solo cuentas de estudiantes universitarios del equipo.  
- Minimización: embeddings > fotos; borrado; no entrenar modelos propios con menores.

### 3.5 Anti-fraude del deck que SÍ entra en Must colegio (aunque facial sea Nice)

Documentar en Confluence como módulo **Integridad académica (kiosco)**:

1. `requestFullscreen` al iniciar evaluación.  
2. Listeners: `visibilitychange`, `blur`, `keydown` (Esc), opcional `pagehide`.  
3. Tabla `integrity_events` (attempt_id, tipo, timestamp).  
4. Umbral → marca intento `flagged` / suspendido; docente ve contador.  
5. Esto responde al problema de la propuesta (“apps/bots no controlan fraude”) **sin** biometría.

---

## 4) Referencias competitivas / mercado (breve)

Sin métricas inventadas; solo posicionamiento cualitativo con links.

| Producto | Qué hace | Gap vs Francisco Arango (MVP sexto) |
|----------|----------|-------------------------------------|
| **[Kahoot!](https://kahoot.com/schools/)** | Quizzes live gamificados, alto engagement en aula | No es plataforma institucional propia del colegio; integridad anti-fraude débil frente a IA/copia; sin certificado aval rector local |
| **[Quizizz / Wayground](https://wayground.com/)** | Quizzes student-paced + herramientas classroom | Genérico multi-escuela; no Cockroach/parcial; integridad y aval rector no son el foco de un MVP propio |
| **[Proctorizer](https://proctorizer.com/)** | e-proctoring LatAm (IA cámara, lock browser, LMS) | Pesado/licenciado; overkill para voluntariado sexto; no gamificación mates ni certificados del colegio |
| **[Klarway](https://klarway.com/)** | Proctoring + biometría + safe browser | Orientado integridad remota enterprise; no Kahoot-like ni MVP PWA de voluntariado |

**Posicionamiento del gap:** “Kahoot-like + integridad kiosco + certificado rector + BD propia (Cockroach) en PWA del colegio” — nicho que no cubre un proctoring comercial ni un quiz genérico por sí solos.

---

## 5) Recomendación ejecutiva (para Nexus → Dev Coordinación)

1. **Una app, dos Must lists:** checklist Parcial-base + MVP Colegio sexto; no construir Fase 2–3 rectoría en 17 días.  
2. **BD:** Cockroach Cloud + app Render; `DATABASE_URL` SSL; **prohibido** Render Postgres como BD del parcial.  
3. **Facial+IA:** tratarlos como **Must de rúbrica/demo** (capa 2 del docx); MVP fino (match embeddings + chatbot tutor práctica); confirmar con docente día 1.  
4. **Anti-fraude kiosco (fullscreen/foco/tab):** **Must producto colegio**; es el “integridad” vendible a Rectoría sin biometría institucional aún.  
5. **Certificado PDF + 1 Excel** (p.ej. resultados por estudiante / eventos integridad) cubren reportes del parcial y valor rectoría.  
6. **PWA mínima** (manifest + SW) desde sprint 1; no esperar al final.  
7. **Datos biométricos:** solo cuentas del equipo en demo; cero caras de menores hasta aval legal.  
8. **Confluence + scripts SQL + evidencias** son parte del Must, no “documentación después”.  
9. **Nombre carpeta/producto:** Darwin define (EduQuest u otro) antes del repo.  
10. **Riesgo #1 plazo:** cold start Render Free + recovery email + facial; mitigar con smoke tests diarios y wake pre-sustentación.

---

## 6) Mapa de entregables (quién mira qué)

| Entregable | Track | Owner sugerido |
|------------|-------|----------------|
| ER + SQL + Cockroach Cloud | B | BD / Backend |
| Auth hash + roles + recovery email | B | Backend |
| PDF certificado + Excel reportes | A+B | Backend |
| Kahoot-like sexto + banco preguntas | A | Fullstack + contenido |
| Kiosco anti-fraude + `integrity_events` | A | Frontend |
| Facial MVP + chatbot IA | B-alt | Frontend/IA |
| PWA + deploy Render URL | A+B | DevOps |
| Confluence + evidencias + repo | B | Todo el equipo |
| Aval firma Rector (real) | A institucional | Darwin / Rectoría (paralelo, no bloquea placeholder) |

---

## Anexo — Fuentes usadas

1. Nexus brief interno: `/workspace/colegio-francisco-arango/briefs/BRIEF_NEXUS.md`  
2. Enunciado profesor: `/workspace/colegio-francisco-arango/briefs/parcial-gestion-bd.docx`  
3. Propuesta rectoría: `/workspace/colegio-francisco-arango/briefs/propuesta-rectoria.pptx`  
4. Cockroach Quickstart: https://www.cockroachlabs.com/docs/cockroachcloud/quickstart  
5. Cockroach Connect: https://www.cockroachlabs.com/docs/cockroachcloud/connect-to-your-cluster  
6. Cockroach Costs (Basic $15 / 50M RU / 10 GiB): https://www.cockroachlabs.com/docs/cockroachcloud/costs  
7. Cockroach Free trial ($400 credits): https://www.cockroachlabs.com/docs/cockroachcloud/free-trial  
8. Cockroach site (citado en enunciado): https://www.cockroachlabs.com/  
9. Render Free limits: https://render.com/docs/free  
10. MediaPipe Face Detector Web: https://developers.google.com/edge/mediapipe/solutions/vision/face_detector/web_js  
11. Ley 1581/2012 (Colombia): https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=49981  
12. Kahoot Schools: https://kahoot.com/schools/  
13. Wayground (Quizizz): https://wayground.com/  
14. Proctorizer: https://proctorizer.com/  
15. Klarway: https://klarway.com/  

---

*Fin BRIEF_DISCOVERY_LAB_INNOVACION — agente Mercado. Sin métricas de mercado inventadas; números de planes solo los publicados en docs citadas.*
