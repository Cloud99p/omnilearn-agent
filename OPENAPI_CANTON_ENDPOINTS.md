# Canton Integration - OpenAPI Endpoints

## Overview

This document lists the new API endpoints added for Canton RWA integration.

**These endpoints are ADDITIONS only** - they do not modify existing OmniLearn endpoints.

---

## Base URL

```
/api/canton
```

---

## Asset Management

### POST `/api/canton/assets`

**Create a new RWA asset on Canton Network**

**Request Body:**
```json
{
  "name": "Treasury Bond 2026-A",
  "type": "treasury-bond",
  "totalValue": 1000000,
  "currency": "USD",
  "tokensCount": 1000,
  "maturityDate": "2027-06-30",
  "jurisdiction": "US",
  "metadata": {
    "issuer": "Federal Reserve",
    "rating": "AAA"
  }
}
```

**Response:**
```json
{
  "id": "rwa_1234567890",
  "name": "Treasury Bond 2026-A",
  "type": "treasury-bond",
  "totalValue": 1000000,
  "currency": "USD",
  "tokensMinted": 1000,
  "tokenValue": 1000,
  "issuer": "did:example:issuer123",
  "issueDate": "2026-07-06T14:39:00Z",
  "maturityDate": "2027-06-30T00:00:00Z",
  "jurisdiction": "US",
  "compliance": {
    "kycVerified": true,
    "amlPassed": true,
    "accreditedInvestor": true,
    "jurisdictionAllowed": true,
    "lockupDays": 90,
    "restrictions": []
  },
  "txId": "tx_abc123def456",
  "metadata": "{\"issuer\":\"Federal Reserve\",\"rating\":\"AAA\"}"
}
```

---

### GET `/api/canton/assets/:assetId`

**Get details for a specific RWA asset**

**Response:**
```json
{
  "id": "rwa_1234567890",
  "name": "Treasury Bond 2026-A",
  "type": "treasury-bond",
  "totalValue": 1000000,
  "currency": "USD",
  "tokensMinted": 1000,
  "tokenValue": 1000,
  "issuer": "did:example:issuer123",
  "issueDate": "2026-07-06T14:39:00Z",
  "maturityDate": "2027-06-30T00:00:00Z",
  "jurisdiction": "US",
  "holders": [
    {
      "did": "did:example:holder1",
      "tokens": 50,
      "acquiredAt": "2026-07-06T15:00:00Z"
    }
  ],
  "compliance": { ... }
}
```

---

### GET `/api/canton/assets`

**List all RWA assets (with optional filters)**

**Query Parameters:**
- `issuer` (optional) - Filter by issuer DID
- `type` (optional) - Filter by asset type
- `jurisdiction` (optional) - Filter by jurisdiction

**Response:**
```json
[
  {
    "id": "rwa_1234567890",
    "name": "Treasury Bond 2026-A",
    "type": "treasury-bond",
    "totalValue": 1000000,
    "tokensMinted": 1000,
    "issuer": "did:example:issuer123",
    "issueDate": "2026-07-06T14:39:00Z"
  }
]
```

---

## Token Transfers

### POST `/api/canton/transfer`

**Transfer RWA tokens between holders**

**Request Body:**
```json
{
  "assetId": "rwa_1234567890",
  "tokens": 10,
  "from": "did:example:holder1",
  "to": "did:example:holder2",
  "checkCompliance": true
}
```

**Response:**
```json
{
  "txId": "tx_xyz789abc123",
  "status": "confirmed",
  "timestamp": "2026-07-06T14:40:00Z"
}
```

---

## Audit & Compliance

### POST `/api/canton/audit`

**Generate compliance/audit report**

**Request Body:**
```json
{
  "assetId": "rwa_1234567890",  // Optional - omit for full audit
  "startDate": "2026-01-01",
  "endDate": "2026-12-31",
  "includeCompliance": true,
  "format": "json"  // or "pdf", "csv"
}
```

**Response:**
```json
{
  "id": "audit_1234567890",
  "generatedAt": "2026-07-06T14:41:00Z",
  "assets": [...],
  "holders": [...],
  "transactions": [...],
  "compliance": {
    "totalHolders": 15,
    "kycVerified": 15,
    "amlPassed": 15,
    "violations": []
  }
}
```

---

### GET `/api/canton/audit/:assetId`

**Get audit report for specific asset**

