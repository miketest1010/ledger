import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export const fieldClass =
  'h-11 w-full rounded-xl border border-line bg-card px-3 text-base text-ink outline-none transition placeholder:text-muted/70 focus:border-ink'

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}
