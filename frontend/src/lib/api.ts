const BASE = "/api";

export async function fetchPapers(params?: {
  page?: number;
  page_size?: number;
  keyword?: string;
  year_from?: number;
  year_to?: number;
  tag?: string;
  domain_id?: string;
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

export async function uploadPDF(file: File, domainId?: string) {
  const formData = new FormData();
  formData.append("file", file);
  if (domainId) formData.append("domain_id", domainId);
  const resp = await fetch(`${BASE}/upload`, { method: "POST", body: formData });
  if (!resp.ok) throw new Error("Upload failed");
  return resp.json();
}

export async function uploadBatchZip(file: File, autoMine = false, domainId?: string) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("auto_mine", String(autoMine));
  if (domainId) formData.append("domain_id", domainId);
  const resp = await fetch(`${BASE}/upload/batch`, { method: "POST", body: formData });
  if (!resp.ok) throw new Error("Batch upload failed");
  return resp.json();
}

export async function fetchIngestionJobs() {
  const resp = await fetch(`${BASE}/ingestion/jobs`);
  if (!resp.ok) throw new Error("Failed to fetch ingestion jobs");
  return resp.json();
}

export async function fetchDownloads() {
  const resp = await fetch(`${BASE}/downloads`);
  if (!resp.ok) throw new Error("Failed to fetch downloads");
  return resp.json();
}

export async function createDownload(identifier: string, strategy = "legal_only") {
  const resp = await fetch(`${BASE}/downloads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, strategy }),
  });
  if (!resp.ok) throw new Error("Download request failed");
  return resp.json();
}

export async function ingestDownload(downloadId: string, domainId: string, autoMine = false) {
  const resp = await fetch(`${BASE}/downloads/${downloadId}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain_id: domainId, auto_mine: autoMine }),
  });
  if (!resp.ok) throw new Error("Download ingest failed");
  return resp.json();
}

export async function pauseIngestionJob(jobId: string) {
  const resp = await fetch(`${BASE}/ingestion/jobs/${jobId}/pause`, { method: "POST" });
  if (!resp.ok) throw new Error("Failed to pause job");
  return resp.json();
}

export async function cancelIngestionJob(jobId: string) {
  const resp = await fetch(`${BASE}/ingestion/jobs/${jobId}`, { method: "DELETE" });
  if (!resp.ok) throw new Error("Failed to cancel job");
  return resp.json();
}

export async function triggerSolidElectrolyteExtraction(paperId: string) {
  const resp = await fetch(`${BASE}/extract/solid-electrolyte/${paperId}`, { method: "POST" });
  if (!resp.ok) throw new Error("Solid electrolyte extraction failed");
  return resp.json();
}

export async function triggerSolidElectrolytePropertyMining(params?: {
  replace?: boolean;
  limit_per_query?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) searchParams.set(k, String(v));
    });
  }
  const resp = await fetch(`${BASE}/extract/solid-electrolyte/properties/mine?${searchParams}`, { method: "POST" });
  if (!resp.ok) throw new Error("Solid electrolyte property mining failed");
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
  page_size?: number;
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

export async function deletePaper(paperId: string) {
  const resp = await fetch(`${BASE}/papers/${paperId}`, { method: "DELETE" });
  if (!resp.ok) {
    let detail = "";
    try {
      const body = await resp.json();
      detail = body.detail || "";
    } catch {}
    throw new Error(detail || `删除失败 (HTTP ${resp.status})`);
  }
  return resp.json();
}

export async function runSchemaConvergence() {
  const resp = await fetch(`${BASE}/entities/converge`, { method: "POST" });
  if (!resp.ok) throw new Error("Convergence failed");
  return resp.json();
}

export async function triggerEntityMining(params: {
  domain_id: string;
  replace?: boolean;
  paper_limit?: number;
  chunk_limit?: number;
}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined) searchParams.set(k, String(v));
  });
  const resp = await fetch(`${BASE}/entities/mine?${searchParams}`, { method: "POST" });
  if (!resp.ok) throw new Error("Entity mining failed");
  return resp.json();
}

