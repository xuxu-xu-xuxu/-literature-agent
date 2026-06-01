"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Network, RefreshCw, Search } from "lucide-react";
import { fetchDomains, fetchKnowledgeGraph } from "@/lib/api";

interface Domain {
  id: string;
  name: string;
}

interface GraphNode {
  id: string;
  label: string;
  type: "domain" | "paper" | "entity";
  size: number;
  domain_id?: string | null;
  paper_id?: string;
  meta?: Record<string, string | number | null | undefined>;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  weight: number;
}

interface SimNode extends GraphNode {
  x: number;
  y: number;
  tx: number;
  ty: number;
  phase: number;
  drift: number;
}

const nodeColors: Record<GraphNode["type"], string> = {
  domain: "#f6c85f",
  paper: "#58d5ff",
  entity: "#c084fc",
};

const nodeLabels: Record<GraphNode["type"], string> = {
  domain: "领域",
  paper: "文献",
  entity: "实体",
};

function hashString(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function quadraticPoint(
  source: { x: number; y: number },
  control: { x: number; y: number },
  target: { x: number; y: number },
  t: number
) {
  const mt = 1 - t;
  return {
    x: mt * mt * source.x + 2 * mt * t * control.x + t * t * target.x,
    y: mt * mt * source.y + 2 * mt * t * control.y + t * t * target.y,
  };
}

function edgeControlPoint(source: SimNode, target: SimNode, edgeId: string) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const dist = Math.max(1, Math.hypot(dx, dy));
  const bend = ((hashString(edgeId) % 120) - 60) * 0.42;
  return {
    x: (source.x + target.x) / 2 - (dy / dist) * bend,
    y: (source.y + target.y) / 2 + (dx / dist) * bend,
  };
}

function selectDisplayEdges(edges: GraphEdge[]) {
  const domainEdges = edges
    .filter((edge) => edge.type === "domain_paper")
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 42);
  const entityEdges = edges
    .filter((edge) => edge.type !== "domain_paper")
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 58);
  return [...domainEdges, ...entityEdges];
}

function buildMoleculeLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
  previousNodes: SimNode[]
) {
  const center = { x: width / 2, y: height / 2 };
  const minDim = Math.max(360, Math.min(width, height));
  const margin = 48;
  const previousById = new Map(previousNodes.map((node) => [node.id, node]));
  const targets = new Map<string, { x: number; y: number }>();
  const domainAnchors = new Map<string, { x: number; y: number }>();
  const domains = nodes.filter((node) => node.type === "domain");
  const papers = nodes.filter((node) => node.type === "paper");
  const entities = nodes.filter((node) => node.type === "entity");

  domains.forEach((node, index) => {
    const count = Math.max(1, domains.length);
    const angle = count === 1 ? -Math.PI / 2 : -Math.PI / 2 + (index / count) * Math.PI * 2;
    const radiusX = count === 1 ? 0 : Math.min(width * 0.2, 230);
    const radiusY = count === 1 ? 0 : Math.min(height * 0.15, 135);
    const target = {
      x: center.x + Math.cos(angle) * radiusX,
      y: center.y + Math.sin(angle) * radiusY,
    };
    targets.set(node.id, target);
    domainAnchors.set(node.domain_id || node.id.replace("domain:", ""), target);
  });

  const papersByDomain = new Map<string, GraphNode[]>();
  papers.forEach((node) => {
    const key = node.domain_id || "unclassified";
    papersByDomain.set(key, [...(papersByDomain.get(key) || []), node]);
  });

  papersByDomain.forEach((domainPapers, domainId) => {
    const anchor = domainAnchors.get(domainId) || center;
    domainPapers.forEach((node, index) => {
      const count = Math.max(1, domainPapers.length);
      const ring = Math.floor(index / 22);
      const angle =
        (index / count) * Math.PI * 2 +
        ((hashString(node.id) % 100) / 100) * 0.5 +
        ring * 0.37;
      const radius = minDim * (0.2 + ring * 0.075);
      const jitter = ((hashString(`${node.id}:jitter`) % 100) - 50) * 0.55;
      targets.set(node.id, {
        x: anchor.x + Math.cos(angle) * (radius + jitter),
        y: anchor.y + Math.sin(angle) * (radius * 0.72 + jitter * 0.45),
      });
    });
  });

  entities.forEach((node, index) => {
    const relatedPaperTargets = edges
      .filter((edge) => edge.target === node.id || edge.source === node.id)
      .map((edge) => targets.get(edge.source) || targets.get(edge.target))
      .filter(Boolean) as Array<{ x: number; y: number }>;

    if (relatedPaperTargets.length) {
      const average = relatedPaperTargets.reduce(
        (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
        { x: 0, y: 0 }
      );
      average.x /= relatedPaperTargets.length;
      average.y /= relatedPaperTargets.length;
      const awayX = average.x - center.x;
      const awayY = average.y - center.y;
      const angle = Math.atan2(awayY, awayX) + ((hashString(node.id) % 80) - 40) / 260;
      const distance = Math.max(minDim * 0.32, Math.hypot(awayX, awayY) * 1.14);
      targets.set(node.id, {
        x: center.x + Math.cos(angle) * distance,
        y: center.y + Math.sin(angle) * distance * 0.84,
      });
      return;
    }

    const angle = (index / Math.max(1, entities.length)) * Math.PI * 2;
    targets.set(node.id, {
      x: center.x + Math.cos(angle) * minDim * 0.38,
      y: center.y + Math.sin(angle) * minDim * 0.3,
    });
  });

  return nodes.map((node) => {
    const previous = previousById.get(node.id);
    const target = targets.get(node.id) || center;
    const phase = (hashString(node.id) % 628) / 100;
    const drift = node.type === "domain" ? 5 : node.type === "paper" ? 9 : 13;
    return {
      ...node,
      x: previous?.x ?? clamp(target.x, margin, width - margin),
      y: previous?.y ?? clamp(target.y, margin, height - margin),
      tx: clamp(target.x, margin, width - margin),
      ty: clamp(target.y, margin, height - margin),
      phase,
      drift,
    };
  });
}

function GraphCanvas({
  nodes,
  edges,
  selectedId,
  onSelect,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedId: string | null;
  onSelect: (node: GraphNode | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simNodesRef = useRef<SimNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const hoverRef = useRef<string | null>(null);
  const draggingRef = useRef<string | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const selectedRef = useRef<string | null>(selectedId);
  const displayEdges = useMemo(() => selectDisplayEdges(edges), [edges]);

  useEffect(() => {
    selectedRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const width = canvas?.clientWidth || 900;
    const height = canvas?.clientHeight || 620;
    simNodesRef.current = buildMoleculeLayout(nodes, displayEdges, width, height, simNodesRef.current);
    edgesRef.current = displayEdges;
  }, [nodes, displayEdges]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    let raf = 0;
    let lastWidth = 0;
    let lastHeight = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const nextWidth = Math.max(1, Math.floor(rect.width));
      const nextHeight = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(nextWidth * dpr);
      canvas.height = Math.floor(nextHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (nextWidth !== lastWidth || nextHeight !== lastHeight) {
        simNodesRef.current = buildMoleculeLayout(nodes, displayEdges, nextWidth, nextHeight, simNodesRef.current);
        lastWidth = nextWidth;
        lastHeight = nextHeight;
      }
    };

    const drawBackground = (width: number, height: number) => {
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, "#05070b");
      gradient.addColorStop(0.5, "#09111e");
      gradient.addColorStop(1, "#070812");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = "#9de7ff";
      ctx.lineWidth = 1;
      for (let x = (frame * 0.08) % 54; x < width; x += 54) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x - height * 0.35, height);
        ctx.stroke();
      }
      ctx.restore();

      const scanY = (frame * 0.18) % height;
      ctx.save();
      ctx.globalAlpha = 0.1;
      ctx.strokeStyle = "#58d5ff";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, scanY);
      ctx.lineTo(width, scanY);
      ctx.stroke();
      ctx.restore();
    };

    const step = () => {
      resize();
      frame += 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const simNodes = simNodesRef.current;
      const byId = new Map(simNodes.map((node) => [node.id, node]));
      const selectedNodeId = selectedRef.current;

      for (const node of simNodes) {
        const slowTime = frame * 0.006;
        const targetX =
          node.tx +
          Math.sin(slowTime + node.phase) * node.drift +
          Math.sin(frame * 0.0022 + node.phase * 1.7) * node.drift * 0.45;
        const targetY =
          node.ty +
          Math.cos(slowTime * 0.84 + node.phase) * node.drift +
          Math.cos(frame * 0.0028 + node.phase * 1.3) * node.drift * 0.38;

        if (draggingRef.current === node.id) {
          node.x += (pointerRef.current.x - node.x) * 0.24;
          node.y += (pointerRef.current.y - node.y) * 0.24;
        } else {
          node.x += (targetX - node.x) * 0.035;
          node.y += (targetY - node.y) * 0.035;
        }
      }

      drawBackground(width, height);

      edgesRef.current.forEach((edge, index) => {
        const source = byId.get(edge.source);
        const target = byId.get(edge.target);
        if (!source || !target) return;
        const active = Boolean(selectedNodeId && (source.id === selectedNodeId || target.id === selectedNodeId));
        const color = edge.type === "domain_paper" ? "#f6c85f" : "#58d5ff";
        const control = edgeControlPoint(source, target, edge.id);

        ctx.save();
        ctx.globalAlpha = active ? 0.62 : edge.type === "domain_paper" ? 0.18 : 0.13;
        ctx.strokeStyle = color;
        ctx.lineWidth = active ? 1.6 : 0.7;
        ctx.shadowColor = color;
        ctx.shadowBlur = active ? 14 : 4;
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.quadraticCurveTo(control.x, control.y, target.x, target.y);
        ctx.stroke();
        ctx.restore();

        if (index % 3 === 0 || active) {
          const t = (frame * 0.0019 + (hashString(edge.id) % 1000) / 1000) % 1;
          const point = quadraticPoint(source, control, target, t);
          ctx.save();
          ctx.globalAlpha = active ? 0.86 : 0.36;
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = active ? 13 : 8;
          ctx.beginPath();
          ctx.arc(point.x, point.y, active ? 2.4 : 1.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });

      for (const node of simNodes) {
        const color = nodeColors[node.type];
        const active = node.id === selectedNodeId || node.id === hoverRef.current;
        const pulse = 1 + Math.sin(frame * 0.018 + node.phase) * 0.06;
        const radius = node.size * (active ? 1.32 : pulse);

        ctx.save();
        ctx.globalAlpha = node.type === "entity" ? 0.88 : 0.96;
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = active ? 26 : node.type === "domain" ? 18 : 12;
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (node.type === "domain" || active) {
          ctx.save();
          ctx.font = active ? "600 12px sans-serif" : "500 11px sans-serif";
          ctx.fillStyle = active ? "#ffffff" : "#dbeafe";
          ctx.shadowColor = "#000000";
          ctx.shadowBlur = 8;
          ctx.fillText(node.label, node.x + radius + 8, node.y + 4);
          ctx.restore();
        }
      }

      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [nodes, displayEdges]);

  const findNode = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    pointerRef.current = { x, y };
    let found: SimNode | null = null;
    for (const node of simNodesRef.current) {
      if (Math.hypot(node.x - x, node.y - y) <= node.size + 10) {
        found = node;
      }
    }
    return found;
  };

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full cursor-crosshair"
      onMouseMove={(event) => {
        const node = findNode(event.clientX, event.clientY);
        hoverRef.current = node?.id || null;
      }}
      onMouseDown={(event) => {
        const node = findNode(event.clientX, event.clientY);
        draggingRef.current = node?.id || null;
        if (node) onSelect(node);
      }}
      onMouseUp={() => {
        draggingRef.current = null;
      }}
      onMouseLeave={() => {
        hoverRef.current = null;
        draggingRef.current = null;
      }}
    />
  );
}

