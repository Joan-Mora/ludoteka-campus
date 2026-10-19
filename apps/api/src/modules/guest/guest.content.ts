/** Octavo only, for now. Other grades reuse this shape next week. Answers never leave the server until a round is over. */

export const CLASS_GRADE = 8;
export const CLASS_GROUPS = ['81', '82', '83'] as const;
export const ACTIVITIES = ['diagnostico', 'fabrica', 'elementos', 'casos'] as const;
export type Activity = (typeof ACTIVITIES)[number];

export const GRADE_NAME: Record<number, string> = { 6: 'Sexto', 7: 'Séptimo', 8: 'Octavo', 9: 'Noveno' };

export const CLASS_GRADES = [6, 7, 8, 9] as const;

/** Lo que el docente puede proyectar. El diagnóstico y el final son exámenes; el resto se juega moviendo piezas. */
export const GRADE_ACTIVITIES: Record<number, { id: string; label: string; hint: string }[]> = {
  6: [
    { id: 'diagnostico', label: 'Diagnóstico', hint: 'Cómo entran: ecuaciones, fracciones, regla de tres y estadística' },
    { id: 'balanza', label: 'La balanza', hint: 'Despeja x sumando, restando o dividiendo los dos lados' },
    { id: 'barras', label: 'Barras', hint: 'Parte una barra y pinta la suma de dos fracciones' },
    { id: 'proporcion', label: 'La jarra', hint: 'Regla de tres: sirve los pedidos sin romper la proporción' },
    { id: 'encuesta', label: 'La encuesta', hint: 'Arma la gráfica de barras con los datos, sin adivinar una opción' },
    { id: 'final', label: 'Examen final', hint: 'Los mismos temas, para comparar con el diagnóstico' },
  ],
  7: [
    { id: 'diagnostico', label: 'Diagnóstico', hint: 'Cómo entran: áreas, ecuaciones, proporcionalidad y polinomios' },
    { id: 'areas', label: 'Geoplano', hint: 'Pinta un rectángulo con el área pedida' },
    { id: 'balanza', label: 'La balanza', hint: 'Despeja x sumando, restando o dividiendo los dos lados' },
    { id: 'proporcion', label: 'La jarra', hint: 'Sirve los pedidos sin romper la proporción' },
    { id: 'fichas', label: 'Fichas', hint: 'Arma el rectángulo del polinomio' },
    { id: 'final', label: 'Examen final', hint: 'Los mismos temas, para comparar con el diagnóstico' },
  ],
  8: [
    { id: 'diagnostico', label: 'Diagnóstico', hint: 'Cómo entran: casos de factorización y fracciones algebraicas' },
    { id: 'fichas', label: 'Fichas', hint: 'Factoriza armando el rectángulo, sin opciones para adivinar' },
    { id: 'relato', label: 'La fábrica', hint: 'Cada compuerta es un rectángulo. Si fallas, la historia se traba y hay que repararla' },
    { id: 'elementos', label: 'Fuego y agua', hint: 'En parejas, sobre la misma ecuación: uno suma y el otro divide' },
    { id: 'final', label: 'Examen final', hint: 'Los mismos temas, para comparar con el diagnóstico' },
  ],
  9: [
    { id: 'diagnostico', label: 'Diagnóstico', hint: 'Cómo entran: sistemas 2x2, 3x3 y el método que elijan' },
    { id: 'cruce', label: 'Cruce de rectas', hint: 'Mueve las dos rectas hasta que sean las del sistema' },
    { id: 'gauss', label: 'Gauss-Jordan', hint: 'Opera filas tú mismo. También puedes pedir la explicación de una matriz' },
    { id: 'final', label: 'Examen final', hint: 'Los mismos temas, para comparar con el diagnóstico' },
  ],
};

export const PLAY_GAMES = ['balanza', 'barras', 'areas', 'proporcion', 'fichas', 'relato', 'elementos', 'cruce', 'gauss', 'encuesta'] as const;

export interface Option { id: string; text: string }
export interface Item {
  id: string;
  topic: string;
  prompt: string;
  options: Option[];
  answer: string;
  explain: string;
}

const opt = (pairs: [string, string][]): Option[] => pairs.map(([id, text]) => ({ id, text }));

