import type { ComponentType } from 'react';
import { Brain, Castle, Grid3x3, ListOrdered, PieChart, Rocket, Ruler, ShoppingCart, SpellCheck, Zap, type LucideIcon } from 'lucide-react';
import { ARCADE_INFO, type ArcadeGame, type ArcadeUi } from '@eduquest/contracts';
import { ChoiceBoard, GridBoard, HangmanBoard, InputBoard, LineBoard, MemoryBoard, OrderBoard, type BoardProps } from './boards';

/** Registro del Arcade: aspecto de cada juego y el tablero que dibuja cada tipo de pregunta. */
export const GAME_LOOK: Record<ArcadeGame, { icon: LucideIcon; bg: string }> = {
  carrera: { icon: Rocket, bg: 'linear-gradient(135deg, #7c5cff, #3a7bff)' },
  fracciones: { icon: PieChart, bg: 'linear-gradient(135deg, #ff9f43, #ff5d73)' },
  memoria: { icon: Brain, bg: 'linear-gradient(135deg, #19c39c, #0ea5e9)' },
  recta: { icon: Ruler, bg: 'linear-gradient(135deg, #3a7bff, #19c39c)' },
  ordena: { icon: ListOrdered, bg: 'linear-gradient(135deg, #a855f7, #ec4899)' },
  torre: { icon: Castle, bg: 'linear-gradient(135deg, #f59e0b, #ef4444)' },
  mercado: { icon: ShoppingCart, bg: 'linear-gradient(135deg, #10b981, #65a30d)' },
  area: { icon: Grid3x3, bg: 'linear-gradient(135deg, #0ea5e9, #6366f1)' },
  ahorcado: { icon: SpellCheck, bg: 'linear-gradient(135deg, #ec4899, #f97316)' },
  quiz: { icon: Zap, bg: 'linear-gradient(135deg, #eab308, #f97316)' },
};

export const BOARDS: Record<ArcadeUi, ComponentType<BoardProps>> = {
  input: InputBoard,
  choice: ChoiceBoard,
  memory: MemoryBoard,
  line: LineBoard,
  order: OrderBoard,
  grid: GridBoard,
  hangman: HangmanBoard,
};

/** Tableros que se juegan en varios pasos y avisan solos cuando terminan. */
export const MULTI_STEP: ArcadeUi[] = ['memory', 'hangman'];

export const gameInfo = (code: ArcadeGame) => ({ ...ARCADE_INFO[code], ...GAME_LOOK[code] });
