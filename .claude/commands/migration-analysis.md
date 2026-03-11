# Go-to-TypeScript Migration Analysis

Analyze the Go backend package dependency graph, compute migration tiers, check existing TypeScript coverage, and generate a migration roadmap.

This command scans the live codebase so results stay accurate as migration progresses. Re-run it anytime to get an updated view.

---

## Step 1: Extract Go Package Inventory

Enumerate all packages under `internal/`, counting source files, lines of code, test files, and subpackages.

Run this bash command:

```bash
echo "=== Go Package Inventory ==="
echo ""
for pkg in internal/*/; do
  pkg_name=$(basename "$pkg")
  go_files=$(find "$pkg" -name '*.go' ! -name '*_test.go' | wc -l | tr -d ' ')
  test_files=$(find "$pkg" -name '*_test.go' | wc -l | tr -d ' ')
  loc=$(find "$pkg" -name '*.go' ! -name '*_test.go' -exec cat {} + 2>/dev/null | wc -l | tr -d ' ')
  subpkgs=$(find "$pkg" -mindepth 1 -type d | wc -l | tr -d ' ')
  echo "$pkg_name: ${go_files} source files, ${loc} LOC, ${test_files} test files, ${subpkgs} subpackages"
done
```

Present the results as a table sorted by LOC descending. Note which packages are the largest (most effort to migrate) and which are smallest (quick wins).

---

## Step 2: Build Dependency Graph

Extract internal import dependencies from non-test Go files. Exclude test files because they import test utilities (e.g., `utiltest`, `loggingtest`) that create false dependencies.

Run this bash command:

```bash
echo "=== Internal Import Dependencies ==="
echo ""
for pkg in internal/*/; do
  pkg_name=$(basename "$pkg")
  deps=$(grep -rh '"github.com/posit-dev/publisher/internal/' "$pkg" --include='*.go' --exclude='*_test.go' 2>/dev/null \
    | sed 's/.*"github.com\/posit-dev\/publisher\/internal\///' \
    | sed 's/".*//' \
    | sort -u)
  if [ -n "$deps" ]; then
    echo "--- $pkg_name imports ---"
    echo "$deps"
    echo ""
  else
    echo "--- $pkg_name imports ---"
    echo "(none - leaf package)"
    echo ""
  fi
done
```

From this output, produce **two views**:

### Top-Level Grouping
Show each package and the top-level packages it depends on. For example:
```
config -> [clients, contenttypes, interpreters, logging, schema, types, util]
```

### Subpackage-Level Detail
Where a package imports a subpackage (e.g., `clients/types` rather than `clients` root), note this specifically. This matters because subpackages like `clients/types` can potentially be migrated independently of the full parent package.

---

## Step 3: Compute Migration Tiers

Using the dependency data from Step 2, compute migration tiers using an iterative algorithm. Run this as a Python script, filling in the dependency dictionary from the Step 2 results:

```bash
python3 -c "
import sys

# Fill this dict from Step 2 output.
# Key = package name, Value = set of top-level packages it depends on.
# IMPORTANT: Use only top-level package names (e.g., 'clients' not 'clients/types').
# Exclude self-references.
deps = {
    # Claude: populate this from the grep output above, e.g.:
    # 'accounts': {'clients', 'credentials', 'logging', 'types', 'util'},
    # 'bundles': {'clients', 'config', 'logging', 'types', 'util'},
    # ...leaf packages have empty sets:
    # 'contenttypes': set(),
    # 'logging': set(),
}

all_pkgs = set(deps.keys())
assigned = {}
tier = 0

while True:
    current_tier = set()
    for pkg in all_pkgs - set(assigned.keys()):
        pkg_deps = deps[pkg] - {pkg}  # exclude self-refs
        if pkg_deps.issubset(set(assigned.keys())):
            current_tier.add(pkg)
    if not current_tier:
        break
    for pkg in current_tier:
        assigned[pkg] = tier
    tier += 1

unassigned = all_pkgs - set(assigned.keys())

print('=== Migration Tiers ===')
print()
for t in range(tier):
    pkgs_in_tier = sorted([p for p, v in assigned.items() if v == t])
    print(f'Tier {t}: {pkgs_in_tier}')
print()

if unassigned:
    print(f'CIRCULAR DEPENDENCIES (unassigned): {sorted(unassigned)}')
    print('These packages form dependency cycles and need manual analysis.')
    # Show the remaining deps for cycle analysis
    for pkg in sorted(unassigned):
        remaining = deps[pkg] & unassigned
        print(f'  {pkg} -> {sorted(remaining)}')
else:
    print('No circular dependencies detected - all packages assigned to tiers.')
"
```

**IMPORTANT**: You must fill in the `deps` dictionary with the actual data from Step 2 before running this script. Each key is a top-level package name, and each value is the set of top-level packages it imports (excluding itself).

