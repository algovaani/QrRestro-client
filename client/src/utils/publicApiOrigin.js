import { getApiOrigin } from '../services/api';

/** @deprecated use getApiOrigin from services/api */
export function getPublicApiOrigin() {
  return getApiOrigin();
}
