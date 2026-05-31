"""Paper classification service: LLM auto-tagging + vector clustering."""
import asyncio
import json
import logging
import re

from sqlalchemy import func, select, delete as sa_delete

from backend.llm import get_llm_client
from backend.models.database import get_db, Paper, PaperTag

logger = logging.getLogger(__name__)

# ── Tag vocabulary ───────────────────────────────────────────────────
TAG_VOCABULARY = {
    "研究领域": ["CO2还原", "固态电解质", "电催化", "电池材料", "表征技术", "计算模拟", "合成制备", "机理研究"],
    "材料类型": ["氧化物", "硫化物", "聚合物", "金属合金", "碳材料", "MOF/COF", "二维材料", "钙钛矿"],
    "方法类型": ["实验研究", "DFT计算", "AIMD模拟", "机器学习", "原位表征", "理论分析"],
}

ALL_TAGS = [t for group in TAG_VOCABULARY.values() for t in group]

CLASSIFY_PROMPT = """你是一个材料科学文献分类专家。请根据以下论文内容，从预设标签列表中选择最匹配的 2-5 个标签。

标签列表（只能从以下标签中选择，不要自创标签）：
{tag_list}

论文标题：{title}
论文摘要：{abstract}

输出严格的 JSON 数组格式（只输出 JSON，不要其他文字）：
["标签1", "标签2", "标签3"]

如果论文内容不足以判断，选择最接近的标签。"""

CLUSTER_NAME_PROMPT = """以下是同一聚类中的论文标题列表。请根据这些标题为该聚类生成一个简洁的中文名称（不超过10个字），描述该组论文的共同研究主题。

只返回名称本身，不要加任何解释。

论文标题：
{titles}"""


# ── JSON parsing helpers (reuse pattern from extract_service.py) ─────
def _clean_json_response(response: str) -> str:
    """Extract JSON from LLM response that may contain extra text."""
    response = response.strip()
    # Try to find JSON array or object boundaries
    for start_char, end_char in [("[", "]"), ("{", "}")]:
        start = response.find(start_char)
        end = response.rfind(end_char)
        if start != -1 and end != -1 and end > start:
            return response[start : end + 1]
    return response


def _parse_tag_response(response: str) -> list[str]:
    """Parse LLM tag response, filtering to known vocabulary."""
    cleaned = _clean_json_response(response)
    try:
        tags = json.loads(cleaned)
        if isinstance(tags, list):
            return [t for t in tags if isinstance(t, str) and t in ALL_TAGS]
    except json.JSONDecodeError:
        # Try to extract quoted strings as fallback
        matches = re.findall(r'"([^"]+)"', cleaned)
        tags = [m for m in matches if m in ALL_TAGS]
        if tags:
            return tags
    return []


# ── LLM Classification (Plan C) ──────────────────────────────────────
async def classify_single_paper(paper_id: str) -> list[str]:
    """Classify a single paper using LLM, store tags in DB. Idempotent."""
    # Fetch paper
    async for db in get_db():
        paper = await db.get(Paper, paper_id)
        break
    if not paper:
        logger.warning("Paper %s not found, skipping classification", paper_id)
        return []

    # Build content for classification
    text_parts = []
    if paper.abstract:
        text_parts.append(paper.abstract)
    if paper.full_text:
        text_parts.append(paper.full_text[:4000])
    abstract = "\n".join(text_parts)[:8000] or paper.title or ""

    # Call LLM
    prompt = CLASSIFY_PROMPT.format(
        tag_list=", ".join(ALL_TAGS),
        title=paper.title or "",
        abstract=abstract,
    )
    try:
        llm = get_llm_client()
        response = await llm.chat([{"role": "user", "content": prompt}])
        tags = _parse_tag_response(response)
    except Exception as e:
        logger.error("LLM classification failed for paper %s: %s", paper_id, e)
        return []

    if not tags:
        logger.info("No valid tags returned for paper %s", paper_id)
        return []

    # Store tags (upsert-like: skip duplicates)
    stored = 0
    async for db in get_db():
        for tag_name in tags:
            try:
                db.add(PaperTag(paper_id=paper_id, tag=tag_name, source="llm"))
                await db.commit()
                stored += 1
            except Exception:
                await db.rollback()
        break

    logger.info("Classified paper %s with tags: %s (%d stored)", paper_id, tags, stored)
    return tags


