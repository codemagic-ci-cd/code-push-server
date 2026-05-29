# Security Policy

## Reporting a Vulnerability

Please do not report security vulnerabilities through public GitHub issues.

Use GitHub Private Vulnerability Reporting for this repository:

1. Open the repository on GitHub.
1. Go to the **Security** tab.
1. Select **Report a vulnerability**.
1. Include as much detail as possible so maintainers can reproduce and assess the issue.

## What to Report

Please report vulnerabilities that could affect the confidentiality, integrity, or availability of CodePush Server, the CodePush CLI, or update delivery. Useful reports include:

- Authentication or authorization bypasses
- Privilege escalation between accounts, apps, deployments, or collaborators
- Update package tampering, signature bypasses, or unsafe release delivery behavior
- Exposure of deployment keys, access keys, secrets, tokens, or private update artifacts
- Injection vulnerabilities, cross-site scripting, server-side request forgery, or unsafe deserialization
- Storage access issues that expose or allow modification of another user's data
- Dependency vulnerabilities with a realistic exploit path in this project

Please include:

- Affected version, commit, branch, or deployment configuration
- Steps to reproduce the issue
- Proof-of-concept code or requests, when safe to share
- Expected and actual behavior
- Impact and any known mitigations

## Response Expectations

Maintainers aim to acknowledge new vulnerability reports within 5 business days. After initial triage, maintainers will work with the reporter to confirm impact, identify affected versions, prepare fixes, and coordinate disclosure timing.

Response times may vary based on report complexity and maintainer availability, but maintainers will make a good-faith effort to keep reporters updated while an issue is being investigated.

## Coordinated Disclosure

Please keep vulnerability details private until maintainers have investigated the report and, when needed, prepared a fix or mitigation. After a fix is available, maintainers will coordinate public disclosure through GitHub security advisories, release notes, or other appropriate project channels.

Reports should be made in good faith and should avoid privacy violations, data destruction, service disruption, or access to data beyond what is necessary to demonstrate the vulnerability.
