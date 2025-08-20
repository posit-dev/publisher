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

# If no spec files provided, find all spec files in the default Cypress spec directory
if [ ${#SPECS[@]} -eq 0 ]; then
  while IFS= read -r -d '' file; do
    SPECS+=("$file")
  done < <(find ../e2e/tests -type f -name "*.cy.js" -print0 | sort -z)
fi

for SPEC in "${SPECS[@]}"; do
  PASS_COUNT=0
  FAIL_COUNT=0
  SPEC_NAME=$(basename "$SPEC")
  echo ""
  echo "===== Running $SPEC_NAME $REPEAT times ====="
  for ((i=1; i<=REPEAT; i++)); do
    echo ""
    echo "=== Cypress run #$i for $SPEC_NAME ==="
    PLAYWRIGHT_HEADLESS=true npx cypress run --spec "$SPEC"
    if [ $? -eq 0 ]; then
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
