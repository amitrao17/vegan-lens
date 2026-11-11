# Vegan Lens backlog

## On-device semantic title classification (opt-in, no uploads)
Regex rules (e.g. the 0.4.63 discussion rule) can't tell what a title means ("Why Did Shirdi Sai Baba Eat Meat?" is about
belief, not food). Planned: an **opt-in** semantic pass that runs **only on the device**. No title, URL or page text ever leaves the browser.
- **Chrome built-in AI (Gemini Nano, Prompt API)**: `LanguageModel.availability()` / `LanguageModel.create()` from the
  extension. The model downloads once and runs locally. Use it only when available, with a fixed prompt that returns one of
  `shows-food | discussion | unrelated` plus the topic. Cache results per title.
- **Fallback / Firefox**: a tiny local model shipped or downloaded on opt-in (e.g. a small ONNX / transformers.js text
  classifier run via WASM/WebGPU in an offscreen document), or no semantic pass at all.
- **Guard rails**: only consulted for titles the rules already flagged (it can only soften a verdict, never add a dim), so
  the false-positive risk only goes down. Per-title time budget; rules stay the source of truth when the model is
  unavailable. Settings toggle off by default; privacy text: "runs on your device, nothing is uploaded".
- **Eval**: labelled title set from tests + debug logs; ship only if precision on "shows-food" stays at or above the current rules.