async def classify_all_papers() -> dict:
    """Batch-classify all papers that don't yet have LLM tags."""
    # Find papers without LLM tags
    async for db in get_db():
        sub = select(PaperTag.paper_id).where(PaperTag.source == "llm")
        result = await db.execute(
            select(Paper.id, Paper.title)
            .where(Paper.status == "ingested")
            .where(Paper.id.not_in(sub))
        )
        papers = [{"id": r[0], "title": r[1]} for r in result.fetchall()]
        break

    if not papers:
        return {"total": 0, "classified": 0, "skipped": 0}

    total = len(papers)
    classified = 0
    errors = []

    for i, p in enumerate(papers):
        try:
            tags = await classify_single_paper(p["id"])
            if tags:
                classified += 1
            logger.info("[%d/%d] Classified: %s", i + 1, total, p["title"][:60])
        except Exception as e:
            errors.append({"paper_id": p["id"], "title": p["title"], "error": str(e)})
            logger.error("[%d/%d] Failed: %s — %s", i + 1, total, p["title"][:60], e)
        await asyncio.sleep(0.5)  # Rate limiting

    return {"total": total, "classified": classified, "errors": errors}


# ── Vector Clustering (Plan A) ───────────────────────────────────────
async def cluster_papers(n_clusters: int = 8) -> dict:
    """Cluster papers by abstract embeddings, name clusters with LLM."""
    from backend.services.embedding import embed_single

    # Fetch papers with abstracts
    async for db in get_db():
        result = await db.execute(
            select(Paper.id, Paper.title, Paper.abstract)
            .where(Paper.status == "ingested")
            .where(Paper.abstract.isnot(None))
            .where(Paper.abstract != "")
        )
        rows = result.fetchall()
        break

    papers = [{"id": r[0], "title": r[1], "abstract": r[2]} for r in rows]
    if len(papers) < 2:
        return {"clusters": [], "error": "Not enough papers with abstracts"}

    # Embed all abstracts
    logger.info("Embedding %d paper abstracts for clustering...", len(papers))
    vectors = []
    valid_papers = []
    for p in papers:
        try:
            vec = await embed_single(p["abstract"])
            vectors.append(vec)
            valid_papers.append(p)
        except Exception as e:
            logger.warning("Embedding failed for %s: %s", p["id"], e)

    if len(valid_papers) < 2:
        return {"clusters": [], "error": "Not enough successful embeddings"}

    # K-means clustering
    from sklearn.cluster import KMeans
    import numpy as np

    X = np.array(vectors)
    actual_k = min(n_clusters, len(valid_papers))
    kmeans = KMeans(n_clusters=actual_k, random_state=42, n_init=10)
    labels = kmeans.fit_predict(X)

    # Group papers by cluster
    clusters = {}
    for i, label in enumerate(labels):
        label = int(label)
        if label not in clusters:
            clusters[label] = []
        clusters[label].append(valid_papers[i])

    # Name each cluster with LLM
    cluster_results = []
    llm = get_llm_client()
    for label, cluster_papers_list in clusters.items():
        sample_titles = [p["title"] for p in cluster_papers_list[:10]]
        prompt = CLUSTER_NAME_PROMPT.format(titles="\n".join(f"- {t}" for t in sample_titles))
        try:
            name = (await llm.chat([{"role": "user", "content": prompt}])).strip()
            # Clean up: remove quotes, newlines
            name = name.replace('"', "").replace("'", "").replace("\n", "").strip()
        except Exception:
            name = f"聚类 {label + 1}"

        cluster_results.append({
            "name": name,
            "count": len(cluster_papers_list),
            "paper_ids": [p["id"] for p in cluster_papers_list],
        })

    # Store cluster tags (delete old cluster tags first, then insert new)
    async for db in get_db():
        await db.execute(sa_delete(PaperTag).where(PaperTag.source == "cluster"))
        await db.commit()
        break

    for cr in cluster_results:
        tag_name = f"[聚类] {cr['name']}"
        async for db in get_db():
            for pid in cr["paper_ids"]:
                db.add(PaperTag(paper_id=pid, tag=tag_name, source="cluster"))
            await db.commit()
            break

    logger.info("Clustering complete: %d clusters", len(cluster_results))
    return {"clusters": cluster_results}


# ── Category Aggregation ─────────────────────────────────────────────
async def get_categories() -> list[dict]:
    """Return all categories with paper counts and sample papers."""
    async for db in get_db():
        result = await db.execute(
            select(PaperTag.tag, func.count(PaperTag.paper_id).label("cnt"))
            .group_by(PaperTag.tag)
            .order_by(func.count(PaperTag.paper_id).desc())
        )
        tag_counts = {r[0]: r[1] for r in result.fetchall()}
        break

    categories = []
    for group_name, group_tags in TAG_VOCABULARY.items():
        for tag_name in group_tags:
            cnt = tag_counts.get(tag_name, 0)
            if cnt > 0:
                categories.append({
                    "tag": tag_name,
                    "count": cnt,
                    "category": group_name,
                })

    # Also include cluster tags
    for tag_name, cnt in tag_counts.items():
        if tag_name.startswith("[聚类]"):
            categories.append({
                "tag": tag_name,
                "count": cnt,
                "category": "聚类结果",
            })

    return categories
