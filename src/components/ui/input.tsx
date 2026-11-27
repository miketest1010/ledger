import type { InputHTMLAttributes } from 'react'
import { cn, fieldClass } from '@/lib/utils.ts'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldClass, className)} {...props} />
}
