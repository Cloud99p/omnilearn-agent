# GitHub Packages Setup Guide

**Published Package**: `@cloud99p/omnilearn-sdk`  
**Registry**: https://npm.pkg.github.com

---

## 📦 Installation

### 1. Configure Authentication

Create a **Personal Access Token (PAT)** with `read:packages` scope:

1. Go to: https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select scope: `read:packages`
4. Copy the token

Add to your project's `.npmrc`:

```bash
# .npmrc
@cloud99p:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN_HERE
```

### 2. Install the SDK

```bash
# With pnpm (recommended)
pnpm add @cloud99p/omnilearn-sdk

# With npm
npm install @cloud99p/omnilearn-sdk --registry=https://npm.pkg.github.com

# With yarn
yarn add @cloud99p/omnilearn-sdk --registry=https://npm.pkg.github.com
```

---

## 🚀 Publishing to GitHub Packages

### Prerequisites

- GitHub account with `Cloud99p` organization/user
- Write access to packages in GitHub Packages
- GitHub token with `publish:packages` scope (for CI)

### Manual Publish

```bash
cd packages/sdk
pnpm install
pnpm run build
pnpm publish --access public
```

**Note**: You'll be prompted for authentication. Use your GitHub PAT.

### Automated Publish (GitHub Actions)

The repository includes `.github/workflows/publish-sdk.yml` which:

1. Triggers on GitHub release creation
2. Builds the SDK
3. Publishes to GitHub Packages
4. Creates a GitHub release

**To trigger manually**:
1. Go to Actions tab
2. Select "Publish SDK to GitHub Packages"
3. Click "Run workflow"
4. Enter version (e.g., `1.0.0`)

---

## 🔧 Configuration

### package.json

```json
{
  "name": "@cloud99p/omnilearn-sdk",
  "version": "1.0.0",
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  }
}
```

### .npmrc (Root)

```bash
# Root .npmrc for monorepo
registry=https://registry.npmjs.org/

# GitHub Packages for @cloud99p scope
@cloud99p:registry=https://npm.pkg.github.com
```

### .npmrc (SDK Package)

```bash
# GitHub Packages Registry for SDK
@cloud99p:registry=https://npm.pkg.github.com
```

---

## 📊 Package Details

- **Name**: `@cloud99p/omnilearn-sdk`
- **Version**: `1.0.0`
- **Registry**: https://npm.pkg.github.com
- **Repository**: https://github.com/Cloud99p/omnilearn-agent
- **Scope**: `@cloud99p` (your GitHub username)

---

## 🔐 Security

### Token Scopes Required

| Action | Scope |
|--------|-------|
| Install | `read:packages` |
| Publish | `publish:packages` |
| Manage | `repo` (for releases) |

### Best Practices

1. **Never commit tokens** to git
2. **Use environment variables** in CI/CD
3. **Rotate tokens** every 90 days
4. **Use minimal scopes** (principle of least privilege)

### CI/CD Configuration

GitHub Actions automatically uses `${{ secrets.GITHUB_TOKEN }}` which has:
- `read:packages` - to read dependencies
- `publish:packages` - to publish the SDK
- `repo` - to create releases

No additional configuration needed!

---

## 📦 Package Contents

After build, the package includes:

```
dist/
├── index.js          # CommonJS bundle (14.49 KB)
├── index.js.map      # Source map
├── index.mjs         # ESM bundle (12.75 KB)
├── index.mjs.map     # Source map
├── index.d.ts        # TypeScript definitions (15.35 KB)
└── index.d.mts       # TypeScript definitions (ESM)
```

**Total**: ~58 KB (including source maps)

---

## 🌐 Package URL

- **GitHub Packages**: https://github.com/Cloud99p/omnilearn-agent/pkgs/npm/omnilearn-sdk
- **NPM Registry**: https://npm.pkg.github.com/@cloud99p/omnilearn-sdk

---

## 📝 Versioning

### Semantic Versioning

- **Major**: Breaking changes
- **Minor**: New features (backward compatible)
- **Patch**: Bug fixes

### Release Process

1. Update version in `packages/sdk/package.json`
2. Commit: `chore: bump version to 1.0.1`
3. Push to main
4. Create GitHub release
5. GitHub Actions auto-publishes

---

## 🧪 Testing Locally

Before publishing, test the package:

```bash
# Create test project
mkdir test-sdk
cd test-sdk
pnpm init

# Link local package
pnpm add /path/to/omnilearn-agent/packages/sdk

# Test installation
pnpm install
```

---

## 📞 Support

- **Issues**: https://github.com/Cloud99p/omnilearn-agent/issues
- **Email**: emmanuelhosea09@gmail.com
- **Docs**: See `packages/sdk/README.md`

---

**Ready to publish!** 🚀
