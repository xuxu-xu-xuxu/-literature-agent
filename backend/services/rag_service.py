from backend.llm import get_llm_client

QUERY_REWRITE_PROMPT = """你是一个材料科学文献检索专家。将用户的问题改写为更适合检索的查询。
- 将口语化表达转换为学术术语
- 中文和英文术语都保留（中英双语查询）
- 如果问题涉及缩写，同时保留全称和缩写
- 只输出改写后的查询，不要解释

用户问题: {query}
改写查询:"""

RAG_SYSTEM_PROMPT = """你是一个材料科学文献助手。请根据提供的文献片段回答用户的问题。
必须遵守以下规则：
1. 每个事实性陈述后标注来源：[作者, 年份, §章节]
2. 如果文献片段中找不到相关信息，明确说"当前文献库中未找到相关信息"
3. 禁止编造任何文献中不存在的数据或结论
4. 回答结尾列出引用的文献列表"""


async def rewrite_query(query: str) -> str:
    llm = get_llm_client()
    prompt = QUERY_REWRITE_PROMPT.format(query=query)
    return await llm.chat([{"role": "user", "content": prompt}])


async def generate_answer_stream(query: str, conversation_history: list[dict] = None):
    from backend.services.rag_search import hybrid_search

    rewritten = await rewrite_query(query)
    docs = await hybrid_search(rewritten, top_k=20)

    context_parts = []
    for i, doc in enumerate(docs):
        ref = f"[{i+1}]"
        paper_info = f"来源{ref}: {doc.get('title', '')} - {doc.get('heading', '')}"
        context_parts.append(f"{paper_info}\n{doc['text']}")

    context = "\n\n---\n\n".join(context_parts[:5])

    messages = [{"role": "system", "content": RAG_SYSTEM_PROMPT}]
    if conversation_history:
        messages.extend(conversation_history[-6:])
    messages.append({"role": "user", "content": f"文献片段:\n{context}\n\n问题: {query}"})

    llm = get_llm_client()
    async for chunk in llm.chat_stream(messages):
        yield chunk

    yield "\n\n---\n**参考文献:**\n"
    for i, doc in enumerate(docs[:5]):
        title = doc.get("title", "Unknown")
        heading = doc.get("heading", "")
        paper_id = doc.get("paper_id", "")
        yield f"\n[{i+1}] {title} - {heading} (ID: {paper_id})"
