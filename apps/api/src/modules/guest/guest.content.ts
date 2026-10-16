/** Octavo only, for now. Other grades reuse this shape next week. Answers never leave the server until a round is over. */

export const CLASS_GRADE = 8;
export const CLASS_GROUPS = ['81', '82', '83'] as const;
export const ACTIVITIES = ['diagnostico', 'fabrica', 'elementos', 'casos'] as const;
export type Activity = (typeof ACTIVITIES)[number];

export const GRADE_NAME: Record<number, string> = { 6: 'Sexto', 7: 'Séptimo', 8: 'Octavo', 9: 'Noveno' };

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

export function publicItem(item: Item) {
  return { id: item.id, topic: item.topic, prompt: item.prompt, options: item.options };
}

export function publicLock(lock: Lock) {
  return { prompt: lock.prompt, topic: lock.topic, options: lock.options };
}

export function sceneView(scene: Scene) {
  return { id: scene.id, text: scene.text, prompt: scene.prompt, options: scene.options, end: Boolean(scene.end) };
}
