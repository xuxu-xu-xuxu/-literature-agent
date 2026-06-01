from fastapi import APIRouter, Query
from sqlalchemy import func, select

from backend.models.database import Entity, LibraryDomain, Paper, PaperDomainAssignment, get_db

router = APIRouter(prefix="/api", tags=["knowledge-graph"])

NOISE_ENTITY_TYPES = {
    "author",
    "authors",
    "person",
    "figure",
    "fig",
    "table",
    "reference",
    "references",
    "bibliography",
    "element",
    "elements",
    "entity",
    "keyword",
    "keywords",
    "material",
    "materials",
    "method",
    "methods",
    "organization",
    "process",
    "property",
    "properties",
    "topic",
    "institution",
    "journal",
    "section",
    "作者",
    "主题",
    "参考文献",
    "文献",
    "图",
    "表",
    "机构",
    "关键词",
    "材料",
    "方法",
    "过程",
    "人物",
    "属性",
    "单位",
    "元素",
    "期刊",
}


def _paper_label(title: str) -> str:
    if len(title) <= 72:
        return title
    return f"{title[:69]}..."


def _is_graph_entity_noise(entity_type: str | None) -> bool:
    if not entity_type:
        return True
    normalized = entity_type.strip().lower()
    return not normalized or normalized in NOISE_ENTITY_TYPES


def _select_entity_rows(
    rows: list[tuple[str, str, int]],
    per_paper_limit: int = 2,
    max_entities: int = 48,
) -> list[tuple[str, str, int]]:
    filtered = [
        (paper_id, entity_type, int(count))
        for paper_id, entity_type, count in rows
        if not _is_graph_entity_noise(entity_type)
    ]
    entity_totals: dict[str, int] = {}
    for _paper_id, entity_type, count in filtered:
        entity_totals[entity_type] = entity_totals.get(entity_type, 0) + count

    allowed_entities = {
        entity_type
        for entity_type, _total in sorted(
            entity_totals.items(),
            key=lambda item: (-item[1], item[0].lower()),
        )[:max_entities]
    }

    selected: list[tuple[str, str, int]] = []
    per_paper_counts: dict[str, int] = {}
    for paper_id, entity_type, count in filtered:
        if entity_type not in allowed_entities:
            continue
        if per_paper_counts.get(paper_id, 0) >= per_paper_limit:
            continue
        selected.append((paper_id, entity_type, count))
        per_paper_counts[paper_id] = per_paper_counts.get(paper_id, 0) + 1
    return selected


@router.get("/knowledge-graph")
async def get_knowledge_graph(
    domain_id: str | None = Query(default=None),
    limit: int = Query(default=90, ge=20, le=180),
):
    nodes: dict[str, dict] = {}
    edges: list[dict] = []

    async for db in get_db():
        domain_query = select(LibraryDomain).order_by(LibraryDomain.sort_order)
        if domain_id:
            domain_query = domain_query.where(LibraryDomain.id == domain_id)
        domain_result = await db.execute(domain_query)
        domains = domain_result.scalars().all()

        for domain in domains:
            nodes[f"domain:{domain.id}"] = {
                "id": f"domain:{domain.id}",
                "label": domain.name,
                "type": "domain",
                "domain_id": domain.id,
                "size": 20,
                "meta": {"description": domain.description},
            }

        paper_query = (
            select(Paper, PaperDomainAssignment.domain_id)
            .join(PaperDomainAssignment, PaperDomainAssignment.paper_id == Paper.id, isouter=True)
            .where(Paper.status == "ingested")
            .order_by(Paper.created_at.desc())
            .limit(limit)
        )
        if domain_id:
            paper_query = paper_query.where(PaperDomainAssignment.domain_id == domain_id)

        paper_result = await db.execute(paper_query)
        papers = paper_result.all()
        paper_ids = [paper.id for paper, _domain_id in papers]

        for paper, paper_domain_id in papers:
            paper_node_id = f"paper:{paper.id}"
            nodes[paper_node_id] = {
                "id": paper_node_id,
                "label": _paper_label(paper.title),
                "type": "paper",
                "paper_id": paper.id,
                "domain_id": paper_domain_id,
                "size": 9,
                "meta": {
                    "authors": paper.authors,
                    "year": paper.year,
                    "journal": paper.journal,
                    "status": paper.status,
                },
            }
            if paper_domain_id:
                edges.append({
                    "id": f"domain:{paper_domain_id}->paper:{paper.id}",
                    "source": f"domain:{paper_domain_id}",
                    "target": paper_node_id,
                    "type": "domain_paper",
                    "weight": 1.8,
                })

        if paper_ids:
            entity_result = await db.execute(
                select(Entity.paper_id, Entity.entity_type, func.count().label("count"))
                .where(Entity.paper_id.in_(paper_ids))
                .group_by(Entity.paper_id, Entity.entity_type)
                .order_by(func.count().desc())
                .limit(limit * 3)
            )
            entity_rows = entity_result.all()
            selected_entity_rows = _select_entity_rows(
                [(paper_id, entity_type, count) for paper_id, entity_type, count in entity_rows],
                per_paper_limit=1,
                max_entities=min(36, max(12, limit // 3)),
            )
            entity_counts: dict[str, int] = {}

            for paper_id, entity_type, count in selected_entity_rows:
                entity_node_id = f"entity:{entity_type}"
                entity_counts[entity_node_id] = entity_counts.get(entity_node_id, 0) + int(count)
                nodes.setdefault(entity_node_id, {
                    "id": entity_node_id,
                    "label": entity_type,
                    "type": "entity",
                    "size": 7,
                    "meta": {"count": 0},
                })
                nodes[entity_node_id]["meta"]["count"] = entity_counts[entity_node_id]
                nodes[entity_node_id]["size"] = min(18, 7 + entity_counts[entity_node_id] ** 0.5)
                edges.append({
                    "id": f"paper:{paper_id}->entity:{entity_type}",
                    "source": f"paper:{paper_id}",
                    "target": entity_node_id,
                    "type": "paper_entity",
                    "weight": min(3.5, 0.8 + int(count) ** 0.5),
                })
        break

    return {"nodes": list(nodes.values()), "edges": edges}
