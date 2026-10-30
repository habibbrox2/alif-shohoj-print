# Contributing to Alif Shohoj Printby AAA Tech Solutions

Thank you for your interest in contributing to **Alif Shohoj Printby AAA Tech Solutions** (`alif-shohoj-print`).

Contributions such as bug reports, documentation improvements, accessibility fixes, and carefully scoped feature proposals are welcome. Please read this guide before opening an issue or submitting a pull request.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Before You Start](#before-you-start)
- [Report a Bug](#report-a-bug)
- [Suggest a Feature](#suggest-a-feature)
- [Development Principles](#development-principles)
- [Making Changes](#making-changes)
- [Testing and Verification](#testing-and-verification)
- [Pull Request Checklist](#pull-request-checklist)
- [Security Issues](#security-issues)
- [AI-Assisted Contributions](#ai-assisted-contributions)
- [License and Contributions](#license-and-contributions)

## Code of Conduct

Be respectful, constructive, and considerate. Focus feedback on the work, explain disagreements clearly, and help keep project discussions welcoming and useful.

## Before You Start

1. Search existing issues and pull requests to avoid duplicates.
2. Read the project README and any relevant project-specific instructions, including `AGENTS.md` if present.
3. For substantial changes, open an issue first to discuss the proposed approach.
4. Do not assume a proposed change has been approved merely because an issue exists.

## Report a Bug

When opening a bug report, include as much of the following as is relevant:

- A clear, descriptive title.
- The steps needed to reproduce the issue.
- Expected behavior and actual behavior.
- Environment details, such as operating system, app version, and relevant runtime versions.
- Relevant logs, screenshots, or a short screen recording, with sensitive information removed.
- Whether the issue is reproducible and how often it occurs.

Use a minimal reproduction where possible. Do not include passwords, API keys, access tokens, private customer documents, personal identity documents, or other sensitive data in an issue.

## Suggest a Feature

Feature proposals should explain:

- The problem or user need.
- The proposed behavior and intended users.
- Why existing functionality does not adequately solve the problem.
- Possible alternatives and relevant trade-offs.
- Any compatibility, privacy, security, or maintenance implications.

Discuss major features before investing in a large implementation. Keep proposals focused and avoid combining unrelated changes.

## Development Principles

Contributions should follow these principles:

- **Preserve existing behavior:** avoid unintended regressions in existing workflows.
- **Keep changes scoped:** make the smallest coherent change that solves the stated problem.
- **Protect production configuration:** do not change production URLs, deployment settings, signing configuration, environment variables, or release behavior without explicit maintainer approval.
- **Protect user data:** validate input, handle errors safely, and avoid logging sensitive information.
- **Use secure defaults:** never commit secrets, credentials, private keys, or real customer data.
- **Maintain compatibility:** document and discuss breaking changes before implementing them.
- **Explain why, not the obvious:** comments should clarify non-obvious decisions rather than restate the code.
- **Update documentation:** meaningful behavior, setup, architecture, or workflow changes should be reflected in the relevant documentation, including the README when appropriate.

## Making Changes

1. Fork the repository and create a focused branch from the appropriate base branch.
2. Inspect the existing implementation and project instructions before editing.
3. Establish a clean baseline and identify existing changes before modifying files.
4. Make only the changes needed for the issue or approved proposal.
5. Add or update tests and documentation where appropriate.
6. Review the complete diff for unrelated edits, accidental deletions, secrets, generated files, and configuration changes.
7. Run the relevant checks and record their results.
8. Push your branch to your fork and open a pull request against the project's intended base branch.

Do not rewrite shared history or force-push to a maintainer-controlled branch unless a maintainer explicitly requests it.

## Testing and Verification

Run the checks relevant to your changes. Depending on the affected area, these may include:

- Automated tests.
- Linting and formatting checks.
- Type checks or static analysis.
- Production builds.
- Manual verification of the changed workflow.
- Regression checks for related existing functionality.

In your pull request, list the commands you ran and whether they passed. If a check could not be run, say why. Do not claim that tests passed if they were not executed.

For changes affecting printing, job processing, desktop packaging, networking, or local data storage, verify the relevant workflow and failure paths where practical. Do not test against real customer data.

## Pull Request Checklist

Before submitting a pull request, confirm that:

- [ ] The change addresses an issue or clearly described need.
- [ ] The pull request has a concise title and explains the motivation.
- [ ] The diff contains no unrelated changes.
- [ ] Existing functionality and production configuration are preserved unless a change was explicitly approved.
- [ ] Tests and relevant checks have been run, with results documented.
- [ ] Documentation is updated where needed.
- [ ] No secrets, credentials, private customer data, or unnecessary generated artifacts are included.
- [ ] Breaking changes and migration steps are clearly documented.
- [ ] AI-assisted work is disclosed as described below.

A maintainer may request changes, additional tests, or clarification before merging. Submitting a pull request does not guarantee acceptance.

## Security Issues

**Do not report exploitable vulnerabilities in public issues.** Share security concerns privately with the repository owner or through a security contact explicitly published in the repository. If no private reporting channel is listed, contact the maintainer directly through an appropriate private channel.

Include the affected component, impact, reproduction details, and a suggested mitigation if available. Avoid accessing, modifying, or exposing other people's data while investigating a potential vulnerability.

## AI-Assisted Contributions

AI tools may be used to assist with research, coding, testing, or documentation, but the contributor remains responsible for the entire submission.

If AI materially contributes to a pull request, disclose in the pull request description:

- The AI tool and model name, when known.
- Which parts were AI-assisted.
- What you personally reviewed, tested, or changed.
- Any limitations or checks that were not completed.

Review all generated code for correctness, security, licensing concerns, compatibility, and maintainability. Do not submit code you do not understand or cannot explain. Never provide secrets, credentials, or private customer data to AI tools.

## License and Contributions

By submitting a contribution, you confirm that you have the right to submit it and that it may be distributed under the repository's applicable license. If the repository has no license or the licensing terms are unclear, contact the maintainer before contributing code.

Thank you for helping improve **Alif Shohoj Printby AAA Tech Solutions**.
