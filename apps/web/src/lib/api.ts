/** The web app uses the shared client with a same-origin API and a localStorage token. */
import { api, configureClient, type TokenStore } from '@kiwanja/client';

const TOKEN_KEY = 'kiwanja.token';

export const tokenStore: TokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (t) => {
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable */
    }
  },
};

configureClient({ baseUrl: '', tokenStore });

export { api, ApiError, errorMessage } from '@kiwanja/client';
export default api;
