import PDFDocument from 'pdfkit';

export const GUIDE_TITLE = 'Guía de matemáticas de sexto: fracciones, decimales y geometría';

const SECTIONS: { title: string; paragraphs: string[] }[] = [
  {
    title: '1. Fracciones',
    paragraphs: [
      'Una fracción representa una o varias partes iguales de una unidad. Se escribe a/b, donde el numerador a indica cuántas partes se toman y el denominador b indica en cuántas partes iguales se dividió la unidad. El denominador nunca puede ser cero.',
      'Fracciones propias son las que tienen el numerador menor que el denominador, como 3/5, y valen menos que una unidad. Fracciones impropias tienen el numerador mayor o igual que el denominador, como 7/4, y se pueden escribir como número mixto: 7/4 = 1 3/4.',
      'Dos fracciones son equivalentes cuando representan la misma cantidad. Se obtienen multiplicando o dividiendo el numerador y el denominador por el mismo número distinto de cero. Por ejemplo, 1/2 = 2/4 = 3/6 = 4/8. Para comprobar si dos fracciones son equivalentes se multiplican en cruz: 2/3 y 8/12 son equivalentes porque 2 × 12 = 3 × 8 = 24.',
      'Simplificar una fracción es encontrar su fracción equivalente más pequeña, llamada fracción irreducible. Se divide el numerador y el denominador entre su máximo común divisor. Ejemplo: para simplificar 18/24 se calcula el MCD de 18 y 24, que es 6, y queda 18/24 = 3/4.',
    ],
  },
  {
    title: '2. Operaciones con fracciones',
    paragraphs: [
      'Para sumar o restar fracciones con el mismo denominador se suman o restan los numeradores y se conserva el denominador: 2/7 + 3/7 = 5/7.',
      'Si los denominadores son distintos, primero se buscan fracciones equivalentes con un denominador común, que suele ser el mínimo común múltiplo de los denominadores. Ejemplo: 1/4 + 1/6. El MCM de 4 y 6 es 12, entonces 1/4 = 3/12 y 1/6 = 2/12, y la suma es 5/12.',
      'Para multiplicar fracciones se multiplican los numeradores entre sí y los denominadores entre sí: 2/3 × 4/5 = 8/15. Conviene simplificar antes de multiplicar cuando sea posible.',
      'Para dividir fracciones se multiplica la primera por el inverso de la segunda: 3/4 ÷ 2/5 = 3/4 × 5/2 = 15/8.',
    ],
  },
  {
    title: '3. Máximo común divisor y mínimo común múltiplo',
    paragraphs: [
      'El máximo común divisor (MCD) de dos números es el mayor número que divide a ambos sin dejar residuo. Se puede hallar descomponiendo en factores primos y multiplicando los factores comunes con su menor exponente. MCD(18, 24): 18 = 2 × 3², 24 = 2³ × 3, entonces MCD = 2 × 3 = 6.',
      'El mínimo común múltiplo (MCM) es el menor número, distinto de cero, que es múltiplo de ambos. Se multiplican los factores comunes y no comunes con su mayor exponente. MCM(4, 6): 4 = 2², 6 = 2 × 3, entonces MCM = 2² × 3 = 12.',
      'Un número primo solo tiene dos divisores: 1 y él mismo. Los primeros números primos son 2, 3, 5, 7, 11, 13, 17, 19, 23 y 29. El número 1 no es primo.',
    ],
  },
  {
    title: '4. Números decimales',
    paragraphs: [
      'Un número decimal tiene una parte entera y una parte decimal separadas por una coma. En 12,375 la parte entera es 12, el 3 está en las décimas, el 7 en las centésimas y el 5 en las milésimas.',
      'Toda fracción decimal se puede escribir como número decimal: 3/10 = 0,3; 45/100 = 0,45. Para convertir cualquier fracción en decimal se divide el numerador entre el denominador: 3/4 = 0,75.',
      'Para sumar o restar decimales se alinean las comas. Para multiplicar se multiplica como si fueran enteros y luego se separan tantas cifras decimales como tengan entre los dos factores: 1,2 × 0,3 = 0,36.',
    ],
  },
  {
    title: '5. Perímetro y área',
    paragraphs: [
      'El perímetro es la longitud del contorno de una figura y se obtiene sumando la medida de todos sus lados. El perímetro de un rectángulo de 8 cm de largo y 5 cm de ancho es 8 + 5 + 8 + 5 = 26 cm.',
      'El área es la medida de la superficie que ocupa una figura y se expresa en unidades cuadradas. Área del rectángulo = base × altura. Área del cuadrado = lado × lado. Área del triángulo = (base × altura) ÷ 2. Un triángulo de base 10 cm y altura 6 cm tiene un área de 30 cm².',
      'La circunferencia es el contorno de un círculo. Su longitud es 2 × π × radio, y el área del círculo es π × radio². Para sexto se usa π ≈ 3,14.',
    ],
  },
];

/** A real multi-page guide so the library, the RAG tutor and the glossary have content from the first deploy. */
export function buildGuidePdf(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 64, info: { Title: GUIDE_TITLE, Author: 'Colegio Francisco Arango' } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.fillColor('#5b3df5').fontSize(22).text('Ludoteka Campus', { align: 'left' });
    doc.fillColor('#1d1a3a').fontSize(16).text(GUIDE_TITLE);
    doc.moveDown(0.4).fillColor('#6b6890').fontSize(11).text('Colegio Francisco Arango · Grado sexto · Material de consulta');
    doc.moveDown(1.2);
    SECTIONS.forEach((section, index) => {
      if (index > 0 && index % 2 === 0) doc.addPage();
      doc.fillColor('#5b3df5').fontSize(15).text(section.title);
      doc.moveDown(0.4);
      for (const paragraph of section.paragraphs) {
        doc.fillColor('#1d1a3a').fontSize(11.5).text(paragraph, { align: 'justify', lineGap: 3 });
        doc.moveDown(0.6);
      }
      doc.moveDown(0.6);
    });
    doc.end();
  });
}
