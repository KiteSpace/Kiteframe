# Security Policy

## Supported Versions

We currently support security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 2.x.x   | ✅ Current         |
| 1.2.x   | ✅ LTS             |
| 1.1.x   | ❌ End of Life     |
| 1.0.x   | ❌ End of Life     |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please report it responsibly:

### How to Report

- **Email**: security@kiteframe.io
- **Subject**: Security Vulnerability in KiteFrame
- **Include**:
  - Detailed description of the vulnerability
  - Steps to reproduce (if applicable)
  - Proof of concept (if available)
  - Affected versions
  - Potential impact assessment

### What NOT to Do

- **Do not** disclose the vulnerability publicly until we have had a chance to address it
- **Do not** exploit the vulnerability beyond what is necessary to demonstrate it
- **Do not** access, modify, or delete user data

## Our Response Process

### Timeline

- **3 business days**: We will acknowledge receipt of your report
- **7 business days**: We will provide an initial assessment and timeline
- **30 days**: We aim to resolve critical vulnerabilities within this timeframe

### Our Commitment

1. We will work with you to understand and verify the vulnerability
2. We will keep you informed of our progress throughout the resolution process
3. We will credit you for the discovery (if desired) in our security advisory
4. We will notify you when the vulnerability has been fixed

## Security Features

KiteFrame includes several built-in security features:

- **Input Validation**: All user inputs are validated and sanitized
- **XSS Prevention**: Content Security Policy (CSP) compliance
- **Rate Limiting**: Protection against abuse and DoS attacks
- **Security Monitoring**: Real-time threat detection and logging

## Scope

This security policy applies to:

- The KiteFrame library and all related packages
- Official documentation and examples
- The KiteFrame website and related services

**Out of scope:**
- Third-party integrations and plugins (unless developed by the KiteFrame team)
- User applications built with KiteFrame
- Dependencies managed by their respective maintainers

## Safe Harbor

We support responsible disclosure and will not pursue legal action against researchers who:

- Make a good faith effort to avoid privacy violations, destruction of data, and interruption or degradation of our services
- Only interact with accounts you own or with explicit permission from the account holder
- Do not access sensitive data beyond what is necessary to demonstrate the vulnerability
- Report vulnerabilities as soon as possible after discovery

## Security Best Practices

When using KiteFrame in your applications:

- Keep KiteFrame updated to the latest version
- Implement proper authentication and authorization
- Validate and sanitize all user inputs
- Use HTTPS in production environments
- Follow the principle of least privilege
- Regularly audit your dependencies

## Contact

For security-related questions or concerns:

- **Security Team**: security@kiteframe.io
- **General Support**: support@kiteframe.io
- **Enterprise Security**: enterprise@kiteframe.io

---

Thank you for helping keep KiteFrame and our community safe!