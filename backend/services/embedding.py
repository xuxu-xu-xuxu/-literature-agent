import httpx
from backend.config import get_settings

async def embed_sentences(sentences: list[str], return_sparse: bool = False) -> dict:
    settings = get_settings()
    batch_size = settings.embedding_batch_size
    all_dense = []
    all_sparse = []

    async with httpx.AsyncClient(timeout=120) as client:
        for i in range(0, len(sentences), batch_size):
            batch = sentences[i : i + batch_size]
            resp = await client.post(
                f"{settings.bge_embed_url}",
                json={"sentences": batch, "return_sparse": return_sparse}
            )
            resp.raise_for_status()
            result = resp.json()
            all_dense.extend(result["dense_embeddings"])
            if return_sparse:
                all_sparse.extend(result.get("sparse_embeddings", []))

    return {"dense_embeddings": all_dense, "sparse_embeddings": all_sparse}

async def embed_single(text: str) -> list[float]:
    result = await embed_sentences([text])
    return result["dense_embeddings"][0]

async def rerank(query: str, documents: list[str], top_k: int = 10) -> list[dict]:
    settings = get_settings()
    url = settings.bge_embed_url.replace("/embed", "/rerank")
    docs = [d[:1024] for d in documents]
    ranked = []
    async with httpx.AsyncClient(timeout=120) as client:
        for i in range(0, len(docs), 15):
            batch = docs[i : i + 15]
            resp = await client.post(url, json={"query": query, "documents": batch})
            resp.raise_for_status()
            result = resp.json()
            for item in result["ranked"]:
                item["index"] += i
                ranked.append(item)
    ranked.sort(key=lambda x: x["score"], reverse=True)
    return ranked[:top_k]
