# Test Suite Documentation

## Overview

This test suite provides comprehensive coverage for the OmniLearn API Server's core systems:
- **Character System**: 7 personality traits with evolution, soft caps, and rebalancing
- **Hebbian Learning**: Cryptographic proof system for knowledge connections
- **Ontology Reflection**: Self-reflection engine for knowledge graph optimization
- **Multi-Agent Network**: Trust scores, voting, and reputation system

## Running Tests

```bash
# Run all tests
pnpm test

# Watch mode (re-runs on file changes)
pnpm test:watch

# With coverage report
pnpm test:coverage
```

## Test Files

| File | Tests | Description |
|------|-------|-------------|
| `character.test.ts` | 26 | Personality trait deltas, soft caps, rebalancing, voice modifiers |
| `hebbian.test.ts` | 20 | Proof construction, validation, voting, tamper detection |
| `ontology.test.ts` | 23 | Proposal validation, execution, reflection heuristics |
| `network.test.ts` | 39 | Trust scores, phases, voting weights, decay |
| `integration.test.ts` | 12 | Cross-system interactions, stability, edge cases |
| **Total** | **120** | **Comprehensive coverage** |

## Test Categories

### Unit Tests (Pure Functions)
- No database dependencies
- Fast execution (<100ms total)
- Test mathematical correctness
- Edge case handling

### Integration Tests
- Cross-module interactions
- State consistency
- Recovery from extreme states
- System stability

## Critical Test Scenarios

### Character System
✅ Soft cap prevents traits from reaching 100  
✅ Rebalancing moves extreme traits toward 50  
✅ Negative deltas don't produce negative trait values  
✅ Technical/emotional content detection works  

### Hebbian System
✅ Proof changes with any input modification  
✅ Validation detects tampered evidence  
✅ Freshness check rejects old proposals (>72h)  
✅ Quorum calculation is correct (60% of validators)  

### Ontology System
✅ Merge detection uses Jaccard similarity  
✅ Split detection identifies over-broad nodes  
✅ Demotion triggers on low-confidence rules  
✅ Cooldown prevents reflection loops  

### Network System
✅ Trust score weights are correct (40/40/20)  
✅ Phase transitions at correct boundaries (30/90 days, 0.3/0.7 trust)  
✅ Observer phase has zero voting weight  
✅ Decay reduces weights but respects minimums  

## Test Coverage Goals

| Module | Current | Goal |
|--------|---------|------|
| character.ts | ~95% | 95% |
| hebbian.ts | ~80%* | 90% |
| ontology.ts | ~75%* | 90% |
| network.ts | ~85%* | 95% |

*Database-dependent functions require integration tests with test database

## Adding New Tests

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

## Mocking Database Dependencies

For unit tests, mock the database module:

```typescript
import { vi } from 'vitest';

vi.mock('@workspace/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
  // Add schema tables as needed
}));
```

## Continuous Integration

Tests run automatically on:
- Pull requests
- Main branch merges
- Weekly scheduled runs (Sundays at 2 AM UTC)

## Known Limitations

1. **Database-dependent functions**: Require integration test setup with test database
2. **External API calls**: Mocked in unit tests
3. **Time-dependent logic**: Use mocked timestamps for consistency

## Troubleshooting

### Tests fail with "DATABASE_URL must be set"
→ Ensure database mocks are set up correctly in test file

### Tests fail with "function is not exported"
→ Test only exported functions, or test internal logic locally

### Coverage report shows low coverage
→ Add tests for edge cases and error handling paths

## Performance Benchmarks

- Total test suite: <3 seconds
- Individual test files: <100ms each
- Watch mode: Instant re-runs on file changes

## Security Testing

The test suite includes security-focused tests:
- Proof tamper detection
- Hash collision resistance
- Freshness validation
- Vote weight restrictions
- Phase-based access control

## Future Test Additions

- [ ] Load testing for concurrent proposal validation
- [ ] Property-based testing for mathematical functions
- [ ] End-to-end tests with test database
- [ ] Performance regression tests
- [ ] Fuzzing for input validation

---

**Last Updated**: 2026-05-24  
**Test Count**: 120 passing  
**Coverage**: ~85% (unit tests only)
