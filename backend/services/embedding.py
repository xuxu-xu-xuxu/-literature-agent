import httpx
from backend.config import get_settings

BATCH_SIZE = 20

async def embed_sentences(sentences: list[str], return_sparse: bool = False) -> dict:
    settings = get_settings()
    all_dense = []
    all_sparse = []

    async with httpx.AsyncClient(timeout=120) as client:
        for i in range(0, len(sentences), BATCH_SIZE):
            batch = sentences[i : i + BATCH_SIZE]
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
