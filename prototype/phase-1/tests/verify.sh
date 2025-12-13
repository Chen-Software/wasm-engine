#!/usr/bin/env bash
set -e

# --- Test Harness for Git-Native Causal Projection PoC ---

# Helper function for assertions
assert_eq() {
  if [ "$1" != "$2" ]; then
    echo "Assertion failed: '$1' != '$2'"
    exit 1
  fi
}

assert_neq() {
  if [ "$1" == "$2" ]; then
    echo "Assertion failed: '$1' == '$2'"
    exit 1
  fi
}

assert_success() {
  if [ "$1" -ne 0 ]; then
    echo "Command failed with exit code $1"
    exit 1
  fi
}

# --- Test Setup ---
echo "--- Setting up test repository ---"
# Temporarily cd into the script's directory to find the repo root reliably.
SCRIPT_DIR=$(dirname "$0")
cd "$SCRIPT_DIR"
PROJECT_ROOT=$(git rev-parse --show-toplevel)
cd - > /dev/null # Go back to the original directory

TEST_REPO_DIR=$(mktemp -d)
trap 'rm -rf "$TEST_REPO_DIR"' EXIT
cd "$TEST_REPO_DIR"

# Initialize with 'main' as the default branch
git init -b main
# Configure a dummy user for commits
git config user.name "Test User"
git config user.email "test@example.com"

# --- Test Execution ---
echo "--- Verifying P0 (Causality) & P5 (Branch-Local Reasoning) on first commit ---"
echo "hello world" > README.md
git add README.md
git commit -m "Initial commit"
assert_success $?

SOURCE_COMMIT_1=$(git rev-parse HEAD)
"$PROJECT_ROOT/prototype/phase-1/tools/projector.sh" "$SOURCE_COMMIT_1"

# P5: The data branch should now exist.
DATA_BRANCH_EXISTS=$(git rev-parse --verify --quiet refs/heads/data)
if [ -z "$DATA_BRANCH_EXISTS" ]; then
  echo "Invariant P5 failed: data branch was not created on first commit."
  exit 1
fi
DATA_COMMIT_1=$(git rev-parse refs/heads/data)

# P0: Check that the data commit has the correct metadata
METADATA_SHA=$(git ls-tree "$DATA_COMMIT_1" -- "metadata/commit.json" | awk '{print $3}')
git cat-file blob "$METADATA_SHA" | grep -q "\"source_commit\": \"$SOURCE_COMMIT_1\""
assert_success $?

echo "--- Verifying P1 (Determinism) & P3 (Completeness) ---"
# P3: Check that the artifact tree matches the source tree
SOURCE_TREE_1=$(git rev-parse HEAD^{tree})
ARTIFACT_TREE_1=$(git ls-tree "$DATA_COMMIT_1" -- "artifacts" | awk '{print $3}')
assert_eq "$SOURCE_TREE_1" "$ARTIFACT_TREE_1"

echo "--- Verifying P2 (Idempotency) ---"
# Re-run the projector script manually. It should do nothing.
"$PROJECT_ROOT/prototype/phase-1/tools/projector.sh" "$SOURCE_COMMIT_1"
DATA_COMMIT_AFTER_RERUN=$(git rev-parse refs/heads/data)
assert_eq "$DATA_COMMIT_1" "$DATA_COMMIT_AFTER_RERUN"

echo "--- Verifying behavior on a second commit ---"
echo "new content" >> README.md
git commit -am "Second commit"
assert_success $?

SOURCE_COMMIT_2=$(git rev-parse HEAD)
"$PROJECT_ROOT/prototype/phase-1/tools/projector.sh" "$SOURCE_COMMIT_2"
DATA_COMMIT_2=$(git rev-parse refs/heads/data)
assert_neq "$DATA_COMMIT_1" "$DATA_COMMIT_2"

echo "--- All invariants verified successfully! ---"
