export const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function formatBRL(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return 'R$ --';
  return currencyFormatter.format(value);
}

export function formatDateShort(dateString: string): string {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  } catch {
    return dateString;
  }
}

export function formatDateFull(dateString: string): string {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return dateString;
  }
}

export function formatTimeAgo(dateString: string): string {
  try {
    const d = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 0) return 'Agora';

    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `Há ${diffMins} min`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Há ${diffHours} h`;

    const diffDays = Math.floor(diffHours / 24);
    return `Há ${diffDays} d`;
  } catch {
    return 'Desconhecido';
  }
}

export function calculateWorkHours(price: number, income: number, hours: number): string {
  if (!income || !hours || income <= 0 || hours <= 0) return '0 h';
  const hourlyRate = income / hours;
  const h = price / hourlyRate;
  if (h < 1) {
    const mins = Math.round(h * 60);
    return `${mins} min`;
  }
  return `${h.toFixed(1)} h`;
}
