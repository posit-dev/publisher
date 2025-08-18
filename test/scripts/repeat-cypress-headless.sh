#!/bin/bash

REPEAT=5  # Default repeat count
SPECS=()
TOTAL_PASS=0
TOTAL_FAIL=0
SPEC_NAMES=()
SPEC_PASSES=()
SPEC_FAILS=()

# Parse arguments
for arg in "$@"; do
  if [[ $arg == REPEAT=* ]]; then
    REPEAT="${arg#REPEAT=}"
  else
    SPECS+=("$arg")
  fi
done

# If no specs provided, run all tests as one group
if [ ${#SPECS[@]} -eq 0 ]; then
  SPECS=("")
fi

for SPEC in "${SPECS[@]}"; do
  PASS_COUNT=0
  FAIL_COUNT=0
  if [ -n "$SPEC" ]; then
    SPEC_ARG="--spec $SPEC"
    echo ""
    echo "===== Running $SPEC $REPEAT times ====="
    SPEC_NAME="$SPEC"
  else
    SPEC_ARG=""
    echo ""
    echo "===== Running ALL TESTS $REPEAT times ====="
    SPEC_NAME="ALL TESTS"
  fi
  for ((i=1; i<=REPEAT; i++)); do
    echo ""
    echo "=== Cypress run #$i for $SPEC ==="
    if npx cypress run $SPEC_ARG; then
      echo "Run #$i PASSED"
      ((PASS_COUNT++))
      ((TOTAL_PASS++))
    else
      echo "Run #$i FAILED"
      ((FAIL_COUNT++))
      ((TOTAL_FAIL++))
    fi
  done
  SPEC_NAMES+=("$SPEC_NAME")
  SPEC_PASSES+=("$PASS_COUNT")
  SPEC_FAILS+=("$FAIL_COUNT")
done

echo ""
echo "========== PER-FILE SUMMARY =========="
for idx in "${!SPEC_NAMES[@]}"; do
  echo "--- ${SPEC_NAMES[$idx]} ---"
  echo "Total runs: $REPEAT"
  echo "Passed:     ${SPEC_PASSES[$idx]}"
  echo "Failed:     ${SPEC_FAILS[$idx]}"
  echo "----------------------"
done
echo "======================================"
echo ""
echo "========== OVERALL SUMMARY =========="
echo "Total runs: $((REPEAT * ${#SPECS[@]}))"
echo "Passed:     $TOTAL_PASS"
echo "Failed:     $TOTAL_FAIL"
echo "====================================="
