FROM python:3.11-slim

# System deps for llama.cpp build
RUN apt-get update && apt-get install -y \
    git build-essential cmake && rm -rf /var/lib/apt/lists/*

# Build llama.cpp (includes llama-server)
RUN git clone https://github.com/ggerganov/llama.cpp /llama.cpp \
    && cd /llama.cpp && cmake -B build && cmake --build build -j$(nproc)

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Models volume mount
VOLUME ["/models"]

ENV MODEL_PATH=/models/model.gguf
ENV LLAMA_SERVER=/llama.cpp/build/bin/llama-server

CMD ["python", "main.py"]
