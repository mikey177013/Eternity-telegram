# Security Policy

## Supported Versions

The following versions of Nagatele Bot are currently receiving security updates:

| Version | Supported          |
| ------- | ------------------ |
| 5.1.x   | :white_check_mark: |
| 5.0.x   | :x:                |
| 4.0.x   | :white_check_mark: |
| < 4.0   | :x:                |

Older versions may still function, but they will **not** receive patches for newly discovered vulnerabilities. We strongly recommend running the latest supported release.

---

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly. **Do not** open a public GitHub issue for security-related problems.

### How to Report

- **Email:** phoenix177013@gmail.com
- **Telegram:** [@sanosenxpai](https://t.me/sanosenxpai)

**Include the following:**
- A clear description of the vulnerability
- Steps to reproduce the issue
- Affected version(s)
- Any proof-of-concept code or screenshots (if applicable)
- Suggested fix (optional)

### What to Expect

| Stage | Timeline |
|-------|----------|
| Acknowledgement of report | Within **48 hours** |
| Initial assessment & severity rating | Within **3–5 days** |
| Status update (accepted / declined / in progress) | Within **7 days** |
| Patch release (if accepted) | Depends on severity — critical fixes within **7–14 days** |

### If Accepted

- You will be credited in the release notes (unless you prefer to stay anonymous)
- A patched version will be published as soon as possible
- You may be asked to verify the fix before public disclosure

### If Declined

- You will receive a clear explanation of why the report was not accepted
- If applicable, we will suggest alternative channels or clarify that the behaviour is by design

---

## Scope

The following are **in scope** for security reports:

- Remote code execution via bot commands
- SQL injection or database tampering
- Authentication / permission bypass (e.g. non-owner running dev commands)
- Token or credential leakage
- Denial-of-service through crafted input

The following are **out of scope**:

- Spam or abuse from Telegram accounts (report to Telegram directly)
- Issues in third-party dependencies (report upstream)
- Social engineering attacks
- Bugs that do not have a security impact

---

Thank you for helping keep Nagatele Bot and its users safe.
