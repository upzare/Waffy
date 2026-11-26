# Waffy - AI Copilot for Web

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/badjijohkpnecfhjkondhcgacchekldm?style=flat-square&label=Chrome%20Web%20Store&color=00c853)](https://chromewebstore.google.com/detail/waffy-ai-copilot-for-web/badjijohkpnecfhjkondhcgacchekldm)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg?style=flat-square)](LICENSE)
[![Discord](https://img.shields.io/badge/Discord-Waffy-5865F2?style=flat-square&logo=discord&logoColor=white)](https://dsc.gg/waffy)
[![Website](https://img.shields.io/badge/website-waffy.io-111111?style=flat-square)](https://waffy.io)

**Waffy** is a free, open-source AI browser assistant for Chrome and compatible Chromium browsers. Use it to summarize web pages, research across tabs, draft and rewrite text directly on a page, and automate repetitive browser tasks. Waffy can remember preferences across chats, follow reusable Agent Skills, and use tools from Model Context Protocol (MCP) servers.

Choose from built-in browser AI, a local model server such as Ollama or LM Studio, or a cloud provider using your own API key. Setup requires no Waffy account.

[Install Waffy from the Chrome Web Store](https://chromewebstore.google.com/detail/waffy-ai-copilot-for-web/badjijohkpnecfhjkondhcgacchekldm) or [build it from source](#build-from-source).

<div align="center">
  <img width="auto" height="500" alt="Waffy AI browser assistant in the side panel" src="https://github.com/user-attachments/assets/6b67d739-8fe0-4d0e-a7dc-66cd9ce8d2a3" />
</div>

## Features

### Web page summaries and AI chat

- Ask questions about the current page or right-click it and choose **Summarize this page**. Waffy can read page text and look at screenshots for visual context.
- Type `@` in chat to include another open tab or choose **Capture area** on Waffy’s in-page toolbar to attach part of the page as a screenshot.
- Attach images, plain text, or PDFs up to 5 MB per file. Pin prompts you use often and revisit earlier conversations in chat history.

### Web search and research

Search and Research are on by default and use DuckDuckGo for web searches. Type `/` in the composer to choose a mode. Manage these modes in **Settings → General**.

### In-page AI writing tools

Open the side panel to show Waffy’s toolbar on supported pages. Select text or place your cursor in an editable field, then choose **Draft & Rewrite**. Ask Waffy to draft a reply, fix grammar, shorten a passage, or change its tone.

Preview the result and select **Apply** to insert or replace text in a supported field. You can also copy the result or choose **Ask in Chat** to continue with the text in the side panel.

### Personalized memory

Waffy can automatically remember lasting details from your conversations, such as your preferences, work, and ongoing projects. It can use relevant saved facts in later chats and writing requests. Memory is on by default. Open **Settings → Memory** to turn it off, review or summarize saved facts, delete individual entries, or reset all memory.

### Reusable Agent Skills

Skills give Waffy instructions you can reuse for tasks such as comparing products, reviewing a page, or formatting research notes. Go to **Settings → Skills**, choose **Import SKILL.md**, confirm the import, and select **Save Changes**.

Type `$` in the composer to pick a skill for one message. For example, use `/research $compare-products Compare @Laptop A and @Laptop B` to combine a skill with Research mode and two tabs. Skills work with Chat, Search, Research, and Automation. Import a file with the same skill name to review and replace the installed version. See the [Agent Skills file specification](https://agentskills.io/specification).

### MCP server integrations

Waffy’s built-in MCP client can discover and call tools from the Model Context Protocol (MCP) servers you enable. Depending on the server, these tools can search connected documents or update records in another app. MCP tools are available in Chat, Search, Research, and the planning and execution stages of Automation.

1. Go to **Settings → MCP Servers → Add server**. Enter a name and a Streamable HTTP endpoint.
2. Choose **None**, **Bearer token**, or **OAuth** for authentication and select **Add server**.
3. Open the menu next to the server. Select **Test** to check the connection and list its tools, or **Sign in or Reconnect** for OAuth. Select **Save Changes** to finish.

Use HTTPS for remote servers. Localhost HTTP works with **None** or **Bearer token**.

### Browser automation

Enable automation in **Settings → General** or during setup. Use `/automate` when you want Waffy to fill a form, click through a flow, or move between tabs.

Waffy plans the task and uses screenshots to locate page elements. It can click, type, drag, scroll, choose dropdown options, and open or switch tabs. For execution, use a vision model that can locate UI elements in screenshots, such as **gemini-3.6-flash**.

### Local and cloud AI models

Choose a provider and a model for each stage in **Settings → Models**.

| Stage     | What it does                                                     |
| --------- | ---------------------------------------------------------------- |
| Base      | Handles chat, Draft & Rewrite, chat titles, and memory summaries |
| Search    | Answers questions using web search                               |
| Research  | Synthesizes information from the page and the web                |
| Planning  | Turns a request into an automation plan                          |
| Execution | Uses screenshots to interact with web pages                      |
| Output    | Checks the outcome and reports what happened                     |
| Step      | Generates short labels while automation runs                     |

## Supported providers

| Provider            | Use it for                                                     |
| ------------------- | -------------------------------------------------------------- |
| OpenAI              | GPT models                                                     |
| Anthropic           | Claude models                                                  |
| Google AI Studio    | Gemini models                                                  |
| xAI                 | Grok models                                                    |
| Groq                | Fast open models                                               |
| OpenRouter          | Many models through one API key                                |
| Browser built-in AI | Gemini Nano in Chrome or Aion Instruct in Edge, when available |
| Custom API          | Any OpenAI-compatible endpoint, including Ollama and LM Studio |

To use Browser AI in Edge 158 or later, enable **Prompt API** in `edge://flags` and restart Edge. See [Microsoft’s Prompt API setup guide](https://learn.microsoft.com/en-us/microsoft-edge/web-ai/prompt-api#test-the-prompt-api-locally).

Add keys in **Extension settings → API Keys**. For a local server, set the base URL under **Custom API**. Ollama also needs `OLLAMA_ORIGINS` set to `chrome-extension://*` before you restart it.

## Getting started

### Install from the Chrome Web Store

[Waffy on the Chrome Web Store](https://chromewebstore.google.com/detail/waffy-ai-copilot-for-web/badjijohkpnecfhjkondhcgacchekldm)

Open Waffy from the browser toolbar or press `Ctrl+I` (`Cmd+I` on macOS). The first install opens a setup page for choosing your model and enabling features.

### Build from source

You need [Bun](https://bun.sh/) 1.0+ and a Chromium browser.

```bash
git clone https://github.com/upzare/Waffy.git
cd Waffy
bun install
bun run build
```

The build writes the unpacked extension to `build/` and a `<name>-<version>.zip` archive to `.output/` using the manifest name and version.

### Load the unpacked extension

1. Open `chrome://extensions`, `edge://extensions`, or `brave://extensions`.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select the `build/` folder.
4. Open Waffy from the toolbar and follow the same setup as the store version.

### Configure

1. Open **Extension settings** from the side panel, or right-click the toolbar icon and choose **Options**.
2. Add an API key, use Browser built-in AI, or connect a custom endpoint.
3. Choose models under **Models** and manage optional features in **General**, **Memory**, **Skills**, and **MCP Servers**.

## Project structure

```
extension/
  public/                  Manifest, icons, static assets
  src/
    panel/                 Chat, history, and composer
    settings/              Models, memory, Skills, MCP servers, and general options
    setup/                 First-run setup
    release/               Update notes
    lib/
      llm/                 Model providers, prompts, tools, and streaming
      memory/              On-device embeddings and saved facts
      skills/              SKILL.md parsing and storage
      mcp/                 MCP connections and tool calls
      background/          Tabs, search, page capture, automation, context menu
      content/             In-page writing tools and screenshot capture UI
      client.ts            Extension settings and storage
      content.ts           In-page actions
      db.ts                IndexedDB for conversations, Skills, and memory
package.json               Workspace root. Run bun commands from here.
build/                     Production output (load this unpacked)
.output/                   Zipped release packages
```

## Privacy

Waffy stores API keys, settings, and MCP credentials in extension storage. Chat history, imported Skills, and saved memory are stored in IndexedDB. Waffy computes memory embeddings on your device with `all-MiniLM-L6-v2`.

Built-in Browser AI runs on your device. If you choose a cloud model, requests go directly from your browser to the provider with the context needed for the task, which can include page content, screenshots, selected text, skill instructions, or recalled facts. Web search sends queries to DuckDuckGo. Connected MCP servers receive the arguments for their tool calls, and tool results can be sent to your chosen model.

Waffy enables anonymous usage analytics by default. Turn it off during setup or in **Settings → General**. Automation uses Chrome’s debugger permission while a task is running.

See [waffy.io/privacy](https://waffy.io/privacy) for the full privacy policy.

## FAQ

### Which browsers run Waffy?

Waffy runs in Chrome and compatible Chromium browsers such as Edge and Brave. In-page tools and built-in Browser AI depend on the APIs available in your browser.

### Can I use Waffy without an API key?

Yes. Use **Browser AI** on a supported device or connect a local OpenAI-compatible endpoint that accepts requests without a key. If you choose a cloud model, add the provider’s API key.

### Can I use Skills and MCP tools together?

Yes. Select a skill in chat and ask Waffy to use a service from an enabled MCP server. For example, use a weekly-report skill to format updates from a connected project tracker.

### Is Waffy free?

Yes. The extension is free under Apache 2.0. Cloud providers may charge for API usage.

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
