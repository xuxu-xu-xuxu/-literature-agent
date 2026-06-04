# Memory Usage Log

## Baseline before single-literature import

- Timestamp: 2026-06-03T10:36:53.5131651+08:00
- Host physical memory total: 31.89 GiB
- Host physical memory used: 18.28 GiB
- Host physical memory free: 13.61 GiB
- Host physical memory used percent: 57.32%
- Docker container memory total: ~2.83 GiB

| Container | Memory | Memory % | CPU % | Status |
| --- | ---: | ---: | ---: | --- |
| literature-agent-frontend-1 | 68.37 MiB | 0.43% | 0.00% | running |
| literature-agent-backend-1 | 155.3 MiB | 0.97% | 5.54% | running, healthy |
| literature-agent-milvus-1 | 231.7 MiB | 1.45% | 3.22% | running |
| literature-agent-bge-m3-1 | 709.9 MiB | 4.45% | 0.10% | running, healthy |
| literature-agent-es-1 | 1.5 GiB | 9.63% | 0.37% | running, healthy |
| literature-agent-minio-1 | 123.4 MiB | 0.77% | 0.00% | running, healthy |
| literature-agent-postgres-1 | 45.77 MiB | 0.29% | 0.00% | running, healthy |
| literature-agent-etcd-1 | 29.96 MiB | 0.19% | 0.38% | running |

Comparison method: import one literature item, wait until ingestion finishes and the containers settle, then run `docker stats --no-stream` again. The per-literature estimate is the after-import memory total minus this baseline.
