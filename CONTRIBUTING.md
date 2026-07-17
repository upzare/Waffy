# Contributing to Waffy

Thank you for your interest in contributing to Waffy. This project is maintained by [Waffy AI](https://waffy.io) and licensed under the [Apache License 2.0](LICENSE).

## Ways to contribute

- Report bugs and request features via [GitHub Issues](https://github.com/upzare/Waffy/issues)
- Improve documentation
- Submit pull requests with bug fixes or enhancements
- Help others in issue discussions

## Before you start

1. Search existing issues and pull requests to avoid duplicate work.
2. For large changes, open an issue first to discuss the approach.
3. Keep pull requests focused — one feature or fix per PR when possible.

## Development setup

```bash
git clone https://github.com/upzare/Waffy.git
cd Waffy
bun install
bun run dev
```

Load the `build/` directory as an unpacked extension in `chrome://extensions/`, then reload the extension after changes.

## Pull request guidelines

1. Fork the repository and create a branch from `main`.
2. Make your changes and verify the extension still builds:

   ```bash
   bun run build
   ```

```

3. Write a clear PR description explaining what changed and why.
4. Link any related issues (e.g. `Fixes #123`).
5. Ensure you are not committing secrets, API keys, or `.env` files.

## Code style

- Match the existing TypeScript and React patterns in the codebase.
- Prefer small, readable changes over large refactors unless discussed in advance.
- Avoid unrelated formatting or drive-by changes in the same PR.

## Reporting bugs

Include as much detail as possible:

- Chrome version
- Waffy version
- AI provider and model configuration
- Steps to reproduce
- Expected vs actual behavior
- Screenshots or console errors if relevant

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.yml) when filing issues.

## Security issues

Please do **not** open public issues for security vulnerabilities. See [SECURITY.md](SECURITY.md) for responsible disclosure instructions.

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).
```
