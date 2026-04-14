function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatDateForDateInput(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatIsoForDatetimeLocal(isoString: string): string {
  const date = new Date(isoString);

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function parseDatetimeLocalToIso(value: string): string {
  const [datePart, timePart] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);

  return new Date(year, month - 1, day, hours, minutes, 0, 0).toISOString();
}

export function parseDateAndTimeToIso(dateValue: string, timeValue: string): string {
  return parseDatetimeLocalToIso(`${dateValue}T${timeValue}`);
}

export function parseDateInputToLocalDate(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function startOfLocalDateIso(dateKey: string): string {
  const date = parseDateInputToLocalDate(dateKey);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

export function endOfLocalDateIso(dateKey: string): string {
  const date = parseDateInputToLocalDate(dateKey);
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
}

export function shiftLocalDateKey(dateKey: string, days: number): string {
  const date = parseDateInputToLocalDate(dateKey);
  date.setDate(date.getDate() + days);
  return formatDateForDateInput(date);
}

export function monthStartDateKey(dateKey: string): string {
  const date = parseDateInputToLocalDate(dateKey);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-01`;
}

export function shiftLocalMonthKey(dateKey: string, months: number): string {
  const date = parseDateInputToLocalDate(dateKey);
  const currentDay = date.getDate();
  const targetMonthStart = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const monthEnd = new Date(
    targetMonthStart.getFullYear(),
    targetMonthStart.getMonth() + 1,
    0
  ).getDate();

  return formatDateForDateInput(
    new Date(
      targetMonthStart.getFullYear(),
      targetMonthStart.getMonth(),
      Math.min(currentDay, monthEnd),
      0,
      0,
      0,
      0
    )
  );
}
