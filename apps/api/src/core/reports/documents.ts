import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

export function reportId(prefix: string) {
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  return `${prefix}-${stamp}`;
}

export function pdfDocument(draw: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    draw(doc);
    doc.end();
  });
}

export function paintHeader(doc: PDFKit.PDFDocument, title: string, id: string) {
  doc.fillColor('#5b3df5').fontSize(20).text('Ludoteka Campus · Colegio Francisco Arango');
  doc.moveDown(0.3);
  doc.fillColor('#1C2430').fontSize(16).text(title);
  doc.fontSize(10).fillColor('#5C6570').text(`Generado: ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`);
  doc.text(`Identificador: ${id}`);
  doc.moveDown();
  doc.fillColor('#1C2430');
}

export async function workbookBuffer(build: (book: ExcelJS.Workbook) => void) {
  const book = new ExcelJS.Workbook();
  book.creator = 'Ludoteka Campus';
  build(book);
  const data = await book.xlsx.writeBuffer();
  return Buffer.from(data);
}
