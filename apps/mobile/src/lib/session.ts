/**
 * Connects the shared client to the right API server.
 *
 * Order of preference:
 *   1. A server address the user typed in Settings (saved on the phone).
 *   2. EXPO_PUBLIC_API_URL from apps/mobile/.env (written by the setup script).
 *   3. The computer running `expo start`: Expo Go already knows its LAN address, so on the
 *      same Wi-Fi the phone finds the API on port 4000 with no configuration at all.
 */
import { configureClient, type TokenStore } from '@kiwanja/client';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { storage } from './storage';

const TOKEN_KEY = 'kiwanja.token';
const SERVER_KEY = 'kiwanja.server';
const API_PORT = 4000;

let token: string | null = null;
const tokenStore: TokenStore = {
  get: () => token,
  set: async (t) => {
    token = t;
    await storage.set(TOKEN_KEY, t);
  },
};

export function detectedServer(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  const hostUri = Constants.expoConfig?.hostUri; // e.g. "192.168.1.20:8081"
  const host = hostUri?.split(':')[0];
  if (host) return `http://${host}:${API_PORT}`;
  if (Platform.OS === 'web' && typeof location !== 'undefined') return `${location.protocol}//${location.hostname}:${API_PORT}`;
  return `http://localhost:${API_PORT}`;
}

export let customServer: string | null = null;
export const currentServer = () => customServer ?? detectedServer();

/** Load the saved token and server before the first screen renders. */
export async function bootSession() {
  const [t, server] = await Promise.all([storage.get(TOKEN_KEY), storage.get(SERVER_KEY)]);
  token = t;
  customServer = server;
  configureClient({ baseUrl: currentServer(), tokenStore });
}

export async function setCustomServer(url: string | null) {
  customServer = url ? url.trim().replace(/\/+$/, '') : null;
  await storage.set(SERVER_KEY, customServer);
  configureClient({ baseUrl: currentServer() });
}