**Response:** Same as POST `/api/canton/audit`

---

## Portfolio & Holdings

### GET `/api/canton/portfolio/:did`

**Get portfolio for a specific holder DID**

**Response:**
```json
{
  "did": "did:example:holder1",
  "totalValue": 50000,
  "holdings": [
    {
      "assetId": "rwa_1234567890",
      "assetName": "Treasury Bond 2026-A",
      "tokens": 50,
      "value": 50000,
      "acquiredAt": "2026-07-06T15:00:00Z"
    }
  ],
  "transactions": [
    {
      "id": "tx_001",
      "type": "buy",
      "tokens": 50,
      "timestamp": "2026-07-06T15:00:00Z"
    }
  ]
}
```

---

### GET `/api/canton/transactions`

**Get transaction history (with optional filters)**

**Query Parameters:**
- `assetId` (optional) - Filter by asset
- `holder` (optional) - Filter by holder DID
- `limit` (optional, default: 100) - Max results
- `offset` (optional) - Pagination offset

**Response:**
```json
{
  "total": 150,
  "transactions": [
    {
      "id": "tx_001",
      "assetId": "rwa_1234567890",
      "type": "transfer",
      "from": "did:example:holder1",
      "to": "did:example:holder2",
      "tokens": 10,
      "timestamp": "2026-07-06T14:40:00Z",
      "status": "confirmed"
    }
  ]
}
```

---

## Utility Endpoints

### GET `/api/canton/tokenize`

**Calculate optimal tokenization parameters**

**Query Parameters:**
- `type` (required) - Asset type
- `totalValue` (required) - Total value to tokenize
- `targetMarket` (optional) - 'retail' or 'institutional'

**Response:**
```json
{
  "assetType": "treasury-bond",
  "totalValue": 1000000,
  "currency": "USD",
  "recommendedTokens": 1000,
  "tokenFaceValue": 1000,
  "minInvestment": 1000,
  "targetInvestor": "wholesale",
  "rationale": "Wholesale bond market standard ($1K minimum, similar to traditional bonds)"
}
```

---

### POST `/api/canton/validate`

**Validate asset issuance parameters**

**Request Body:**
```json
{
  "name": "Treasury Bond 2026-A",
  "type": "treasury-bond",
  "totalValue": 1000000,
  "tokensCount": 1000
}
```

**Response:**
```json
{
  "valid": true,
  "errors": []
}
```

---

## Integration Notes

### Existing OmniLearn Endpoints (UNCHANGED)

All existing OmniLearn endpoints continue to work exactly as before:

- `POST /api/omni/chat` - AI chat with knowledge graph
- `GET /api/omni/knowledge` - Browse knowledge nodes
- `POST /api/omni/train` - Manual training
- `GET /api/omni/character` - Character state
- `POST /api/omni/benchmark` - Intelligence benchmarks

### How Canton Integrates

The Canton module **calls into** OmniLearn core:

1. **Asset metadata** → Stored in knowledge graph
2. **Transaction proofs** → Added to cryptographic proof chain
3. **Compliance data** → Trained into character system (role-based behavior)
4. **Audit reports** → Indexed in knowledge graph for retrieval

**No existing code is modified** - Canton is a pure add-on.

---

## Authentication

All endpoints use the same authentication as existing OmniLearn:

- **Clerk JWT** for authenticated users
- **API key** for service-to-service calls
- **Rate limiting**: 100 requests per 15 minutes per IP

---

## Error Responses

Standard error format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Asset name is required",
    "details": {
      "field": "name",
      "reason": "Field cannot be empty"
    }
  }
}
```

---

## Testing

### Test Data

For development/testing, use these endpoints to create test data:

```bash
# Create test asset
curl -X POST http://localhost:3000/api/canton/assets \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Bond",
    "type": "treasury-bond",
    "totalValue": 10000,
    "tokensCount": 100
  }'

# Generate test audit report
curl -X POST http://localhost:3000/api/canton/audit \
  -H "Content-Type: application/json" \
  -d '{
    "format": "json"
  }'
```

---

## Next Steps

1. Add these endpoints to `lib/api-spec/openapi.yaml` (add section, don't replace)
2. Implement backend routes in `artifacts/api-server/src/routes-canton.ts`
3. Update frontend to use new components
4. Deploy to production

---

*This document is ADDITIVE - it does not replace existing API documentation.*
