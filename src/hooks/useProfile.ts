import { useEffect, useState } from "react";

const GRAPH = "https://graph.microsoft.com/v1.0";

export type Profile = {
  name: string;
  email: string;
  photo: string | null;
  jobTitle: string;
  department: string;
  company: string;
  office: string;
  location: string; // city, country
  mobile: string;
  phone: string; // office phone
  employeeId: string;
  manager: string;
};

const FIELDS = [
  "displayName",
  "mail",
  "userPrincipalName",
  "jobTitle",
  "department",
  "companyName",
  "officeLocation",
  "city",
  "country",
  "mobilePhone",
  "businessPhones",
  "employeeId",
].join(",");

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

      // teeno requests ek sath chalti hain, koi fail ho to baaqi par asar nahi
      const [me, manager, photo] = await Promise.all([
        fetch(`${GRAPH}/me?$select=${FIELDS}`, { headers })
          .then(async (r) => {
            const body = await r.json();
            console.log("GRAPH /me", r.status, JSON.stringify(body));
            return r.ok ? body : null;
          })
          .catch((e) => {
            console.log("GRAPH /me error", e);
            return null;
          }),
        fetch(`${GRAPH}/me/manager?$select=displayName`, { headers })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch(`${GRAPH}/me/photo/$value`, { headers })
          .then(async (r) => (r.ok ? blobToDataUri(await r.blob()) : null))
          .catch(() => null),
      ]);

      const clean = (v: any) => (typeof v === "string" ? v.trim() : "");

      // "Bilal Khan | Individual Consultant | Technology"
      //   -> naam | designation | department
      const [namePart = "", titlePart = "", deptPart = ""] = clean(
        me?.displayName,
      )
        .split("|")
        .map((p) => p.trim());

      const next: Profile = {
        name: namePart,
        email: clean(me?.mail) || clean(me?.userPrincipalName),
        photo,
        jobTitle: clean(me?.jobTitle) || titlePart,
        department: clean(me?.department) || deptPart,
        company: clean(me?.companyName),
        office: clean(me?.officeLocation),
        location: [clean(me?.city), clean(me?.country)]
          .filter(Boolean)
          .join(", "),
        mobile: clean(me?.mobilePhone),
        phone: clean(me?.businessPhones?.[0]),
        employeeId: clean(me?.employeeId),
        manager: clean(manager?.displayName).split("|")[0].trim(),
      };
      if (!cancelled) setProfile(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return profile;
}
