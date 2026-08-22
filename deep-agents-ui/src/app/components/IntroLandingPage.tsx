"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Zap,
  Cpu,
  Globe,
  Database,
  Mail,
  BarChart3,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Github,
  ExternalLink,
  Layers,
  Workflow,
  Server,
  Code2,
  FileText,
  Clock,
  Terminal,
  Activity,
  Sliders,
  Check,
  Search,
  Factory,
  ChevronRight
} from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";

interface IntroLandingPageProps {
  onEnterApp?: () => void;
}

interface ArchNode {
  id: string;
  layerId: number;
  title: string;
  badge: string;
  sourceFile: string;
  summary: string;
  techStack: string[];
  latency: string;
  inputData: string;
  outputData: string;
  codeSnippet: string;
}

interface ArchLayer {
  id: number;
  number: string;
  title: string;
  subtitle: string;
  color: string;
  badgeBg: string;
  badgeBorder: string;
  nodes: ArchNode[];
}

const ARCH_LAYERS: ArchLayer[] = [
  {
    id: 1,
    number: "01",
    title: "Multi-Signal Data Ingestion",
    subtitle: "Tầng Thu Thập Tín Hiệu Đa Sàn Real-Time",
    color: "#00FF88",
    badgeBg: "bg-[#00FF88]/10",
    badgeBorder: "border-[#00FF88]/30",
    nodes: [
      {
        id: "crawlers-etsy",
        layerId: 1,
        title: "Etsy GMV & Rank Scraper",
        badge: "Crawlee Stealth",
        sourceFile: "src/crawlers/etsy_scraper.py",
        summary: "Cào tự động danh sách listing thịnh hành trên Etsy, trích xuất giá bán, review velocity, bestseller tags và ước tính lượt tìm kiếm hàng tháng.",
        techStack: ["Crawlee Python", "Residential US Proxy", "Anti-PerimeterX"],
        latency: "~850ms",
        inputData: '{\n  "keyword": "personalized leather wallet",\n  "limit": 25,\n  "marketplace": "etsy_us"\n}',
        outputData: '{\n  "items": [\n    {\n      "title": "Custom Leather Cardholder",\n      "price": 28.5,\n      "monthly_sales": 620,\n      "review_count": 1420,\n      "is_bestseller": true\n    }\n  ]\n}',
        codeSnippet: `class EtsyScraper:
    async def fetch_trending_listings(self, keyword: str, limit: int = 20):
        # Stealth Crawlee worker with residential rotation
        context = await self.browser_pool.get_context()
        page = await context.new_page()
        url = f"https://www.etsy.com/search?q={quote_plus(keyword)}"
        await page.goto(url, wait_until="domcontentloaded")
        return self._extract_listing_cards(page)`
      },
      {
        id: "crawlers-amazon",
        layerId: 1,
        title: "Amazon BSR & BuyBox Scraper",
        badge: "PA-API + CDP",
        sourceFile: "src/crawlers/amazon_scraper.py",
        summary: "Trích xuất chỉ số Best Sellers Rank (BSR), phân tích BuyBox giá và ước tính doanh số hàng ngày qua thuật toán đảo nghịch BSR.",
        techStack: ["Amazon PA-API v5", "Browserless Cloud", "BSR Reverse Engine"],
        latency: "~1.1s",
        inputData: '{\n  "keyword": "engraved wooden sign",\n  "category": "Home & Kitchen",\n  "domain": "amazon.com"\n}',
        outputData: '{\n  "bsr_rank": 1240,\n  "estimated_monthly_units": 1150,\n  "avg_price": 34.99,\n  "prime_eligible": true\n}',
        codeSnippet: `def estimate_sales_from_bsr(bsr_rank: int, category: str) -> int:
    # Mathematical curve fitting for Amazon US Categories
    if category == "Home & Kitchen":
        return int(150000 * (bsr_rank ** -0.58))
    return int(80000 * (bsr_rank ** -0.52))`
      },
      {
        id: "crawlers-trends",
        layerId: 1,
        title: "Google Trends & Pinterest Signals",
        badge: "pytrends & Visual API",
        sourceFile: "src/crawlers/google_trends_scraper.py",
        summary: "Phân tích đường cong tốc độ tìm kiếm 12 tháng qua pytrends và đo lường độ phủ viral pin từ Pinterest.",
        techStack: ["pytrends US", "Pinterest Visual API", "Exponential Smoothing"],
        latency: "~600ms",
        inputData: '{\n  "terms": ["acrylic night light", "led name sign"],\n  "timeframe": "today 12-m",\n  "geo": "US"\n}',
        outputData: '{\n  "growth_pct": 42.5,\n  "seasonality_peak": "Q4 (Holiday Surge)",\n  "viral_pin_velocity": "+128%/mo"\n}',
        codeSnippet: `def get_trend_velocity(keyword: str) -> dict:
    pytrends.build_payload([keyword], timeframe='today 12-m', geo='US')
    df = pytrends.interest_over_time()
    growth = ((df[keyword].iloc[-4:].mean() / df[keyword].iloc[:4].mean()) - 1) * 100
    return {"growth_pct": round(growth, 1), "peak": "Q4" if growth > 30 else "Evergreen"}`
      }
    ]
  },
  {
    id: 2,
    number: "02",
    title: "Grounding & Cache Layer",
    subtitle: "Tầng Đối Soát Chống Ảo Giác & Bộ Đệm Tối Ưu",
    color: "#00D2FF",
    badgeBg: "bg-[#00D2FF]/10",
    badgeBorder: "border-[#00D2FF]/30",
    nodes: [
      {
        id: "grounding-citations",
        layerId: 2,
        title: "Grounding & Citation Engine",
        badge: "Zero-Hallucination",
        sourceFile: "src/citations/citation_engine.py",
        summary: "Tự động gán nhãn trích dẫn URL kiểm chứng cho 100% số liệu cơ hội sản phẩm, triệt tiêu hoàn toàn ảo giác AI.",
        techStack: ["Regex URL Anchor", "SKU Verifier", "Citation Tags [1..N]"],
        latency: "<5ms",
        inputData: '{\n  "unverified_claim": "Sản phẩm bán chạy 600 chiếc/tháng trên Etsy",\n  "evidence_url": "https://etsy.com/listing/123456"\n}',
        outputData: '{\n  "grounded_text": "Sản phẩm đạt 600 lượt bán/tháng [1]",\n  "citations": [\n    {\n      "id": 1,\n      "source": "Etsy Live Scraper",\n      "url": "https://etsy.com/listing/123456"\n    }\n  ]\n}',
        codeSnippet: `class CitationEngine:
    def ground_response(self, text: str, market_sources: list) -> tuple:
        # Injects inline anchor citations and returns verifiable sources map
        citations = []
        for idx, src in enumerate(market_sources, 1):
            citations.append({"id": idx, "url": src["url"], "title": src["title"]})
        return text, citations`
      },
      {
        id: "grounding-context",
        layerId: 2,
        title: "Context Offloader & 24h Cache",
        badge: "Token Optimizer",
        sourceFile: "src/context/context_offloader.py",
        summary: "Tự động offload các bảng ma trận dữ liệu lớn (>10KB) ra bộ nhớ đệm và lưu trữ ngoài, giữ context window của LLM luôn tinh gọn.",
        techStack: ["Local Disk Cache", "24h TTL", "MD5 Hash Fingerprinting"],
        latency: "<10ms",
        inputData: '{\n  "dataset_size": "45.8 KB (120 listings)",\n  "query_hash": "a8f19bc2e71"\n}',
        outputData: '{\n  "offloaded": true,\n  "summary_token_saved": 12400,\n  "cache_hit": true\n}',
        codeSnippet: `def offload_large_matrix(matrix_data: list, cache_key: str):
    if len(json.dumps(matrix_data)) > 10240:
        file_path = f"cache/matrices/{cache_key}.json"
        with open(file_path, "w") as f:
            json.dump(matrix_data, f)
        return {"offloaded": True, "reference_id": cache_key}`
      }
    ]
  },
  {
    id: 3,
    number: "03",
    title: "Cognitive Agentic Core",
    subtitle: "Tầng Trí Tuệ Nhân Tạo & Điều Phối 15 Công Cụ",
    color: "#A78BFA",
    badgeBg: "bg-[#A78BFA]/10",
    badgeBorder: "border-[#A78BFA]/30",
    nodes: [
      {
        id: "agent-react",
        layerId: 3,
        title: "LangGraph ReAct Orchestrator",
        badge: "Chief R&D Brain",
        sourceFile: "src/agent_graph.py",
        summary: "Bộ não điều phối trung tâm chạy vòng lặp suy luận ReAct (Reasoning + Acting), tự động lựa chọn công cụ phù hợp theo yêu cầu người dùng.",
        techStack: ["LangGraph 1.0", "LangChain ReAct", "Deterministic Temp 0.0"],
        latency: "~1.5s - 3.0s",
        inputData: '{\n  "user_prompt": "Tìm ngách sản phẩm quà tặng Ngày Của Cha có biên lợi nhuận > 40%",\n  "thread_id": "th_992a8"\n}',
        outputData: '{\n  "tool_calls": [\n    "fetch_etsy_market_data",\n    "fetch_amazon_market_data",\n    "evaluate_5d_opportunity_score"\n  ]\n}',
        codeSnippet: `graph = create_react_agent(
    model=llm,
    tools=orchestrator_tools,
    prompt=ORCHESTRATOR_SYSTEM_PROMPT
)`
      },
      {
        id: "agent-skills",
        layerId: 3,
        title: "10+ E-Commerce Domain Skills",
        badge: "Specialized Modules",
        sourceFile: "skills/ecommerce_skills/",
        summary: "Bộ thư viện tri thức chuyên sâu: Etsy SEO, Amazon Profit Calculator, Brand Protection, Review Sentiment Checker và Tối ưu Supply Chain.",
        techStack: ["Etsy SEO Analyzer", "Amazon FBA/FBM Math", "Review NLP Scorer"],
        latency: "<50ms",
        inputData: '{\n  "skill_name": "profit-margin-calculator-amazon",\n  "selling_price": 39.99,\n  "base_cost": 12.5\n}',
        outputData: '{\n  "amazon_fee": 6.0,\n  "shipping": 4.5,\n  "net_profit": 16.99,\n  "net_margin_pct": 42.48\n}',
        codeSnippet: `def consult_ecommerce_skill(skill_name: str, params: dict):
    skill_module = load_skill_script(skill_name)
    return skill_module.execute(params)`
      }
    ]
  },
  {
    id: 4,
    number: "04",
    title: "5D Scoring & Factory Normalizer",
    subtitle: "Tầng Chấm Điểm 5D & Khớp Phôi Xưởng Printway VN",
    color: "#FF8A00",
    badgeBg: "bg-[#FF8A00]/10",
    badgeBorder: "border-[#FF8A00]/30",
    nodes: [
      {
        id: "score-5d",
        layerId: 4,
        title: "5D Opportunity Scoring Engine",
        badge: "Algorithmic 0-100",
        sourceFile: "src/scoring.py",
        summary: "Chấm điểm cơ hội từ 0-100 dựa trên công thức 5 chiều trọng số: Demand (25%), Margin (25%), Competition (20%), Velocity (15%), Seasonality (15%).",
        techStack: ["Scoring Formula 5D", "Margin Simulation", "Risk Penalty Math"],
        latency: "<15ms",
        inputData: '{\n  "searches": 24000,\n  "competitors": 210,\n  "growth_pct": 38.0,\n  "base_cost": 8.5,\n  "selling_price": 29.99\n}',
        outputData: '{\n  "overall_opportunity_score": 86.5,\n  "verdict": "HIGH_OPPORTUNITY",\n  "margin_pct": 71.6,\n  "recommendation": "Launch with Printway Acrylic Stand"\n}',
        codeSnippet: `def evaluate_5d_score(demand, comp, growth, season, margin):
    score = (demand * 0.25) + (margin * 0.25) + (comp * 0.20) + (growth * 0.15) + (season * 0.15)
    verdict = "HIGH_OPPORTUNITY" if score >= 75 else "MODERATE"
    return {"score": round(score, 1), "verdict": verdict}`
      },
      {
        id: "factory-taxonomy",
        layerId: 4,
        title: "Printway Catalog & Factory Matcher",
        badge: "TF-IDF + Cosine",
        sourceFile: "src/taxonomy.py",
        summary: "Chuẩn hóa tiêu đề sản phẩm bất kỳ thành SKU phôi xưởng Printway Việt Nam (thời gian sản xuất 1-3 ngày, giao US 5-9 ngày).",
        techStack: ["Scikit-Learn TF-IDF", "Cosine Similarity", "Printway In-house Catalog"],
        latency: "<20ms",
        inputData: '{\n  "dirty_title": "Customised LED 3D Acrylic Bedside Lamp with Wooden Base"\n}',
        outputData: '{\n  "matched_sku": "PW-ACR-LED-01",\n  "product_type": "Acrylic Night Light (Wood Base)",\n  "base_cost": 6.2,\n  "production_time": "1-2 business days",\n  "shipping_us": "$4.50 (5-8 days)"\n}',
        codeSnippet: `class ProductTaxonomyNormalizer:
    def normalize(self, dirty_title: str) -> dict:
        query_vec = self.vectorizer.transform([dirty_title])
        scores = cosine_similarity(query_vec, self.doc_vectors)[0]
        best_idx = np.argmax(scores)
        return self.catalog[best_idx]`
      }
    ]
  },
  {
    id: 5,
    number: "05",
    title: "Visual Insights & Delivery",
    subtitle: "Tầng Sáng Tạo Design & Tự Động Hóa Gửi Báo Cáo",
    color: "#38BDF8",
    badgeBg: "bg-[#38BDF8]/10",
    badgeBorder: "border-[#38BDF8]/30",
    nodes: [
      {
        id: "output-insights",
        layerId: 5,
        title: "Visual Design Angles Engine",
        badge: "Generative POD",
        sourceFile: "src/insights.py",
        summary: "Đề xuất 3 hướng thiết kế POD sáng tạo (Minimalist Line Art, Vintage Retro, Cyberpunk Glow) kèm prompt tạo mockup chuẩn xưởng.",
        techStack: ["Design NLP Engine", "Mockup Prompt Generator", "Style Mapping"],
        latency: "~300ms",
        inputData: '{\n  "niche": "Gifts for Plant Lovers",\n  "product_type": "Ceramic Planter"\n}',
        outputData: '{\n  "design_angles": [\n    {"name": "Botanical Line Art", "vibe": "Minimalist Boho"},\n    {"name": "Retro Plant Mom 70s", "vibe": "Warm Vintage"},\n    {"name": "Punny Cactus Quotes", "vibe": "Humor Casual"}\n  ]\n}',
        codeSnippet: `def generate_design_angles(niche: str, product_type: str):
    return [
        {"style": "Minimalist Botanical", "color_palette": ["#E2D4C0", "#2D4A22"]},
        {"style": "Retro Typography", "color_palette": ["#E76F51", "#F4A261"]},
        {"style": "Cyberpunk Neon Flora", "color_palette": ["#00FF88", "#00D2FF"]}
    ]`
      },
      {
        id: "output-delivery",
        layerId: 5,
        title: "PDF Dossier & Resend Email Cron",
        badge: "Automated Reports",
        sourceFile: "src/tools/email_tools.py",
        summary: "Tự động xuất file PDF báo cáo thẩm định R&D và lên lịch gửi email tự động định kỳ qua Resend API.",
        techStack: ["Resend Email API", "ReportLab PDF Engine", "PostgreSQL Scheduled Crons"],
        latency: "~800ms",
        inputData: '{\n  "recipient": "seller@printway.io",\n  "frequency": "weekly_monday_8am",\n  "format": "html_and_pdf"\n}',
        outputData: '{\n  "status": "scheduled",\n  "next_run": "2026-08-24 08:00:00 UTC",\n  "email_id": "re_1982a87bf"\n}',
        codeSnippet: `def send_market_report_to_email(to_email: str, subject: str, report_html: str):
    resend.api_key = RESEND_API_KEY
    return resend.Emails.send({
        "from": "Printway Nexus AI <nexus@printway.io>",
        "to": [to_email],
        "subject": subject,
        "html": report_html
    })`
      }
    ]
  }
];

