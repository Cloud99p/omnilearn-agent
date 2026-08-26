# Dependabot Vulnerability Remediation — Omnilearn Agent

**Date:** 2026-08-26
**Branch:** `main`

## Summary

Remediated the supply-chain vulnerability backlog reported by GitHub Dependabot. **27 unique advisories → 12 remaining**, all of which are documented *accepted risks* that cannot be patched without breaking core functionality.

| Metric | Before | After |
|:-------|:------:|:-----:|
| Critical | 1 | 1 (accepted) |
| High | 12 | 5 (all protobufjs, accepted) |
| Moderate | ~14 | 6 (5 protobufjs + 1 opentelemetry, accepted) |
| Low | 2 | 0 |

## Fixed Vulnerabilities

### 1. `xlsx` (SheetJS) → replaced with `exceljs`
- **Advisories:** Prototype pollution + ReDoS (High). `xlsx@0.18.5` is abandoned with **no patched version**.
- **Fix:** Replaced the import and extraction path in `artifacts/api-server/src/brain/document-tools.ts`:
  - Removed `import { read, utils } from "xlsx"`
  - Added `import ExcelJS from "exceljs"`
  - Rewrote the excel `case` block using `ExcelJS.Workbook` / `xlsx.load()` / `eachSheet` / `eachRow`, with robust coercion for rich-text, hyperlink, formula, and error cell unions.
  - Added `exceljs@^4.4.0` to `artifacts/api-server/package.json`.
- **Verified:** Runtime smoke test PASS — correct tab-separated extraction with rich-text joining.

### 2. `multer` 1.4.5-lts.1 → 2.2.0 (Direct + transitive)
- **Advisories (11 total):** deeply nested field names DoS, uncontrolled recursion, resource exhaustion, unhandled exceptions, aborted-upload cleanup, memory leaks.
- **Fix:** Bumped `multer` to `^2.2.0` in `artifacts/api-server/package.json` and pinned `2.2.0` via root `pnpm.overrides`.
- **Verified:** `documents.ts` / `omni/train.ts` runtime typecheck shows **zero multer-related errors** — v1→v2 API is compatible (`upload.single`, `memoryStorage` unchanged).

### 3. `sharp` 0.34.2 → 0.35.0 (Direct + transitive)
- **Advisories:** libvips CVEs CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591 (High).
- **Fix:** Bumped to `0.35.0` via root `pnpm.overrides` (applies to all dependents).

### 4. Transitive overrides (root `pnpm.overrides`)
Consolidated single override block forcing patched versions:
- `http-proxy-middleware`: `^3.0.5` → `^3.0.7` (CRLF field injection, host-header routing bypass)
- `js-cookie`: `^3.0.7` (per-instance prototype hijack)
- `form-data`: `^4.0.6` (CRLF injection)
- `brace-expansion`: `^2.1.4` (3× DoS)
- `body-parser`: `^2.3.0` (invalid-limit DoS)
- `uuid`: `^11.1.1` (buffer bounds check)
- `qs`: `^6.15.2` (stringify DoS)
- `js-yaml`: `^4.3.1` (prototype pollution / code-exec on unsafe load)
- `fast-uri`: `^3.1.5` (ReDoS / parser DoS)
- `linkify-it`: `^5.0.2` (ReDoS)
- `markdown-it`: `^14.2.0` (ReDoS)
- `postcss`: `^8.5.23` (ReDoS / line-ending DoS)
- `nanoid`: `^3.3.18` (predictable IDs via non-crypto RNG)
- `@babel/core`: `^7.29.6` (ReDoS on template literal parsing)
- `vitest`: `^1.0.0` → `^3.2.6` (dev toolchain, transitive advisory fixes across `packages/sdk`, `packages/network-hierarchy`, `artifacts/api-server`)
- `vite`: `^7.3.2` → `^7.3.5` (catalog bump)
- `esbuild`: `^0.27.3` → `^0.28.1` (api-server; 0.28.x also already resolved in lock)

## Accepted Risks (documented, cannot patch)

### A. `protobufjs` (11 advisories — 1 critical, 5 high, 5 moderate) — BLOCKED
- **Path:** `@xenova/transformers → onnxruntime-web → onnx-proto → protobufjs`
- **Cause:** `onnx-proto` hard-pins `protobufjs ^6.x` (verified `onnx-proto@4.0.4` and even latest `onnx-proto@8.0.1` both require `^6.8.8` / `^6.11.2`). The patched version (`≥7.5.5`/`7.6.3`) requires a major bump that breaks the ONNX toolchain.
- **Business impact of forcing v7:** Breaks ONNX inference used for embeddings / semantic search (core feature).
- **Mitigation:** `onnx-proto` uses static **precompiled** schema code, not runtime attacker-controlled descriptors. The critical advisory (attacker-controlled descriptor) is not practically exploitable in this configuration.

### B. `@opentelemetry/core` (1 moderate) — BLOCKED
- **Path:** `@sentry/node → @opentelemetry/core@1.30.1`
- **Cause:** Sentry hard-pins the OTel 1.x line; the fix requires `≥2.8.0` (major bump).
- **Mitigation:** The W3C Baggage unbounded-memory advisory is only exploitable when processing **untrusted incoming** Baggage headers. This API server does not run an inbound trace-context propagator on untrusted traffic.

## Verification
- `pnpm install`: clean resolution (pnpm 10.33.2), all 12 workspace projects.
- `pnpm audit --prod`: reduced to the 12 accepted advisories above.
- Typecheck (`tsc --noEmit`, api-server): **no new errors introduced** — all remaining errors in touched files are pre-existing legacy code issues (confirmed via baseline stash comparison).
- ExcelJS runtime smoke test: **PASS**.

## Rollback
`git revert` the remediation commit. The `pnpm-lock.yaml` and both `package.json` files (root + api-server) must be reverted together — the root `pnpm.overrides` block and the api-server dependency changes are coupled.
