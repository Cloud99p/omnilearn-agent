# OmniLearn API Server

The brain of the OmniLearn agent system — a self-improving AI with personality evolution, Hebbian learning, ontology reflection, and multi-agent networking.

## Architecture

### Core Systems

1. **Character System** (`src/brain/character.ts`)
   - 7 personality traits: curiosity, caution, confidence, verbosity, technical, empathy, creativity
   - Soft-cap mechanism prevents extreme trait values
   - Automatic rebalancing toward equilibrium
   - Voice modulation based on trait states

2. **Hebbian Learning** (`src/brain/hebbian.ts`)
   - Cryptographic proof system for knowledge connections
   - Multi-validator voting (proof, semantic, freshness, graph, consistency)
   - Proposal creation, validation, and application
   - Evidence-based edge formation in knowledge graph

3. **Ontology Reflection** (`src/brain/ontology.ts`)
   - Self-reflection engine for knowledge graph structure
   - Operations: new-edge-type, split-node, merge-nodes, demote-rule
   - Jaccard similarity for duplicate detection
   - Automatic proposal generation for graph optimization

4. **Multi-Agent Network** (`src/brain/network.ts`)
   - Trust score calculation (domain × 0.4 + accuracy × 0.4 + topology × 0.2)
   - Phase-based reputation: Observer → Probationary → Voting Member
   - Weighted voting system
   - Hebbian synaptic decay

## Development

### Prerequisites

- Node.js 24.x
- pnpm >= 10.0.0
- PostgreSQL database

### Installation

```bash
pnpm install
```

### Running

```bash
# Development mode
pnpm dev

# Type checking
pnpm typecheck
```

## Testing

**CRITICAL**: This system has 7 personality traits, Hebbian learning, ontology reflection, and a multi-agent network. One bug in personality evolution and the agent starts acting schizophrenic. **Tests are mandatory, not optional.**

### Running Tests

```bash
# Run all tests (120 tests, ~3 seconds)
pnpm test

# Watch mode (re-runs on file changes)
pnpm test:watch

# With coverage report
pnpm test:coverage
```

### Test Suite Status

✅ **120 tests passing** across 5 test files:

| Module | Tests | Focus |
|--------|-------|-------|
| Character | 26 | Trait deltas, soft caps, rebalancing, voice |
| Hebbian | 20 | Proof construction, validation, tamper detection |
| Ontology | 23 | Proposal validation, execution, heuristics |
| Network | 39 | Trust scores, phases, voting, decay |
| Integration | 12 | Cross-system interactions, stability |

See `tests/README.md` for detailed documentation.

### Test Categories

#### Unit Tests
- Pure function testing (clamp, deltas, hashes, similarity)
- No database dependencies
- Fast execution (<100ms per test)

#### Integration Tests
- Cross-system interactions
- State consistency across modules
- Recovery from extreme states

### Adding New Tests

1. Create test file in `tests/` directory
2. Use descriptive test names: `should [expected behavior] when [condition]`
3. Test edge cases: empty inputs, boundary values, null/undefined
4. Test failure modes: invalid inputs, tampered data, timeout scenarios

Example:
```typescript
describe('YourModule', () => {
  it('should handle edge case gracefully', () => {
    const result = yourFunction(extremeInput);
    expect(result).toBeWithin(safeRange);
  });
});
```

### Critical Test Scenarios

**Personality System:**
- ✅ Soft cap prevents traits from reaching 100
- ✅ Rebalancing moves extreme traits toward 50
- ✅ Negative deltas don't produce negative trait values
- ✅ Technical/emotional content detection works

**Hebbian System:**
- ✅ Proof changes with any input modification
- ✅ Validation detects tampered evidence
- ✅ Freshness check rejects old proposals (>72h)
- ✅ Quorum calculation is correct (60% of validators)

**Ontology System:**
- ✅ Merge detection uses Jaccard similarity
- ✅ Split detection identifies over-broad nodes
- ✅ Demotion triggers on low-confidence rules
- ✅ Cooldown prevents reflection loops

**Network System:**
- ✅ Trust score weights are correct (40/40/20)
- ✅ Phase transitions at correct boundaries (30/90 days, 0.3/0.7 trust)
- ✅ Observer phase has zero voting weight
- ✅ Decay reduces weights but respects minimums

## Database Schema

Key tables:
- `knowledge_nodes` — Learned facts and concepts
- `knowledge_edges` — Hebbian connections between nodes
- `hebbian_proposals` — Pending edge modifications
- `ontology_nodes` — Vocabulary and structure definitions
- `ontology_proposals` — Pending structural changes
- `network_neurons` — Distributed knowledge units
- `network_synapses` — Inter-neuron connections
- `network_agents` — Agent reputation and phase
- `network_votes` — Weighted voting records

## Security

### Content Moderation
All network contributions pass through moderation before storage.

### Proof Integrity
- SHA-256 hashes for evidence and proposals
- Timestamp-based freshness validation
- Multi-validator consensus for Hebbian changes

### Reputation System
- Minimum 30 submissions for accuracy scoring
- 90-day maturation period for full voting rights
- Domain diversity prevents single-source dominance

## API Endpoints

See `src/routes/` for available endpoints:
- `/api/brain/*` — Knowledge and character operations
- `/api/network/*` — Multi-agent network operations
- `/api/ontology/*` — Ontology reflection operations

## Monitoring

### Health Checks
- Reflection cycle completion
- Proposal validation rates
- Network decay cycles
- Trait rebalancing events

### Logging
All operations logged via Pino with structured JSON output.

## License

AGPL-3.0-or-later

## Author

Emmanuel Nenpan Hosea <emmanuel@omnilearn.dpdns.org>