export const DIAGNOSTIC: Item[] = [
  { id: 'd1', topic: 'Factor común', prompt: 'Factoriza 6x + 9', answer: 'a', explain: '3 es factor de 6x y de 9: 3(2x + 3).', options: opt([['a', '3(2x + 3)'], ['b', '6(x + 9)'], ['c', '2(3x + 9)'], ['d', '3(2x + 9)']]) },
  { id: 'd2', topic: 'Factor común', prompt: 'Factoriza 4x² + 8x', answer: 'a', explain: '4x es el factor común: 4x(x + 2).', options: opt([['a', '4x(x + 2)'], ['b', '4(x² + 8x)'], ['c', 'x(4x² + 2)'], ['d', '2x(2x + 8)']]) },
  { id: 'd3', topic: 'Diferencia de cuadrados', prompt: 'Factoriza x² − 16', answer: 'a', explain: 'x² − 4² = (x − 4)(x + 4).', options: opt([['a', '(x − 4)(x + 4)'], ['b', '(x − 16)(x + 1)'], ['c', '(x − 8)(x + 2)'], ['d', '(x − 4)²']]) },
  { id: 'd4', topic: 'Diferencia de cuadrados', prompt: 'Factoriza 9x² − 25', answer: 'a', explain: '(3x)² − 5² = (3x − 5)(3x + 5).', options: opt([['a', '(3x − 5)(3x + 5)'], ['b', '(9x − 5)(x + 5)'], ['c', '(3x − 25)(3x + 1)'], ['d', '(3x − 5)²']]) },
  { id: 'd5', topic: 'Trinomio cuadrado perfecto', prompt: 'Factoriza x² + 6x + 9', answer: 'a', explain: '6 = 2·3 y 9 = 3², así que es (x + 3)².', options: opt([['a', '(x + 3)²'], ['b', '(x + 9)²'], ['c', '(x + 6)²'], ['d', '(x − 3)²']]) },
  { id: 'd6', topic: 'Trinomio cuadrado perfecto', prompt: 'Factoriza x² − 10x + 25', answer: 'a', explain: '10 = 2·5 y 25 = 5², con el signo menos: (x − 5)².', options: opt([['a', '(x − 5)²'], ['b', '(x − 10)²'], ['c', '(x + 5)²'], ['d', '(x − 25)²']]) },
  { id: 'd7', topic: 'Trinomio x² + bx + c', prompt: 'Factoriza x² + 5x + 6', answer: 'a', explain: '2 y 3 suman 5 y multiplican 6: (x + 2)(x + 3).', options: opt([['a', '(x + 2)(x + 3)'], ['b', '(x + 1)(x + 6)'], ['c', '(x + 5)(x + 1)'], ['d', '(x − 2)(x − 3)']]) },
  { id: 'd8', topic: 'Trinomio x² + bx + c', prompt: 'Factoriza x² − 7x + 12', answer: 'a', explain: '−3 y −4 suman −7 y multiplican 12: (x − 3)(x − 4).', options: opt([['a', '(x − 3)(x − 4)'], ['b', '(x − 2)(x − 6)'], ['c', '(x + 3)(x − 4)'], ['d', '(x − 7)(x + 12)']]) },
  { id: 'd9', topic: 'Simplificar', prompt: 'Simplifica (x² − 9) / (x − 3), con x ≠ 3', answer: 'a', explain: 'x² − 9 = (x − 3)(x + 3). Se cancela (x − 3) y queda x + 3.', options: opt([['a', 'x + 3'], ['b', 'x − 3'], ['c', 'x² − 3'], ['d', '1']]) },
  { id: 'd10', topic: 'Simplificar', prompt: 'Simplifica (2x + 4) / (x + 2), con x ≠ −2', answer: 'a', explain: '2x + 4 = 2(x + 2). Se cancela (x + 2) y queda 2.', options: opt([['a', '2'], ['b', 'x + 2'], ['c', '2x'], ['d', '4']]) },
  { id: 'd11', topic: 'Operar fracciones', prompt: 'Calcula 1/x + 2/x, con x ≠ 0', answer: 'a', explain: 'Mismo denominador: se suman los numeradores. 1 + 2 = 3, queda 3/x.', options: opt([['a', '3/x'], ['b', '2/x'], ['c', '1/(2x)'], ['d', '3/(2x)']]) },
  { id: 'd12', topic: 'Operar fracciones', prompt: 'Calcula (x/3) · (6/x), con x ≠ 0', answer: 'a', explain: 'x se cancela y 6/3 = 2.', options: opt([['a', '2'], ['b', '6'], ['c', 'x/2'], ['d', '18/x']]) },
];

