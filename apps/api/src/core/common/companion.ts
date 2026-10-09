import type { DatabaseService } from '../database/database.service';

export type CompanionId = 'luka' | 'luna';

export interface Persona {
  id: CompanionId;
  name: string;
  female: boolean;
}

export const PERSONAS: Record<CompanionId, Persona> = {
  luka: { id: 'luka', name: 'Luka', female: false },
  luna: { id: 'luna', name: 'Luna', female: true },
};

/** The AI companion each student picked in Ajustes; Luka when there is no choice yet. */
export async function personaOf(database: DatabaseService, userId: string): Promise<Persona> {
  const row = await database.db.selectFrom('user_preferences').select('companion').where('user_id', '=', userId).executeTakeFirst();
  return PERSONAS[row?.companion === 'luna' ? 'luna' : 'luka'];
}

/** Prompt line so the model uses the chosen name and refers to itself with the right grammatical gender. */
export function personaLine(persona: Persona) {
  return persona.female
    ? `Te llamas ${persona.name}. Cuando hables de ti usa el femenino (por ejemplo: "estoy lista", "soy tu compañera").`
    : `Te llamas ${persona.name}. Cuando hables de ti usa el masculino (por ejemplo: "estoy listo", "soy tu compañero").`;
}