export function IntroLandingPage({ onEnterApp }: IntroLandingPageProps) {
  const { user, signInWithClerk, signUpWithClerk } = useAuth();

  // Interactive Architecture Blueprint State
  const [selectedLayerId, setSelectedLayerId] = useState<number>(3);
  const [selectedNodeId, setSelectedNodeId] = useState<string>("agent-react");
  const [inspectorTab, setInspectorTab] = useState<"overview" | "schema" | "code">("overview");

  const currentLayer = ARCH_LAYERS.find((l) => l.id === selectedLayerId) || ARCH_LAYERS[2];
  const currentNode =
    currentLayer.nodes.find((n) => n.id === selectedNodeId) ||
    currentLayer.nodes[0] ||
    ARCH_LAYERS[2].nodes[0];

  const handleSelectNode = (layerId: number, nodeId: string) => {
    setSelectedLayerId(layerId);
    setSelectedNodeId(nodeId);
  };

  const handlePrimaryAction = () => {
    if (user) {
      onEnterApp?.();
    } else {
      signUpWithClerk();
    }
  };

  return (
    <div className="min-h-screen bg-[#080B21] text-slate-100 font-sans selection:bg-[#00FF88]/30 selection:text-[#00FF88]">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 w-full border-b border-[#00FF88]/15 bg-[#080B21]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex items-center">
              <img
                src="/logo_header.png"
                alt="Printway Nexus"
                className="h-8 sm:h-9 w-auto object-contain"
              />
            </div>
            <span className="hidden sm:inline-block rounded-full bg-[#00FF88]/15 px-2 py-0.5 text-[10px] font-bold text-[#00FF88] border border-[#00FF88]/30">
              v2.0 PROD
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300">
            <a href="#blueprint" className="hover:text-[#00FF88] transition-colors flex items-center gap-1.5">
              <Workflow className="h-3.5 w-3.5 text-[#00FF88]" />
              <span>Sơ Đồ Kiến Trúc</span>
            </a>
            <a href="#scoring5d" className="hover:text-[#00D2FF] transition-colors flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5 text-[#00D2FF]" />
              <span>Ma Trận Điểm 5D</span>
            </a>
            <a href="#factory" className="hover:text-[#FF8A00] transition-colors flex items-center gap-1.5">
              <Factory className="h-3.5 w-3.5 text-[#FF8A00]" />
              <span>Khớp Xưởng Printway VN</span>
            </a>
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <button
                type="button"
                onClick={() => onEnterApp?.()}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#00FF88] to-[#00D2FF] px-4 py-2 text-xs font-bold text-[#080B21] shadow-[0_0_20px_rgba(0,255,136,0.3)] hover:opacity-90 transition-all cursor-pointer"
              >
                <span>Vào Workspace</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => signInWithClerk()}
                  className="rounded-xl border border-white/10 bg-[#0E1538] px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:border-[#00FF88]/40 hover:text-white transition-all cursor-pointer"
                >
                  Đăng Nhập
                </button>
                <button
                  type="button"
                  onClick={() => signUpWithClerk()}
                  className="flex items-center gap-1.5 rounded-xl bg-[#00FF88] px-3.5 py-1.5 text-xs font-bold text-[#080B21] shadow-[0_0_15px_rgba(0,255,136,0.4)] hover:bg-[#00FF88]/90 transition-all cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Trải Nghiệm Ngay</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 1. Minimalist Hero Section with Competition Banner */}
      <section className="relative overflow-hidden pt-12 pb-16 sm:pt-16 sm:pb-24 border-b border-white/10">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105 filter brightness-[0.30] contrast-125 pointer-events-none"
          style={{ backgroundImage: "url('/banner_crossborder.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080B21] via-[#080B21]/80 to-[#080B21]/50 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-transparent via-[#080B21]/60 to-[#080B21] pointer-events-none" />

        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#00FF88]/40 bg-[#080B21]/90 px-4 py-1.5 text-xs font-semibold text-[#00FF88] backdrop-blur-md shadow-[0_0_20px_rgba(0,255,136,0.25)] mb-6 animate-pulse">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Cross Border AI Innovation Summit 2026 &bull; Track: E-Commerce AI</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight">
            Phát Hiện & Thẩm Định Cơ Hội Sản Phẩm POD Bằng{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00FF88] via-[#00D2FF] to-[#FFFFFF]">
              Agentic AI Đa Tín Hiệu
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-xs sm:text-sm text-slate-200 leading-relaxed">
            <strong className="text-white">Printway Nexus</strong> tự động cào tín hiệu thời gian thực từ <strong>Etsy, Amazon, Pinterest & Google Trends</strong>, chấm điểm theo <strong>Ma trận 5D</strong> và đối soát phôi xưởng <strong>Printway Việt Nam (sản xuất 1-3 ngày)</strong>.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={handlePrimaryAction}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#00FF88] to-[#00D2FF] px-6 py-3.5 text-xs sm:text-sm font-extrabold text-[#080B21] shadow-[0_0_25px_rgba(0,255,136,0.4)] hover:scale-105 transition-all cursor-pointer"
            >
              <Zap className="h-4 w-4 fill-current" />
              <span>{user ? "Vào Bàn Làm Việc R&D" : "Bắt Đầu Nghiên Cứu Miễn Phí"}</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            <a
              href="#blueprint"
              className="flex items-center gap-2 rounded-xl border border-white/20 bg-[#0E1538]/90 backdrop-blur-md px-6 py-3.5 text-xs sm:text-sm font-bold text-white hover:border-[#00D2FF]/50 hover:bg-[#121A45] transition-all shadow-lg"
            >
              <Workflow className="h-4 w-4 text-[#00D2FF]" />
              <span>Khám Phá Sơ Đồ Kiến Trúc Tương Tác</span>
            </a>
          </div>

          {/* 4 Minimal Metric Badges */}
          <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-4xl mx-auto text-left">
            <div className="rounded-xl border border-[#00FF88]/30 bg-[#0E1538]/85 p-3.5 backdrop-blur-xl">
              <div className="text-[10px] font-mono text-slate-400">NGUỒN CÀO DỮ LIỆU THẬT</div>
              <div className="text-lg sm:text-xl font-black text-[#00FF88] mt-0.5">5+ Nền Tảng</div>
              <p className="text-[10px] text-slate-300 mt-0.5">Etsy, Amazon, Pinterest, Trends</p>
            </div>
            <div className="rounded-xl border border-[#00D2FF]/30 bg-[#0E1538]/85 p-3.5 backdrop-blur-xl">
              <div className="text-[10px] font-mono text-slate-400">CHẤM ĐIỂM CƠ HỘI</div>
              <div className="text-lg sm:text-xl font-black text-[#00D2FF] mt-0.5">Ma Trận 5D</div>
              <p className="text-[10px] text-slate-300 mt-0.5">Demand, Margin, Comp, Velocity</p>
            </div>
            <div className="rounded-xl border border-[#FF8A00]/30 bg-[#0E1538]/85 p-3.5 backdrop-blur-xl">
              <div className="text-[10px] font-mono text-slate-400">XƯỞNG PRINTWAY VN</div>
              <div className="text-lg sm:text-xl font-black text-[#FF8A00] mt-0.5">1 - 3 Ngày SX</div>
              <p className="text-[10px] text-slate-300 mt-0.5">Phôi chuẩn xưởng + 5-8 ngày giao US</p>
            </div>
            <div className="rounded-xl border border-white/20 bg-[#0E1538]/85 p-3.5 backdrop-blur-xl">
              <div className="text-[10px] font-mono text-slate-400">ĐỘ CHÍNH XÁC SỐ LIỆU</div>
              <div className="text-lg sm:text-xl font-black text-white mt-0.5">100% Grounded</div>
              <p className="text-[10px] text-slate-300 mt-0.5">Triệt tiêu ảo giác, trích dẫn URL</p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. THE STAR: Interactive Architecture Blueprint (Bản Vẽ Kiến Trúc Tương Tác) */}
      <section id="blueprint" className="py-16 sm:py-20 bg-[#080B21] relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto mb-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#00D2FF]/30 bg-[#00D2FF]/10 px-3.5 py-1 text-[11px] font-bold text-[#00D2FF] uppercase tracking-wider mb-2">
              <Workflow className="h-3.5 w-3.5" />
              <span>BẢN VẼ HỆ THỐNG TƯƠNG TÁC (INTERACTIVE SYSTEM BLUEPRINT)</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Kiến Trúc Kỹ Thuật Thực Sự Của Printway Nexus
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-400">
              Nhấp vào bất kỳ <strong>Tầng Kiến Trúc</strong> hoặc <strong>Module Nút</strong> bên dưới để xem luồng dữ liệu, schema thực tế và mã nguồn lõi.
            </p>
          </div>

          {/* Layer Selection Navigation Tabs */}
          <div className="flex items-center justify-start sm:justify-center gap-2 overflow-x-auto pb-4 mb-6 scrollbar-none">
            {ARCH_LAYERS.map((layer) => {
              const isSelected = selectedLayerId === layer.id;
              return (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() => {
                    setSelectedLayerId(layer.id);
                    setSelectedNodeId(layer.nodes[0].id);
                  }}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                    isSelected
                      ? `bg-[#0E1538] text-white shadow-lg`
                      : "bg-[#080B21] text-slate-400 border-white/10 hover:text-slate-200 hover:border-white/20"
                  }`}
                  style={{
                    borderColor: isSelected ? layer.color : undefined,
                    boxShadow: isSelected ? `0 0 15px ${layer.color}30` : undefined
                  }}
                >
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-black"
                    style={{ backgroundColor: `${layer.color}25`, color: layer.color }}
                  >
                    {layer.number}
                  </span>
                  <span>{layer.title}</span>
                </button>
              );
            })}
          </div>

          {/* Main Blueprint Interactive Grid: Left Visual Flow + Right Live Inspector */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 7 Columns: Visual Interactive Pipeline Nodes */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              {ARCH_LAYERS.map((layer) => {
                const isLayerActive = selectedLayerId === layer.id;
                return (
                  <div
                    key={layer.id}
                    className={`rounded-2xl border transition-all p-4 ${
                      isLayerActive
                        ? "bg-[#0E1538] border-opacity-100 shadow-2xl"
                        : "bg-[#0A0E2A]/70 border-white/5 opacity-80 hover:opacity-100 hover:border-white/15"
                    }`}
                    style={{
                      borderColor: isLayerActive ? layer.color : undefined,
                      boxShadow: isLayerActive ? `0 0 25px ${layer.color}20` : undefined
                    }}
                  >
                    {/* Layer Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="flex h-6 w-6 items-center justify-center rounded-lg text-xs font-black"
                          style={{ backgroundColor: `${layer.color}25`, color: layer.color }}
                        >
                          {layer.number}
                        </span>
                        <div>
                          <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                            <span>{layer.title}</span>
                            {isLayerActive && (
                              <span className="flex h-2 w-2 rounded-full animate-ping" style={{ backgroundColor: layer.color }} />
                            )}
                          </h4>
                          <span className="text-[10px] text-slate-400">{layer.subtitle}</span>
                        </div>
                      </div>
                      <span
                        className="text-[10px] font-mono px-2 py-0.5 rounded border"
                        style={{
                          backgroundColor: `${layer.color}15`,
                          borderColor: `${layer.color}40`,
                          color: layer.color
                        }}
                      >
                        {layer.nodes.length} Modules
                      </span>
                    </div>

                    {/* Nodes in this Layer */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {layer.nodes.map((node) => {
                        const isNodeSelected = selectedNodeId === node.id;
                        return (
                          <button
                            key={node.id}
                            type="button"
                            onClick={() => handleSelectNode(layer.id, node.id)}
                            className={`flex flex-col justify-between text-left p-3 rounded-xl border transition-all cursor-pointer ${
                              isNodeSelected
                                ? "bg-[#121A45] border-opacity-100 shadow-md"
                                : "bg-[#080B21]/90 border-white/10 hover:border-white/20 hover:bg-[#0E1538]"
                            }`}
                            style={{
                              borderColor: isNodeSelected ? layer.color : undefined,
                              boxShadow: isNodeSelected ? `0 0 12px ${layer.color}35` : undefined
                            }}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                {isNodeSelected && (
                                  <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ color: layer.color }} />
                                )}
                                <span>{node.title}</span>
                              </span>
                            </div>

                            <p className="text-[10px] text-slate-300 line-clamp-2 leading-relaxed mb-2">
                              {node.summary}
                            </p>

                            <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 border-t border-white/5 pt-1.5 mt-auto">
                              <span className="text-slate-400 truncate max-w-[140px]">{node.sourceFile}</span>
                              <span style={{ color: layer.color }} className="font-bold shrink-0">{node.latency}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right 5 Columns: Interactive Live Module Inspector Drawer */}
            <div className="lg:col-span-5 sticky top-20 rounded-2xl border border-white/15 bg-[#0E1538] p-5 shadow-2xl backdrop-blur-xl">
              {/* Header Inspector */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-xl font-black text-xs"
                    style={{ backgroundColor: `${currentLayer.color}25`, color: currentLayer.color }}
                  >
                    <Code2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-white">
                      Live Component Inspector
                    </h4>
                    <span className="text-[10px] font-mono text-slate-400">
                      {currentNode.sourceFile}
                    </span>
                  </div>
                </div>

                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded border"
                  style={{
                    backgroundColor: `${currentLayer.color}15`,
                    borderColor: `${currentLayer.color}40`,
                    color: currentLayer.color
                  }}
                >
                  {currentNode.badge}
                </span>
              </div>

              {/* Inspector Navigation Tabs */}
              <div className="flex rounded-xl bg-[#080B21] p-1 mb-4 border border-white/5 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setInspectorTab("overview")}
                  className={`flex-1 py-1.5 rounded-lg transition-all ${
                    inspectorTab === "overview"
                      ? "bg-[#121A45] text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Tổng Quan Module
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorTab("schema")}
                  className={`flex-1 py-1.5 rounded-lg transition-all ${
                    inspectorTab === "schema"
                      ? "bg-[#121A45] text-[#00D2FF] shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Schema I/O
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorTab("code")}
                  className={`flex-1 py-1.5 rounded-lg transition-all ${
                    inspectorTab === "code"
                      ? "bg-[#121A45] text-[#00FF88] shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Mã Nguồn Lõi
                </button>
              </div>

              {/* Tab 1: Overview */}
              {inspectorTab === "overview" && (
                <div className="space-y-4 animate-in fade-in duration-150 text-xs">
                  <div>
                    <h5 className="font-bold text-white mb-1.5 text-sm">{currentNode.title}</h5>
                    <p className="text-slate-300 leading-relaxed text-xs">
                      {currentNode.summary}
                    </p>
                  </div>

                  {/* Tech Specs Table */}
                  <div className="rounded-xl border border-white/5 bg-[#080B21] p-3 space-y-2">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">File triển khai:</span>
                      <span className="font-mono text-[#00FF88]">{currentNode.sourceFile}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Tốc độ phản hồi (Latency):</span>
                      <span className="font-mono text-white font-bold">{currentNode.latency}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Độ tin cậy (Anti-Ban SLA):</span>
                      <span className="font-mono text-[#00D2FF] font-bold">99.8% Grounded</span>
                    </div>
                  </div>

                  {/* Tech Stack Pills */}
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1.5">
                      Công nghệ & Kỹ thuật lõi
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {currentNode.techStack.map((tech, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-[#080B21] border border-white/10 text-[10px] font-mono text-slate-200"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Schema I/O */}
              {inspectorTab === "schema" && (
                <div className="space-y-3 animate-in fade-in duration-150 text-xs">
                  <div>
                    <span className="text-[10px] font-mono text-[#00D2FF] uppercase tracking-wider block mb-1">
                      &bull; Input Payload (Tham Số Đầu Vào)
                    </span>
                    <pre className="rounded-xl bg-[#080B21] p-3 font-mono text-[10px] text-slate-200 overflow-x-auto border border-white/5">
                      {currentNode.inputData}
                    </pre>
                  </div>

                  <div>
                    <span className="text-[10px] font-mono text-[#00FF88] uppercase tracking-wider block mb-1">
                      &bull; Output Payload (Dữ Liệu Trả Về)
                    </span>
                    <pre className="rounded-xl bg-[#080B21] p-3 font-mono text-[10px] text-[#00FF88] overflow-x-auto border border-white/5">
                      {currentNode.outputData}
                    </pre>
                  </div>
                </div>
              )}

              {/* Tab 3: Code Snippet */}
              {inspectorTab === "code" && (
                <div className="space-y-2 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span>Python Production Snippet</span>
                    <span className="text-[#00FF88]">Verified</span>
                  </div>
                  <pre className="rounded-xl bg-[#080B21] p-3.5 font-mono text-[10.5px] text-slate-200 overflow-x-auto border border-white/5 leading-relaxed">
                    <code>{currentNode.codeSnippet}</code>
                  </pre>
                </div>
              )}

              {/* Quick Action Button */}
              <div className="mt-5 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={handlePrimaryAction}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00FF88] to-[#00D2FF] py-2.5 text-xs font-bold text-[#080B21] shadow-lg hover:opacity-90 transition-all cursor-pointer"
                >
                  <Zap className="h-3.5 w-3.5 fill-current" />
                  <span>Trải Nghiệm Trực Tiếp Module Này</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Minimal 5D Scoring Matrix Breakdown */}
      <section id="scoring5d" className="py-16 bg-[#0A0E2B] border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#00FF88]/30 bg-[#00FF88]/10 px-3.5 py-1 text-[11px] font-bold text-[#00FF88] uppercase tracking-wider mb-2">
              <BarChart3 className="h-3.5 w-3.5" />
              <span>CƠ CHẾ ĐỊNH LƯỢNG KHOA HỌC</span>
            </div>
            <h3 className="text-2xl sm:text-4xl font-black text-white">
              Ma Trận 5D Thẩm Định Cơ Hội Sản Phẩm
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-slate-400">
              Công thức 5 chiều trọng số độc quyền giúp nhà bán loại bỏ cảm tính và chọn đúng sản phẩm thắng ngay từ ngày đầu.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="rounded-2xl border border-[#00FF88]/20 bg-[#0E1538] p-4 text-left">
              <div className="text-xl font-black text-[#00FF88]">25%</div>
              <h5 className="font-bold text-white text-xs mt-1">1. Demand Score</h5>
              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                Đo lường dung lượng tìm kiếm hàng tháng và doanh số bán thực tế từ Etsy & Amazon.
              </p>
            </div>

            <div className="rounded-2xl border border-[#00D2FF]/20 bg-[#0E1538] p-4 text-left">
              <div className="text-xl font-black text-[#00D2FF]">25%</div>
              <h5 className="font-bold text-white text-xs mt-1">2. Margin & Fit</h5>
              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                Biên lợi nhuận ròng sau khi đối soát giá phôi xưởng Printway VN và phí sàn thương mại.
              </p>
            </div>

            <div className="rounded-2xl border border-[#A78BFA]/20 bg-[#0E1538] p-4 text-left">
              <div className="text-xl font-black text-[#A78BFA]">20%</div>
              <h5 className="font-bold text-white text-xs mt-1">3. Competition</h5>
              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                Mật độ đối thủ cạnh tranh trên trang nhất. Càng ít đối thủ Bestseller điểm càng cao.
              </p>
            </div>

            <div className="rounded-2xl border border-[#FF8A00]/20 bg-[#0E1538] p-4 text-left">
              <div className="text-xl font-black text-[#FF8A00]">15%</div>
              <h5 className="font-bold text-white text-xs mt-1">4. Growth Velocity</h5>
              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                Tốc độ tăng trưởng tìm kiếm 12 tháng từ Google Trends và Pinterest viral pins.
              </p>
            </div>

            <div className="rounded-2xl border border-white/20 bg-[#0E1538] p-4 text-left">
              <div className="text-xl font-black text-white">15%</div>
              <h5 className="font-bold text-white text-xs mt-1">5. Seasonality Timing</h5>
              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                Đánh giá thời điểm vàng ra mắt (Evergreen quanh năm hoặc đón đầu sóng Q4/Father's Day).
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Printway Factory Direct Connection */}
      <section id="factory" className="py-16 bg-[#080B21] border-t border-white/10">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-[#FF8A00]/30 bg-[#0E1538] p-6 sm:p-10 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-left space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#FF8A00]/40 bg-[#FF8A00]/10 px-3 py-0.5 text-[10px] font-bold text-[#FF8A00]">
                <Factory className="h-3.5 w-3.5" />
                <span>IN-HOUSE MANUFACTURING SYNC</span>
              </div>
              <h3 className="text-xl sm:text-3xl font-black text-white">
                Khớp Trực Tiếp Phôi Xưởng Printway Việt Nam
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
                Không chỉ gợi ý ý tưởng, Printway Nexus ánh xạ thẳng cơ hội sản phẩm với kho phôi xưởng in ấn Printway (Acrylic, Gỗ, Kim Loại, Gốm Sứ), kiểm tra giá xuất xưởng và thời gian hoàn thành 1-3 ngày làm việc.
              </p>
              <div className="flex flex-wrap gap-2 text-[10px] font-mono text-[#FF8A00] pt-1">
                <span className="px-2.5 py-1 rounded bg-[#080B21] border border-[#FF8A00]/30">Sản xuất 1-3 ngày</span>
                <span className="px-2.5 py-1 rounded bg-[#080B21] border border-[#FF8A00]/30">Vận chuyển US 5-8 ngày</span>
                <span className="px-2.5 py-1 rounded bg-[#080B21] border border-[#FF8A00]/30">100+ Loại Phôi In-house</span>
              </div>
            </div>

            <div className="shrink-0 w-full md:w-auto">
              <button
                type="button"
                onClick={handlePrimaryAction}
                className="w-full md:w-auto flex items-center justify-center gap-2 rounded-2xl bg-[#FF8A00] hover:bg-[#FF7A00] px-8 py-4 text-xs sm:text-sm font-extrabold text-[#080B21] shadow-[0_0_30px_rgba(255,138,0,0.35)] transition-all cursor-pointer"
              >
                <span>Bắt Đầu Thẩm Định Ngay</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Minimal Footer */}
      <footer className="border-t border-white/10 bg-[#060818] py-8 text-xs text-slate-500">
        <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex items-center">
              <img
                src="/logo_header.png"
                alt="Printway Nexus"
                className="h-6 w-auto object-contain"
              />
            </div>
            <span>&copy; 2026 Printway Nexus. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6 text-[11px]">
            <a href="https://printway.io/en" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
              Printway Official Catalog
            </a>
            <a href="https://github.com/Trung1234/product-hub-assistant" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
              GitHub Repository
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
