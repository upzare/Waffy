# Waffy — open-source AI copilot for the web

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/badjijohkpnecfhjkondhcgacchekldm?style=flat-square&label=Chrome%20Web%20Store&color=00c853)](https://chromewebstore.google.com/detail/waffy-ai-copilot-for-web/badjijohkpnecfhjkondhcgacchekldm)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg?style=flat-square)](LICENSE)
[![Discord](https://img.shields.io/badge/Discord-Waffy-5865F2?style=flat-square&logo=discord&logoColor=white)](https://dsc.gg/waffy)
[![Website](https://img.shields.io/badge/website-waffy.io-111111?style=flat-square)](https://waffy.io)

**Waffy** is a free, open-source Chrome extension that puts an AI copilot in the browser side panel. Describe what you want in plain language. Waffy can read the page you are on, search and research the web, click through multi-step workflows, and remember useful facts about you on this device.

It is a [Manifest V3](https://developer.chrome.com/docs/extensions/mv3/intro/) extension for Chromium browsers: Chrome, Edge, Brave, Opera, and others. You choose the model — a cloud API, the browser’s built-in model, or a local OpenAI-compatible server such as Ollama or LM Studio. API keys, chats, and memory stay in the browser. Prompts go from your browser to the provider you selected.

Install it from the [Chrome Web Store](https://chromewebstore.google.com/detail/waffy-ai-copilot-for-web/badjijohkpnecfhjkondhcgacchekldm), or [build it from source](#getting-started).

## Features

### Read and talk about the current page

- Open the side panel from the toolbar, or press `Ctrl+I` (change it in `chrome://extensions/shortcuts`).
- Read the active tab as Markdown, and look at a screenshot when the page is visual — dashboards, charts, canvases, and app layouts.
- Right-click a page and choose **Summarize this page**.
- Type `@` to pull in another open tab, or `/` for Search, Research, and Automation.
- Attach JPEG, PNG, GIF, plain text, or PDF files, up to 5 MB each.
- Pin two to four quick prompts on the home screen, and edit them in settings.
- Keep conversation history on this device. Open it from the right edge of the panel, and delete a chat when you are done with it.

### Web search and research

Search and Research are on by default. Turn either one off in **Settings → General**.

| Mode         | How to start                            | What it does                                                                                 |
| ------------ | --------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Search**   | `/search`, or ask for something current | Looks up the question, reads a relevant page, and answers from that page                     |
| **Research** | `/research`                             | Goes further: the current page, a screenshot when the layout matters, and follow-up searches |
| **Chat**     | Just type                               | Answers from the page in front of you, and can search on its own when Search is enabled      |

Web search runs in the browser through DuckDuckGo, then reads the chosen page. The query is not sent to a Waffy server.

### Browser automation

Automation is off until you turn it on in **Settings → General**, or during first-run setup. With it on, ask Waffy to fill a form, click through a flow, or move between tabs. You can also start a task with `/automate`.

Waffy plans the task, then drives the page from screenshots:

- Click, type, clear fields, press keys, and choose dropdown options
- Drag and drop, scroll, wait, and reload
- Open, switch, and close tabs, and go to a URL
- Check whether the task finished, then write the result in plain language

The run is split into planning, execution, validation, and a short summary, so each stage can use its own model. Execution needs a vision model that can point at UI elements on a screenshot. **gemini-3.6-flash** (Google AI Studio or OpenRouter) is the recommended model for that stage. Use the built-in browser model for lighter work, such as titles and step labels.

### Personalized memory

Memory is off until you turn it on in **Settings → Memory**.

With memory on, Waffy saves lasting facts from your chats — name, work, location, preferences, and projects — and uses them in later conversations, including search, research, and automation planning. You do not have to say “remember this.”

Facts are embedded on this device with a small local model (`all-MiniLM-L6-v2`) and stored in IndexedDB. A new fact that closely matches an existing one updates that fact. In settings you can read every saved fact, delete one, summarize them, or reset memory. The summary uses the Memory model you pick, and the built-in browser model keeps that summary on the device.

Memory is for facts about you. The assistant is instructed to skip passwords, payment details, one-off tasks, and the contents of the page you are looking at.

### Bring your own model

Each pipeline stage can use a different provider and model. Stages for a feature you have turned off stay out of the way.

Chat, search, research, titles, step labels, and memory summaries default to the browser’s built-in model, so those can run with no API key. Automation defaults to Gemini for planning and execution, and to GPT for validation and the final write-up. Turn Automation on only after those providers have keys, or point those stages at another model.

| Stage         | What it does                                             | A good fit                                                             |
| ------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| Base          | Everyday answers, page questions, handoff to other modes | Built-in browser model, or a cloud model for harder questions          |
| Search        | Answers from web search                                  | Browser model, or a fast cloud model                                   |
| Research      | Longer synthesis from the page and the web               | A capable cloud model                                                  |
| Planning      | Turns a request into an automation plan                  | A fast text model                                                      |
| Execution | Clicks and types from screenshots                        | A vision model with image grounding. |
| Validation    | Checks whether the task succeeded                        | A fast text model                                                      |
| Output        | Writes the result in plain language                      | A fast text model                                                      |
| Title         | Names the conversation                                   | Browser model                                                          |
| Step          | Short labels while automation runs                       | Browser model                                                          |
| Memory        | Summarizes saved facts in settings                       | Browser model, so the summary stays on this device                     |

## Supported providers

| Provider            | Use it for                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| OpenAI              | GPT models                                                                                              |
| Anthropic           | Claude models                                                                                           |
| Google AI Studio    | Gemini models                                                                                           |
| xAI                 | Grok models                                                                                             |
| Groq                | Fast open models                                                                                        |
| OpenRouter          | Many models through one API key                                                                         |
| Browser built-in AI | Gemini Nano in Chrome, Phi Mini in Edge, and the built-in model in other supported browsers. No API key |
| Custom API          | Any OpenAI-compatible endpoint, including Ollama and LM Studio                                          |

Add cloud keys in **Extension settings → API Keys**. Download the on-device model from **Settings → Models** when a stage uses Browser built-in AI. Point **Settings → Custom API** at a base URL and model name for a local or self-hosted server. If that server does not require a key, leave the key blank.

Local servers such as Ollama refuse extension requests until you allow the origin. Set `OLLAMA_ORIGINS` to `chrome-extension://*` (or this extension’s id) and restart the server.

## Getting started

### Install from the Chrome Web Store

[Waffy — AI Copilot for Web](https://chromewebstore.google.com/detail/waffy-ai-copilot-for-web/badjijohkpnecfhjkondhcgacchekldm)

### Build from source

You need [Bun](https://bun.sh/) 1.0+ and a Chromium browser.

```bash
git clone https://github.com/upzare/Waffy.git
cd Waffy
bun install
bun run build
```

The build writes a `build/` directory and a zip in `.output/`. The zip name comes from the manifest, for example `Waffy - AI Copilot for Web-1.3.3.zip`.

### Load the unpacked extension

1. Open the extensions page: `chrome://extensions`, `edge://extensions`, or `brave://extensions`.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select the `build/` folder.
4. Open Waffy from the toolbar, or press `Ctrl+I`.

The first install opens a setup page where you pick a provider, a model, and which features to turn on. Later updates can open a short release-notes page.

### Configure

1. Open **Extension settings** from the side panel, or right-click the toolbar icon and choose **Options**.
2. Add an API key, use Browser built-in AI, or connect a custom endpoint.
3. Under **Models**, pick a model for each stage. For **Execution**, use a vision model such as **gemini-3.6-flash**.
4. Under **General**, turn Automation on if you want clicks and form filling. Under **Memory**, turn personalized memory on if you want facts saved on this device.

A few things to try: “Summarize this page”, “Look for the latest news on AI”, or, with Automation on, “Fill out this form for me”.

## Project structure

```
extension/
  public/                  Manifest, icons, static assets
  src/
    panel/                 Side panel: chat, history, composer
    settings/              Options: general, memory, API keys, models, custom API
    setup/                 First-run setup
    release/               Update notes
    lib/
      llm/                 Providers, prompts, tools, streaming
      memory/              On-device embeddings and saved facts
      background/          Tabs, search, page capture, automation, context menu
      agent.ts             Entry point for AI calls
      client.ts            Extension settings and storage
      content.ts           In-page actions (clicks, typing, screenshots)
      db.ts                IndexedDB (Dexie): conversations and memory
package.json               Workspace root — run bun commands from here
build/                     Production output (load this unpacked)
.output/                   Zipped release packages
```

## Privacy

API keys and settings live in the browser’s extension storage. Conversations and memory facts live in IndexedDB on this device. Memory embeddings are computed locally. When you use a cloud model, the prompt goes from your browser to that provider. Browser built-in AI runs on the device.

Automation uses Chrome’s debugger permission so a task can click, type, and read pages while it is running.

See [waffy.io/privacy](https://waffy.io/privacy) for the full privacy policy.

## FAQ

**Which browsers run Waffy?**
Chromium browsers that support Manifest V3, including Chrome, Edge, Brave, and Opera. Firefox is not supported.

**Do I need an API key?**
Only for a cloud provider. Browser built-in AI needs no key. A local OpenAI-compatible server is configured under Custom API, and the key can stay empty when the server does not ask for one.

**Where are chats and memory stored?**
On this device. Waffy has no account and no inference backend. You can delete a conversation from history, and delete or reset memory from **Settings → Memory**.

**Can it click, type, and fill forms?**
Yes, after you turn on Automation. The execution stage should use a vision model that can locate elements on a screenshot.

**What does memory remember?**
Lasting facts about you, such as your name, work, preferences, and current projects. Review the exact list anytime in settings. Embeddings never leave the browser.

**Is Waffy free?**
The extension is free and licensed under Apache 2.0. Cloud model usage is billed by the provider whose key you add.

## Links

- [Website](https://waffy.io)
- [Chrome Web Store](https://chromewebstore.google.com/detail/waffy-ai-copilot-for-web/badjijohkpnecfhjkondhcgacchekldm)
- [GitHub](https://github.com/upzare/Waffy)
- [Discord](https://dsc.gg/waffy)
- [X](https://x.com/WaffyHQ)

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).

## Security

To report a security vulnerability, see [SECURITY.md](SECURITY.md). Please do not open public issues for security reports.

## License

Copyright 2026 [Waffy.io](https://waffy.io)

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for the full text.
