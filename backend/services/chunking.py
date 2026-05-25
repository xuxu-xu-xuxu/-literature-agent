import re
from typing import List

def chunk_text(text: str, chunk_size: int = 512, overlap: int = 64) -> List[str]:
    sentences = _split_sentences(text)
    chunks = []
    current = ""
    for sent in sentences:
        if len(current) + len(sent) <= chunk_size:
            current += sent
        else:
            if current:
                chunks.append(current.strip())
            overlap_text = current[-overlap:] if len(current) > overlap else current
            current = overlap_text + sent
    if current.strip():
        chunks.append(current.strip())
    return chunks

def chunk_sections(sections: list[dict], chunk_size: int = 512, overlap: int = 64) -> list[dict]:
    result = []
    for sec in sections:
        sec_chunks = chunk_text(sec["content"], chunk_size, overlap)
        for i, c in enumerate(sec_chunks):
            result.append({
                "text": c,
                "heading": sec["heading"],
                "chunk_index": i,
                "token_count": max(1, len(c) // 4),
            })
    return result

def _split_sentences(text: str) -> List[str]:
    pattern = re.compile(r'(?<=[。！？.!?\n])\s+')
    parts = pattern.split(text)
    result = []
    for p in parts:
        if p.strip():
            result.append(p)
    if not result:
        result = [text]
    return result