export interface Scene {
  id: string;
  text: string;
  prompt?: string;
  options?: Option[];
  answer?: string;
  explain?: string;
  topic?: string;
  ok?: string;
  bad?: string;
  end?: boolean;
}

/** A short branching story. A wrong gate does not end the game: the factory jams and the next scene is the repair. */
export const FACTORY: Scene[] = [
  { id: 'porton', text: 'La fábrica solo abre el portón si la caja trae el polinomio ya factorizado.', prompt: 'Factoriza x² − 9', topic: 'Diferencia de cuadrados', answer: 'a', explain: 'x² − 3² = (x − 3)(x + 3).', ok: 'cinta', bad: 'atasco', options: opt([['a', '(x − 3)(x + 3)'], ['b', '(x − 9)(x + 1)'], ['c', '(x − 3)²'], ['d', 'x(x − 9)']]) },
  { id: 'atasco', text: 'El portón se trabó. Hay que repararlo con otra diferencia de cuadrados antes de seguir.', prompt: 'Factoriza x² − 25', topic: 'Diferencia de cuadrados', answer: 'a', explain: 'x² − 5² = (x − 5)(x + 5).', ok: 'cinta', bad: 'atasco', options: opt([['a', '(x − 5)(x + 5)'], ['b', '(x − 25)(x + 1)'], ['c', '(x − 5)²'], ['d', '5(x − 5)']]) },
  { id: 'cinta', text: 'La cinta transportadora pide el factor común para dejar pasar la caja.', prompt: 'Factoriza 6x + 9', topic: 'Factor común', answer: 'a', explain: '3(2x + 3).', ok: 'prensa', bad: 'ayuda', options: opt([['a', '3(2x + 3)'], ['b', '6(x + 9)'], ['c', '9(x + 1)'], ['d', '2(3x + 9)']]) },
  { id: 'ayuda', text: 'La cinta se detuvo. Un operario te pasa un caso parecido para destrabarla.', prompt: 'Factoriza 4x + 10', topic: 'Factor común', answer: 'a', explain: '2 es factor de 4x y de 10: 2(2x + 5).', ok: 'prensa', bad: 'ayuda', options: opt([['a', '2(2x + 5)'], ['b', '4(x + 10)'], ['c', '5(x + 2)'], ['d', 'x(4 + 10)']]) },
  { id: 'prensa', text: 'La prensa solo sella trinomios cuadrados perfectos.', prompt: 'Factoriza x² + 6x + 9', topic: 'Trinomio cuadrado perfecto', answer: 'a', explain: '(x + 3)².', ok: 'muelle', bad: 'reproceso', options: opt([['a', '(x + 3)²'], ['b', '(x + 6)²'], ['c', '(x + 9)(x + 1)'], ['d', '(x − 3)²']]) },
  { id: 'reproceso', text: 'La prensa devolvió la caja. Hay que rehacer el sello.', prompt: 'Factoriza x² − 10x + 25', topic: 'Trinomio cuadrado perfecto', answer: 'a', explain: '(x − 5)².', ok: 'muelle', bad: 'reproceso', options: opt([['a', '(x − 5)²'], ['b', '(x − 10)²'], ['c', '(x + 5)²'], ['d', '(x − 25)(x + 1)']]) },
  { id: 'muelle', text: 'En el muelle hay que simplificar la fracción algebraica para etiquetar el envío.', prompt: 'Simplifica (x² − 4) / (x − 2), con x ≠ 2', topic: 'Simplificar', answer: 'a', explain: 'x² − 4 = (x − 2)(x + 2). Queda x + 2.', ok: 'fin', bad: 'fuga', options: opt([['a', 'x + 2'], ['b', 'x − 2'], ['c', 'x² − 2'], ['d', '4']]) },
  { id: 'fuga', text: 'La etiqueta salió mal y hay una fuga de cajas. Corrígelo con esta.', prompt: 'Simplifica (x² − 1) / (x − 1), con x ≠ 1', topic: 'Simplificar', answer: 'a', explain: 'x² − 1 = (x − 1)(x + 1). Queda x + 1.', ok: 'fin', bad: 'fuga', options: opt([['a', 'x + 1'], ['b', 'x − 1'], ['c', '1'], ['d', 'x² − 1']]) },
  { id: 'fin', text: 'El envío salió. La fábrica anota cómo te fue en cada compuerta: lo que acertaste a la primera y lo que hubo que reparar.', end: true },
];

