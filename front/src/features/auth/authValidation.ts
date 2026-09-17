export const passwordPattern = '^(?=.*[A-Z])(?=(?:.*\\d){2,})(?=.*[^A-Za-z0-9]).{8,}$';
export const phonePattern = /^(?:0[1-9]\d{8}|0[1-9](?: \d{2}){4}|0[1-9](?:\.\d{2}){4})$/;

export function normalizePhoneInput(value: string) {
  return value.trim().replace(/^(?:\+33|0033)[ .-]?/, '0').replace(/[^0-9 .]/g, '').slice(0, 14);
}
