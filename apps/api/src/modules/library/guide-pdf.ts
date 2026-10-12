import { existsSync } from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { repoRoot } from '../../core/config/env';

export interface GuideContent {
  intro: string;
  objectives: string[];
  sections: { title: string; paragraphs: string[]; example?: { statement: string; solution: string } }[];
  practice: { question: string; answer: string }[];
  glossary: { term: string; definition: string }[];
  closing: string;
}

export interface GuideMeta {
  title: string;
  subject: string;
  grade: string;
  dba: string[];
  author: string;
}

const INK = '#1d1a3a';
const MUTED = '#6b6890';
const ACCENT: Record<string, string> = {
  Matemáticas: '#5b3df5',
  Lenguaje: '#d9480f',
  'Ciencias Naturales': '#2b8a3e',
  'Ciencias Sociales': '#b7791f',
  Inglés: '#1971c2',
};

/** Liberation Sans ships with pdfjs-dist and covers √, π, ≈ and ≤, which Helvetica (WinAnsi) cannot draw. */
function fonts() {
  const dir = path.join(repoRoot(), 'node_modules', 'pdfjs-dist', 'standard_fonts');
  const regular = path.join(dir, 'LiberationSans-Regular.ttf');
  const bold = path.join(dir, 'LiberationSans-Bold.ttf');
  return existsSync(regular) && existsSync(bold) ? { regular, bold } : { regular: 'Helvetica', bold: 'Helvetica-Bold' };
}

/** Study guide laid out for print: cover band, objectives, sections with worked examples, practice, answers and glossary. */
export function renderGuidePdf(meta: GuideMeta, guide: GuideContent): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const accent = ACCENT[meta.subject] ?? '#5b3df5';
    const font = fonts();
    const doc = new PDFDocument({ size: 'LETTER', margin: 64, bufferPages: true, info: { Title: meta.title, Author: meta.author, Subject: `${meta.subject} · ${meta.grade}` } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    const width = doc.page.width - 128;
    const body = (text: string, options: PDFKit.Mixins.TextOptions = {}) =>
      doc.font(font.regular).fillColor(INK).fontSize(11.5).text(text, { align: 'justify', lineGap: 3, ...options });
    const heading = (text: string, size = 15) => {
      if (doc.y > doc.page.height - 160) doc.addPage();
      doc.moveDown(0.6).font(font.bold).fillColor(accent).fontSize(size).text(text);
      doc.moveDown(0.35);
    };

    doc.rect(0, 0, doc.page.width, 150).fill(accent);
    doc.font(font.bold).fillColor('#ffffff').fontSize(11).text(`LUDOTEKA CAMPUS · ${meta.subject.toUpperCase()} · GRADO ${meta.grade.toUpperCase()}`, 64, 44, { characterSpacing: 1 });
    doc.font(font.bold).fontSize(22).text(meta.title, 64, 66, { width });
    doc.font(font.regular).fillColor(MUTED).fontSize(10).text(`${meta.author} · Guía de estudio`, 64, 168);
    doc.y = 190;

    body(guide.intro);
    heading('Lo que vas a lograr', 13);
    for (const objective of guide.objectives) body(`•  ${objective}`, { align: 'left', indent: 6 });

    guide.sections.forEach((section, index) => {
      heading(`${index + 1}. ${section.title}`);
      for (const paragraph of section.paragraphs) {
        body(paragraph);
        doc.moveDown(0.5);
      }
      if (section.example) {
        const text = `Ejemplo. ${section.example.statement}\n\nSolución. ${section.example.solution}`;
        doc.font(font.regular).fontSize(11);
        const height = doc.heightOfString(text, { width: width - 28, lineGap: 2 }) + 24;
        if (doc.y + height > doc.page.height - 72) doc.addPage();
        const top = doc.y;
        doc.roundedRect(64, top, width, height, 8).fillOpacity(0.07).fill(accent).fillOpacity(1);
        doc.rect(64, top, 4, height).fill(accent);
        doc.font(font.regular).fillColor(INK).fontSize(11).text(text, 78, top + 12, { width: width - 28, lineGap: 2 });
        doc.x = 64;
        doc.y = top + height + 8;
      }
    });

    heading('Practica');
    guide.practice.forEach((item, index) => {
      body(`${index + 1}. ${item.question}`, { align: 'left' });
      doc.moveDown(0.3);
    });

    heading('Glosario', 13);
    for (const entry of guide.glossary) {
      doc.font(font.bold).fillColor(INK).fontSize(11).text(`${entry.term}: `, { continued: true });
      doc.font(font.regular).text(entry.definition, { lineGap: 2 });
      doc.moveDown(0.25);
    }

    heading('Para cerrar', 13);
    body(guide.closing);

    heading('Respuestas de la práctica', 13);
    guide.practice.forEach((item, index) => body(`${index + 1}. ${item.answer}`, { align: 'left' }));

    if (meta.dba.length) {
      heading('Derechos Básicos de Aprendizaje que trabaja esta guía', 11);
      doc.font(font.regular).fillColor(MUTED).fontSize(9.5);
      for (const line of meta.dba) doc.text(line, { lineGap: 1.5 }).moveDown(0.2);
      doc.text('Fuente: Ministerio de Educación Nacional, Derechos Básicos de Aprendizaje.', { lineGap: 1.5 });
    }

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0;
      doc.font(font.regular).fillColor(MUTED).fontSize(8.5)
        .text(`${meta.title} · página ${i + 1} de ${range.count}`, 64, doc.page.height - 44, { width, align: 'center', lineBreak: false });
    }
    doc.end();
  });
}