export const FACTORY_GATES = ['porton', 'cinta', 'prensa', 'muelle'];

export const CASES: Item[] = [
  { id: 'c1', topic: 'Factor común', prompt: '5x + 15', answer: 'comun', explain: '5 es factor de los dos términos.', options: opt([['comun', 'Factor común'], ['diferencia', 'Diferencia de cuadrados'], ['perfecto', 'Trinomio cuadrado perfecto'], ['trinomio', 'Trinomio x² + bx + c']]) },
  { id: 'c2', topic: 'Diferencia de cuadrados', prompt: 'x² − 49', answer: 'diferencia', explain: '49 es 7² y hay un menos entre dos cuadrados.', options: opt([['comun', 'Factor común'], ['diferencia', 'Diferencia de cuadrados'], ['perfecto', 'Trinomio cuadrado perfecto'], ['trinomio', 'Trinomio x² + bx + c']]) },
  { id: 'c3', topic: 'Trinomio cuadrado perfecto', prompt: 'x² + 10x + 25', answer: 'perfecto', explain: '10 = 2·5 y 25 = 5².', options: opt([['comun', 'Factor común'], ['diferencia', 'Diferencia de cuadrados'], ['perfecto', 'Trinomio cuadrado perfecto'], ['trinomio', 'Trinomio x² + bx + c']]) },
  { id: 'c4', topic: 'Trinomio x² + bx + c', prompt: 'x² + 9x + 20', answer: 'trinomio', explain: 'Buscas dos números que sumen 9 y multipliquen 20 (4 y 5). No es un cuadrado perfecto.', options: opt([['comun', 'Factor común'], ['diferencia', 'Diferencia de cuadrados'], ['perfecto', 'Trinomio cuadrado perfecto'], ['trinomio', 'Trinomio x² + bx + c']]) },
  { id: 'c5', topic: 'Factor común', prompt: '4x² − 12x', answer: 'comun', explain: '4x está en los dos términos.', options: opt([['comun', 'Factor común'], ['diferencia', 'Diferencia de cuadrados'], ['perfecto', 'Trinomio cuadrado perfecto'], ['trinomio', 'Trinomio x² + bx + c']]) },
  { id: 'c6', topic: 'Diferencia de cuadrados', prompt: '4x² − 9', answer: 'diferencia', explain: '(2x)² − 3².', options: opt([['comun', 'Factor común'], ['diferencia', 'Diferencia de cuadrados'], ['perfecto', 'Trinomio cuadrado perfecto'], ['trinomio', 'Trinomio x² + bx + c']]) },
  { id: 'c7', topic: 'Trinomio cuadrado perfecto', prompt: 'x² − 8x + 16', answer: 'perfecto', explain: '8 = 2·4 y 16 = 4².', options: opt([['comun', 'Factor común'], ['diferencia', 'Diferencia de cuadrados'], ['perfecto', 'Trinomio cuadrado perfecto'], ['trinomio', 'Trinomio x² + bx + c']]) },
  { id: 'c8', topic: 'Trinomio x² + bx + c', prompt: 'x² − 5x + 6', answer: 'trinomio', explain: '−2 y −3 suman −5 y multiplican 6.', options: opt([['comun', 'Factor común'], ['diferencia', 'Diferencia de cuadrados'], ['perfecto', 'Trinomio cuadrado perfecto'], ['trinomio', 'Trinomio x² + bx + c']]) },
];

export const CASE_SECONDS = 90;

interface Lock { prompt: string; topic: string; options: Option[]; answer: string; explain: string }
export interface Gate { fire: Lock; water: Lock }

