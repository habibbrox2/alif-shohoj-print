# GitHub Actions Windows Build Guide for Alif Shohoj Print

## Overview

This guide explains how to use GitHub Actions to build the Windows NSIS installer for the **Alif Shohoj Print by AAA Tech Solutions** desktop application.

The workflow automatically builds the application on every push to `main`, `master`, or `develop` branches, on pull requests, and can be triggered manually with custom parameters.

## Workflow File Location

```
.github/workflows/windows-build.yml
```

## Workflow Triggers

### Automatic Triggers

| Trigger | Description | Branches/Tags |
|---------|-------------|---------------|
| `push` | Push to main, master, develop branches | `main`, `master`, `develop` |
| `push` | Push tags starting with `v` | `v*` |
| `pull_request` | Pull requests to main, master | `main`, `master` |

### Manual Trigger

You can manually trigger the workflow from the GitHub Actions tab:

1. Go to **Actions** → **Windows Build**
2. Click **Run workflow**
3. Select branch and enter optional parameters:
   - **skip_tests**: Skip tests for faster builds (default: `false`)

## Build Process

The workflow performs the following steps:

### 1. Checkout Repository
Clones the repository with full history.

### 2. Setup Python
- Installs Python 3.x (required for native module compilation via node-gyp)

### 3. Setup Node.js
- Installs Node.js v22 LTS
- Caches npm dependencies using `package-lock.json`

### 4. Install Dependencies
```bash
npm ci
```

### 5. Verify Native Modules
- Verifies that `better-sqlite3` and `pdf-to-printer` load correctly

### 6. Run Linting
```bash
npm run lint
```
Performs TypeScript type checking.

### 7. Run Desktop Tests
```bash
npm run test:desktop
```
Runs Electron service tests.

### 8. Run Renderer Tests
```bash
npm run test:renderer
```
Runs renderer service tests.

### 9. Build Renderer
```bash
npm run build
```
Builds the Vite renderer bundle.

### 10. Build Electron Main Process
```bash
npm run build:electron
```
Compiles Electron main process TypeScript and copies preload script.

### 11. Package Windows NSIS Installer
```bash
npx electron-builder --win nsis --x64 --ia32 --publish never
```
Creates the NSIS installer executable for both `x64` and `ia32` architectures. The `--publish never` flag prevents electron-builder from attempting to publish to GitHub releases during the build process.

### 12. Upload Artifacts
Stores the built `.exe` files as GitHub Actions artifacts for 60 days.

## Build Output

The workflow creates installers for multiple architectures in a single build:

| Architecture | Target |
|--------------|--------|
| `x64` | 64-bit Windows |
| `ia32` | 32-bit Windows |

Both architectures are built in a single job using the `electron-builder.yml` configuration.

## Artifacts

### Build Artifacts

After a successful build, the following files are available as artifacts:

- `Alif-Shohoj-Print-{version}-Setup-x64.exe`
- `Alif-Shohoj-Print-{version}-Setup-ia32.exe`

These are stored in GitHub Actions artifacts for 60 days.

### Downloading Artifacts

1. Go to **Actions** → **Windows Build**
2. Select a completed workflow run
3. Scroll to **Artifacts** section
4. Download the desired artifact

## Release Workflow

When you push a tag starting with `v` (e.g., `v1.0.0`), the workflow automatically:

1. Builds the application
2. Creates a GitHub Release
3. Attaches the installer files to the release

### Creating a Release

```bash
# Create and push a version tag
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

The release will be available at:
```
https://github.com/{owner}/{repo}/releases/tag/v1.0.0
```

## Configuration

### Environment Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `NODE_VERSION` | `22` | Node.js version to use |

### Secrets

| Secret | Purpose | Required |
|--------|---------|----------|
| `GITHUB_TOKEN` | Auto-generated token for releases | Automatic |

## Troubleshooting

### Build Fails on Dependencies

**Error**: `npm ci` fails
**Solution**: Ensure `package-lock.json` is committed and up to date.

### Test Failures

**Error**: Tests fail during build
**Solution**: Run tests locally first:
```bash
npm run test:desktop
npm run test:renderer
```

### Electron Builder Errors

**Error**: `electron-builder` fails
**Solution**: 
1. Check `electron-builder.yml` configuration
2. Ensure all build resources exist in `build/` directory
3. Verify Node.js version compatibility

### Icon Issues

**Error**: Missing or invalid icon
**Solution**: Ensure `build/icon.png` exists and is a valid PNG file.

### Native Module Build Issues

**Error**: `better-sqlite3` fails to build
**Solution**: The workflow uses `npm rebuild` via electron-builder. Ensure native dependencies are compatible with the Node.js version.

## Best Practices

1. **Always run tests locally** before pushing to avoid failing CI builds.
2. **Use semantic versioning** for tags (e.g., `v1.0.0`, `v1.1.0`, `v2.0.0`).
3. **Keep `package-lock.json`** committed and synchronized.
4. **Review artifacts** before creating a release.
5. **Test installers** on a clean Windows machine when possible.

## Manual Build Commands

For local development, use these commands instead of GitHub Actions:

```bash
# Full verification and build
npm run verify

# Build unpacked directory (for testing)
npm run app:dir

# Build Windows installer
npm run app:dist

# Build signed installer (requires signing setup)
npm run app:dist:signed
```

## Security Notes

- The workflow uses `GITHUB_TOKEN` which is automatically provided by GitHub Actions.
- Never commit signing certificates or private keys to the repository.
- For signed releases, configure signing secrets in repository settings:
  - `WIN_CSC_LINK`: Base64-encoded certificate
  - `WIN_CSC_KEY_PASSWORD`: Certificate password

## Updating the Workflow

To modify the build process:

1. Edit `.github/workflows/windows-build.yml`
2. Test changes in a feature branch
3. Create a pull request for review
4. Merge to main/master after approval

## Related Files

- `package.json` - Project configuration and scripts
- `electron-builder.yml` - Electron builder configuration
- `tsconfig.json` - TypeScript configuration
- `tsconfig.electron.json` - Electron TypeScript configuration
- `vite.config.ts` - Vite build configuration

## Support

For issues with the build process:

1. Check the workflow logs in GitHub Actions
2. Review the troubleshooting section above
3. Open an issue in the repository with the error details

---

*Last updated: October 2026*