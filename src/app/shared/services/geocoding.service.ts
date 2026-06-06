export type AddressSuggestion = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
};

export type GeocodedAddressResult = {
  formattedAddress: string;
  latitude: number;
  longitude: number;
};

type NominatimResult = {
  place_id?: string | number;
  display_name?: string;
  lat?: string | number;
  lon?: string | number;
};

type NominatimSearchAttempt = {
  query: string;
  countryCode?: string;
  useViewbox?: boolean;
};

const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';

export type AddressSearchContext = {
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
};

const COUNTRY_CODES: Record<string, string> = {
  argentina: 'ar',
  uruguay: 'uy',
  paraguay: 'py',
  chile: 'cl',
  brasil: 'br',
  brazil: 'br',
  bolivia: 'bo',
};

function getCountryCode(context?: AddressSearchContext) {
  const explicitCode = context?.countryCode?.trim().toLowerCase();
  if (explicitCode) return explicitCode;
  const country = context?.country?.trim().toLowerCase();
  return country ? COUNTRY_CODES[country] : undefined;
}

function buildContextualQuery(query: string, context?: AddressSearchContext) {
  return [query, context?.city, context?.region, context?.country]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(', ');
}

function mapNominatimPayload(payload: unknown): AddressSuggestion[] {
  if (!Array.isArray(payload)) return [];

  return payload
    .map((item: NominatimResult, index: number) => {
      const latitude = Number(item?.lat);
      const longitude = Number(item?.lon);
      const label = String(item?.display_name ?? '').trim();
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !label) return null;
      return {
        id: String(item?.place_id ?? `${label}-${index}`),
        label,
        latitude,
        longitude,
      };
    })
    .filter((item: AddressSuggestion | null): item is AddressSuggestion => item !== null);
}

export async function searchAddressSuggestions(
  query: string,
  signal?: AbortSignal,
  context?: AddressSearchContext,
): Promise<AddressSuggestion[]> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 4) return [];

  try {
    const countryCode = getCountryCode(context);
    const contextualQuery = buildContextualQuery(trimmedQuery, context);
    const attempts: NominatimSearchAttempt[] = [
      { query: contextualQuery || trimmedQuery, countryCode, useViewbox: true },
      { query: trimmedQuery, countryCode, useViewbox: true },
      { query: trimmedQuery, countryCode },
      { query: trimmedQuery },
    ];

    for (const attempt of attempts) {
      if (signal?.aborted) return [];

      const url = new URL(NOMINATIM_SEARCH_URL);
      url.searchParams.set('format', 'json');
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('limit', '5');
      url.searchParams.set('q', attempt.query);

      if (attempt.countryCode) {
        url.searchParams.set('countrycodes', attempt.countryCode);
      }

      if (attempt.useViewbox && Number.isFinite(context?.latitude) && Number.isFinite(context?.longitude)) {
        const lat = Number(context?.latitude);
        const lng = Number(context?.longitude);
        url.searchParams.set('viewbox', `${lng - 0.45},${lat + 0.45},${lng + 0.45},${lat - 0.45}`);
      }

      const response = await fetch(
        url.toString(),
        { method: 'GET', signal, headers: { 'Accept-Language': 'es' } },
      );
      if (!response.ok) continue;

      const suggestions = mapNominatimPayload(await response.json().catch(() => []));
      if (suggestions.length > 0) return suggestions;
    }

    return [];
  } catch {
    return [];
  }
}

export async function geocodeAddressWithGoogle(
  address: string,
  googleMapsApiKey?: string,
): Promise<GeocodedAddressResult | null> {
  const trimmedAddress = address.trim();
  if (!trimmedAddress || !googleMapsApiKey) return null;

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(trimmedAddress)}&key=${googleMapsApiKey}`,
    );

    if (!response.ok) return null;

    const data = await response.json() as {
      status: string;
      results?: Array<{
        formatted_address: string;
        geometry: {
          location: {
            lat: number;
            lng: number;
          };
        };
      }>;
    };

    if (data.status !== 'OK' || !data.results || data.results.length === 0) return null;

    const firstResult = data.results[0];
    return {
      formattedAddress: firstResult.formatted_address,
      latitude: firstResult.geometry.location.lat,
      longitude: firstResult.geometry.location.lng,
    };
  } catch {
    return null;
  }
}

export async function geocodeAddressWithNominatim(address: string): Promise<GeocodedAddressResult | null> {
  const suggestions = await searchAddressSuggestions(address);
  if (suggestions.length === 0) return null;

  const firstSuggestion = suggestions[0];
  return {
    formattedAddress: firstSuggestion.label,
    latitude: firstSuggestion.latitude,
    longitude: firstSuggestion.longitude,
  };
}

export async function reverseGeocodeCoordinates(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<GeocodedAddressResult | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  try {
    const url = new URL(NOMINATIM_REVERSE_URL);
    url.searchParams.set('format', 'json');
    url.searchParams.set('lat', String(latitude));
    url.searchParams.set('lon', String(longitude));
    url.searchParams.set('zoom', '18');
    url.searchParams.set('addressdetails', '1');

    const response = await fetch(
      url.toString(),
      { method: 'GET', signal, headers: { 'Accept-Language': 'es' } },
    );
    if (!response.ok) return null;

    const payload = await response.json().catch(() => null) as NominatimResult | null;
    const formattedAddress = String(payload?.display_name ?? '').trim();
    const resolvedLatitude = Number(payload?.lat ?? latitude);
    const resolvedLongitude = Number(payload?.lon ?? longitude);
    if (!formattedAddress) return null;

    return {
      formattedAddress,
      latitude: Number.isFinite(resolvedLatitude) ? resolvedLatitude : latitude,
      longitude: Number.isFinite(resolvedLongitude) ? resolvedLongitude : longitude,
    };
  } catch {
    return null;
  }
}

export async function geocodeAddress(
  address: string,
  options: { googleMapsApiKey?: string } = {},
): Promise<GeocodedAddressResult | null> {
  return (
    await geocodeAddressWithGoogle(address, options.googleMapsApiKey)
  ) ?? geocodeAddressWithNominatim(address);
}