export const GATES: Gate[] = [
  { fire: { topic: 'Diferencia de cuadrados', prompt: 'Factoriza x² − 16', answer: 'a', explain: '(x − 4)(x + 4).', options: opt([['a', '(x − 4)(x + 4)'], ['b', '(x − 16)²'], ['c', '(x − 8)(x + 2)'], ['d', 'x(x − 16)']]) }, water: { topic: 'Simplificar', prompt: 'Simplifica (2x + 6) / (x + 3)', answer: 'a', explain: '2(x + 3) / (x + 3) = 2.', options: opt([['a', '2'], ['b', 'x + 3'], ['c', '6'], ['d', '2x']]) } },
  { fire: { topic: 'Factor común', prompt: 'Factoriza 8x + 12', answer: 'a', explain: '4(2x + 3).', options: opt([['a', '4(2x + 3)'], ['b', '8(x + 12)'], ['c', '2(4x + 12)'], ['d', 'x(8 + 12)']]) }, water: { topic: 'Simplificar', prompt: 'Simplifica (x² − 9) / (x − 3)', answer: 'a', explain: 'Queda x + 3.', options: opt([['a', 'x + 3'], ['b', 'x − 3'], ['c', 'x − 9'], ['d', '3']]) } },
  { fire: { topic: 'Trinomio cuadrado perfecto', prompt: 'Factoriza x² + 8x + 16', answer: 'a', explain: '(x + 4)².', options: opt([['a', '(x + 4)²'], ['b', '(x + 8)²'], ['c', '(x + 2)(x + 8)'], ['d', '(x − 4)²']]) }, water: { topic: 'Operar fracciones', prompt: 'Calcula 3/x + 2/x', answer: 'a', explain: '5/x.', options: opt([['a', '5/x'], ['b', '6/x'], ['c', '5/(2x)'], ['d', '6/x²']]) } },
  { fire: { topic: 'Trinomio x² + bx + c', prompt: 'Factoriza x² + 7x + 12', answer: 'a', explain: '(x + 3)(x + 4).', options: opt([['a', '(x + 3)(x + 4)'], ['b', '(x + 6)(x + 2)'], ['c', '(x + 7)(x + 1)'], ['d', '(x + 12)(x + 1)']]) }, water: { topic: 'Operar fracciones', prompt: 'Calcula (x/2) · (4/x)', answer: 'a', explain: '4/2 = 2.', options: opt([['a', '2'], ['b', '4'], ['c', 'x'], ['d', '8/x']]) } },
  { fire: { topic: 'Diferencia de cuadrados', prompt: 'Factoriza 9x² − 4', answer: 'a', explain: '(3x − 2)(3x + 2).', options: opt([['a', '(3x − 2)(3x + 2)'], ['b', '(9x − 2)(x + 2)'], ['c', '(3x − 4)²'], ['d', '(3x − 2)²']]) }, water: { topic: 'Simplificar', prompt: 'Simplifica (x² − 1) / (x + 1)', answer: 'a', explain: 'Queda x − 1.', options: opt([['a', 'x − 1'], ['b', 'x + 1'], ['c', '1'], ['d', 'x² − 1']]) } },
  { fire: { topic: 'Trinomio cuadrado perfecto', prompt: 'Factoriza x² − 6x + 9', answer: 'a', explain: '(x − 3)².', options: opt([['a', '(x − 3)²'], ['b', '(x − 6)²'], ['c', '(x + 3)²'], ['d', '(x − 9)(x + 1)']]) }, water: { topic: 'Simplificar', prompt: 'Simplifica (4x − 8) / (2x − 4)', answer: 'a', explain: '4(x − 2) / 2(x − 2) = 2.', options: opt([['a', '2'], ['b', '4'], ['c', 'x − 2'], ['d', '1/2']]) } },
];

const input = (id: string, topic: string, prompt: string, answer: string, explain: string): Item => ({ id, topic, prompt, options: [], answer, explain });

