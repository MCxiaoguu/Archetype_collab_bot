#!/bin/bash
set -e
echo "=== Running all test suites ==="

if [ -d "Archetype_Backend/_tests" ]; then
  echo "--- Backend tests ---"
  cd Archetype_Backend && uv run pytest _tests/ -v && cd ..
fi

if [ -f "archetype_frontend/package.json" ]; then
  echo "--- Frontend tests ---"
  cd archetype_frontend && npm test -- --run && cd ..
fi

if [ -d "exps/tests" ]; then
  echo "--- Exps tests ---"
  cd exps && PYTHONPATH=. uv run --project . -- python -m pytest tests/ -v --ignore=tests/test_notte_e2e_smoke.py && cd ..
fi

echo "=== All tests complete ==="
