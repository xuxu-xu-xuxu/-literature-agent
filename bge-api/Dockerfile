FROM python:3.10-slim
WORKDIR /app
# 先安装 CPU 版 PyTorch，防止 FlagEmbedding 拉取 CUDA 版本
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
COPY main.py .
CMD ["python3", "main.py"]