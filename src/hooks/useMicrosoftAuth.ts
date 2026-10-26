import { AZURE } from "@/constants/azure";
import { clearCache } from "@/lib/survey-cache";
import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
WebBrowser.maybeCompleteAuthSession();

export const redirectUri = AuthSession.makeRedirectUri({
  scheme: "idaphse",
  path: "auth",
});

const issuer = `https://login.microsoftonline.com/${AZURE.tenantId}/v2.0`;
const STORE_KEY = "idap_refresh_token";

// shared state
let token: string | null = null;
let pendingVerifier: string | null = null;
let refresh: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let restorePromise: Promise<void> | null = null;
let restoreDone = false;
const listeners = new Set<(t: string | null) => void>();

function setToken(t: string | null) {
  token = t;
  listeners.forEach((l) => l(t));
}

async function saveRefresh(r: string | null) {
  refresh = r;
  try {
    if (r) await SecureStore.setItemAsync(STORE_KEY, r);
    else await SecureStore.deleteItemAsync(STORE_KEY);
  } catch {}
}

// access token ko expire hone se pehle khud naya kar do
function scheduleRefresh(expiresIn?: number) {
  if (timer) clearTimeout(timer);
  const secs = Math.max(60, (expiresIn ?? 3600) - 300);
  timer = setTimeout(() => {
    refreshAccess().catch(() => {});
  }, secs * 1000);
}

async function refreshAccess() {
  if (!refresh) throw new Error("Please sign in again");
  const discovery = await AuthSession.fetchDiscoveryAsync(issuer);
  const t = await AuthSession.refreshAsync(
    {
      clientId: AZURE.clientId,
      refreshToken: refresh,
      scopes: AZURE.scopes,
    },
    discovery,
  );
  if (t.refreshToken) await saveRefresh(t.refreshToken);
  setToken(t.accessToken);
  scheduleRefresh(t.expiresIn);
}

export function restoreSession() {
  if (!restorePromise) {
    restorePromise = (async () => {
      try {
        const saved = await SecureStore.getItemAsync(STORE_KEY);
        if (!saved) return;
        refresh = saved;
        await refreshAccess();
      } catch (e: any) {
        // token waqai invalid/expire ho to hata do, network error par rehne do
        const msg = String(e?.code ?? e?.name ?? e?.message ?? "");
        if (/invalid_grant|TokenError|AADSTS/i.test(msg)) {
          await saveRefresh(null);
        }
      } finally {
        restoreDone = true;
      }
    })();
  }
  return restorePromise;
}
export function signOut() {
  if (timer) clearTimeout(timer);
  saveRefresh(null);
  clearCache(); // <- add
  setToken(null);
}
export async function completeSignIn(code: string) {
  if (!pendingVerifier) throw new Error("Missing code verifier, sign in again");
  const discovery = await AuthSession.fetchDiscoveryAsync(issuer);
  const tokens = await AuthSession.exchangeCodeAsync(
    {
      clientId: AZURE.clientId,
      code,
      redirectUri,
      extraParams: { code_verifier: pendingVerifier },
    },
    discovery,
  );
  await saveRefresh(tokens.refreshToken ?? null);
  setToken(tokens.accessToken);
  scheduleRefresh(tokens.expiresIn);
}

export function useMicrosoftAuth() {
  const [accessToken, setAccessToken] = useState<string | null>(token);
  const [restoring, setRestoring] = useState(!token && !restoreDone);
  const discovery = AuthSession.useAutoDiscovery(issuer);

  useEffect(() => {
    listeners.add(setAccessToken);
    return () => {
      listeners.delete(setAccessToken);
    };
  }, []);

  useEffect(() => {
    if (restoreDone) {
      setRestoring(false);
      return;
    }
    restoreSession().finally(() => setRestoring(false));
  }, []);

  const signIn = async () => {
    if (!discovery) return;
    const request = new AuthSession.AuthRequest({
      clientId: AZURE.clientId,
      scopes: AZURE.scopes,
      redirectUri,
      usePKCE: true,
    });
    await request.makeAuthUrlAsync(discovery);
    pendingVerifier = request.codeVerifier ?? null;
    await request.promptAsync(discovery);
  };

  return { accessToken, signIn, signOut, ready: !!discovery, restoring };
}

export async function getSharePointToken(): Promise<string> {
  if (!refresh) {
    await restoreSession();
    if (!refresh) throw new Error("Please sign in again");
  }
  const discovery = await AuthSession.fetchDiscoveryAsync(issuer);
  const t = await AuthSession.refreshAsync(
    {
      clientId: AZURE.clientId,
      refreshToken: refresh,
      scopes: [`https://${AZURE.sharepointHost}/AllSites.Read`],
    },
    discovery,
  );
  if (t.refreshToken) await saveRefresh(t.refreshToken);
  return t.accessToken;
}
