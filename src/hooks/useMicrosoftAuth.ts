import { AZURE } from "@/constants/azure";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";

WebBrowser.maybeCompleteAuthSession();

export const redirectUri = AuthSession.makeRedirectUri({
  scheme: "idaphse",
  path: "auth",
});

const issuer = `https://login.microsoftonline.com/${AZURE.tenantId}/v2.0`;

// shared state (screens badalne par bhi bacha rehta hai)
let token: string | null = null;
let pendingVerifier: string | null = null;
let refresh: string | null = null;
const listeners = new Set<(t: string | null) => void>();

function setToken(t: string | null) {
  token = t;
  listeners.forEach((l) => l(t));
}

export function signOut() {
  refresh = null;
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
  refresh = tokens.refreshToken ?? null;
  setToken(tokens.accessToken);
}

export function useMicrosoftAuth() {
  const [accessToken, setAccessToken] = useState<string | null>(token);
  const discovery = AuthSession.useAutoDiscovery(issuer);

  useEffect(() => {
    listeners.add(setAccessToken);
    return () => {
      listeners.delete(setAccessToken);
    };
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

  return { accessToken, signIn, signOut, ready: !!discovery };
}

export async function getSharePointToken(): Promise<string> {
  console.log("REFRESH?", !!refresh);
  if (!refresh) throw new Error("Please sign in again");
  const discovery = await AuthSession.fetchDiscoveryAsync(issuer);
  const t = await AuthSession.refreshAsync(
    {
      clientId: AZURE.clientId,
      refreshToken: refresh,
      scopes: [`https://${AZURE.sharepointHost}/AllSites.Read`],
    },
    discovery,
  );
  if (t.refreshToken) refresh = t.refreshToken;
  return t.accessToken;
}
