import { useEffect, useState } from "react";

const GRAPH = "https://graph.microsoft.com/v1.0";

export type Profile = { name: string; email: string; photo: string | null };

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function useProfile(token: string | null) {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!token) {
      setProfile(null);
      return;
    }
    let cancelled = false;

    (async () => {
      const headers = { Authorization: `Bearer ${token}` };
      let name = "";
      let email = "";
      let photo: string | null = null;

      try {
        const me = await fetch(`${GRAPH}/me`, { headers }).then((r) =>
          r.json(),
        );
        name = (me.displayName ?? "").split("|")[0].trim();
        email = me.mail ?? me.userPrincipalName ?? "";
      } catch {}

      try {
        const res = await fetch(`${GRAPH}/me/photo/$value`, { headers });
        if (res.ok) photo = await blobToDataUri(await res.blob());
      } catch {}

      if (!cancelled) setProfile({ name, email, photo });
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return profile;
}
