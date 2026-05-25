import { apiClient } from '../core/http/client';
import { API_VERSION } from '../core/http/types';

export interface UpdateStoreProfileImageRequest {
  image: string;
}

export interface UpdateStoreProfileImageResponse {
  profile_image_url?: string;
  profileImageUrl?: string;
}

export interface StoreProfile {
  id?: number | string;
  name?: string;
  slug?: string;
  profile_image_url?: string | null;
  profileImageUrl?: string | null;
  offers_delivery?: boolean;
  offersDelivery?: boolean;
  offers_pickup?: boolean;
  offersPickup?: boolean;
}

export interface UpdateStoreProfileRequest {
  name?: string;
  slug?: string;
  profile_image_url?: string;
  profileImageUrl?: string;
  offers_delivery?: boolean;
  offersDelivery?: boolean;
  offers_pickup?: boolean;
  offersPickup?: boolean;
  delivery_enabled?: boolean;
  deliveryEnabled?: boolean;
  pickup_enabled?: boolean;
  pickupEnabled?: boolean;
}

export function updateStoreProfile(payload: UpdateStoreProfileRequest): Promise<StoreProfile> {
  return apiClient.patch(`${API_VERSION}/store/profile`, payload);
}

export function updateStoreProfileImage(payload: UpdateStoreProfileImageRequest): Promise<UpdateStoreProfileImageResponse> {
  return apiClient.patch(`${API_VERSION}/store/profile-image`, {
    image: payload.image,
    profileImage: payload.image,
    profile_image: payload.image,
    logo: payload.image,
    logoUrl: payload.image,
    logo_url: payload.image,
  });
}
