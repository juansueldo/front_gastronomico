import { apiConnection } from './apiConnection';
import { API_VERSION } from './types';

export interface Headquarter {
  id: string;
  name: string;
  phone?: string;
  location?: string;
  storeId?: string;
  statusId?: number;
}

export interface CreateHeadquarterRequest {
  name: string;
  phone?: string;
  location?: string;
}