Present the tier results and explain:
- **Tier 0**: Leaf packages with no internal dependencies — migrate these first
- **Tier 1**: Packages that only depend on Tier 0 packages
- **Tier N**: Packages whose dependencies are all in tiers 0 through N-1
- **Circular**: Packages in dependency cycles that need special handling (break the cycle by migrating subpackages first)

---

## Step 4: Check Existing TypeScript Coverage

Search the TypeScript codebase for files that correspond to Go packages. This helps identify what's already been migrated or has partial TypeScript equivalents.

Search these key locations:

```bash
echo "=== TypeScript Coverage Check ==="
echo ""

echo "--- Type definitions (extensions/vscode/src/api/types/) ---"
find extensions/vscode/src/api/types/ -name '*.ts' 2>/dev/null | sort

echo ""
echo "--- API resources (extensions/vscode/src/api/resources/) ---"
find extensions/vscode/src/api/resources/ -name '*.ts' 2>/dev/null | sort

echo ""
echo "--- Top-level modules ---"
find extensions/vscode/src/ -maxdepth 1 -name '*.ts' 2>/dev/null | sort

echo ""
echo "--- Connect client ---"
find extensions/vscode/src/api/ -name '*.ts' 2>/dev/null | sort
```

For each Go package, note whether a TypeScript equivalent exists:
- **Full coverage**: A TypeScript module covers the same functionality
- **Partial coverage**: Some types or functions exist but the package isn't fully ported
- **No coverage**: No TypeScript equivalent found yet

Read key TypeScript files to understand what types and interfaces are already defined. Pay attention to:
- Type definitions that mirror Go structs
- API client methods that mirror Go client functions
- Enum definitions (e.g., `ServerType`, `ContentType`)

---

## Step 5: Reverse Dependency Analysis

Compute which packages are depended on by the most other packages. These are high-risk migration targets because many consumers need to be updated when their API changes.

Run this bash command:

```bash
echo "=== Reverse Dependencies (who depends on each package) ==="
echo ""
for target in internal/*/; do
  target_name=$(basename "$target")
  dependents=""
  for pkg in internal/*/; do
    pkg_name=$(basename "$pkg")
    if [ "$pkg_name" = "$target_name" ]; then continue; fi
    if grep -rqh "\"github.com/posit-dev/publisher/internal/${target_name}" "$pkg" --include='*.go' --exclude='*_test.go' 2>/dev/null; then
      dependents="$dependents $pkg_name"
    fi
  done
  count=$(echo "$dependents" | wc -w | tr -d ' ')
  if [ "$count" -gt 0 ]; then
    echo "$target_name (depended on by $count packages):$dependents"
  else
    echo "$target_name (depended on by 0 packages)"
  fi
done | sort -t'(' -k2 -rn
```

Identify:
- **Foundation packages** (depended on by 5+ packages): Need very careful API design during migration since many consumers rely on them
- **Mid-tier packages** (depended on by 2-4 packages): Moderate risk
- **Isolated packages** (depended on by 0-1 packages): Low risk, can be migrated with minimal impact

---

## Step 6: Generate Migration Roadmap

Compile all the analysis into a comprehensive report. Format it as follows:

### Dependency Visualization

Create an ASCII visualization of the dependency tiers:

```
Tier 0 (leaf packages - no internal deps):
  [contenttypes] [logging] [project] [server_type] ...

Tier 1 (depends only on Tier 0):
  [types] [util] ...
    |       |
    v       v

Tier 2 (depends on Tier 0-1):
  [schema] [events] ...
    |
    v

... and so on
```

### Migration Tiers Detail

For each tier, list the packages with:
- Lines of code (from Step 1)
- Number of subpackages
- Internal dependencies
- TypeScript coverage status (from Step 4)
- Reverse dependency count (from Step 5)
- Recommended migration order within the tier (smallest/simplest first)

### Subpackage Extraction Opportunities

Identify cases where a package imports only a subpackage of another package (from Step 2 subpackage-level detail). These represent opportunities to:
- Migrate the subpackage independently
- Break apparent cycles (e.g., if `config` imports `clients/types` but not the full `clients` package)

### Risk Assessment

For each foundation package (high reverse dependency count):
- List all consumers
- Note API surface area (exported functions/types)
- Flag if it's in a dependency cycle
- Recommend whether to migrate it early (to unblock others) or late (to stabilize the API first)

### Recommended Migration Order

Provide a numbered list of packages in recommended migration order, considering:
1. Tier assignment (lower tiers first)
2. Within each tier: smallest LOC first
3. Foundation packages may be prioritized despite size if they unblock many others
4. Packages with existing TypeScript coverage can be prioritized as quick wins

---

## Notes

- This analysis excludes test file imports (`*_test.go`) because test helpers like `utiltest` and `loggingtest` create dependencies that don't exist in production code.
- Subpackage-level detail is important: `config` importing `clients/types` is very different from `config` importing the full `clients` package with its HTTP client logic.
- Re-run this command periodically as migration progresses to get updated tier assignments and coverage status.
- The Python tier computation may show circular dependencies. These typically need to be broken by extracting shared types into a separate package or migrating subpackages independently.
