/** Quita correos, teléfonos y enlaces antes de enviar texto de un usuario a la IA. */
export function redact(text: string) {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[correo]')
    .replace(/https?:\/\/\S+/g, '[enlace]')
    .replace(/(?:\+?\d[\s-]?){7,}/g, '[número]');
}
