# Waffy

Waffy is an open-source Chrome extension that brings AI-powered browser automation to your side panel. Describe what you want in natural language — Waffy can browse pages, click elements, fill forms, extract data, and complete multi-step workflows using vision-capable models and tool calling.

## Features

- **Natural language automation** — Tell Waffy what to do in plain English and it plans and executes browser actions for you.
- **Vision-based interaction** — Uses screenshots and coordinates to click, type, scroll, and navigate like a human would.
- **Multi-stage pipeline** — Separate models for planning, execution, validation, and output so each step can use the right model for the job.
- **Browser built-in AI** — Optional on-device models (Chrome Gemini Nano / Edge Phi Mini) for lightweight tasks like title and step generation. No API key required.
- **Bring your own API keys** — Connect your own provider accounts. Keys are stored locally in the extension — Waffy does not run a backend for inference.
- **Multiple providers** — OpenAI, Anthropic, Google AI Studio, xAI, Groq, OpenRouter, and Browser built-in AI.
- **Flexible model configuration** — Choose different models for each pipeline stage and UI helper task in settings.
- **Chat history & pinned prompts** — Keep conversation history and customize quick-start prompts on the home screen.
- **Side panel UI** — Open Waffy from the toolbar or with `Ctrl+I` (configurable in `chrome://extensions/shortcuts`).

## Supported providers

| Provider         | Example models                   |
| ---------------- | -------------------------------- |
| OpenAI           | GPT-4o, GPT-4.1                  |
| Anthropic        | Claude Sonnet, Claude Opus       |
| Google AI Studio | Gemini 2.x                       |
| xAI              | Grok                             |
| Groq             | Llama, Mixtral                   |
| OpenRouter       | 100+ models via a single API key |

Add API keys in **Extension settings → API Keys** after installation. For browser built-in AI, download the on-device model from **Settings → Models**.

### Choosing models

Waffy runs a multi-stage pipeline. Each stage can use a different model:

| Stage | Purpose | Model guidance |
| ----- | ------- | -------------- |
| Planning | Decides whether to automate and drafts a task plan | Fast text models work well |
| **Execution** | Drives browser actions from screenshots | Use a **vision model with spatial reasoning and image grounding** — it must identify UI element coordinates on screenshots. Recommended: **gemini-3.5-flash** (Google AI Studio or OpenRouter). Browser built-in AI is not recommended here. |
| Validation | Checks whether the task succeeded | Fast text models work well |
| Output | Summarizes results for you | Fast text models work well |
| Title / Step | Short UI labels | Browser built-in AI works well (default) |

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- Google Chrome (or a Chromium-based browser)

### Build from source

```bash
git clone https://github.com/upzare/Waffy.git
cd Waffy
npm install
npm run build
```

This produces a `build/` directory and a `.output/Waffy-1.0.0.zip` package.

### Load the extension in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `build/` folder
4. Click the Waffy icon in the toolbar, or press `Ctrl+I` to open the side panel

### Configure API keys

1. Right-click the Waffy icon → **Options**, or open **Extension settings** from the side panel
2. Go to **API Keys** and add a key for at least one provider
3. Go to **Models** and pick models for each pipeline stage. For **Execution**, use a vision model with spatial reasoning — e.g. **gemini-3.5-flash** via Google or OpenRouter.
4. Start chatting — try something like _"Go to example.com and click the login button"_

## Development

```bash
npm run dev    # watch mode — rebuilds on file changes
npm run start  # dev server with hot reload
```

After `npm run dev`, reload the extension in `chrome://extensions/` when you make changes.

## Project structure

```
├── extension/
│   ├── src/
│   │   ├── panel/          # Side panel UI (chat, history, input)
│   │   ├── settings/       # Extension options page (API keys, models, general)
│   │   └── lib/
│   │       ├── llm/        # Model providers, streaming, prompts, tools
│   │       ├── agent.ts    # Entry point for AI calls
│   │       ├── client.ts   # Chrome storage & settings
│   │       ├── background.ts
│   │       └── content.ts  # Page interaction (clicks, typing, screenshots)
│   └── public/             # Manifest, icons, static assets
├── build/                  # Production output (load this in Chrome)
├── package.json
├── webpack.config.ts
└── tsconfig.json
```

## Privacy

API keys and conversation history are stored locally in your browser via Chrome's extension storage. Requests go directly from your browser to the AI provider you configure — Waffy does not proxy or log your prompts.

See [waffy.io/privacy](https://waffy.io/privacy) for the full privacy policy.

## Links

- [Website](https://waffy.io)
- [GitHub](https://github.com/upzare/Waffy)
- [Twitter / X](https://x.com/WaffyHQ)

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).

## Security

To report a security vulnerability, see [SECURITY.md](SECURITY.md). Please do not open public issues for security reports.

## License

Copyright 2025 [Waffy AI](https://waffy.io)

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for the full text.
