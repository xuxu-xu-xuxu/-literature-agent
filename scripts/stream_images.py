#!/usr/bin/env python3
"""Stream docker images directly to server via SSH pipe."""
import paramiko
import subprocess
import sys

HOST = "172.20.252.20"
USER = "root"
PASS = "yunkun2025"

IMAGES = [
    "quay.io/coreos/etcd:v3.5.5",
    "minio/minio:RELEASE.2023-03-20T20-16-18Z",
    "postgres:16-alpine",
    "elasticsearch:8.15.3",
    "python:3.10-slim",
    "python:3.11-slim",
    "node:22-alpine",
    "milvusdb/milvus:v2.5.27",
    "literature_agent-bge-m3:latest",
    "literature_agent-backend:latest",
    "literature_agent-frontend:latest",
]

def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASS, timeout=10, look_for_keys=False, allow_agent=False)
    print("SSH 连接成功")

    for img in IMAGES:
        print(f"\n=== 传输: {img} ===")
        # Check if image already exists on server
        stdin, stdout, stderr = client.exec_command(f"docker image inspect {img} >/dev/null 2>&1 && echo EXISTS || echo NOT_FOUND")
        status = stdout.read().decode().strip()
        if "EXISTS" in status:
            print(f"  已存在，跳过")
            continue

        # Stream: local docker save | gzip | remote gunzip | docker load
        print(f"  开始流式传输...")
        local_cmd = f"docker save {img} | gzip -c"

        # Run docker load on server
        remote_cmd = "gunzip -c | docker load 2>&1"

        try:
            # Start local docker save
            local_proc = subprocess.Popen(
                local_cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE
            )

            # Start remote docker load with stdin from local
            stdin, stdout, stderr = client.exec_command(remote_cmd)

            # Pipe data in chunks
            chunk_size = 1024 * 1024  # 1MB chunks
            total = 0
            while True:
                chunk = local_proc.stdout.read(chunk_size)
                if not chunk:
                    break
                stdin.write(chunk)
                total += len(chunk)
                if total % (50 * 1024 * 1024) == 0:  # print every 50MB
                    print(f"  已传输: {total/1024/1024:.0f}MB")

            stdin.close()
            local_proc.stdout.close()

            # Get remote output
            out = stdout.read().decode().strip()
            err = stderr.read().decode().strip()
            if out:
                print(f"  [OUT]: {out}")
            if err:
                print(f"  [ERR]: {err}")

            # Check local exit
            local_rc = local_proc.wait()
            if local_rc != 0:
                local_err = local_proc.stderr.read().decode()
                print(f"  本地错误: {local_err}")
            else:
                print(f"  完成: {total/1024/1024:.0f}MB 已传输")
        except Exception as e:
            print(f"  传输失败: {e}")

    print("\n=== 验证服务器上的镜像 ===")
    stdin, stdout, stderr = client.exec_command("docker images --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}' | head -20")
    print(stdout.read().decode().strip())

    client.close()

if __name__ == "__main__":
    main()
