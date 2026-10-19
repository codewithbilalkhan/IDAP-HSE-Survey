import { AZURE } from "@/constants/azure";
import { FIELDS, getField } from "@/constants/fields";

export type Photo = { uri: string; name: string; date: string };

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const fmt = (v: any) => {
  const d = new Date(v);
  return isNaN(d.getTime())
    ? ""
    : `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

// Site ke SAARE surveys ki attachments (latest pehle)
export async function fetchSitePhotos(
  spToken: string,
  items: any[],
  site: string,
): Promise<Photo[]> {
  const host = `https://${AZURE.sharepointHost}`;
  const web = `${host}${AZURE.sitePath}`;

  const surveys = items
    .filter((i) => getField(i, FIELDS.projectSite) === site)
    .filter((i) => i.Attachments !== false) // jin mein attachment nahi, unhe skip
    .map((i) => ({ id: i.id, when: i._created }))
    .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());

  const out: Photo[] = [];
  const BATCH = 5;

  for (let i = 0; i < surveys.length; i += BATCH) {
    const chunk = surveys.slice(i, i + BATCH);
    const results = await Promise.all(
      chunk.map(async (s) => {
        try {
          const url = `${web}/_api/web/lists/getbytitle('${encodeURIComponent(
            AZURE.listName,
          )}')/items(${s.id})/AttachmentFiles`;
          const res = await fetch(url, {
            headers: {
              Authorization: `Bearer ${spToken}`,
              Accept: "application/json;odata=nometadata",
            },
          });
          if (!res.ok) return [] as Photo[];
          const json = await res.json();
          return (json.value ?? [])
            .filter((f: any) => /\.(jpe?g|png|webp|gif)$/i.test(f.FileName))
            .map((f: any) => {
              const rel = String(f.ServerRelativeUrl).replace(/'/g, "''");
              return {
                uri: `${web}/_api/web/GetFileByServerRelativeUrl('${encodeURIComponent(
                  rel,
                )}')/$value`,
                name: f.FileName,
                date: fmt(s.when),
              } as Photo;
            });
        } catch {
          return [] as Photo[];
        }
      }),
    );
    out.push(...results.flat());
  }
  return out;
}
