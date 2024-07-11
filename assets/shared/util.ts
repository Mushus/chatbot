export function pad0(num: number | string, length: number): string {
  return num.toString().padStart(length, '0');
}
