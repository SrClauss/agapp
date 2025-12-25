export function onlyDigits(value: string) {
  return (value || '').replace(/\D/g, '');
}

export function isValidCPF(cpf?: string | null): boolean {
  if (!cpf) return false;
  const digits = onlyDigits(cpf);
  if (digits.length !== 11) return false;
  // Reject CPFs with all identical digits
  if (/^(\d)\1+$/.test(digits)) return false;

  const toIntArray = (s: string) => s.split('').map((c) => parseInt(c, 10));
  const nums = toIntArray(digits);

  const calc = (arr: number[], factor: number) => {
    let total = 0;
    for (let i = 0; i < arr.length; i++) {
      total += arr[i] * (factor - i);
    }
    const remainder = (total * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  const digit1 = calc(nums.slice(0, 9), 10);
  const digit2 = calc(nums.slice(0, 10), 11);

  return digit1 === nums[9] && digit2 === nums[10];
}
