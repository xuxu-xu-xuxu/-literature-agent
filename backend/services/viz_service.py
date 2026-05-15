from backend.llm import get_llm_client
from backend.models.database import get_db, Entity
from sqlalchemy import text
import json

VIZ_PROMPT = """你是数据可视化专家。用户想要一个图表。根据用户需求，生成：
1. 合适的SQL查询（查询entities表，字段: paper_id, entity_type, attributes(JSONB), source_span）
2. 合适的图表类型
3. ECharts配置

用户需求: {query}

已知实体类型: {available_types}

entities表结构: paper_id TEXT, entity_type TEXT, attributes JSONB, source_span TEXT

SQL注意事项（非常重要）:
- attributes列是JSONB类型，检查键是否存在使用 attributes::jsonb->>'key' IS NOT NULL，绝对不要使用 ? 操作符
- 数值比较需要类型转换: (attributes->>'numeric_field')::numeric
- 字符串比较直接: attributes->>'text_field' = 'value'

输出JSON（不要其他内容）:
{{
  "sql": "SELECT ... FROM entities WHERE ...",
  "chart_type": "bar|scatter|line|boxplot|heatmap",
  "title": "图表标题",
  "echarts_option": {{完整ECharts配置}},
  "explanation": "图表说明"
}}
"""


async def generate_chart(query: str) -> dict:
    async for db in get_db():
        types_result = await db.execute(text("SELECT DISTINCT entity_type FROM entities LIMIT 50"))
        available_types = [row[0] for row in types_result.fetchall()]
        break

    llm = get_llm_client()
    prompt = VIZ_PROMPT.format(
        query=query,
        available_types=json.dumps(available_types, ensure_ascii=False)
    )
    response = await llm.chat([{"role": "user", "content": prompt}])
    response = response.strip()
    if response.startswith("```json"):
        response = response[7:]
    if response.endswith("```"):
        response = response[:-3]
    plan = json.loads(response)

    async for db in get_db():
        result = await db.execute(text(plan["sql"]))
        columns = result.keys()
        rows = [dict(zip(columns, row)) for row in result.fetchall()]
        break

    return {
        "chart_type": plan["chart_type"],
        "title": plan["title"],
        "data": rows,
        "echarts_option": plan["echarts_option"],
        "explanation": plan.get("explanation", ""),
    }
