# Contributing to OmniLearn

Thank you for your interest in contributing! This guide helps you make effective contributions.

## 🚦 Before You Start

### 1. Check Existing Issues
Search [open issues](https://github.com/Cloud99p/omnilearn-agent/issues) for related discussions.

### 2. Set Up Development Environment

```bash
git clone https://github.com/Cloud99p/omnilearn-agent.git
cd omnilearn-agent
pnpm install
cp .env.example .env
# Edit .env with your credentials
pnpm --filter @workspace/db run push
```

### 3. Verify Build Passes

```bash
pnpm run typecheck
pnpm run build
```

**If this fails, do not submit a PR.** Fix build issues first.

## 📋 Pull Request Checklist

Before submitting your PR:

- [ ] Code compiles without TypeScript errors
- [ ] `pnpm run build` succeeds
- [ ] New code follows existing patterns
- [ ] Environment variables documented (if applicable)
- [ ] README updated (if adding features)

## 🎯 Good First Contributions

Look for issues labeled:
- `good first issue` — Beginner-friendly tasks
- `help wanted` — Need community help
- `bug` — Fix something broken

## 🏗️ Architecture Guidelines

### Code Organization

```
artifacts/api-server/src/
├── brain/          # Core intelligence logic
├── routes/         # API route handlers
├── middlewares/    # Express middlewares
└── lib/            # Shared utilities
```

### Adding New Features

1. **Brain Logic** → `artifacts/api-server/src/brain/`
2. **API Routes** → `artifacts/api-server/src/routes/`
3. **Frontend UI** → `artifacts/omnilearn/src/pages/`
4. **Database Schema** → `lib/db/src/schema/`

### TypeScript Standards

- Use explicit types for function parameters and returns
- Prefer `const` over `let`
- Handle all error cases (no unhandled Promise rejections)
- Use `safeParse()` for Zod validation, handle failure cases

### Database Changes

1. Update schema in `lib/db/src/schema/`
2. Run `pnpm --filter @workspace/db run push` (development)
3. Create migration for production: `pnpm --filter @workspace/db run generate`

## 🧪 Testing

Currently no formal test suite. Manual testing checklist:

- [ ] Chat functionality works
- [ ] Knowledge graph updates correctly
- [ ] Character traits evolve
- [ ] No console errors in browser
- [ ] API routes return expected responses

## 📝 Commit Messages

Follow conventional commits:

```
feat: add Hebbian edge validation
fix: resolve TypeScript error in synthesizer
docs: update README with deployment steps
chore: update pnpm-lock.yaml
```

## 🔍 Code Review Process

1. PR submitted
2. CI runs automatically (type check + build)
3. Maintainer reviews code
4. Address feedback
5. Merge to main

## 🚫 What Not to Do

- ❌ Don't commit `.env` files
- ❌ Don't merge to main without passing CI
- ❌ Don't add dependencies without discussing first
- ❌ Don't ignore TypeScript errors
- ❌ Don't push untested database migrations

## 💡 Ideas for Contributions

### Beginner
- Fix typos in documentation
- Add TypeScript types to untyped code
- Improve error messages

### Intermediate
- Add new knowledge extraction patterns
- Create UI improvements
- Add API route tests

### Advanced
- Implement new Hebbian edge types
- Optimize TF-IDF retrieval
- Add multi-agent sync protocols

## 📞 Getting Help

- Open an issue for bugs
- Start a discussion for feature ideas
- Check existing documentation first

## 🎉 Recognition

Contributors will be acknowledged in:
- README.md contributors section
- Release notes for significant contributions

---

Thanks for contributing to OmniLearn! 🧠
