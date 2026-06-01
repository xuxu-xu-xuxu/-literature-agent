import re
from collections.abc import Iterable

from sqlalchemy import delete, select

from backend.models.database import Entity, Paper, PaperDomainAssignment, get_db
from backend.services.ingestion import init_es
from backend.services.solid_electrolyte_properties.extractor import (
    ABBR_FORMULAS,
    FORMULA_OR_ABBR_PATTERN,
    _is_plausible_material,
    _normalized_formula,
)

ENTITY_SOURCE = "entity_mining"

MATERIAL_FAMILIES = {
    "argyrodite": ["argyrodite", "argyrodites"],
    "garnet": ["garnet", "garnets"],
    "NASICON": ["NASICON", "nasicon"],
    "sulfide electrolyte": ["sulfide electrolyte", "sulfide solid electrolyte"],
    "oxide electrolyte": ["oxide electrolyte", "oxide solid electrolyte"],
    "halide electrolyte": ["halide electrolyte", "halide solid electrolyte"],
    "polymer electrolyte": ["polymer electrolyte", "polymeric electrolyte"],
    "gel polymer electrolyte": ["gel polymer electrolyte", "GPE"],
}

PROPERTIES = {
    "ionic conductivity": ["ionic conductivity", "Li-ion conductivity", "conductivity"],
    "electrochemical window": ["electrochemical window", "stability window"],
    "activation energy": ["activation energy"],
    "Li transference number": ["Li transference number", "lithium transference number", "tLi+"],
    "critical current density": ["critical current density", "CCD"],
    "interfacial resistance": ["interfacial resistance", "interface resistance"],
}

METHODS = {
    "EIS": ["EIS", "electrochemical impedance spectroscopy", "impedance spectroscopy"],
    "LSV": ["LSV", "linear sweep voltammetry"],
    "CV": ["CV", "cyclic voltammetry"],
    "XRD": ["XRD", "X-ray diffraction", "x ray diffraction"],
    "SEM": ["SEM", "scanning electron microscopy"],
    "TEM": ["TEM", "transmission electron microscopy"],
    "DFT": ["DFT", "density functional theory"],
    "AIMD": ["AIMD", "ab initio molecular dynamics"],
    "MD": ["molecular dynamics"],
}


def _clean_material_token(token: str) -> str:
    cleaned = (token or "").strip().strip(".,;:)]}")
    if re.search(r"-?contained$", cleaned, flags=re.IGNORECASE):
        return ""
    cleaned = re.sub(r"-?(?:based|doped|modified|coated)$", "", cleaned, flags=re.IGNORECASE)
    return cleaned.strip().strip(".,;:)]}")


def _is_entity_material(material: str) -> bool:
    if material in ABBR_FORMULAS:
        return True
    if material.count("(") != material.count(")") or material.count("[") != material.count("]"):
        return False
    if re.search(r"[a-z]{2,}", material):
        return False
    if not re.search(r"\b(?:Li|Na|Ag)", material):
        return False
    return _is_plausible_material(material)


