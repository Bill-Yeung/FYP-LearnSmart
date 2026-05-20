import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import {
  UploadCloud,
  Search,
  FolderOpen,
  Building,
  Atom,
  BookOpen,
  DivideCircle,
  TrendingUp,
  Inbox,
  X,
} from "lucide-react";

interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  icon: "history" | "science" | "literature" | "math" | "economics";
  type: string;
  documentCount: number;
  scriptCount: number;
  lastUpdated: string;
  tags: string[];
  source: "System Knowledge Base" | "Personal Upload";
}

const INITIAL_BASES: KnowledgeBase[] = [
  {
    id: "kb_001",
    name: "Modern Chinese History Knowledge Base",
    description:
      "Contains important historical events such as the Opium War, Taiping Rebellion, Hundred Days' Reform, and Xinhai Revolution, covering multi-dimensional analysis of politics, economy, and society.",
    icon: "history",
    type: "History",
    documentCount: 245,
    scriptCount: 12,
    lastUpdated: "2023-10-20",
    tags: [
      "Opium War",
      "Unequal Treaties",
      "Self-Strengthening Movement",
      "Xinhai Revolution",
    ],
    source: "System Knowledge Base",
  },
  {
    id: "kb_002",
    name: "World History of Science Knowledge Base",
    description:
      "From ancient science to the modern scientific and technological revolution, covering important scientific discoveries and theoretical breakthroughs in physics, chemistry, biology, astronomy, etc.",
    icon: "science",
    type: "Science",
    documentCount: 189,
    scriptCount: 8,
    lastUpdated: "2023-10-18",
    tags: [
      "Scientific Revolution",
      "Physics",
      "Biology",
      "Technological Development",
    ],
    source: "System Knowledge Base",
  },
  {
    id: "kb_003",
    name: "Classical Literature Knowledge Base",
    description:
      "Covers the classics of ancient Chinese literature, including poetry, prose, novels, etc., providing background analysis, literary criticism, and creative techniques.",
    icon: "literature",
    type: "Literature",
    documentCount: 312,
    scriptCount: 15,
    lastUpdated: "2023-10-15",
    tags: [
      "Poetry",
      "Ancient Prose",
      "Dream of the Red Chamber",
      "Literary Criticism",
    ],
    source: "System Knowledge Base",
  },
  {
    id: "kb_004",
    name: "History of Mathematical Thought Knowledge Base",
    description:
      "From ancient mathematics to modern mathematical theories, covering important mathematical ideas, theorem proofs, and application scenarios to cultivate mathematical thinking.",
    icon: "math",
    type: "Math",
    documentCount: 167,
    scriptCount: 9,
    lastUpdated: "2023-10-12",
    tags: ["Geometry", "Algebra", "Calculus", "Mathematical Thinking"],
    source: "System Knowledge Base",
  },
  {
    id: "kb_005",
    name: "Opium War Special Topic Base",
    description:
      "In-depth analysis of the historical background, economic factors, military conflicts, and long-term impact of the Opium War, including a large number of original documents and research results.",
    icon: "history",
    type: "History",
    documentCount: 78,
    scriptCount: 5,
    lastUpdated: "2023-10-10",
    tags: [
      "Opium War",
      "Treaty of Nanking",
      "Lin Zexu",
      "Sino-British Relations",
    ],
    source: "Personal Upload",
  },
  {
    id: "kb_006",
    name: "Principles of Economics Knowledge Base",
    description:
      "Covers the basic principles of microeconomics and macroeconomics, and understands economic laws through case analysis and interactive scenarios.",
    icon: "economics",
    type: "Economics",
    documentCount: 134,
    scriptCount: 7,
    lastUpdated: "2023-10-08",
    tags: [
      "Supply and Demand",
      "Market Structure",
      "Macroeconomic Policy",
      "International Trade",
    ],
    source: "System Knowledge Base",
  },
];

