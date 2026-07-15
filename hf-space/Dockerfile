# Hugging Face Space (Docker SDK) that runs the FULL CarePulse backend
# INCLUDING the on-device AI -- whisper transcription + MFCC diarization --
# on the free 16 GB CPU tier (no credit card needed).
#
# It's the combined single-process backend (backend/combined-server.js) plus
# the Linux speech tooling baked in. With no RabbitMQ configured, the
# conversation service runs the speech pipeline in-process, so a recorded
# session gets a real transcript right here. Translation (NLLB) is left out of
# this image for now -- it's the heavy piece and re-downloads a ~2.4 GB model
# on each cold start; the translate UI just hides itself when it's absent.
#
# The image clones the PUBLIC repo at build time, so the Space repo only needs
# this Dockerfile + README.md. Rebuild the Space to pick up new backend commits.
FROM ubuntu:24.04

# Node 20 (matches package.json engines), ffmpeg, git, python for diarization.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl git ffmpeg python3 python3-venv gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Diarization deps in their own venv (ubuntu's python is PEP668-managed).
RUN python3 -m venv /opt/pyenv && /opt/pyenv/bin/pip install --no-cache-dir librosa scikit-learn

# Official prebuilt Linux whisper.cpp (x86-64) -- same build the local worker uses.
RUN curl -sL https://github.com/ggml-org/whisper.cpp/releases/download/v1.9.1/whisper-bin-ubuntu-x64.tar.gz \
      | tar xz -C /opt && mv /opt/whisper-bin-ubuntu-x64 /opt/whisper && chmod +x /opt/whisper/whisper-cli

# Whisper base model (~148 MB), baked in so there's nothing to mount at runtime.
RUN mkdir -p /models && \
    curl -sL -o /models/ggml-base.bin \
      https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin

# Clone the public repo and install the backend's production deps.
RUN git clone --depth 1 https://github.com/manish-g-p/carepulse-mern /src
WORKDIR /src/backend
RUN npm ci --omit=dev

# Point the tool locations at the Linux binaries; serve on HF's expected port.
# No RABBITMQ_URL -> in-process speech processing. Secrets (MONGO_URI, JWT_SECRET,
# ADMIN_PASSKEY, AUDIO_ENCRYPTION_KEY, CLIENT_ORIGIN) come from Space secrets.
ENV WHISPER_EXE=/opt/whisper/whisper-cli \
    WHISPER_MODEL=/models/ggml-base.bin \
    FFMPEG_EXE=ffmpeg \
    PYTHON_EXE=/opt/pyenv/bin/python3 \
    LD_LIBRARY_PATH=/opt/whisper \
    COMBINED_DB=carepulse \
    PORT=7860

EXPOSE 7860
CMD ["node", "combined-server.js"]
