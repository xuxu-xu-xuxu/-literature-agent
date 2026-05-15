import hashlib
import uuid
import os

_converter = None

def _get_converter():
    global _converter
    if _converter is None:
        from docling.document_converter import DocumentConverter
        _converter = DocumentConverter()
    return _converter

def compute_paper_id(file_path: str) -> str:
    sha = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(8192):
            sha.update(chunk)
    return sha.hexdigest()[:16]

def parse_pdf(file_path: str) -> dict:
    try:
        converter = _get_converter()
        result = converter.convert(file_path)
        markdown_text = result.document.export_to_markdown()
        tables = _extract_tables_from_doc(result)
    except Exception:
        markdown_text = _extract_text_pymupdf(file_path)
        tables = []
    metadata = _extract_metadata(file_path)
    sections = _split_by_sections(markdown_text)
    return {
        "paper_id": compute_paper_id(file_path),
        "metadata": metadata,
        "full_text": markdown_text,
        "sections": sections,
        "tables": tables,
    }

def _extract_text_pymupdf(file_path: str) -> str:
    import fitz
    doc = fitz.open(file_path)
    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()
    return text

def _extract_metadata(file_path: str) -> dict:
    import fitz
    doc = fitz.open(file_path)
    meta = doc.metadata
    first_page = doc[0].get_text()[:1000] if doc.page_count > 0 else ""
    doc.close()
    title = meta.get("title", "") or (first_page.split("\n")[0] if first_page else "")
    author = meta.get("author", "")
    return {"title": title.strip(), "authors": author.strip()}

def _split_by_sections(text: str) -> list[dict]:
    import re
    sections = []
    pattern = re.compile(r"^#{1,3}\s+(.+)$", re.MULTILINE)
    matches = list(pattern.finditer(text))
    for i, match in enumerate(matches):
        title = match.group(1).strip()
        start = match.end()
        end = matches[i+1].start() if i+1 < len(matches) else len(text)
        body = text[start:end].strip()
        if body:
            sections.append({"heading": title, "content": body})
    if not sections:
        sections.append({"heading": "", "content": text})
    return sections

def _extract_tables_from_doc(result) -> list[dict]:
    tables = []
    for table in result.document.tables:
        if hasattr(table, "export_to_dataframe"):
            df = table.export_to_dataframe()
            tables.append(df.to_dict(orient="records"))
    return tables

def save_upload(file_content: bytes, filename: str, upload_dir: str) -> str:
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, f"{uuid.uuid4().hex}_{filename}")
    with open(file_path, "wb") as f:
        f.write(file_content)
    return file_path