export async function visualizeQuery(query: string) {
  const resp = await fetch(`${BASE}/visualize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!resp.ok) {
    let detail = `可视化失败 (HTTP ${resp.status})`;
    try {
      const body = await resp.json();
      detail = body.detail || detail;
    } catch {}
    throw new Error(detail);
  }
  return resp.json();
}

export async function fetchSolidElectrolyteRecords(params?: {
  paper_id?: string;
  method?: string;
  element?: string;
  confidence_min?: number;
  page?: number;
  page_size?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) searchParams.set(k, String(v));
    });
  }
  const resp = await fetch(`${BASE}/analytics/records?${searchParams}`);
  if (!resp.ok) throw new Error("Failed to fetch solid electrolyte records");
  return resp.json();
}

export async function fetchConductivityByElement(params?: {
  metric?: "avg" | "median";
  method?: string;
  temperature_min?: number;
  temperature_max?: number;
  confidence_min?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) searchParams.set(k, String(v));
    });
  }
  const resp = await fetch(`${BASE}/analytics/conductivity/by-element?${searchParams}`);
  if (!resp.ok) throw new Error("Failed to fetch conductivity by element");
  return resp.json();
}

export async function fetchConductivityByMethod() {
  const resp = await fetch(`${BASE}/analytics/conductivity/by-method`);
  if (!resp.ok) throw new Error("Failed to fetch conductivity by method");
  return resp.json();
}

export async function fetchConductivityByTemperature() {
  const resp = await fetch(`${BASE}/analytics/conductivity/by-temperature`);
  if (!resp.ok) throw new Error("Failed to fetch conductivity by temperature");
  return resp.json();
}

// ── Classification APIs ─────────────────────────────────────────────
export async function fetchCategories() {
  const resp = await fetch(`${BASE}/papers/categories`);
  if (!resp.ok) throw new Error("Failed to fetch categories");
  return resp.json();
}

export async function fetchSolidElectrolytePropertyRecords(params?: {
  property_name?: string;
  confidence_min?: number;
  status?: string;
  page?: number;
  page_size?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) searchParams.set(k, String(v));
    });
  }
  const resp = await fetch(`${BASE}/analytics/properties?${searchParams}`);
  if (!resp.ok) throw new Error("Failed to fetch solid electrolyte property records");
  return resp.json();
}

export async function fetchPropertyConductivityByMaterial(params?: {
  confidence_min?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) searchParams.set(k, String(v));
    });
  }
  const resp = await fetch(`${BASE}/analytics/properties/conductivity/by-material?${searchParams}`);
  if (!resp.ok) throw new Error("Failed to fetch conductivity by material");
  return resp.json();
}

export async function fetchPropertyConductivityByElement(params?: {
  metric?: "avg" | "median";
  confidence_min?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) searchParams.set(k, String(v));
    });
  }
  const resp = await fetch(`${BASE}/analytics/properties/conductivity/by-element?${searchParams}`);
  if (!resp.ok) throw new Error("Failed to fetch conductivity by element");
  return resp.json();
}

export async function fetchPropertyElementFrequency(params?: {
  confidence_min?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) searchParams.set(k, String(v));
    });
  }
  const resp = await fetch(`${BASE}/analytics/properties/elements/frequency?${searchParams}`);
  if (!resp.ok) throw new Error("Failed to fetch element frequency");
  return resp.json();
}

export async function fetchElectrochemicalWindowByMaterial(params?: {
  confidence_min?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) searchParams.set(k, String(v));
    });
  }
  const resp = await fetch(`${BASE}/analytics/properties/electrochemical-window/by-material?${searchParams}`);
  if (!resp.ok) throw new Error("Failed to fetch electrochemical window by material");
  return resp.json();
}

export async function fetchDomains() {
  const resp = await fetch(`${BASE}/domains`);
  if (!resp.ok) throw new Error("Failed to fetch domains");
  return resp.json();
}

export async function fetchKnowledgeGraph(params?: {
  domain_id?: string;
  limit?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) searchParams.set(k, String(v));
    });
  }
  const resp = await fetch(`${BASE}/knowledge-graph?${searchParams}`);
  if (!resp.ok) throw new Error("Failed to fetch knowledge graph");
  return resp.json();
}

export async function createDomain(payload: {
  id: string;
  name: string;
  description?: string;
  color?: string;
  sort_order?: number;
  is_default?: boolean;
}) {
  const resp = await fetch(`${BASE}/domains`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    let detail = "";
    try {
      const body = await resp.json();
      detail = body.detail || "";
    } catch {}
    throw new Error(detail || "Failed to create domain");
  }
  return resp.json();
}

export async function updateDomain(domainId: string, payload: {
  name?: string;
  description?: string;
  color?: string;
  sort_order?: number;
  is_default?: boolean;
}) {
  const resp = await fetch(`${BASE}/domains/${domainId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    let detail = "";
    try {
      const body = await resp.json();
      detail = body.detail || "";
    } catch {}
    throw new Error(detail || "Failed to update domain");
  }
  return resp.json();
}

export async function deleteDomain(domainId: string) {
  const resp = await fetch(`${BASE}/domains/${domainId}`, { method: "DELETE" });
  if (!resp.ok) {
    let detail = "";
    try {
      const body = await resp.json();
      detail = body.detail || "";
    } catch {}
    throw new Error(detail || "Failed to delete domain");
  }
  return resp.json();
}

export async function assignPaperDomain(paperId: string, domainId: string) {
  const resp = await fetch(`${BASE}/papers/${paperId}/domain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain_id: domainId }),
  });
  if (!resp.ok) throw new Error("Failed to assign domain");
  return resp.json();
}

export async function triggerClassify() {
  const resp = await fetch(`${BASE}/papers/classify`, { method: "POST" });
  if (!resp.ok) throw new Error("Failed to trigger classification");
  return resp.json();
}

export async function triggerClassifyPaper(paperId: string) {
  const resp = await fetch(`${BASE}/papers/classify/${paperId}`, { method: "POST" });
  if (!resp.ok) throw new Error("Failed to classify paper");
  return resp.json();
}

export async function triggerClustering() {
  const resp = await fetch(`${BASE}/papers/cluster`, { method: "POST" });
  if (!resp.ok) throw new Error("Failed to trigger clustering");
  return resp.json();
}
