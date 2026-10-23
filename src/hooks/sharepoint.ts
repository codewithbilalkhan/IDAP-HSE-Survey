import { AZURE } from "@/constants/azure";

const GRAPH = "https://graph.microsoft.com/v1.0";

async function graph(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${GRAPH}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      // lets sorting work even on non-indexed columns
      Prefer: "HonorNonIndexedQueriesWarningMayFailRandomly",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const err: any = new Error(`Graph ${res.status}`);
    err.status = res.status;
    err.body = await res.text();
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

export async function getSiteId(token: string) {
  const site = await graph(
    token,
    `/sites/${AZURE.sharepointHost}:${AZURE.sitePath}`,
  );
  return site.id as string;
}

export async function getSurveyItems(token: string) {
  const siteId = await getSiteId(token);
  const list = encodeURIComponent(AZURE.listName);
  let url: string | null =
    `/sites/${siteId}/lists/${list}/items?$expand=fields&$top=200`;
  const all: any[] = [];

  while (url) {
    const data: any = await graph(
      token,
      url.startsWith("http") ? url.replace(GRAPH, "") : url,
    );
    all.push(
      ...data.value.map((i: any) => ({
        id: i.id,
        _by: i.createdBy?.user?.displayName ?? "",
        _created: i.createdDateTime ?? "",
        ...i.fields,
      })),
    );
    url = data["@odata.nextLink"] ?? null;
  }
  return all;
}

export async function addSurveyItem(
  token: string,
  fields: Record<string, any>,
) {
  const siteId = await getSiteId(token);
  const list = encodeURIComponent(AZURE.listName);
  return graph(token, `/sites/${siteId}/lists/${list}/items`, {
    method: "POST",
    body: JSON.stringify({ fields }),
  });
}
