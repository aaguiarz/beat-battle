export function isValidGroupCode(code: string): boolean {
  return /^[A-Za-z0-9]{12}$/.test(code);
}

export function validateJoinCode(code: string): { isValid: boolean; error?: string } {
  const trimmedCode = code.trim();
  
  if (!trimmedCode) {
    return { isValid: false, error: 'Please enter a group code first.' };
  }
  
  if (!isValidGroupCode(trimmedCode)) {
    return { isValid: false, error: 'Group codes must be 12 alphanumeric characters.' };
  }
  
  return { isValid: true };
}