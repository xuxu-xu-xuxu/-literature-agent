from collections import defaultdict

def test_rrf_same_doc_gets_higher_score():
    rrf = defaultdict(float)
    k = 60
    for rank in range(10):
        rrf["doc1"] += 1 / (k + rank + 1)
    for rank in range(10):
        rrf["doc1"] += 1 / (k + rank + 1)
    for rank in range(10):
        rrf["doc2"] += 1 / (k + rank + 1)
    ranked = sorted(rrf.items(), key=lambda x: x[1], reverse=True)
    assert ranked[0][0] == "doc1"
    assert ranked[1][0] == "doc2"
