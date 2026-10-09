import { useAuth } from './auth';

export type CompanionId = 'luka' | 'luna';

export interface Companion {
  id: CompanionId;
  name: string;
  /** Spanish grammatical gender for UI copy ("tu compañero" / "tu compañera"). */
  female: boolean;
  /** "compañero" or "compañera". */
  noun: string;
}

export const COMPANIONS: Record<CompanionId, Companion> = {
  luka: { id: 'luka', name: 'Luka', female: false, noun: 'compañero' },
  luna: { id: 'luna', name: 'Luna', female: true, noun: 'compañera' },
};

export function useCompanion(): Companion {
  const { user } = useAuth();
  return COMPANIONS[user?.companion ?? 'luka'];
}
