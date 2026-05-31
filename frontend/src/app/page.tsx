"use client";
import { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronRight, Folder, FolderOpen, Library } from "lucide-react";
import { ChatPanel } from "@/components/chat/chat-panel";
import { fetchPapers, fetchCategories } from "@/lib/api";

interface Paper {
  id: string;
  title: string;
}

interface CategoryData {
  tag: string;
  count: number;
  category: string;
}

const SECTION_ORDER = ["研究领域", "材料类型", "方法类型", "聚类结果"];

export default function ChatPage() {
  const [allPapers, setAllPapers] = useState<Paper[]>([]);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [categoryPapers, setCategoryPapers] = useState<Record<string, Paper[]>>({});
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // scope: "all" | { type: "category"; tag: string } | { type: "paper"; paperId: string }
  const [scopeType, setScopeType] = useState<"all" | "category" | "paper">("all");
  const [scopeTag, setScopeTag] = useState<string>("");
  const [scopePaperId, setScopePaperId] = useState<string>("");

  const loadAll = useCallback(async () => {
    try {
      const [paperData, catData] = await Promise.all([
        fetchPapers({ page_size: 100 }),
        fetchCategories(),
      ]);
      setAllPapers(paperData.items || []);
      setCategories(catData || []);
    } catch {}
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Toggle category expand and load papers
  const toggleCategory = async (tag: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });

    if (!categoryPapers[tag]) {
      try {
        const data = await fetchPapers({ tag, page_size: 100 });
        setCategoryPapers((prev) => ({ ...prev, [tag]: data.items || [] }));
      } catch {}
    }
  };

  // Compute effective scope_paper_ids
  const getScopePaperIds = (): string[] => {
    if (scopeType === "all") return [];
    if (scopeType === "category") {
      const papers = categoryPapers[scopeTag] || [];
      return papers.map((p) => p.id);
    }
    if (scopeType === "paper" && scopePaperId) return [scopePaperId];
    return [];
  };

  // Group categories by section
  const sections: Record<string, CategoryData[]> = {};
  for (const cat of categories) {
    const s = cat.category || "其他";
    if (!sections[s]) sections[s] = [];
    sections[s].push(cat);
  }

  // Select a category — filter to that category
  const selectCategory = (tag: string) => {
    if (scopeType === "category" && scopeTag === tag) {
      // Deselect — go back to all
      setScopeType("all");
      setScopeTag("");
    } else {
      setScopeType("category");
      setScopeTag(tag);
      setScopePaperId("");
    }
  };

  // Select a single paper
  const selectPaper = (paperId: string) => {
    if (scopeType === "paper" && scopePaperId === paperId) {
      setScopeType("all");
      setScopePaperId("");
    } else {
      setScopeType("paper");
      setScopePaperId(paperId);
      setScopeTag("");
    }
  };

  // Select all papers
  const selectAll = () => {
    setScopeType("all");
    setScopeTag("");
    setScopePaperId("");
  };

  return (
    <div className="h-full flex">
      <div className="flex-1 flex flex-col min-w-0">
        <ChatPanel scopePaperIds={getScopePaperIds().length > 0 ? getScopePaperIds() : undefined} />
      </div>

      {/* Right sidebar: category-based paper scope selector */}
      <div className="w-52 shrink-0 border-l border-[#e5e7eb] bg-[#fafafa] flex flex-col select-none">
        <div className="p-3 border-b border-[#e5e7eb]">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">提问范围</p>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {/* All papers */}
          <button
            onClick={selectAll}
            className={`w-full flex items-center gap-2 px-3 py-2 mx-1 rounded-md text-xs transition-colors ${
              scopeType === "all"
                ? "bg-[#dce3f0] text-[#1a2744] font-semibold border-l-2 border-[#1a2744]"
                : "text-gray-600 hover:bg-gray-100 border-l-2 border-transparent"
            }`}
          >
            <Library className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate flex-1 text-left">全部文献</span>
            <span className="text-[10px] text-gray-400 shrink-0">{allPapers.length}</span>
          </button>

          {/* Category folders */}
          {SECTION_ORDER.map((sectionName) => {
            const items = sections[sectionName];
            if (!items || items.length === 0) return null;
            return (
              <div key={sectionName} className="mt-2">
                <div className="px-3 py-1 text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                  {sectionName}
                </div>
                {items.map((cat) => {
                  const isCategorySelected = scopeType === "category" && scopeTag === cat.tag;
                  const isExpanded = expandedCategories.has(cat.tag);
                  return (
                    <div key={cat.tag}>
                      {/* Category row */}
                      <div
                        className={`flex items-center gap-1 px-1 mx-1 rounded-md text-xs transition-colors ${
                          isCategorySelected ? "bg-[#dce3f0] border-l-2 border-[#1a2744]" : "hover:bg-gray-100 border-l-2 border-transparent"
                        }`}
                      >
                        <button
                          onClick={() => toggleCategory(cat.tag)}
                          className="p-1 rounded hover:bg-gray-200 shrink-0"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3 h-3 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-3 h-3 text-gray-400" />
                          )}
                        </button>
                        <button
                          onClick={() => selectCategory(cat.tag)}
                          className="flex items-center gap-2 flex-1 py-2 pr-2 text-left min-w-0"
                        >
                          {isCategorySelected ? (
                            <FolderOpen className="w-3.5 h-3.5 shrink-0 text-[#1a2744]" />
                          ) : (
                            <Folder className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                          )}
                          <span className={`truncate flex-1 ${isCategorySelected ? "font-medium text-[#1a2744]" : "text-gray-600"}`}>
                            {cat.tag}
                          </span>
                          <span className="text-[10px] text-gray-400 shrink-0">{cat.count}</span>
                        </button>
                      </div>

                      {/* Expanded papers */}
                      {isExpanded && (
                        <div className="ml-4 border-l border-[#e5e7eb] pl-2">
                          {(categoryPapers[cat.tag] || []).map((paper) => {
                            const isPaperSelected = scopeType === "paper" && scopePaperId === paper.id;
                            return (
                              <button
                                key={paper.id}
                                onClick={() => selectPaper(paper.id)}
                                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[11px] text-left transition-colors ${
                                  isPaperSelected
                                      ? "bg-[#dce3f0] text-[#1a2744] font-semibold border-l-2 border-[#1a2744]"
                                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-700 border-l-2 border-transparent"
                                }`}
                              >
                                <span className="truncate">{paper.title.slice(0, 28)}{paper.title.length > 28 ? "..." : ""}</span>
                              </button>
                            );
                          })}
                          {(categoryPapers[cat.tag] || []).length === 0 && (
                            <p className="text-[10px] text-gray-400 px-2 py-1">加载中...</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Remaining sections */}
          {Object.entries(sections).map(([sectionName, items]) => {
            if (SECTION_ORDER.includes(sectionName)) return null;
            return (
              <div key={sectionName} className="mt-2">
                <div className="px-3 py-1 text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                  {sectionName}
                </div>
                {items.map((cat) => {
                  const isCategorySelected = scopeType === "category" && scopeTag === cat.tag;
                  const isExpanded = expandedCategories.has(cat.tag);
                  return (
                    <div key={cat.tag}>
                      <div
                        className={`flex items-center gap-1 px-1 mx-1 rounded-md text-xs transition-colors ${
                          isCategorySelected ? "bg-[#dce3f0] border-l-2 border-[#1a2744]" : "hover:bg-gray-100 border-l-2 border-transparent"
                        }`}
                      >
                        <button onClick={() => toggleCategory(cat.tag)} className="p-1 rounded hover:bg-gray-200 shrink-0">
                          {isExpanded ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}
                        </button>
                        <button onClick={() => selectCategory(cat.tag)} className="flex items-center gap-2 flex-1 py-2 pr-2 text-left min-w-0">
                          {isCategorySelected ? (
                            <FolderOpen className="w-3.5 h-3.5 shrink-0 text-[#1a2744]" />
                          ) : (
                            <Folder className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                          )}
                          <span className={`truncate flex-1 ${isCategorySelected ? "font-medium text-[#1a2744]" : "text-gray-600"}`}>{cat.tag}</span>
                          <span className="text-[10px] text-gray-400 shrink-0">{cat.count}</span>
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="ml-4 border-l border-[#e5e7eb] pl-2">
                          {(categoryPapers[cat.tag] || []).map((paper) => {
                            const isPaperSelected = scopeType === "paper" && scopePaperId === paper.id;
                            return (
                              <button key={paper.id} onClick={() => selectPaper(paper.id)}
                                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[11px] text-left transition-colors ${
                                  isPaperSelected ? "bg-[#dce3f0] text-[#1a2744] font-semibold border-l-2 border-[#1a2744]" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700 border-l-2 border-transparent"
                                }`}>
                                <span className="truncate">{paper.title.slice(0, 28)}{paper.title.length > 28 ? "..." : ""}</span>
                              </button>
                            );
                          })}
                          {(categoryPapers[cat.tag] || []).length === 0 && (
                            <p className="text-[10px] text-gray-400 px-2 py-1">加载中...</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
