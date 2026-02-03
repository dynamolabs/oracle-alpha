# Contributing to ORACLE Alpha

First off, thank you for considering contributing to ORACLE Alpha! 🎉

## Code of Conduct

Be respectful, inclusive, and constructive. We're all here to build cool stuff.

## How Can I Contribute?

### 🐛 Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/dynamolabs/oracle-alpha/issues)
2. If not, create a new issue with:
   - Clear title
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Node version, etc.)

### 💡 Suggesting Features

1. Check existing issues for similar suggestions
2. Create a new issue with:
   - Use case / problem you're solving
   - Proposed solution
   - Alternative solutions considered

### 🔧 Pull Requests

1. Fork the repo
2. Create a branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm test`
5. Run linter: `npm run lint`
6. Commit: `git commit -m 'feat: Add amazing feature'`
7. Push: `git push origin feature/amazing-feature`
8. Open a Pull Request

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/oracle-alpha.git
cd oracle-alpha

# Install dependencies
npm install

# Copy env file
cp .env.example .env

# Run tests
npm test

# Start dev server
npm run dev
```

## Commit Messages

We follow [Conventional Commits](https://conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Formatting (no code change)
- `refactor:` Code restructuring
- `test:` Adding tests
- `chore:` Maintenance

Examples:
```
feat: Add whale tracker source
fix: Handle empty API response in KOL tracker
docs: Update API examples in README
test: Add unit tests for confidence scoring
```

## Code Style

- TypeScript strict mode
- 2 space indentation
- Single quotes
- Semicolons required
- Max line length: 100

Run `npm run lint:fix` to auto-fix most issues.

## Testing

- Write tests for new features
- Maintain >80% coverage
- Run `npm test` before submitting PR

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- confidence.test.ts
```

## Project Structure

```
oracle-alpha/
├── src/
│   ├── api/          # Express server & endpoints
│   ├── aggregator/   # Signal aggregation logic
│   ├── sources/      # Signal sources (wallets, KOLs, etc.)
│   ├── onchain/      # Solana program interaction
│   ├── tracker/      # Performance tracking
│   ├── utils/        # Utilities (scoring, dedup)
│   └── types/        # TypeScript types
├── tests/            # Unit tests
├── programs/         # Solana/Anchor program
├── app/              # Dashboard frontend
├── docs/             # Documentation
└── scripts/          # Deployment & utility scripts
```

## Adding a New Signal Source

1. Create file in `src/sources/your-source.ts`
2. Implement the scanner function:
```typescript
export async function scanYourSource(): Promise<RawSignal[]> {
  // Fetch data
  // Process into RawSignal format
  // Return signals
}
```
3. Add to aggregator in `src/aggregator/index.ts`
4. Add source config with weight and win rate
5. Write tests in `tests/your-source.test.ts`

## Questions?

Open an issue or reach out to the maintainers.

---

Happy coding! 🐼