export default function GraphPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [domainId, setDomainId] = useState("");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(70);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [loading, setLoading] = useState(false);

  const loadGraph = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchKnowledgeGraph({
        domain_id: domainId || undefined,
        limit,
      });
      setNodes(data.nodes || []);
      setEdges(data.edges || []);
      setSelectedNode(null);
    } finally {
      setLoading(false);
    }
  }, [domainId, limit]);

  useEffect(() => {
    fetchDomains().then((data) => setDomains(data || [])).catch(() => setDomains([]));
  }, []);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  const filteredNodes = useMemo(() => {
    if (!query.trim()) return nodes;
    const term = query.trim().toLowerCase();
    return nodes.filter((node) => node.label.toLowerCase().includes(term));
  }, [nodes, query]);

  const visibleNodeIds = useMemo(() => new Set(filteredNodes.map((node) => node.id)), [filteredNodes]);
  const filteredEdges = useMemo(
    () => edges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)),
    [edges, visibleNodeIds]
  );

  const stats = useMemo(() => {
    return {
      domain: filteredNodes.filter((node) => node.type === "domain").length,
      paper: filteredNodes.filter((node) => node.type === "paper").length,
      entity: filteredNodes.filter((node) => node.type === "entity").length,
    };
  }, [filteredNodes]);

  return (
    <div className="h-full overflow-hidden bg-[#05070b] text-white">
      <div className="flex h-full">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-white/10 bg-black/30 px-5 py-4 backdrop-blur">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-300/40 bg-cyan-300/10 text-cyan-200">
                  <Network className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="font-heading text-xl text-white">知识图谱</h1>
                  <p className="text-xs text-cyan-100/60">领域、文献和核心实体的缓慢流动分子网络</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-cyan-100/40" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="搜索节点"
                    className="h-9 w-52 rounded-md border border-white/10 bg-white/5 pl-9 pr-3 text-sm text-white placeholder:text-cyan-100/40 focus:border-cyan-300/70 focus:outline-none"
                  />
                </div>
                <select
                  value={domainId}
                  onChange={(event) => setDomainId(event.target.value)}
                  className="h-9 rounded-md border border-white/10 bg-[#0d1220] px-3 text-sm text-white focus:border-cyan-300/70 focus:outline-none"
                >
                  <option value="">全部领域</option>
                  {domains.map((domain) => (
                    <option key={domain.id} value={domain.id}>
                      {domain.name}
                    </option>
                  ))}
                </select>
                <select
                  value={limit}
                  onChange={(event) => setLimit(Number(event.target.value))}
                  className="h-9 rounded-md border border-white/10 bg-[#0d1220] px-3 text-sm text-white focus:border-cyan-300/70 focus:outline-none"
                >
                  <option value={50}>50 节点</option>
                  <option value={70}>70 节点</option>
                  <option value={110}>110 节点</option>
                </select>
                <button
                  onClick={loadGraph}
                  disabled={loading}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-cyan-300/40 px-3 text-sm font-medium text-cyan-100 hover:bg-cyan-300/10 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  刷新
                </button>
              </div>
            </div>
          </div>

          <div className="relative min-h-0 flex-1">
            <GraphCanvas
              nodes={filteredNodes}
              edges={filteredEdges}
              selectedId={selectedNode?.id || null}
              onSelect={setSelectedNode}
            />
            <div className="pointer-events-none absolute left-5 top-5 flex flex-wrap gap-3 text-xs text-cyan-100/70">
              <span>领域 {stats.domain}</span>
              <span>文献 {stats.paper}</span>
              <span>实体 {stats.entity}</span>
              <span>连接 {filteredEdges.length}</span>
            </div>
          </div>
        </div>

        <aside className="w-72 shrink-0 border-l border-white/10 bg-black/40 p-5 backdrop-blur">
          <h2 className="text-sm font-semibold text-cyan-100">节点信息</h2>
          {selectedNode ? (
            <div className="mt-4 space-y-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-cyan-100/40">
                  {nodeLabels[selectedNode.type]}
                </div>
                <div className="mt-2 text-base font-semibold leading-6 text-white">{selectedNode.label}</div>
              </div>
              <div className="space-y-2 text-xs text-cyan-100/60">
                <div>ID: {selectedNode.id}</div>
                {selectedNode.domain_id && <div>领域: {selectedNode.domain_id}</div>}
                {selectedNode.paper_id && <div>文献 ID: {selectedNode.paper_id}</div>}
                {selectedNode.meta?.year && <div>年份: {selectedNode.meta.year}</div>}
                {selectedNode.meta?.journal && <div>期刊: {selectedNode.meta.journal}</div>}
                {selectedNode.meta?.count && <div>实体出现: {selectedNode.meta.count}</div>}
              </div>
            </div>
          ) : (
            <div className="mt-4 text-sm leading-6 text-cyan-100/50">
              点击或拖动图中的节点查看详情。领域节点偏金色，文献节点偏蓝色，实体节点偏紫色。
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
