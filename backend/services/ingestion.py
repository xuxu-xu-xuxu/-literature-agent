from pymilvus import connections, Collection, FieldSchema, CollectionSchema, DataType, utility
from elasticsearch import Elasticsearch
from backend.config import get_settings
from backend.services.embedding import embed_sentences
from backend.services.chunking import chunk_sections
from backend.services.pdf_service import parse_pdf

COLLECTION_NAME = "literature_chunks"
DIM = 1024


def init_milvus():
    settings = get_settings()
    connections.connect(alias="default", host=settings.milvus_host, port=settings.milvus_port)
    if utility.has_collection(COLLECTION_NAME):
        return Collection(COLLECTION_NAME)
    fields = [
        FieldSchema(name="id", dtype=DataType.VARCHAR, is_primary=True, max_length=64),
        FieldSchema(name="paper_id", dtype=DataType.VARCHAR, max_length=64),
        FieldSchema(name="chunk_index", dtype=DataType.INT64),
        FieldSchema(name="text", dtype=DataType.VARCHAR, max_length=4096),
        FieldSchema(name="heading", dtype=DataType.VARCHAR, max_length=512),
        FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=DIM),
    ]
    schema = CollectionSchema(fields, description="Literature chunks")
    collection = Collection(COLLECTION_NAME, schema)
    index_params = {"metric_type": "COSINE", "index_type": "IVF_FLAT", "params": {"nlist": 128}}
    collection.create_index("embedding", index_params)
    collection.load()
    return collection


def init_es() -> Elasticsearch:
    settings = get_settings()
    es = Elasticsearch(
        settings.es_host,
        basic_auth=(settings.es_user, settings.es_password),
        verify_certs=False,
    )
    if not es.indices.exists(index="papers"):
        es.indices.create(index="papers", body={
            "mappings": {
                "properties": {
                    "paper_id": {"type": "keyword"},
                    "title": {"type": "text", "analyzer": "standard"},
                    "abstract": {"type": "text", "analyzer": "standard"},
                    "full_text": {"type": "text", "analyzer": "standard"},
                    "authors": {"type": "text"},
                    "year": {"type": "integer"},
                    "journal": {"type": "text"},
                }
            }
        })
    return es


async def ingest_pdf(file_path: str) -> dict:
    parsed = parse_pdf(file_path)
    paper_id = parsed["paper_id"]
    meta = parsed["metadata"]
    sections = parsed["sections"]

    chunks = chunk_sections(sections)
    texts = [c["text"] for c in chunks]
    emb_result = await embed_sentences(texts)

    collection = init_milvus()
    entities = []
    for i, (chunk, emb) in enumerate(zip(chunks, emb_result["dense_embeddings"])):
        entities.append({
            "id": f"{paper_id}_{i}",
            "paper_id": paper_id,
            "chunk_index": i,
            "text": chunk["text"],
            "heading": chunk["heading"],
            "embedding": emb,
        })
    collection.insert(entities)
    collection.flush()

    es = init_es()
    es.index(index="papers", id=paper_id, document={
        "paper_id": paper_id,
        "title": meta["title"],
        "authors": meta.get("authors", ""),
        "abstract": parsed["full_text"][:1000],
        "full_text": parsed["full_text"],
        "year": None,
        "journal": "",
    })

    return {
        "paper_id": paper_id,
        "title": meta["title"],
        "chunk_count": len(chunks),
        "full_text": parsed["full_text"],
        "tables": parsed.get("tables", []),
    }
