/**
 * Validation utilities for forms and user input
 */

export function validateCPF(cpf: string): boolean {
  if (!cpf) return false;
  
  // Remove non-numeric characters
  const cleanCPF = cpf.replace(/\D/g, '');
  
  // Check length
  if (cleanCPF.length !== 11) return false;
  
  // Check for invalid sequences (all same digit)
  if (/^(\d)\1+$/.test(cleanCPF)) return false;
  
  // Basic validation (simplified for testing)
  // In production, implement full CPF validation algorithm
  return true;
}

export function validateEmail(email: string): boolean {
  if (!email) return false;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePhone(phone: string): boolean {
  if (!phone) return false;
  
  const cleanPhone = phone.replace(/\D/g, '');
  return cleanPhone.length >= 10 && cleanPhone.length <= 11;
}

export function validatePassword(password: string): boolean {
  return password.length >= 8;
}
