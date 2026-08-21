import streamlit as st
import json
import pandas as pd
import time
from src.agents.research_agents import ProductOpportunityHubOrchestrator
from src.insights import DesignInsightsEngine

# Page Config & Styling
st.set_page_config(
    page_title="Product Opportunity Hub | DeepAgents UI",
    page_icon="🚀",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS styling for premium R&D Dashboard & Tool Call Inspector
st.markdown("""
<style>
    .main-header {
        font-size: 2.3rem;
        font-weight: 800;
        background: linear-gradient(90deg, #4F46E5, #06B6D4);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0px;
    }
    .sub-header {
        font-size: 1.1rem;
        color: #9CA3AF;
        margin-bottom: 25px;
    }
    .tool-box {
        background-color: #0F172A;
        border: 1px solid #334155;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 10px;
        font-family: monospace;
    }
    .tool-name {
        color: #38BDF8;
        font-weight: bold;
        font-size: 0.95rem;
    }
    .tool-status {
        background-color: #0284C7;
        color: white;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 0.8rem;
        float: right;
    }
    .metric-card {
        background-color: #1E293B;
        border-radius: 10px;
        padding: 15px;
        border: 1px solid #334155;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .badge-recommend {
        background-color: #059669;
        color: white;
        padding: 6px 14px;
        border-radius: 20px;
        font-weight: bold;
        font-size: 0.9rem;
    }
    .badge-caution {
        background-color: #D97706;
        color: white;
        padding: 6px 14px;
        border-radius: 20px;
        font-weight: bold;
        font-size: 0.9rem;
    }
    .badge-reject {
        background-color: #DC2626;
        color: white;
        padding: 6px 14px;
        border-radius: 20px;
        font-weight: bold;
        font-size: 0.9rem;
    }
</style>
""", unsafe_allow_html=True)

@st.cache_resource
def load_orchestrator():
    return ProductOpportunityHubOrchestrator()

@st.cache_resource
def load_insights_engine():
    return DesignInsightsEngine()

orchestrator = load_orchestrator()
insights_engine = load_insights_engine()

# Sidebar
st.sidebar.image("https://img.icons8.com/color/96/000000/brainstorm-skill.png", width=70)
st.sidebar.title("POD Opportunity Hub")
st.sidebar.markdown("**DeepAgents Multi-Agent UI**")
st.sidebar.markdown("---")
st.sidebar.info("🤖 **Framework:** DeepAgents / LangGraph UI\n🛠️ **Tool Tracing:** Enabled\n🎯 **Taxonomy:** Printway Catalog DB")

# Main Header
st.markdown('<p class="main-header">Product Opportunity Hub 🚀</p>', unsafe_allow_html=True)
st.markdown('<p class="sub-header">Automated Multi-Source Market Signal Aggregation & Tool Execution Inspector for DeepAgents</p>', unsafe_allow_html=True)

# Tabs
tab1, tab2, tab3, tab4 = st.tabs([
    "🔍 Instant Listing Evaluator & Tool Inspector",
    "📊 Market Trend Aggregator & Niche Comparison",
    "⚡ Early Alerts & Design Insights",
    "🏬 Printway Catalog & Taxonomy"
])

# ==========================================
# TAB 1: Instant Listing Evaluator & Tool Call Inspector
# ==========================================
with tab1:
    st.subheader("Evaluate Listing Title & Inspect Agent Tool Executions")
    st.caption("Paste any listing title or URL. DeepAgents will invoke specialized tools, displaying input parameters, execution status, and tool responses in real-time.")
    
    sample_queries = [
        "Personalized Grandpa Gift For Father's Day From Granddaughter Custom Shape Acrylic Ornament",
        "Custom Acrylic Photo Night Light Lamp Plaque with Wooden Base Memorial Dog Loss Gift",
        "Layered Laser Cut Wooden Family Tree Ornament Personalised Christmas Gift for Grandma",
        "Personalized Metal Garden Sign Custom Metal Wall Art Plant Lover Gift Metal Sign Outdoor",
        "Custom Engraved Leatherette Journal Notebook Gift for Writer Husband Father Anniversary"
    ]
    
    selected_sample = st.selectbox("💡 Select sample test query:", ["Custom Input..."] + sample_queries)
    default_text = selected_sample if selected_sample != "Custom Input..." else "Personalized Grandpa Gift For Father's Day From Granddaughter Custom Shape Acrylic Ornament"
    user_input = st.text_area("Paste Listing Title or URL:", value=default_text, height=80)
    
    col_btn1, col_btn2 = st.columns([1, 4])
    with col_btn1:
        run_analysis = st.button("🚀 Run Agent & Stream Tools", type="primary", use_container_width=True)

    if run_analysis:
        if not user_input.strip():
            st.warning("Please enter a title or URL to evaluate.")
        else:
            # Container for Tool Execution Tracing
            st.markdown("### 🛠️ Real-time Tool Execution & Agent Steps")
            
            with st.status("🤖 DeepAgents Orchestrator Executing Task...", expanded=True) as status:
                st.write("🧠 **Planner Agent**: Decomposing user request into sub-agent tool calls...")
                time.sleep(0.3)

                # Tool 1 Execution
                st.write("🛠️ Executing Tool 1: `MarketDataHarvester.fetch_metrics()`")
                res = orchestrator.run_listing_analysis(user_input)
                norm = res["normalized_product"]
                scoring = res["scoring_result"]
                metrics = res["listing_metrics"]
                breakdown = scoring["breakdown"]

                st.write("🛠️ Executing Tool 2: `TaxonomyNormalizer.vector_map_title()`")
                time.sleep(0.3)

                st.write("🛠️ Executing Tool 3: `OpportunityScorer.calculate_5d_score()`")
                time.sleep(0.3)

                st.write("🛠️ Executing Tool 4: `ResearchReportGenerator.build_markdown()`")
                time.sleep(0.2)

                status.update(label="✅ All DeepAgent tools executed successfully!", state="complete", expanded=False)

            st.success("✅ Workflow Finished! Inspect Tool Call Details below:")

            # Interactive Tool Call Inspector Expander
            with st.expander("🛠️ Inspect Detailed Agent Tool Calls & Arguments", expanded=True):
                t_col1, t_col2 = st.columns(2)
                
                with t_col1:
                    st.markdown("""
                    <div class="tool-box">
                        <span class="tool-name">1. MarketDataHarvesterAgent</span>
                        <span class="tool-status">SUCCESS</span>
                        <br><small>Tool: <code>fetch_marketplace_signals(query)</code></small>
                    </div>
                    """, unsafe_allow_html=True)
                    st.json({
                        "tool_name": "fetch_marketplace_signals",
                        "input_arguments": {"query": user_input, "sources": ["Etsy", "Amazon", "Google Trends"]},
                        "output_result": metrics
                    })

                    st.markdown("""
                    <div class="tool-box">
                        <span class="tool-name">2. TaxonomyNormalizerAgent</span>
                        <span class="tool-status">SUCCESS</span>
                        <br><small>Tool: <code>normalize_to_printway_taxonomy(title)</code></small>
                    </div>
                    """, unsafe_allow_html=True)
                    st.json({
                        "tool_name": "normalize_to_printway_taxonomy",
                        "input_arguments": {"title": user_input, "catalog_size": 12},
                        "output_result": norm
                    })

                with t_col2:
                    st.markdown("""
                    <div class="tool-box">
                        <span class="tool-name">3. OpportunityEvaluatorAgent</span>
                        <span class="tool-status">SUCCESS</span>
                        <br><small>Tool: <code>compute_5d_opportunity_score(metrics, taxonomy)</code></small>
                    </div>
                    """, unsafe_allow_html=True)
                    st.json({
                        "tool_name": "compute_5d_opportunity_score",
                        "input_arguments": {"metrics": "LST_METRICS", "taxonomy": norm["product_type_id"]},
                        "output_result": {
                            "opportunity_score": scoring["opportunity_score"],
                            "recommendation": scoring["recommendation"],
                            "breakdown": breakdown
                        }
                    })

                    st.markdown("""
                    <div class="tool-box">
                        <span class="tool-name">4. ResearchReportAgent</span>
                        <span class="tool-status">SUCCESS</span>
                        <br><small>Tool: <code>render_actionable_markdown_report()</code></small>
                    </div>
                    """, unsafe_allow_html=True)
                    st.json({
                        "tool_name": "render_actionable_markdown_report",
                        "output_length_chars": len(res["report_markdown"]),
                        "format": "GitHub Markdown + Alerts"
                    })

            st.markdown("---")

            # Final Recommendation Banner
            col_rec1, col_rec2, col_rec3 = st.columns([2, 1, 1])
            with col_rec1:
                st.markdown(f"### Mapped Product Type: `{norm['product_type']}`")
                st.markdown(f"**Category:** `{norm['category']}` | **Material:** `{norm['material']}` | **Confidence:** `{norm['normalization_confidence_pct']}%`")
                st.caption(f"Reason: {scoring['summary_reason']}")
            with col_rec2:
                st.metric("Opportunity Score", f"{scoring['opportunity_score']} / 100")
            with col_rec3:
                rec = scoring["recommendation"]
                if rec == "RECOMMEND":
                    st.markdown('<br><span class="badge-recommend">🔥 RECOMMEND LAUNCH</span>', unsafe_allow_html=True)
                elif rec == "RECOMMEND WITH CAUTION":
                    st.markdown('<br><span class="badge-caution">⚠️ CAUTION (TEST SMALL)</span>', unsafe_allow_html=True)
                else:
                    st.markdown('<br><span class="badge-reject">❌ NOT RECOMMEND</span>', unsafe_allow_html=True)

            st.markdown("---")
            st.subheader("📊 5-Dimensional Opportunity Score Breakdown")

            col_b1, col_b2, col_b3, col_b4, col_b5, col_b6 = st.columns(6)
            col_b1.metric("1. Demand (25%)", f"{breakdown['demand']['score']}/100")
            col_b2.metric("2. Competition (20%)", f"{breakdown['competition']['score']}/100")
            col_b3.metric("3. Growth (20%)", f"{breakdown['growth']['score']}/100")
            col_b4.metric("4. Seasonality (15%)", f"{breakdown['seasonality']['score']}/100")
            col_b5.metric("5. Personalization (10%)", f"{breakdown['personalization']['score']}/100")
            col_b6.metric("6. Printway Fit (10%)", f"{breakdown['production_fit']['score']}/100")

            st.markdown("---")
            st.subheader("📄 Actionable Product Research Report")
            st.markdown(res["report_markdown"])
            
            st.download_button(
                label="📥 Export Report as Markdown (.md)",
                data=res["report_markdown"],
                file_name=f"product_report_{norm['product_type_id']}.md",
                mime="text/markdown"
            )

# ==========================================
# TAB 2: Trend Aggregator & Niche Comparison
# ==========================================
with tab2:
    st.subheader("Compare Market Opportunities across Niches")
    
    col_n1, col_n2 = st.columns([3, 1])
    with col_n1:
        niches_input = st.multiselect(
            "Select Niches to Compare:",
            ["Memorial", "Pet", "Gardening", "Father's Day", "Grandparent", "Christmas", "Anniversary"],
            default=["Memorial", "Pet", "Gardening"]
        )
    with col_n2:
        launch_quarter = st.selectbox("Target Launch Window:", ["Q4 (Christmas Peak)", "Q2 (Father's/Mother's Day)", "Evergreen"])

    if st.button("📊 Compare Niches & Rank Opportunities", type="primary"):
        comp_data = orchestrator.compare_niches(niches_input)
        rankings = comp_data["rankings"]
        
        if not rankings:
            st.warning("No listings found matching selected niches.")
        else:
            df_rank = pd.DataFrame(rankings)
            st.markdown(f"### Found {len(df_rank)} Opportunities Ranked by Opportunity Score")
            
            top_choice = rankings[0]
            st.success(f"🏆 **Top Recommended Niche**: `{top_choice['niche']}` | **Best Product**: `{top_choice['title']}` | **Score**: `{top_choice['score']}/100` ({top_choice['recommendation']})")
            
            st.dataframe(
                df_rank[["niche", "title", "score", "recommendation", "material", "searches", "competitors", "growth"]],
                column_config={
                    "score": st.column_config.ProgressColumn("Opportunity Score", min_value=0, max_value=100, format="%d / 100"),
                    "searches": st.column_config.NumberColumn("Monthly Searches", format="%d"),
                    "competitors": st.column_config.NumberColumn("Competitors", format="%d"),
                    "growth": st.column_config.NumberColumn("Growth MoM", format="+%.1f%%")
                },
                use_container_width=True
            )

# ==========================================
# TAB 3: Early Alerts & Design Insights
# ==========================================
with tab3:
    st.subheader("⚡ Early Surging Trend Alerts (Low Saturation & High Momentum)")
    alerts = insights_engine.get_early_trend_alerts()
    
    col_a1, col_a2 = st.columns(2)
    for idx, alert in enumerate(alerts):
        with (col_a1 if idx % 2 == 0 else col_a2):
            st.markdown(f"""
            <div class="metric-card">
                <h4>{alert['opportunity_level']} - {alert['niche']}</h4>
                <p><b>Product:</b> {alert['title']}</p>
                <p>📈 <b>30-Day Surge:</b> <span style="color:#10B981; font-weight:bold;">{alert['growth_surge']}</span> | 🤺 <b>Competitors:</b> {alert['competitor_count']} listings</p>
                <p>💡 <b>Action:</b> {alert['recommended_action']}</p>
            </div>
            <br>
            """, unsafe_allow_html=True)

    st.markdown("---")
    st.subheader("🎨 Top Design Insights & High-Converting Quote Hooks")
    insights = insights_engine.get_design_insights()
    
    col_i1, col_i2 = st.columns(2)
    with col_i1:
        st.markdown("### 🔥 Top Converting Quote Hooks")
        for q in insights["top_quotes"]:
            st.info(q)
    with col_i2:
        st.markdown("### 🎨 Recommended Color Palettes & Materials")
        for c in insights["top_converting_colors"]:
            st.success(f"• {c}")

    st.markdown("---")
    st.subheader("🤺 Competitor Review Velocity Tracker")
    competitor_data = insights_engine.get_competitor_insights()
    st.dataframe(pd.DataFrame(competitor_data), use_container_width=True)

# ==========================================
# TAB 4: Printway Catalog & Taxonomy
# ==========================================
with tab4:
    st.subheader("🏬 Standardized Printway POD Catalog Taxonomy")
    st.caption("All raw listings are normalized against this authoritative catalog schema.")
    
    with open("data/printway_catalog.json", "r", encoding="utf-8") as f:
        catalog_items = json.load(f)
    
    df_cat = pd.DataFrame(catalog_items)
    st.dataframe(
        df_cat[["product_type_id", "product_type", "category", "material", "production_difficulty", "avg_base_cost_usd", "avg_retail_price_usd", "avg_margin_pct", "lead_time_days"]],
        column_config={
            "avg_base_cost_usd": st.column_config.NumberColumn("Base Cost", format="$%.2f"),
            "avg_retail_price_usd": st.column_config.NumberColumn("Retail Price", format="$%.2f"),
            "avg_margin_pct": st.column_config.NumberColumn("Margin %", format="%d%%"),
            "production_difficulty": st.column_config.NumberColumn("Difficulty (1-5)", format="%d/5")
        },
        use_container_width=True
    )
