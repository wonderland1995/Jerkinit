export function cn(...classes: Array<string | undefined | null | boolean>): string {
  return classes.filter(Boolean).join(' ');
}

function parseDateInput(date: string | Date | null | undefined): Date | null {
  if (!date) return null;
  if (date instanceof Date) {
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const trimmed = date.trim();
  if (!trimmed) return null;

  const candidates = new Set<string>([trimmed]);

  for (const candidate of Array.from(candidates)) {
    if (candidate.includes(' ') && !candidate.includes('T')) {
      candidates.add(candidate.replace(' ', 'T'));
    }
  }

  for (const candidate of Array.from(candidates)) {
    if (/([+-]\d{2})(\d{2})$/.test(candidate)) {
      const withColon = candidate.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
      candidates.add(withColon);
      if (withColon.includes(' ') && !withColon.includes('T')) {
        candidates.add(withColon.replace(' ', 'T'));
      }
    } else if (/([+-]\d{2})$/.test(candidate) && !/:[0-5]\d$/.test(candidate)) {
      const withColon = candidate.replace(/([+-]\d{2})$/, '$1:00');
      candidates.add(withColon);
      if (withColon.includes(' ') && !withColon.includes('T')) {
        candidates.add(withColon.replace(' ', 'T'));
      }
    }
  }

  for (const candidate of Array.from(candidates)) {
    const trimmedFraction = candidate.replace(/\.(\d{3})\d*/, '.$1');
    if (trimmedFraction !== candidate) {
      candidates.add(trimmedFraction);
    }
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    candidates.add(`${trimmed}T00:00:00Z`);
  }

  for (const candidate of candidates) {
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

export function formatDate(date: string | Date | null | undefined, includeTime: boolean = false): string {
  const parsed = parseDateInput(date);
  if (!parsed) return '--';

  const baseOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };

  if (includeTime) {
    return parsed.toLocaleString('en-US', {
      ...baseOptions,
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return parsed.toLocaleDateString('en-US', baseOptions);
}

export function formatDateTime(date: string | Date | null | undefined): string {
  return formatDate(date, true);
}

export function formatNumber(num: number, decimals: number = 2): string {
  return num.toFixed(decimals);
}

export function normalizeQuantityForUnit(quantity: number, unit: string | null | undefined): number {
  if (!Number.isFinite(quantity)) {
    return 0;
  }

  const normalizedUnit = typeof unit === 'string' ? unit.trim().toLowerCase() : '';
  switch (normalizedUnit) {
    case 'kg':
    case 'kilogram':
      return quantity / 1000;
    case 'l':
    case 'liter':
    case 'litre':
      return quantity / 1000;
    default:
      return quantity;
  }
}

export function formatQuantity(
  quantity: number,
  unit: string | null | undefined,
  options: Intl.NumberFormatOptions = {}
): string {
  if (!Number.isFinite(quantity)) {
    return '--';
  }

  const normalized = normalizeQuantityForUnit(quantity, unit);
  const formatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: normalized < 1 ? 3 : 2,
    minimumFractionDigits: 0,
    ...options,
  });

  const unitLabel = typeof unit === 'string' && unit.trim().length > 0 ? unit : '';
  return unitLabel ? `${formatter.format(normalized)} ${unitLabel}` : formatter.format(normalized);
}
