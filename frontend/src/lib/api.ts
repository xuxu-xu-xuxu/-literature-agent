const BASE = "/api";

export async function fetchPapers(params?: {
  page?: number;
  keyword?: string;
  year_from?: number;
  year_to?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) searchParams.set(k, String(v));
    });
  }
  const resp = await fetch(`${BASE}/papers?${searchParams}`);
  if (!resp.ok) throw new Error("Failed to fetch papers");
  return resp.json();
}

export async function uploadPDF(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const resp = await fetch(`${BASE}/upload`, { method: "POST", body: formData });
  if (!resp.ok) throw new Error("Upload failed");
  return resp.json();
}

export async function triggerExtraction(paperId: string) {
  const resp = await fetch(`${BASE}/extract/${paperId}`, { method: "POST" });
  if (!resp.ok) throw new Error("Extraction failed");
  return resp.json();
}

export async function fetchEntities(params?: {
  entity_type?: string;
  paper_id?: string;
  page?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) searchParams.set(k, String(v));
    });
  }
  const resp = await fetch(`${BASE}/entities?${searchParams}`);
  if (!resp.ok) throw new Error("Failed to fetch entities");
  return resp.json();
}

export async function visualizeQuery(query: string) {
  const resp = await fetch(`${BASE}/visualize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!resp.ok) throw new Error("Visualization failed");
  return resp.json();
}
