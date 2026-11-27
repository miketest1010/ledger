import type { TextareaHTMLAttributes } from 'react'
import { cn, fieldClass } from '@/lib/utils.ts'

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldClass, 'h-auto min-h-24 py-2', className)} {...props} />
}
