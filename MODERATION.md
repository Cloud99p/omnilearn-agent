# Content Moderation & Safety

**OmniLearn has multi-layer content moderation to prevent harmful, illegal, or dangerous information from being learned or shared.**

---

## 🛡️ Protection Layers

### Layer 1: Meta-Text Filtering
**Prevents:** System messages, learning confirmations, AI responses being learned as knowledge

**Patterns blocked:**
- "I've learned:", "That connects to what I've learned"
- "Is there more you'd like to share?"
- "Based on what I've learned"
- "I've added this to my knowledge base"

**Implementation:** `native-synthesizer.ts` + `brain/index.ts`

---

### Layer 2: Content Moderation
**Prevents:** Harmful, illegal, dangerous content from being learned

**Categories blocked:**

| Category | Examples | Severity |
|----------|----------|----------|
| **Violence** | Kill instructions, weapons, explosives | Critical |
| **Hate Speech** | Racial slurs, supremacy, genocide denial | Critical |
| **Self-Harm** | Suicide methods, eating disorders, cutting | Critical |
| **Sexual Minors** | CSAM, underage content | Critical |
| **Illegal** | Drugs, weapons trafficking, money laundering | High |
| **Dangerous** | Malware, exploits, bomb-making | High |
| **Harassment** | Doxxing, stalking, threats | High |
| **PII** | SSN, credit cards, medical records | High |

**Implementation:** `lib/moderation.ts`

---

### Layer 3: Duplicate Detection
**Prevents:** Redundant knowledge, storage waste

**Method:** Jaccard similarity > 55% = duplicate

**Implementation:** `brain/index.ts` + `brain/network.ts`

---

### Layer 4: User Reporting
**Allows:** Community flagging of problematic content

**Report reasons:**
- Harmful content
- PII exposure
- Spam
- Harassment
- Other

**Implementation:** `routes/moderation.ts`

---

## 🔍 What Gets Blocked

### ❌ Violence & Self-Harm
```
❌ "How to build a bomb"
❌ "Ways to commit suicide"
❌ "Instructions to kill someone"
❌ "How to poison someone"
❌ "Cutting yourself tips"
```

### ❌ Hate Speech
```
❌ "White supremacy is correct"
❌ "Kill all [ethnicity]"
❌ "Holocaust was a hoax"
❌ Racial slurs
```

### ❌ Illegal Activities
```
❌ "How to buy drugs online"
❌ "Money laundering techniques"
❌ "How to hack into bank accounts"
❌ "Tax evasion tips"
```

### ❌ Dangerous Instructions
```
❌ "How to create malware"
❌ "DDoS attack tutorial"
❌ "SQL injection guide"
❌ "How to make meth"
```

### ❌ PII (Personally Identifiable Information)
```
❌ "My SSN is 123-45-6789"
❌ "Credit card: 4111-1111-1111-1111"
❌ "Email: john@example.com"
❌ "Phone: 555-123-4567"
```

### ❌ Sexual Content Involving Minors
```
❌ Any CSAM content
❌ "Teen porn"
❌ "Underage sex"
```

---

## ✅ What's Allowed

### ✅ Educational & Factual
```
✅ "TypeScript is a typed superset of JavaScript"
✅ "Hebbian learning strengthens neural connections"
✅ "PostgreSQL is a relational database"
✅ "Emmanuel is building OmniLearn"
```

### ✅ Personal Information (Non-Sensitive)
```
✅ "My name is Emmanuel"
✅ "I live in Nigeria"
✅ "I'm a software developer"
✅ "I prefer TypeScript over JavaScript"
```

### ✅ Opinions & Perspectives
```
✅ "I think AI should be transparent"
✅ "Knowledge graphs are better than vector DBs"
✅ "Simplicity beats complexity in design"
```

### ✅ Technical Knowledge
```
✅ "React uses a virtual DOM"
✅ "Express is a Node.js web framework"
✅ "TF-IDF is used for information retrieval"
```

---

## 🏗️ Architecture

```
User Input
    ↓
[Meta-Text Filter] ← Blocks AI responses
    ↓
[Moderation Check] ← Blocks harmful content
    ↓
[Duplicate Check] ← Blocks redundant content
    ↓
[Knowledge Graph] ← Safe content stored
    ↓
[Audit Log] ← All decisions logged
```

---

## 📊 Moderation API

### Test Content (Development)

