export function getPasswordStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  if (password.length === 0) {
    return 0;
  }

  const checks = [
    password.length >= 8,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^a-zA-Z0-9]/.test(password)
  ];

  const scores = [0, 1, 2, 3, 4] as const;
  return scores[checks.filter(Boolean).length];
}