export const EXAMS: Record<number, { diagnostico: Item[]; final: Item[] }> = {
  6: {
    diagnostico: [
      input('s6d1', 'Ecuaciones', 'Resuelve 2x + 3 = 11. Escribe solo el valor de x.', '4', 'Resto 3 en los dos lados: 2x = 8. Divido entre 2: x = 4.'),
      input('s6d2', 'Ecuaciones', 'Resuelve 5x − 4 = 16. Escribe solo el valor de x.', '4', 'Sumo 4: 5x = 20. x = 4.'),
      input('s6d3', 'Fracciones', 'Calcula 1/2 + 1/3. Escríbela simplificada, como 5/6.', '5/6', 'El común es 6: 3/6 + 2/6 = 5/6.'),
      input('s6d4', 'Fracciones', 'Calcula 3/4 − 1/4.', '1/2', '3/4 − 1/4 = 2/4 = 1/2.'),
      input('s6d5', 'Regla de tres', '4 cuadernos cuestan 6000. ¿Cuánto cuestan 10? Escribe solo el número.', '15000', 'Cada uno cuesta 1500. Diez cuestan 15000.'),
      input('s6d6', 'Regla de tres', '3 personas comen 6 panes. ¿Cuántos panes comen 5 personas?', '10', '2 panes por persona. 5 × 2 = 10.'),
      input('s6d7', 'Estadística', 'La media de 4, 6, 8 y 6. Escribe el número.', '6', '(4 + 6 + 8 + 6) / 4 = 24 / 4 = 6.'),
      input('s6d8', 'Estadística', 'La moda de 2, 5, 2, 7, 2, 5.', '2', 'El 2 aparece tres veces, más que los otros.'),
    ],
    final: [
      input('s6f1', 'Ecuaciones', 'Resuelve 3x + 2 = 17. Escribe solo x.', '5', '3x = 15, x = 5.'),
      input('s6f2', 'Ecuaciones', 'Resuelve 4x − 6 = 18. Escribe solo x.', '6', '4x = 24, x = 6.'),
      input('s6f3', 'Fracciones', 'Calcula 2/3 + 1/6.', '5/6', '4/6 + 1/6 = 5/6.'),
      input('s6f4', 'Fracciones', 'Calcula 1/2 × 3/5.', '3/10', 'Numeradores y denominadores se multiplican.'),
      input('s6f5', 'Regla de tres', '2 litros cuestan 5000. ¿Cuánto cuestan 5 litros?', '12500', 'El litro cuesta 2500. Cinco cuestan 12500.'),
      input('s6f6', 'Regla de tres', '6 metros de tela alcanzan para 2 faldas. ¿Cuántos metros para 5 faldas?', '15', '3 metros por falda. 5 × 3 = 15.'),
      input('s6f7', 'Estadística', 'La media de 10, 12, 8 y 10.', '10', '40 / 4 = 10.'),
      input('s6f8', 'Estadística', 'La mediana de 3, 9, 4, 1, 7. Ordénalos primero.', '4', 'Orden: 1, 3, 4, 7, 9. El del centro es 4.'),
    ],
  },
  7: {
    diagnostico: [
      input('s7d1', 'Áreas', 'Área de un rectángulo de base 8 y altura 5.', '40', '8 × 5 = 40.'),
      input('s7d2', 'Áreas', 'Área de un triángulo de base 10 y altura 6.', '30', '(10 × 6) / 2 = 30.'),
      input('s7d3', 'Ecuaciones', 'Resuelve 2x + 5 = 19.', '7', '2x = 14, x = 7.'),
      input('s7d4', 'Proporcionalidad', 'Si 3 kg cuestan 12000, ¿cuánto cuestan 7 kg?', '28000', 'El kilo cuesta 4000. 7 × 4000 = 28000.'),
      input('s7d5', 'Polinomios', 'Suma (2x + 3) + (x + 4). Escríbela como 3x+7.', '3x+7', '2x + x = 3x y 3 + 4 = 7.'),
      input('s7d6', 'Polinomios', 'Multiplica x(x + 5). Escríbela como x^2+5x.', 'x^2+5x', 'x·x + x·5.'),
    ],
    final: [
      input('s7f1', 'Áreas', 'Área de un rectángulo de base 12 y altura 4.', '48', '12 × 4 = 48.'),
      input('s7f2', 'Áreas', 'Área de un triángulo de base 9 y altura 4.', '18', '(9 × 4) / 2 = 18.'),
      input('s7f3', 'Ecuaciones', 'Resuelve 3x − 6 = 15.', '7', '3x = 21, x = 7.'),
      input('s7f4', 'Proporcionalidad', '2 cuadernos cuestan 7000. ¿Cuánto cuestan 5?', '17500', 'Cada uno cuesta 3500. 5 × 3500 = 17500.'),
      input('s7f5', 'Polinomios', 'Resta (5x + 2) − (2x + 1). Escríbela como 3x+1.', '3x+1', '5x − 2x = 3x y 2 − 1 = 1.'),
      input('s7f6', 'Polinomios', 'Multiplica (x + 2)(x + 3). Escríbela como x^2+5x+6.', 'x^2+5x+6', 'x² + 3x + 2x + 6.'),
    ],
  },
  9: {
    diagnostico: [
      input('s9d1', 'Sustitución', 'En x + y = 7 y x = 2, ¿cuánto vale y?', '5', '2 + y = 7, y = 5.'),
      input('s9d2', 'Reducción', 'x + y = 5 y x − y = 1. ¿Cuánto vale x?', '3', 'Al sumar las ecuaciones, 2x = 6, x = 3.'),
      input('s9d3', 'Igualación', 'y = 2x e y = x + 3. ¿Cuánto vale x?', '3', '2x = x + 3, x = 3.'),
      input('s9d4', 'Método gráfico', 'Las rectas y = x e y = −x + 4 se cruzan. ¿Cuánto vale x en el cruce?', '2', 'x = −x + 4, 2x = 4, x = 2.'),
      input('s9d5', 'Sistema 3x3', 'Si x = 1, y = 2 y z = 3, ¿cuánto es x + y + z?', '6', '1 + 2 + 3 = 6. Es el chequeo de la suma.'),
    ],
    final: [
      input('s9f1', 'Sustitución', 'y = 3x y x + y = 12. ¿Cuánto vale x?', '3', 'x + 3x = 12, x = 3.'),
      input('s9f2', 'Reducción', '2x + y = 8 y 2x − y = 4. ¿Cuánto vale x?', '3', 'Al sumar, 4x = 12, x = 3.'),
      input('s9f3', 'Igualación', 'x = y + 1 y x = 2y − 2. ¿Cuánto vale y?', '3', 'y + 1 = 2y − 2, y = 3.'),
      input('s9f4', 'Método gráfico', 'y = 2x + 1 e y = 5. ¿Cuánto vale x?', '2', '2x + 1 = 5, x = 2.'),
      input('s9f5', 'Gauss-Jordan', 'En la fila 1 0 4, la x ya está despejada. ¿Cuánto vale x?', '4', '1·x + 0·y = 4.'),
    ],
  },
};