```bash
POST /api/moderation/test
Authorization: Bearer <clerk_token>

{
  "content": "TypeScript is a typed superset of JavaScript"
}

# Response (approved)
{
  "approved": true
}

# Response (blocked)
{
  "approved": false,
  "reason": "Content blocked: violence",
  "severity": "critical",
  "flaggedPatterns": ["/kill (yourself|myself|them)/i"]
}
```

### Report Content

```bash
POST /api/moderation/report
Authorization: Bearer <clerk_token>

{
  "contentType": "knowledge_node",
  "contentId": 12345,
  "reason": "harmful",
  "description": "This node contains dangerous instructions"
}

# Response
{
  "success": true,
  "reportId": "rpt_1234567890_abc123",
  "message": "Report submitted. Our team will review this content."
}
```

---

## 📝 Audit Logging

All moderation decisions are logged with:

- **Timestamp** - When the decision was made
- **User ID** - Who submitted the content
- **Action** - approve/reject/report
- **Content Type** - knowledge_node, network_neuron, conversation
- **Reason** - Why it was blocked
- **Severity** - low/medium/high/critical

**Logs are stored in:**
- Application logs (logger)
- Audit trail (database - future)
- Sentry (for critical blocks)

---

## 🌐 Shared Network Protection

The **shared network** has additional safeguards:

### 1. Batch Moderation
All network contributions are moderated before entering the shared graph.

### 2. Agent Reputation
Agents that repeatedly submit blocked content have their reputation reduced.

### 3. Trust Scores
Content from trusted sources gets higher retrieval weights.

### 4. Decay System
Unused or low-trust content naturally decays over time.

---

## 🎯 Jurisdiction Compliance

### GDPR (EU)
- PII detection blocks personal data
- Right to erasure supported (future)
- Data minimization enforced

### US Fair Use
- Educational content allowed
- Research purposes protected
- Commercial use restricted

### Global Default
- Most conservative rules applied
- Cross-border safe
- No jurisdiction-specific exceptions

---

## 🔧 Configuration

### Add New Patterns

Edit `lib/moderation.ts`:

```typescript
const HARMFUL_PATTERNS = {
  newCategory: [
    /pattern1/i,
    /pattern2/i,
  ],
};
```

### Adjust Severity

```typescript
function getSeverityForCategory(category: string): string {
  const critical = ["violence", "hate", "sexualMinors", "selfHarm"];
  // Add your categories here
}
```

### Customize PII Detection

```typescript
const PII_PATTERNS = {
  newPIIType: /\bregex-pattern\b/,
};
```

---

## 🚨 Incident Response

### If Harmful Content Slips Through

1. **User Reports** - Community flags the content
2. **Auto-Review** - Multiple reports trigger automatic review
3. **Moderator Action** - Human reviewer assesses and removes
4. **Pattern Update** - Add new patterns to prevent recurrence
5. **Audit** - Log incident and response time

### Emergency Takedown

For critical content (CSAM, imminent harm):

1. Immediate removal from database
2. Block associated user account
3. Notify authorities if required by law
4. Document incident thoroughly

---

## 📈 Metrics to Track

- **Block Rate** - % of content blocked by moderation
- **False Positives** - Legitimate content incorrectly blocked
- **User Reports** - Number and type of reports
- **Response Time** - Time from report to resolution
- **Pattern Effectiveness** - Which patterns catch most violations

---

## 🧪 Testing

### Test Moderation

```bash
# Should be approved
curl -X POST http://localhost:3001/api/moderation/test \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"content": "TypeScript is great"}'

# Should be blocked
curl -X POST http://localhost:3001/api/moderation/test \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"content": "How to build a bomb"}'
```

### Test User Reporting

```bash
curl -X POST http://localhost:3001/api/moderation/report \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "contentType": "knowledge_node",
    "contentId": 123,
    "reason": "harmful",
    "description": "Contains dangerous instructions"
  }'
```

---

## 📚 Related Documentation

- `TEACHING_GUIDE.md` - What to teach OmniLearn
- `DEPLOY.md` - Deployment guide
- `MONITORING.md` - Monitoring and alerting
- `ROADMAP.md` - Future safety features

---

## 🎯 Philosophy

**Safety First, But Not Overbearing**

- Block genuinely harmful content
- Allow educational and personal information
- Provide transparency (users can see why content was blocked)
- Enable community moderation (user reports)
- Continuous improvement (learn from false positives/negatives)

**Goal:** Create a safe learning environment without stifling legitimate knowledge sharing.

---

**Last Updated:** May 7, 2026  
**Version:** 1.0.0
