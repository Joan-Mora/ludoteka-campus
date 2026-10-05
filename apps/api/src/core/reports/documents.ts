import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import QRCode from 'qrcode';

export interface ReportMeta {
  code: string;
  title: string;
  subtitle?: string;
  generatedAt: Date;
  generatedBy?: string | null;
  verifyUrl: string;
  /** Tables the report reads from, printed so the reader knows the data is live from CockroachDB. */
  source: string;
}

export interface Column {
  label: string;
  width: number;
  align?: 'left' | 'right' | 'center';
}

const INK = '#16132d';
const MUTED = '#7a7799';
const VIOLET = '#5b3df5';
const LINE = '#e6e3f4';
const ZEBRA = '#f6f4ff';

export function stamp(date: Date) {
  return date.toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'long', timeStyle: 'short' });
}

export class PdfHelpers {
  constructor(private readonly doc: PDFKit.PDFDocument) {}

  private get bottom() {
    return this.doc.page.height - this.doc.page.margins.bottom - 24;
  }

  ensure(space: number) {
    if (this.doc.y + space > this.bottom) this.doc.addPage();
  }

  section(title: string) {
    this.ensure(48);
    this.doc.moveDown(0.6);
    this.doc.fillColor(VIOLET).font('Helvetica-Bold').fontSize(12.5).text(title.toUpperCase(), { characterSpacing: 0.6 });
    const y = this.doc.y + 3;
    this.doc.moveTo(this.doc.page.margins.left, y).lineTo(this.doc.page.width - this.doc.page.margins.right, y).lineWidth(1).strokeColor(LINE).stroke();
    this.doc.moveDown(0.6);
    this.doc.fillColor(INK).font('Helvetica').fontSize(10.5);
  }

  paragraph(text: string, options: { muted?: boolean; size?: number } = {}) {
    this.ensure(30);
    this.doc.fillColor(options.muted ? MUTED : INK).font('Helvetica').fontSize(options.size ?? 10.5).text(text, { lineGap: 2 });
    this.doc.fillColor(INK);
  }

  keyValues(pairs: [string, string | number][]) {
    const left = this.doc.page.margins.left;
    for (const [key, value] of pairs) {
      this.ensure(18);
      const y = this.doc.y;
      this.doc.font('Helvetica-Bold').fontSize(10).fillColor(MUTED).text(key, left, y, { width: 150 });
      this.doc.font('Helvetica').fontSize(10.5).fillColor(INK).text(String(value), left + 155, y, { width: this.doc.page.width - left * 2 - 155 });
      this.doc.moveDown(0.25);
    }
    this.doc.x = left;
  }

  table(columns: Column[], rows: (string | number | null | undefined)[][], empty = 'Sin registros en la base de datos para este filtro.') {
    const doc = this.doc;
    const left = doc.page.margins.left;
    const usable = doc.page.width - left - doc.page.margins.right;
    const total = columns.reduce((sum, column) => sum + column.width, 0);
    const widths = columns.map((column) => (column.width / total) * usable);
    const header = () => {
      this.ensure(40);
      const y = doc.y;
      doc.rect(left, y, usable, 20).fill(VIOLET);
      let x = left;
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff');
      columns.forEach((column, i) => {
        doc.text(column.label, x + 6, y + 6, { width: widths[i]! - 12, align: column.align ?? 'left', lineBreak: false, ellipsis: true });
        x += widths[i]!;
      });
      doc.y = y + 20;
    };
    header();
    if (!rows.length) {
      doc.font('Helvetica-Oblique').fontSize(10).fillColor(MUTED).text(empty, left + 6, doc.y + 8);
      doc.moveDown(1);
      doc.x = left;
      return;
    }
    rows.forEach((row, index) => {
      doc.font('Helvetica').fontSize(9.5);
      const heights = row.map((cell, i) => doc.heightOfString(String(cell ?? '—'), { width: widths[i]! - 12 }));
      const height = Math.max(18, ...heights.map((h) => h + 8));
      if (doc.y + height > this.bottom) {
        doc.addPage();
        header();
      }
      const y = doc.y;
      if (index % 2 === 1) doc.rect(left, y, usable, height).fill(ZEBRA);
      let x = left;
      doc.fillColor(INK).font('Helvetica').fontSize(9.5);
      row.forEach((cell, i) => {
        doc.text(String(cell ?? '—'), x + 6, y + 4, { width: widths[i]! - 12, align: columns[i]?.align ?? 'left' });
        x += widths[i]!;
      });
      doc.y = y + height;
    });
    doc.moveTo(left, doc.y).lineTo(left + usable, doc.y).lineWidth(0.8).strokeColor(LINE).stroke();
    doc.moveDown(0.8);
    doc.x = left;
  }
}

