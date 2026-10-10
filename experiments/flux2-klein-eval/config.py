"""Track A configuration. Fictional briefs only; no client data."""

MODEL_ID = "black-forest-labs/FLUX.2-klein-4B"  # Apache 2.0. Never the 9B/dev (non-commercial).
# Pin before the first run: the exact Hugging Face commit you reviewed (licence is per revision).
MODEL_REVISION = "main"
# The model card requires diffusers from git; pin a commit for reproducibility.
DIFFUSERS_GIT = "git+https://github.com/huggingface/diffusers.git"
# Download only the Diffusers folders (skip the duplicate 7.75 GB single-file checkpoint).
ALLOW_PATTERNS = ["model_index.json", "scheduler/*", "text_encoder/*", "tokenizer/*", "transformer/*", "vae/*", "LICENSE.md", "README.md"]

WIDTH = 1024
HEIGHT = 1024
STEPS = 4            # distilled model card default
GUIDANCE = 1.0       # distilled model card default

# Modal list prices, USD per second (modal.com/pricing, checked 2026-10-10).
GPU_PRICE_PER_S = {"L4": 0.000222, "A10": 0.000306, "L40S": 0.000542, "A100-40GB": 0.000583, "A100-80GB": 0.000694}
CPU_PRICE_PER_CORE_S = 0.0000131
MEM_PRICE_PER_GIB_S = 0.00000222
CONTAINER_CPU_CORES = 4
CONTAINER_MEM_GIB = 32
SCALEDOWN_WINDOW_S = 60   # idle tail billed after the last request

DEFAULT_GPU = "L4"
# Hard cap for one benchmark session. Modal Starter includes $30/month of credits;
# keep most of it for team/client testing.
DEFAULT_BUDGET_USD = 5.0
