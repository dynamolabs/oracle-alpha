# Changelog

All notable changes to ORACLE Alpha will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-04

### Added
- 🎉 Initial release for Colosseum Agent Hackathon
- Multi-source signal aggregation
  - Smart wallet tracking (24 wallets)
  - KOL activity monitoring (31 KOLs)
  - Volume spike detection
  - Narrative detection (AI, Meme, Political, Gaming, DeFi)
  - New launch scanner
  - Whale accumulation tracking
- Weighted scoring algorithm with historical performance
- On-chain signal publishing (Solana devnet)
- ATH tracking with automatic updates
- Win/Loss determination system
- REST API with 12 endpoints
- WebSocket real-time feed
- Dashboard with live signal display
- Telegram alert integration
- CLI tools (scan, status, leaderboard)
- Comprehensive documentation

### Technical
- 74 unit tests with 89% coverage
- GitHub Actions CI/CD pipeline
- Docker support
- Rate limiting (100 req/min API, 10 req/min for expensive ops)
- Security headers via Helmet
- OpenAPI 3.0 documentation

### Infrastructure
- Express.js API server
- Anchor/Solana program
- PM2 production deployment
- Health check endpoints

## [0.9.0] - 2026-02-03

### Added
- Core aggregator implementation
- Initial 8 signal sources
- Basic API endpoints
- Dashboard MVP

### Fixed
- Score bar crash when score > 100
- UNKNOWN token name with Helius fallback

## [0.1.0] - 2026-02-02

### Added
- Project scaffolding
- Basic types and interfaces
- Anchor program skeleton

---

## Roadmap

### [1.1.0] - Planned
- [ ] Mainnet deployment
- [ ] Additional KOL wallets
- [ ] Twitter API integration
- [ ] Backtesting module

### [1.2.0] - Planned
- [ ] Premium API tier
- [ ] Historical data export
- [ ] Custom alert rules
- [ ] Mobile app
