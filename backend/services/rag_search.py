from backend.services.embedding import embed_single
from backend.services.ingestion import init_milvus, init_es, COLLECTION_NAME
from collections import defaultdict

async def hybrid_search(query: str, top_k: int = 20) -> list[dict]:
    query_vec = await embed_single(query)

    col = init_milvus()
    col.load()
    search_params = {"metric_type": "COSINE", "params": {"nprobe": 16}}
    milvus_results = col.search(
        data=[query_vec], anns_field="embedding", param=search_params,
        limit=top_k, output_fields=["paper_id", "text", "heading", "chunk_index"]
    )

    es = init_es()
    es_results = es.search(index="papers", body={
        "query": {"match": {"full_text": {"query": query, "operator": "or"}}},
        "size": top_k,
        "_source": ["paper_id", "title", "abstract"],
    })

    rrf_scores = defaultdict(float)
    docs = {}
    k = 60
    for rank, hits in enumerate(milvus_results[0]):
        doc_id = f"{hits.entity.get('paper_id')}_{hits.entity.get('chunk_index')}"
        rrf_scores[doc_id] += 1 / (k + rank + 1)
        docs[doc_id] = {
            "paper_id": hits.entity.get("paper_id"),
            "text": hits.entity.get("text"),
            "heading": hits.entity.get("heading"),
            "source": "milvus",
        }
    for rank, hit in enumerate(es_results["hits"]["hits"]):
        doc_id = hit["_source"]["paper_id"] + "_es"
        rrf_scores[doc_id] += 1 / (k + rank + 1)
        docs[doc_id] = {
            "paper_id": hit["_source"]["paper_id"],
            "text": hit["_source"].get("abstract", ""),
            "title": hit["_source"].get("title"),
            "source": "es",
        }

    ranked = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)
    return [docs[doc_id] for doc_id, _ in ranked[:top_k]]
