"""Modal app for the FLUX.2 [klein] 4B evaluation (Track A).

Isolated experiment: fictional briefs only, no client data, no public endpoint.
Nothing here runs until a team member with Modal credentials executes it.

    modal run app.py::download_weights      # once, CPU only
    python run_benchmark.py --set smoke     # see README for budgets
"""
import time

import modal

import config

app = modal.App("raco-flux2-klein-eval")
weights = modal.Volume.from_name("raco-flux2-klein-weights", create_if_missing=True)
WEIGHTS_DIR = "/weights"

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("torch==2.5.1", "transformers>=4.51", "accelerate>=1.2", "safetensors", "huggingface_hub>=0.30", "pillow", "sentencepiece")
    .pip_install(config.DIFFUSERS_GIT)
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "0"})
)


@app.function(image=image, volumes={WEIGHTS_DIR: weights}, timeout=3600, cpu=2, memory=4096)
def download_weights():
    """Fetch only the Diffusers folders into the Volume (one-off, CPU)."""
    import os
    from huggingface_hub import snapshot_download

    path = snapshot_download(
        config.MODEL_ID,
        revision=config.MODEL_REVISION,
        allow_patterns=config.ALLOW_PATTERNS,
        local_dir=WEIGHTS_DIR + "/klein-4b",
        token=os.environ.get("HF_TOKEN"),
    )
    weights.commit()
    total = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(path) for f in fs)
    return {"path": path, "gigabytes": round(total / 1e9, 2), "revision": config.MODEL_REVISION}


@app.cls(
    image=image,
    gpu=config.DEFAULT_GPU,
    volumes={WEIGHTS_DIR: weights},
    cpu=config.CONTAINER_CPU_CORES,
    memory=config.CONTAINER_MEM_GIB * 1024,
    timeout=600,
    scaledown_window=config.SCALEDOWN_WINDOW_S,
    max_containers=1,
)
class Generator:
    @modal.enter()
    def load(self):
        import torch
        from diffusers import Flux2KleinPipeline

        self.container_started = time.time()
        t0 = time.time()
        self.pipe = Flux2KleinPipeline.from_pretrained(WEIGHTS_DIR + "/klein-4b", torch_dtype=torch.bfloat16).to("cuda")
        torch.cuda.synchronize()
        self.load_seconds = round(time.time() - t0, 2)
        self.calls = 0

    @modal.method()
    def generate(self, prompt, seed, steps=config.STEPS, width=config.WIDTH, height=config.HEIGHT, reference_images=None):
        import io
        import torch
        from PIL import Image

        self.calls += 1
        torch.cuda.reset_peak_memory_stats()
        generator = torch.Generator("cuda").manual_seed(int(seed))
        torch.cuda.synchronize()
        t0 = time.time()
        kwargs = dict(prompt=prompt, num_inference_steps=steps, guidance_scale=config.GUIDANCE, width=width, height=height, generator=generator)
        if reference_images:
            # Multi-reference conditioning ("image" list per the Flux2 pipelines). CONFIRM on the
            # first run against the pinned diffusers commit; the model card doesn't document the argument.
            kwargs["image"] = [Image.open(io.BytesIO(b)).convert("RGB") for b in reference_images]
        out = self.pipe(**kwargs)
        torch.cuda.synchronize()
        seconds = round(time.time() - t0, 3)
        buf = io.BytesIO()
        out.images[0].save(buf, format="PNG")
        props = torch.cuda.get_device_properties(0)
        return {
            "png": buf.getvalue(),
            "seconds": seconds,
            "peak_vram_gb": round(torch.cuda.max_memory_allocated() / 1e9, 2),
            "gpu_name": props.name,
            "gpu_total_gb": round(props.total_memory / 1e9, 1),
            "cold": self.calls == 1,
            "load_seconds": self.load_seconds if self.calls == 1 else None,
            "torch": torch.__version__,
            "references": len(reference_images or []),
            "model": config.MODEL_ID,
            "revision": config.MODEL_REVISION,
        }
