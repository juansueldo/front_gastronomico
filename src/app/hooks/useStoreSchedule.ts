import { useMemo } from 'react';

export type Schedule = {
  day_of_week: string; // e.g. 'monday', 'tuesday', ...
  open_time: string;  // 'HH:mm:ss'
  close_time: string; // 'HH:mm:ss'
  is_closed: boolean;
};

export function getDayOfWeekName(date: Date): string {
  // Returns e.g. 'monday', 'tuesday', ...
  return [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ][date.getDay()];
}

export function isStoreOpenNow(schedules: Schedule[], now: Date = new Date()): boolean {
  const day = getDayOfWeekName(now);
  const todaySchedule = schedules.find(s => s.day_of_week === day && !s.is_closed);
  if (!todaySchedule) return false;
  const [openH, openM] = todaySchedule.open_time.split(':').map(Number);
  const [closeH, closeM] = todaySchedule.close_time.split(':').map(Number);
  const open = new Date(now);
  open.setHours(openH, openM, 0, 0);
  const close = new Date(now);
  close.setHours(closeH, closeM, 0, 0);
  // If close is past midnight, add 1 day
  if (close <= open) close.setDate(close.getDate() + 1);
  return now >= open && now <= close;
}

export function getNext7DaysScheduleOptions(schedules: Schedule[], now: Date = new Date()): { id: string, label: string, date: Date }[] {
  const options: { id: string, label: string, date: Date }[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(now);
    date.setDate(now.getDate() + i);
    const day = getDayOfWeekName(date);
    const schedule = schedules.find(s => s.day_of_week === day && !s.is_closed);
    if (!schedule) continue;
    const [openH, openM] = schedule.open_time.split(':').map(Number);
    const [closeH, closeM] = schedule.close_time.split(':').map(Number);
    const open = new Date(date);
    open.setHours(openH, openM, 0, 0);
    const close = new Date(date);
    close.setHours(closeH, closeM, 0, 0);
    if (close <= open) close.setDate(close.getDate() + 1);
    // Generate 30-min slots
    let slot = new Date(open);
    while (slot < close) {
      // If today, only show future slots
      if (i > 0 || slot > now) {
        const id = slot.toISOString();
        const label = slot.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        options.push({ id, label: `${label} (${day.charAt(0).toUpperCase() + day.slice(1)})`, date: new Date(slot) });
      }
      slot = new Date(slot.getTime() + 30 * 60000);
    }
  }
  return options;
}

export function useStoreSchedule(schedules: Schedule[] | undefined, now: Date = new Date()) {
  return useMemo(() => {
    if (!schedules) return { isOpen: false, options: [] };
    return {
      isOpen: isStoreOpenNow(schedules, now),
      options: getNext7DaysScheduleOptions(schedules, now),
    };
  }, [JSON.stringify(schedules), now.getTime()]);
}
