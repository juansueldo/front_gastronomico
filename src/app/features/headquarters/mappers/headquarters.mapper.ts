import type { HeadquarterDto, HeadquarterScheduleDto } from '../types/headquarters.dto';
import type { Headquarter, HeadquarterScheduleInput } from '../types/headquarters.model';

export const normalizeHeadquarterId = (value: string | number) => String(value);

function normalizeNumberLike(value: unknown): number | string | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : String(value);
}

export function mapScheduleDtoToModel(schedule: HeadquarterScheduleDto): HeadquarterScheduleInput {
  return {
    dayOfWeek: String(schedule.dayOfWeek ?? schedule.day_of_week ?? '').trim().toLowerCase(),
    openTime: String(schedule.openTime ?? schedule.open_time ?? '').trim(),
    closeTime: String(schedule.closeTime ?? schedule.close_time ?? '').trim(),
    isClosed: Boolean(schedule.isClosed ?? schedule.is_closed),
  };
}

export function mapHeadquarterDtoToModel(item: HeadquarterDto): Headquarter {
  const statusId = Number(item.statusId ?? item.status_id);

  return {
    id: String(item.id ?? `headquarter-${Date.now()}-${Math.random()}`),
    name: String(item.name ?? 'Sede').trim(),
    phone: item.phone ? String(item.phone) : undefined,
    location: item.location ?? item.address,
    latitude: normalizeNumberLike(item.latitude ?? item.lat),
    longitude: normalizeNumberLike(item.longitude ?? item.lng),
    storeId: item.storeId !== undefined || item.store_id !== undefined
      ? String(item.storeId ?? item.store_id)
      : undefined,
    statusId: Number.isFinite(statusId) ? statusId : undefined,
    schedules: Array.isArray(item.schedules)
      ? item.schedules.map(mapScheduleDtoToModel)
      : undefined,
  };
}

export function mapScheduleModelToDto(schedule: HeadquarterScheduleInput) {
  const dayOfWeek = schedule.dayOfWeek.trim().toLowerCase();
  return {
    dayOfWeek,
    day_of_week: dayOfWeek,
    openTime: schedule.openTime.trim(),
    open_time: schedule.openTime.trim(),
    closeTime: schedule.closeTime.trim(),
    close_time: schedule.closeTime.trim(),
    isClosed: Boolean(schedule.isClosed),
    is_closed: Boolean(schedule.isClosed),
  };
}
