import { FACIAL_POLICY_VERSION } from '../../shared/types/api'

/** Copy Ley 1581 / RNF-F07 — visible en registro y enroll (P09.1/P09.3). */
export function ConsentCopy({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`rounded-xl border border-black/10 bg-[var(--eq-bg)] text-sm ${compact ? 'p-3' : 'p-4'}`}>
      <p className="font-medium text-[var(--eq-primary)]">Tratamiento de datos biométricos (Ley 1581 de 2012)</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--eq-muted)]">
        <li>
          <strong>Finalidad:</strong> ingreso a tu cuenta personal en EduQuest (Colegio Francisco Arango)
          mediante reconocimiento facial opcional.
        </li>
        <li>
          <strong>Dato:</strong> vector biométrico sensible generado <em>en tu dispositivo</em>. No se envía ni
          almacena la foto; solo el embedding + identificador del modelo.
        </li>
        <li>
          <strong>Responsable:</strong> Colegio Francisco Arango / operadores técnicos de EduQuest.
        </li>
        <li>
          <strong>Retención y borrado:</strong> puedes borrar tu embedding en cualquier momento (ajuste Facial).
          También se elimina al dar de baja la cuenta o al vencer el plazo de retención configurado por el colegio.
        </li>
        <li>
          <strong>Alternativa:</strong> la contraseña permanece siempre disponible; el facial no es obligatorio.
        </li>
        <li>
          Política vigente: <code>{FACIAL_POLICY_VERSION}</code>. Si cambia la versión, deberás volver a consentir.
        </li>
      </ul>
    </div>
  )
}