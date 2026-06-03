from backend.routes.knowledge_graph import (
    _is_graph_entity_noise,
    _paper_label,
    _select_entity_rows,
)


def test_paper_label_keeps_short_titles():
    assert _paper_label("short title") == "short title"


def test_paper_label_truncates_long_titles():
    title = "a" * 80

    assert _paper_label(title).endswith("...")
    assert len(_paper_label(title)) == 72


def test_filters_generic_entity_types_from_graph():
    assert _is_graph_entity_noise("Author")
    assert _is_graph_entity_noise("Material")
    assert _is_graph_entity_noise("Element")
    assert _is_graph_entity_noise("参考文献")
    assert _is_graph_entity_noise("关键词")
    assert _is_graph_entity_noise("人物")
    assert _is_graph_entity_noise("Table")
    assert not _is_graph_entity_noise("solid electrolyte")
    assert not _is_graph_entity_noise("LLZO")


def test_select_entity_rows_limits_edges_per_paper_and_keeps_shared_entities():
    rows = [
        ("paper-a", "Author", 20),
        ("paper-a", "LLZO", 9),
        ("paper-a", "conductivity", 6),
        ("paper-a", "separator", 3),
        ("paper-b", "LLZO", 7),
        ("paper-b", "cathode", 4),
        ("paper-b", "Table", 3),
    ]

    selected = _select_entity_rows(rows, per_paper_limit=2, max_entities=3)

    assert selected == [
        ("paper-a", "LLZO", 9),
        ("paper-a", "conductivity", 6),
        ("paper-b", "LLZO", 7),
        ("paper-b", "cathode", 4),
    ]