export async function renderPdf(meta: ReportMeta, draw: (doc: PDFKit.PDFDocument, h: PdfHelpers) => void): Promise<Buffer> {
  const qr = await QRCode.toBuffer(meta.verifyUrl, { width: 160, margin: 1, color: { dark: '#16132d', light: '#ffffff' } });
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4', bufferPages: true, info: { Title: `${meta.title} · ${meta.code}`, Author: 'Ludoteka Campus' } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const width = doc.page.width - left * 2;
    doc.rect(0, 0, doc.page.width, 8).fill(VIOLET);
    doc.image(qr, left + width - 74, 36, { width: 74 });
    doc.fillColor(VIOLET).font('Helvetica-Bold').fontSize(10).text('LUDOTEKA CAMPUS · COLEGIO FRANCISCO ARANGO', left, 40, { width: width - 90, characterSpacing: 0.8 });
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(21).text(meta.title, left, 58, { width: width - 90 });
    if (meta.subtitle) doc.fillColor(MUTED).font('Helvetica').fontSize(11).text(meta.subtitle, { width: width - 90 });
    doc.moveDown(0.5);
    const y = Math.max(doc.y, 118);
    doc.roundedRect(left, y, width, 46, 8).fill('#f4f3fb');
    const cells: [string, string][] = [
      ['Reporte N.º', meta.code],
      ['Generado', stamp(meta.generatedAt)],
      ['Generado por', meta.generatedBy ?? 'Sistema'],
    ];
    cells.forEach(([label, value], i) => {
      const x = left + 12 + (i * (width - 24)) / 3;
      doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(8).text(label.toUpperCase(), x, y + 9, { width: (width - 24) / 3 - 8 });
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(10).text(value, x, y + 22, { width: (width - 24) / 3 - 8 });
    });
    doc.y = y + 60;
    doc.x = left;
    doc.fillColor(INK).font('Helvetica').fontSize(10.5);

    draw(doc, new PdfHelpers(doc));

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const footerY = doc.page.height - 36;
      doc.page.margins.bottom = 0;
      doc.fillColor(MUTED).font('Helvetica').fontSize(8)
        .text(`${meta.code} · Datos consultados en CockroachDB (${meta.source}) · Verificar: ${meta.verifyUrl}`, left, footerY, { width: width - 70, lineBreak: false, ellipsis: true })
        .text(`Página ${i - range.start + 1} de ${range.count}`, left + width - 70, footerY, { width: 70, align: 'right', lineBreak: false });
    }
    doc.end();
  });
}

export interface SheetColumn {
  header: string;
  width: number;
  numFmt?: string;
}

export class WorkbookHelpers {
  constructor(private readonly book: ExcelJS.Workbook, private readonly meta: ReportMeta) {}

  sheet(name: string, columns: SheetColumn[], rows: (string | number | Date | null | undefined)[][], subtitle?: string) {
    const sheet = this.book.addWorksheet(name.slice(0, 31), { views: [{ state: 'frozen', ySplit: 8 }] });
    sheet.columns = columns.map((column) => ({ width: column.width }));
    const span = Math.max(columns.length, 4);
    const title = sheet.addRow(['Ludoteka Campus · Colegio Francisco Arango']);
    title.font = { bold: true, color: { argb: 'FF5B3DF5' }, size: 11 };
    const main = sheet.addRow([this.meta.title + (subtitle ? ` · ${subtitle}` : '')]);
    main.font = { bold: true, size: 16 };
    sheet.addRow(['Reporte N.º', this.meta.code]);
    sheet.addRow(['Generado', stamp(this.meta.generatedAt)]);
    sheet.addRow(['Generado por', this.meta.generatedBy ?? 'Sistema']);
    sheet.addRow(['Fuente', `CockroachDB · ${this.meta.source}`]);
    for (const n of [3, 4, 5, 6]) sheet.getRow(n).getCell(1).font = { bold: true, color: { argb: 'FF7A7799' } };
    sheet.addRow([]);
    sheet.mergeCells(1, 1, 1, span);
    sheet.mergeCells(2, 1, 2, span);
    const header = sheet.addRow(columns.map((column) => column.header));
    header.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B3DF5' } };
      cell.alignment = { vertical: 'middle' };
    });
    header.height = 22;
    rows.forEach((values, index) => {
      const row = sheet.addRow(values.map((value) => value ?? ''));
      if (index % 2 === 1) row.eachCell({ includeEmpty: true }, (cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6F4FF' } }; });
      columns.forEach((column, i) => { if (column.numFmt) row.getCell(i + 1).numFmt = column.numFmt; });
    });
    if (!rows.length) sheet.addRow(['Sin registros en la base de datos para este filtro.']).font = { italic: true, color: { argb: 'FF7A7799' } };
    sheet.autoFilter = { from: { row: 8, column: 1 }, to: { row: 8, column: columns.length } };
    return sheet;
  }
}

export async function renderWorkbook(meta: ReportMeta, build: (h: WorkbookHelpers, book: ExcelJS.Workbook) => void) {
  const book = new ExcelJS.Workbook();
  book.creator = 'Ludoteka Campus';
  book.title = `${meta.title} · ${meta.code}`;
  book.created = meta.generatedAt;
  build(new WorkbookHelpers(book, meta), book);
  const data = await book.xlsx.writeBuffer();
  return Buffer.from(data);
}

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
