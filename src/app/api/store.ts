import { apiClient } from './client';
import { API_VERSION } from './types';

export interface UpdateStoreProfileImageRequest {
  image: string;
}

export interface StoreProfile {
  id?: number | string;
  name?: string;
  slug?: string;
  profile_image_url?: string | null;
  profileImageUrl?: string | null;
}

export interface UpdateStoreProfileRequest {
  name?: string;
  slug?: string;
  profile_image_url?: string;
  profileImageUrl?: string;
}

export function updateStoreProfile(payload: UpdateStoreProfileRequest): Promise<StoreProfile> {
  return apiClient.patch(`${API_VERSION}/store/profile`, payload);
}

export function updateStoreProfileImage(payload: UpdateStoreProfileImageRequest) {
  return apiClient.patch(`${API_VERSION}/store/profile-image`, {
    image: payload.image,
    profileImage: payload.image,
    profile_image: payload.image,
    logo: payload.image,
    logoUrl: payload.image,
    logo_url: payload.image,
  });
}