const FINAL_8: Item[] = [
  input('s8f1', 'Factor común', 'Factoriza 10x + 15. Escríbela como 5(2x+3).', '5(2x+3)', '5 es factor de 10x y de 15.'),
  input('s8f2', 'Diferencia de cuadrados', 'Factoriza x^2 − 36. Escríbela como (x-6)(x+6).', '(x-6)(x+6)', '36 es 6².'),
  input('s8f3', 'Trinomio cuadrado perfecto', 'Factoriza x^2 + 8x + 16. Escríbela como (x+4)^2.', '(x+4)^2', '8 = 2·4 y 16 = 4².'),
  input('s8f4', 'Trinomio', 'Factoriza x^2 + 8x + 15. Escríbela como (x+3)(x+5).', '(x+3)(x+5)', '3 y 5 suman 8 y multiplican 15.'),
  input('s8f5', 'Simplificar', 'Simplifica (x^2 − 16)/(x − 4), con x distinto de 4.', 'x+4', 'Se cancela (x − 4) y queda x + 4.'),
  input('s8f6', 'Operar', 'Calcula 4/x + 1/x, con x distinto de 0.', '5/x', 'Mismo denominador: se suman los numeradores.'),
];

export function examItems(grade: number, which: 'diagnostico' | 'final'): Item[] {
  if (grade === 8 && which === 'diagnostico') return DIAGNOSTIC;
  if (grade === 8 && which === 'final') return FINAL_8;
  return EXAMS[grade]?.[which] ?? EXAMS[6]![which];
}

export function normAnswer(value: string) {
  return value.replace(/\s+/g, '').replace(/−/g, '-').replace(',', '.').toLowerCase();
}

export function publicItem(item: Item) {
  return { id: item.id, topic: item.topic, prompt: item.prompt, options: item.options, input: item.options.length === 0 };
}

export function publicLock(lock: Lock) {
  return { prompt: lock.prompt, topic: lock.topic, options: lock.options };
}

export function sceneView(scene: Scene) {
  return { id: scene.id, text: scene.text, prompt: scene.prompt, options: scene.options, end: Boolean(scene.end) };
}
