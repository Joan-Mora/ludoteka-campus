# Glosario

| Término | Significado |
|---------|-------------|
| Acudiente | Rol `guardian`. Sigue a sus hijos (`guardian_links`), recibe alertas de riesgo y autoriza el registro facial de un menor |
| Alerta de riesgo | Fila de `risk_alerts`: nota baja, inasistencias, integridad o inactividad, con nivel `media` o `alta` |
| Arena | Juego en vivo por equipos con capitán rotativo, votos, candado de respuesta y podio |
| Campus | Pantalla de inicio isométrica: cada edificio abre un módulo |
| Capitán | Miembro del equipo que bloquea la respuesta en la Arena; rota en cada pregunta |
| Cartelera | Novedades del colegio con audiencia, fijado, programación y confirmación de lectura |
| Código LK | Consecutivo `LK-AAAA-NNNNNN` de cada reporte, guardado en `report_log` y verificable en `/verificar-reporte/<código>` |
| Coordinación | Rol `directivo`. Ve indicadores del colegio, el Observatorio y los reportes |
| Cuaderno | Apuntes del estudiante con resumen IA, tarjetas de repaso, metas y sesiones de enfoque |
| Descriptor facial | Vector de 128 números que calcula face-api; se guarda cifrado en `face_templates` |
| Estación | Unidad del mapa de un curso |
| Kiosco | Examen a pantalla completa que registra salida, pérdida de foco y Escape |
| Liga | Ranking de XP del grupo, guardado por semana en `leaderboard_snapshots` |
| Libro de calificaciones | Notas ponderadas por categoría en escala 1.0 a 5.0, con asistencia y rúbricas |
| Libro de XP | Tabla `xp_ledger`. El total se suma; no hay un contador editable |
| Luka | Compañero del campus que sugiere la siguiente actividad |
| Maestría | Nivel de 1 a 10 por estudiante y tema (`topic_mastery`) |
| Mi ruta | Retos adaptativos por tema; el servidor verifica la respuesta que propone la IA |
| Observatorio | Preguntas en español convertidas a SQL de solo lectura sobre las vistas `v_*` |
| Prueba de vida | Gesto aleatorio (parpadear o girar) que se exige antes de tomar las muestras faciales |
| RAG | Recuperación de fragmentos de la biblioteca (`library_chunks`) para que el tutor responda con citas |
| SM-2 | Algoritmo de repaso espaciado: cada tarjeta vuelve según qué tan fácil fue recordarla |
| Snapshot | Estado efímero de una sala de Arena guardado en `arena_rooms.snapshot` para sobrevivir a un reinicio |
| `groups_class` | Tabla del grupo. El nombre evita la palabra reservada `GROUP` |
| `ludoteka_reader` | Rol de base de datos con `SELECT` solo sobre las vistas `v_*` |
