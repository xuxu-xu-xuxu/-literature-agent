"use client";
import { useState, useEffect } from "react";
import { Database, GitMerge, Loader2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchEntities, runSchemaConvergence } from "@/lib/api";

interface Entity {
  id: number;
  paper_id: string;
  entity_type: string;
  attributes: Record<string, string>;
  source_span: string;
}

export function EntityBrowser() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [converging, setConverging] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [synonyms, setSynonyms] = useState<{ canonical: string; variant: string }[]>([]);

  const loadEntities = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchEntities({ page_size: 100 });
      setEntities(data.items || []);
    } catch {
      setError("加载实体失败");
    } finally {
      setLoading(false);
    }
  };

  const loadSynonyms = async () => {
    try {
      const resp = await fetch("/api/entities/synonyms");
      const data = await resp.json();
      setSynonyms(data.synonyms || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadEntities();
    loadSynonyms();
  }, []);

  const handleConverge = async () => {
    setConverging(true);
    try {
      await runSchemaConvergence();
      await loadSynonyms();
    } catch {
      // ignore
    } finally {
      setConverging(false);
    }
  };

  const grouped = entities.reduce<Record<string, Entity[]>>((acc, e) => {
    if (!acc[e.entity_type]) acc[e.entity_type] = [];
    acc[e.entity_type].push(e);
    return acc;
  }, {});

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-[#e5e7eb] shrink-0 flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-600" />
          实体浏览
        </h2>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={loadEntities}
            disabled={loading}
            className="h-7 text-xs border-[#e5e7eb] text-gray-700 hover:bg-[#fafafa]"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "刷新"}
          </Button>
          <Button
            size="sm"
            onClick={handleConverge}
            disabled={converging || entities.length === 0}
            className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            {converging ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <GitMerge className="w-3 h-3" />
            )}
            Schema收敛
          </Button>
        </div>
      </div>

      {synonyms.length > 0 && (
        <div className="px-4 py-2 border-b border-[#e5e7eb] bg-[#fafafa]/50 shrink-0">
          <p className="text-xs text-gray-500 mb-1.5">已收敛的同义实体:</p>
          <div className="flex flex-wrap gap-1">
            {synonyms.map((s, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                {s.canonical} ← {s.variant}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {error && <p className="text-xs text-red-400 p-4">{error}</p>}

        {!loading && entities.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Database className="w-8 h-8 text-gray-400" />
            <p className="text-sm text-gray-500">暂无提取的实体</p>
            <p className="text-xs text-gray-400 text-center px-4">
              在文献库中对已入库的文献点击提取实体按钮
            </p>
          </div>
        )}

        {Object.entries(grouped).map(([type, items]) => (
          <div key={type} className="border-b border-[#e5e7eb] last:border-b-0">
            <div className="px-4 py-2.5 bg-[#fafafa]/30 flex items-center justify-between sticky top-0">
              <span className="text-xs font-semibold text-emerald-700">{type}</span>
              <span className="text-xs text-gray-500">{items.length} 条</span>
            </div>
            {items.map((entity) => (
              <div key={entity.id}>
                <button
                  onClick={() => setExpanded(expanded === entity.id ? null : entity.id)}
                  className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-[#fafafa]/50 transition-colors text-left"
                >
                  <div className="text-xs text-gray-700 truncate flex-1 mr-2">
                    {Object.entries(entity.attributes).slice(0, 2).map(([k, v]) => (
                      <span key={k} className="mr-3">
                        <span className="text-gray-500">{k}:</span>{" "}
                        <span className="text-gray-800">{v}</span>
                      </span>
                    ))}
                  </div>
                  <ChevronRight
                    className={`w-3.5 h-3.5 text-gray-500 shrink-0 transition-transform ${
                      expanded === entity.id ? "rotate-90" : ""
                    }`}
                  />
                </button>
                {expanded === entity.id && (
                  <div className="px-4 pb-3 pl-6">
                    <div className="bg-[#fafafa] rounded-lg p-3 border border-[#e5e7eb]">
                      {Object.entries(entity.attributes).map(([k, v]) => (
                        <div key={k} className="flex gap-2 text-xs py-0.5">
                          <span className="text-gray-500 shrink-0">{k}:</span>
                          <span className="text-gray-800">{v}</span>
                        </div>
                      ))}
                      {entity.source_span && (
                        <div className="text-xs text-gray-400 mt-1.5 pt-1.5 border-t border-[#e5e7eb]">
                          来源: {entity.source_span}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