const FILTER_TAGS = [
  "All",
  "History",
  "Science",
  "Literature",
  "Math",
  "System Knowledge Base",
  "Personal Uploads",
  "Recently Updated",
];

export const GenerateFromBasePage: React.FC = () => {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // apply the active filter and search query to the seed list
  const filteredBases = useMemo(() => {
    let list = INITIAL_BASES;

    if (activeFilter && activeFilter !== "All") {
      list = list.filter((base) => {
        if (activeFilter === "System Knowledge Base") {
          return base.source === "System Knowledge Base";
        }
        if (activeFilter === "Personal Uploads") {
          return base.source === "Personal Upload";
        }
        if (activeFilter === "Recently Updated") {
          return (
            base.lastUpdated.includes("2023-10-2") ||
            base.lastUpdated.includes("2023-10-1")
          );
        }
        return base.type === activeFilter || base.tags.includes(activeFilter);
      });
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((base) => {
        const text = q;
        return (
          base.name.toLowerCase().includes(text) ||
          base.description.toLowerCase().includes(text) ||
          base.type.toLowerCase().includes(text) ||
          base.tags.some((tag) => tag.toLowerCase().includes(text)) ||
          base.source.toLowerCase().includes(text)
        );
      });
    }

    return list;
  }, [activeFilter, search]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleGenerateByUpload = () => {
    navigate("/game/generate-script");
  };

  const selectedBases = useMemo(
    () => INITIAL_BASES.filter((b) => selectedIds.includes(b.id)),
    [selectedIds]
  );

  return (
    <div className="space-y-6">
      {/* Breadcrumbs + page header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <span className="cursor-pointer hover:text-foreground">Home</span>
          <span>{">"}</span>
          <span className="cursor-pointer hover:text-foreground">Script Center</span>
          <span>{">"}</span>
          <span className="font-medium text-foreground">From knowledge base</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-4 mb-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Generate from Knowledge Base
            </h1>
            <p className="text-muted-foreground mt-1">
              Browse and select from available knowledge bases
            </p>
          </div>
          <Button
            className="rounded-xl border border-border/80 bg-gradient-to-b from-background/60 to-background/30 text-foreground shadow-sm"
            onClick={handleGenerateByUpload}
          >
            <UploadCloud className="w-4 h-4 mr-2" />
            Generate by uploading document
          </Button>
        </div>
      </div>

      {/* Search Section */}
      <Card className="p-5 space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Search className="w-4 h-4" />
            </span>
            <input
              className="w-full rounded-xl border bg-background pl-9 pr-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/60"
              placeholder="Search knowledge bases, documents, keywords..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button className="md:w-auto w-full gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600">
            <span>Search</span>
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTER_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveFilter(tag)}
              className={`px-3 py-1.5 rounded-full border text-xs sm:text-sm transition-colors ${
                activeFilter === tag
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </Card>

      {/* Main content */}
      <div className="grid lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)] gap-6 items-start">
        {/* Knowledge base list */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <span>Available knowledge bases</span>
            </div>
            <div className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              {filteredBases.length}
            </div>
          </div>

          {filteredBases.length === 0 ? (
            <Card className="py-10 text-center text-muted-foreground">
              <div className="flex items-center justify-center mb-3">
                <FolderOpen className="w-12 h-12 text-slate-400" />
              </div>
              <div className="font-medium mb-1">No knowledge bases found</div>
              <p className="text-sm">
                Try adjusting your search keywords or filters.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredBases.map((base) => {
                const isSelected = selectedIds.includes(base.id);

                const iconBg =
                  base.icon === "history"
                    ? "bg-gradient-to-br from-amber-400 to-amber-500"
                    : base.icon === "science"
                    ? "bg-gradient-to-br from-emerald-500 to-emerald-400"
                    : base.icon === "literature"
                    ? "bg-gradient-to-br from-violet-500 to-violet-400"
                    : base.icon === "math"
                    ? "bg-gradient-to-br from-blue-500 to-blue-400"
                    : "bg-gradient-to-br from-indigo-500 to-indigo-400";

                const iconComponent =
                  base.icon === "history" ? (
                    <Building className="w-6 h-6" />
                  ) : base.icon === "science" ? (
                    <Atom className="w-6 h-6" />
                  ) : base.icon === "literature" ? (
                    <BookOpen className="w-6 h-6" />
                  ) : base.icon === "math" ? (
                    <DivideCircle className="w-6 h-6" />
                  ) : (
                    <TrendingUp className="w-6 h-6" />
                  );

                return (
                  <Card
                    key={base.id}
                    className={`relative flex flex-col h-full p-5 border transition-shadow cursor-pointer shadow-sm hover:shadow-md ${
                      isSelected
                        ? "border-emerald-400 shadow-[0_0_0_1px_rgba(16,185,129,0.5),0_10px_25px_rgba(15,23,42,0.12)]"
                        : ""
                    }`}
                    onClick={() => toggleSelect(base.id)}
                  >
                    <div className="flex items-start gap-4 mb-3">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl text-white ${iconBg}`}
                      >
                        {iconComponent}
                      </div>
                      <div>
                        <div className="text-base font-semibold leading-snug">
                          {base.name}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {base.source}
                        </div>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                      {base.description}
                    </p>

                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {base.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-[11px] text-emerald-800"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="flex justify-between text-[11px] text-muted-foreground mb-3">
                      <span>{base.documentCount} documents</span>
                      <span>{base.scriptCount} scripts</span>
                      <span>{base.lastUpdated}</span>
                    </div>

                    <div className="mt-auto flex gap-2">
                      <Button
                        className="flex-1 border bg-muted/40 hover:bg-muted text-sm py-1.5"
                        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                          e.stopPropagation();
                          // Simple placeholder; can be replaced by a detail drawer/dialog later
                          alert(
                            `View knowledge base: ${base.name}\n\nDescription: ${base.description}`
                          );
                        }}
                      >
                        View
                      </Button>
                      <Button
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-sm py-1.5"
                        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                          e.stopPropagation();
                          toggleSelect(base.id);
                        }}
                      >
                        {isSelected ? "Selected" : "Select"}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Selected sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-20">
          <Card className="p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-base font-semibold">
                <span>Selected knowledge bases</span>
              </div>
              <div className="px-2.5 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">
                {selectedBases.length}
              </div>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {selectedBases.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-6">
                  <div className="mb-2">
                    <Inbox className="mx-auto h-12 w-12 text-slate-400" />
                  </div>
                  <div className="font-medium mb-1">
                    No knowledge base selected
                  </div>
                  <p className="text-xs">
                    Please select a knowledge base from the list.
                  </p>
                </div>
              ) : (
                selectedBases.map((base) => (
                  <div
                    key={base.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/60 border border-border/60"
                  >
                    <div className="w-9 h-9 rounded-md flex items-center justify-center text-lg bg-background">
                      {base.icon === "history" ? (
                        <Building className="w-5 h-5" />
                      ) : base.icon === "science" ? (
                        <Atom className="w-5 h-5" />
                      ) : base.icon === "literature" ? (
                        <BookOpen className="w-5 h-5" />
                      ) : base.icon === "math" ? (
                        <DivideCircle className="w-5 h-5" />
                      ) : (
                        <TrendingUp className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {base.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {base.type} · {base.source}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="text-destructive text-lg px-1"
                      onClick={() => toggleSelect(base.id)}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-2 pt-2">
              <Button
                className="w-full justify-center gap-2 bg-emerald-500 hover:bg-emerald-600"
                disabled={selectedBases.length === 0}
                onClick={() => {
                  alert(
                    `Generate script from ${selectedBases.length} selected knowledge base(s).`
                  );
                }}
              >
                <span>Generate script from selection</span>
              </Button>
              <Button
                className="w-full justify-center gap-2 border"
                onClick={() => setSelectedIds([])}
                disabled={selectedBases.length === 0}
              >
                Clear selection
              </Button>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
};
export default GenerateFromBasePage;