def _snippet(text: str, position: int, width: int = 220) -> str:
    start = max(0, position - width // 2)
    end = min(len(text), position + width // 2)
    return re.sub(r"\s+", " ", text[start:end]).strip()[:256]


def _phrase_pattern(variant: str) -> re.Pattern:
    escaped = re.escape(variant).replace(r"\ ", r"\s+")
    if re.fullmatch(r"[A-Za-z0-9+.-]+", variant):
        return re.compile(rf"\b{escaped}\b", re.IGNORECASE)
    return re.compile(escaped, re.IGNORECASE)


def _record(
    paper_id: str,
    label: str,
    kind: str,
    text: str,
    position: int,
    heading: str,
    chunk_index: int,
    extra: dict | None = None,
) -> dict:
    attributes = {
        "kind": kind,
        "source": ENTITY_SOURCE,
        "source_chunk_id": f"{paper_id}_{chunk_index}",
        "heading": heading or "",
    }
    if extra:
        attributes.update(extra)
    return {
        "paper_id": paper_id,
        "entity_type": label,
        "attributes": attributes,
        "source_span": _snippet(text, position),
    }


def _extract_phrase_entities(
    paper_id: str,
    text: str,
    heading: str,
    chunk_index: int,
    kind: str,
    vocabulary: dict[str, list[str]],
) -> list[dict]:
    records = []
    for label, variants in vocabulary.items():
        for variant in variants:
            match = _phrase_pattern(variant).search(text)
            if not match:
                continue
            records.append(_record(paper_id, label, kind, text, match.start(), heading, chunk_index))
            break
    return records


def extract_chunk_entities(
    paper_id: str,
    text: str,
    heading: str = "",
    chunk_index: int = 0,
) -> list[dict]:
    records = []
    text = text or ""

    for match in FORMULA_OR_ABBR_PATTERN.finditer(text):
        material = _clean_material_token(match.group(1))
        if not _is_entity_material(material):
            continue
        records.append(_record(
            paper_id,
            material,
            "material",
            text,
            match.start(),
            heading,
            chunk_index,
            {
                "normalized_formula": _normalized_formula(material),
                "is_abbreviation": material in ABBR_FORMULAS,
            },
        ))

    records.extend(_extract_phrase_entities(paper_id, text, heading, chunk_index, "material_family", MATERIAL_FAMILIES))
    records.extend(_extract_phrase_entities(paper_id, text, heading, chunk_index, "property", PROPERTIES))
    records.extend(_extract_phrase_entities(paper_id, text, heading, chunk_index, "method", METHODS))

    return unique_entity_records(records)


def unique_entity_records(records: Iterable[dict]) -> list[dict]:
    deduped = {}
    for record in records:
        kind = (record.get("attributes") or {}).get("kind", "")
        key = (record.get("paper_id"), record.get("entity_type"), kind)
        if key not in deduped:
            deduped[key] = record
    return list(deduped.values())


async def _paper_ids(domain_id: str | None = None, limit: int | None = None) -> list[str]:
    async for db in get_db():
        query = select(Paper.id).where(Paper.status == "ingested").order_by(Paper.created_at.desc())
        if domain_id:
            query = (
                query
                .join(PaperDomainAssignment, PaperDomainAssignment.paper_id == Paper.id)
                .where(PaperDomainAssignment.domain_id == domain_id)
            )
        if limit:
            query = query.limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all())
    return []


def _fetch_chunks(paper_ids: list[str], chunk_limit: int) -> list[dict]:
    if not paper_ids:
        return []
    es = init_es()
    response = es.search(
        index="paper_chunks",
        body={
            "query": {"terms": {"paper_id": paper_ids}},
            "size": chunk_limit,
            "_source": ["paper_id", "chunk_index", "heading", "text"],
            "sort": [{"paper_id": "asc"}, {"chunk_index": "asc"}],
        },
    )
    return [
        {
            "paper_id": hit["_source"]["paper_id"],
            "chunk_index": hit["_source"].get("chunk_index", 0),
            "heading": hit["_source"].get("heading", ""),
            "text": hit["_source"].get("text", ""),
        }
        for hit in response["hits"]["hits"]
    ]


async def mine_entities(
    domain_id: str | None = None,
    replace: bool = True,
    paper_limit: int | None = None,
    chunk_limit: int = 10000,
) -> dict:
    paper_ids = await _paper_ids(domain_id=domain_id, limit=paper_limit)
    chunks = _fetch_chunks(paper_ids, chunk_limit)
    records = []
    for chunk in chunks:
        records.extend(extract_chunk_entities(
            paper_id=chunk["paper_id"],
            text=chunk["text"],
            heading=chunk.get("heading", ""),
            chunk_index=chunk.get("chunk_index", 0),
        ))
    records = unique_entity_records(records)

    async for db in get_db():
        if replace and paper_ids:
            await db.execute(
                delete(Entity)
                .where(Entity.paper_id.in_(paper_ids))
                .where(Entity.attributes["source"].as_string() == ENTITY_SOURCE)
            )
        for record in records:
            db.add(Entity(**record))
        await db.commit()
        break

    return {
        "paper_count": len(paper_ids),
        "chunk_count": len(chunks),
        "entity_count": len(records),
        "source": ENTITY_SOURCE,
    }
