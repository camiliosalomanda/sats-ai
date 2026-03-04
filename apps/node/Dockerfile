FROM python:3.11-slim AS builder

# System deps for llama.cpp build
RUN apt-get update && apt-get install -y \
    git build-essential cmake && rm -rf /var/lib/apt/lists/*

# Pin llama.cpp to a known release for reproducible builds
RUN git clone --depth 1 --branch b4753 https://github.com/ggerganov/llama.cpp /llama.cpp \
    && cd /llama.cpp && cmake -B build && cmake --build build -j$(nproc)

# --- Final stage (no build tools) ---
FROM python:3.11-slim

# Copy only the built binaries from builder
COPY --from=builder /llama.cpp/build/bin/llama-server /usr/local/bin/llama-server
COPY --from=builder /llama.cpp/build/src/*.so /usr/local/lib/
RUN ldconfig

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create non-root user
RUN useradd -m -u 1000 -s /bin/bash satsai \
    && chown -R satsai:satsai /app

# Models volume mount
VOLUME ["/models"]

ENV MODEL_PATH=/models/model.gguf
ENV LLAMA_SERVER=/usr/local/bin/llama-server

USER satsai
CMD ["python", "main.py"]
