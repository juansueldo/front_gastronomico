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

const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';

export async function searchAddressSuggestions(query: string, signal?: AbortSignal): Promise<AddressSuggestion[]> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 4) return [];

  try {
    const response = await fetch(
      `${NOMINATIM_SEARCH_URL}?format=json&addressdetails=1&limit=5&countrycodes=ar&q=${encodeURIComponent(trimmedQuery)}`,
      { method: 'GET', signal, headers: { 'Accept-Language': 'es' } },
    );
    if (!response.ok) return [];

    const payload = await response.json().catch(() => []);
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

export async function geocodeAddress(
  address: string,
  options: { googleMapsApiKey?: string } = {},
): Promise<GeocodedAddressResult | null> {
  return (
    await geocodeAddressWithGoogle(address, options.googleMapsApiKey)
  ) ?? geocodeAddressWithNominatim(address);
}
