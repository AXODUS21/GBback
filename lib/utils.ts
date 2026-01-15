import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generates a unique voucher code in the format: GBF-XXXX-XXXX
 * where XXXX are uppercase alphanumeric characters
 */
export function generateVoucherCode(): string {
  const prefix = 'GBF'
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Excluding confusing characters (0, O, I, 1)
  const sections = 2
  const sectionLength = 4
  
  let code = prefix
  for (let i = 0; i < sections; i++) {
    code += '-'
    for (let j = 0; j < sectionLength; j++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
  }
  
  return code
}