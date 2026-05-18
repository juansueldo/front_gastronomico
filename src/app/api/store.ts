import { apiClient } from './client';
import { API_VERSION } from './types';

export interface UpdateStoreProfileImageRequest {
  image: string;
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
