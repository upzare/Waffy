# Waffy - AI Copilot for Web

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/badjijohkpnecfhjkondhcgacchekldm?style=flat-square&label=Chrome%20Web%20Store&color=00c853)](https://chromewebstore.google.com/detail/waffy-ai-copilot-for-web/badjijohkpnecfhjkondhcgacchekldm)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg?style=flat-square)](LICENSE)
[![Discord](https://img.shields.io/badge/Discord-Waffy-5865F2?style=flat-square&logo=discord&logoColor=white)](https://dsc.gg/waffy)
[![Website](https://img.shields.io/badge/website-waffy.io-111111?style=flat-square)](https://waffy.io)

**Waffy** is a free, open-source Chrome extension that puts an AI copilot in the browser side panel. Describe what you want in plain language. It can read the page you are on, search and research the web, click through multi-step workflows, and remember useful facts about you on this device.

It runs on Chromium browsers (Chrome, Edge, Brave, Opera, and others). You choose the model: a cloud API, the browser’s built-in model, or a local server such as Ollama or LM Studio. API keys, chats, and memory stay in the browser.

Install it from the [Chrome Web Store](https://chromewebstore.google.com/detail/waffy-ai-copilot-for-web/badjijohkpnecfhjkondhcgacchekldm), or [build it from source](#getting-started).

![Waffy side panel](https://waffy.io/ui.gif)

## Features

### Read and talk about the current page

- Open the side panel from the toolbar, or press `Ctrl+I`.
- Read the active tab as Markdown, and look at a screenshot when the page is visual.
- Right-click a page and choose **Summarize this page**.
- Type `@` to include another open tab, or `/` for Search, Research, and Automation.
- Attach images, plain text, or PDFs (up to 5 MB), pin quick prompts, and keep chat history on this device.

### Web search and research

Search and Research are on by default. Turn either one off in **Settings → General**. Search runs in the browser through DuckDuckGo.

| Mode         | How to start | What it does                                                                 |
| ------------ | ------------ | ---------------------------------------------------------------------------- |
| **Search**   | `/search`    | Looks up the question, reads a relevant page, and answers from that page     |
| **Research** | `/research`  | Goes further: the current page, a screenshot when it helps, and more searches |
| **Chat**     | Just type    | Answers from the page in front of you, and can search when Search is on      |

### Browser automation

Automation is off until you turn it on in **Settings → General**, or during setup. Ask Waffy to fill a form, click through a flow, or move between tabs. You can also start with `/automate`.

It plans the task, then drives the page from screenshots: click, type, drag, scroll, choose dropdowns, and open or switch tabs. Execution needs a vision model that can point at UI elements. **gemini-3.6-flash** is the recommended model for that stage.

### Personalized memory

Memory is off until you turn it on in **Settings → Memory**.

Waffy then saves lasting facts from your chats (name, work, preferences, projects) and uses them in later conversations. You do not have to say “remember this.” Facts are embedded on this device with `all-MiniLM-L6-v2` and stored in IndexedDB. You can read, delete, summarize, or reset them in settings. Passwords, payment details, and one-off tasks are left out.

### Bring your own model

Each stage can use a different provider and model. Chat, search, research, titles, and memory summaries default to the built-in browser model, so they can run with no API key. Automation defaults to Gemini for planning and execution, and to GPT for validation and the final write-up.

| Stage      | What it does                                      | A good fit                                        |
| ---------- | ------------------------------------------------- | ------------------------------------------------- |
| Base       | Everyday answers and handoff to other modes       | Browser model, or a cloud model for harder questions |
| Search     | Answers from web search                           | Browser model or a fast cloud model               |
| Research   | Longer answers from the page and the web          | A capable cloud model                             |
| Planning   | Turns a request into an automation plan           | A fast text model                                 |
| Execution  | Clicks and types from screenshots                 | A vision model with image grounding               |
| Validation | Checks whether the task succeeded                 | A fast text model                                 |
| Output     | Writes the result in plain language               | A fast text model                                 |
| Title      | Names the conversation                            | Browser model                                     |
| Step       | Short labels while automation runs                | Browser model                                     |
| Memory     | Summarizes saved facts in settings                | Browser model                                     |

## Supported providers

| Provider            | Use it for                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------- |
| OpenAI              | GPT models                                                                                  |
| Anthropic           | Claude models                                                                               |
| Google AI Studio    | Gemini models                                                                               |
| xAI                 | Grok models                                                                                 |
| Groq                | Fast open models                                                                            |
| OpenRouter          | Many models through one API key                                                             |
| Browser built-in AI | Gemini Nano in Chrome, Phi Mini in Edge. No API key                                        |
| Custom API          | Any OpenAI-compatible endpoint, including Ollama and LM Studio                              |

Add keys in **Extension settings → API Keys**. For a local server, set the base URL under **Custom API**. Ollama also needs `OLLAMA_ORIGINS` set to `chrome-extension://*` before you restart it.

## Getting started

### Install from the Chrome Web Store

[Waffy - AI Copilot for Web](https://chromewebstore.google.com/detail/waffy-ai-copilot-for-web/badjijohkpnecfhjkondhcgacchekldm)

### Build from source

You need [Bun](https://bun.sh/) 1.0+ and a Chromium browser.

```bash
git clone https://github.com/upzare/Waffy.git
cd Waffy
bun install
bun run build
```

The build writes a `build/` directory and a zip in `.output/`, named from the manifest (for example `Waffy - AI Copilot for Web-1.3.3.zip`).

### Load the unpacked extension

1. Open `chrome://extensions`, `edge://extensions`, or `brave://extensions`.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select the `build/` folder.
4. Open Waffy from the toolbar, or press `Ctrl+I`.

The first install opens a setup page for your provider, model, and features.

### Configure

1. Open **Extension settings** from the side panel, or right-click the toolbar icon and choose **Options**.
2. Add an API key, use Browser built-in AI, or connect a custom endpoint.
3. Under **Models**, pick a model for each stage. For **Execution**, use a vision model such as **gemini-3.6-flash**.
4. Turn Automation on under **General**, and personalized memory on under **Memory**, if you want them.

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
      content.ts           In-page actions
      db.ts                IndexedDB: conversations and memory
package.json               Workspace root. Run bun commands from here.
build/                     Production output (load this unpacked)
.output/                   Zipped release packages
```

## Privacy

API keys and settings live in extension storage. Conversations and memory stay in IndexedDB on this device, and memory embeddings are computed locally. A cloud model receives the prompt directly from your browser. Browser built-in AI runs on the device. Automation uses Chrome’s debugger permission while a task is running.

See [waffy.io/privacy](https://waffy.io/privacy) for the full privacy policy.

## FAQ

**Which browsers run Waffy?**
Chromium browsers with Manifest V3, including Chrome, Edge, Brave, and Opera.

**Do I need an API key?**
Only for a cloud provider. Browser built-in AI needs no key. A local server can leave the key empty.

**Where are chats and memory stored?**
On this device. Delete a chat from history, or delete and reset memory in **Settings → Memory**.

**Can it click, type, and fill forms?**
Yes, after you turn on Automation. Use a vision model for the execution stage.

**Is Waffy free?**
The extension is free under Apache 2.0. Cloud models are billed by the provider whose key you add.

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
