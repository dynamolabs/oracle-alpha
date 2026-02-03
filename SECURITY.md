# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability, please:

1. **DO NOT** open a public issue
2. Email security concerns to the maintainers
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within 48 hours and work with you to understand and resolve the issue.

## Security Measures

### API Security
- Rate limiting (100 req/min standard, 10 req/min for expensive operations)
- Helmet.js security headers
- Input validation via Zod schemas
- No SQL injection (no database)

### On-Chain Security
- Program authority verification
- PDA-based account derivation
- No unauthorized state modifications

### Data Security
- No user data storage
- No authentication tokens stored
- Wallet private keys never exposed via API
- Environment variables for sensitive config

## Best Practices for Users

1. **Never share your private keys**
2. Use environment variables for API keys
3. Run behind a reverse proxy (nginx) in production
4. Enable HTTPS in production
5. Monitor rate limit headers

## Audit Status

This project has not undergone a formal security audit. Use at your own risk.

## Responsible Disclosure

We appreciate responsible disclosure and will acknowledge reporters in our release notes (unless you prefer to remain anonymous).
