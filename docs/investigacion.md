# Ludoteka Campus — Investigación competitiva y técnica

> Última revisión: 2026-10-09 · Responsable: Cronista
> **Nombre:** Ludoteka Campus (nombre pendiente de confirmar por Darwin; antes EduQuest).
> **Fuente:** `BRIEF_DISCOVERY_LAB_INNOVACION.md` (agente Mercado, 2026-09-28), enunciado `parcial-gestion-bd.docx` y propuesta a rectoría. No hay métricas de mercado inventadas: solo posicionamiento cualitativo y cifras publicadas en la documentación oficial citada.

## 1. Referencias competitivas

| Producto | Qué hace | Brecha frente al CFA | Decisión de Ludoteka que sale de aquí |
|----------|----------|----------------------|---------------------------------------|
| [Kahoot!](https://kahoot.com/schools/) | Quiz en vivo gamificado con mucho enganche en el aula | No es un aula propia del colegio, la integridad es débil y no tiene certificado con aval del rector | Quiz en vivo y **Arena por equipos** (EQ-C02, ADR-008). Ancla visual Fuego CFA (tono Kahoot), sin clonar |
| [Wayground (antes Quizizz)](https://wayground.com/) | Quiz a ritmo propio y herramientas de clase | Es genérico y multi-escuela, sin integridad ni aval como foco | Práctica a ritmo propio, **Mi ruta** adaptativa y Cuaderno con SM-2 (EQ-P10) |
| [Proctorizer](https://proctorizer.com/) | E-proctoring en LatAm: cámara con IA, navegador bloqueado e integración con LMS | Pesado y con licencia; desproporcionado para un voluntariado de sexto | **Kiosco ligero** sin cámara: pantalla completa, foco, pestaña, Esc y suspensión (EQ-C05). Sin proctoring continuo |
| [Klarway](https://klarway.com/) | Proctoring con biometría y navegador seguro | Integridad remota corporativa, sin juego ni PWA | Facial **solo como login**, en el dispositivo, con consentimiento y contraseña alternativa (ADR-002 y ADR-007). Nada de vigilancia durante el examen |

**Posicionamiento:** juego tipo Kahoot, integridad de kiosco, certificado con aval del rector y una base propia en CockroachDB, todo en una PWA del colegio. Ni un proctoring comercial ni un quiz genérico cubren ese nicho por sí solos.

## 2. Referencias técnicas

| Tema | Referencia | Qué dice (según la doc citada) | Decisión |
|------|------------|-------------------------------|----------|
| Base distribuida | [Cockroach Quickstart](https://www.cockroachlabs.com/docs/cockroachcloud/quickstart) · [Connect to cluster](https://www.cockroachlabs.com/docs/cockroachcloud/connect-to-your-cluster) | Cadena `postgresql://…` con SSL. Allowlist de IP | CockroachDB Cloud como única base. `DATABASE_URL` solo en el entorno (ADR-004) |
| Costos de Cockroach | [Costs](https://www.cockroachlabs.com/docs/cockroachcloud/costs) · [Free trial](https://www.cockroachlabs.com/docs/cockroachcloud/free-trial) | Basic: crédito mensual de 15 USD (unos 50M RU y 10 GiB). Prueba de 400 USD | Alcanza para el parcial si no se hacen pruebas de carga |
| Hosting | [Render Free](https://render.com/docs/free) | Se duerme tras 15 min, arranque en frío de cerca de 1 min, disco efímero | Despertar la URL 2 min antes de la demo. Archivos en Cloudinary, no en disco (ADR-005) |
| Facial | [MediaPipe Face Detector Web](https://developers.google.com/edge/mediapipe/solutions/vision/face_detector/web_js) | Detección en el navegador | Primera versión con geometría de MediaPipe, reemplazada el 5-oct por face-api con descriptores de 128 dimensiones (ADR-007) |
| Protección de datos | [Ley 1581 de 2012](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=49981) | Los datos biométricos son sensibles: requieren autorización previa, expresa e informada | Consentimiento versionado, acudiente para menores, sin fotos, borrado y habeas data (RNF-F, módulo legal) |
| Enunciado del parcial | `briefs/parcial-gestion-bd.docx` | El enunciado base no exige facial, IA ni voz, pero las secciones de deploy, evidencias y sustentación piden demostrar facial e IA. El parcial alternativo agrega voz | Facial, IA y voz entran como Must (EQ-P09, P10 y P11) |

## 3. Opciones evaluadas para el facial (brief §3.2)

| Opción | Resultado |
|--------|-----------|
| A. Detector en el navegador más descriptores (face-api) | **Elegida.** Hace una comparación real en el dispositivo |
| B. Solo la Shape Detection API (`FaceDetector`) | Descartada: es experimental y no da identidad |
| C. API de biometría en la nube | Descartada: costo, llaves y datos sensibles fuera del país |
| D. Una foto sin comparación | Descartada: el enunciado dice que "no basta tomar una fotografía" |
| E. Cámara continua durante el examen | Nice; queda fuera por privacidad de menores |

## 4. Brechas abiertas

- Confirmar con el docente si el "parcial alternativo" (voz, IA y facial) es obligatorio para todos los equipos. El equipo lo trata como Must.
- La firma del rector en el certificado es un marcador hasta el aval formal.
- La prueba de vida por gesto no frena un video. Se declara como control de laboratorio.
