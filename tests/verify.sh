#!/bin/bash
set -e

echo "--- Running Verification Harness for Architectural Invariants ---"

# --- Setup ---
# Create a temporary directory for the test repository.
TEST_REPO_DIR=$(mktemp -d)
trap 'rm -rf "$TEST_REPO_DIR"' EXIT

# Copy the necessary scripts into the test environment.
cp -r .githooks tools SPEC.md "$TEST_REPO_DIR"

cd "$TEST_REPO_DIR"

# Initialize a new Git repository.
git init --initial-branch=main
git config user.name "Test User"
git config user.email "test@example.com"
git config core.hooksPath .githooks
# Suppress noisy detached head advice
git config advice.detachedHead false


# --- Helper Functions ---
assert_eq() {
  if [ "$1" != "$2" ]; then
    echo "❌ ASSERTION FAILED: '$1' != '$2'" >&2
    exit 1
  fi
}

assert_true() {
  if ! "$@"; then
    echo "❌ ASSERTION FAILED: command returned non-zero status: '$*'" >&2
    exit 1
  fi
}

assert_false() {
    if "$@"; then
        echo "❌ ASSERTION FAILED: command returned zero status: '$*'" >&2
        exit 1
    fi
}

get_data_head_tree() {
  git rev-parse --verify data^{tree} 2>/dev/null
}

get_data_head_commit() {
  git rev-parse --verify data 2>/dev/null
}

get_metadata_source_commit() {
  git show data:metadata/commit.json | grep source_commit | cut -d '"' -f 4
}


# --- Test Cases ---

echo -e "\n[TEST 1] Genesis Commit and Initial Projection"
# P0 (Causality) & P3 (Completeness)
echo "hello world" > README.md
git add README.md
git commit -m "feat: initial commit"
MAIN_COMMIT_1=$(git rev-parse HEAD)

assert_true git rev-parse --verify data >/dev/null
assert_eq "$MAIN_COMMIT_1" "$(get_metadata_source_commit)"
echo "✅ PASSED"


echo -e "\n[TEST 2] Idempotence (P2)"
# Re-running the projector on the same commit should not create a new data commit.
DATA_COMMIT_1=$(get_data_head_commit)
./tools/projector.sh "$MAIN_COMMIT_1"
assert_eq "$DATA_COMMIT_1" "$(get_data_head_commit)"
echo "✅ PASSED"


echo -e "\n[TEST 3] Completeness (P3)"
# The reconstructed tree should match the source tree.
RECONSTRUCTION_DIR=$(mktemp -d)
mkdir -p "$RECONSTRUCTION_DIR"
./tools/reconstruct.sh "$RECONSTRUCTION_DIR"
assert_true test -f "$RECONSTRUCTION_DIR/README.md"
assert_eq "hello world" "$(cat "$RECONSTRUCTION_DIR/README.md")"
rm -rf "$RECONSTRUCTION_DIR"
echo "✅ PASSED"


echo -e "\n[TEST 4] Unidirectional Authority (P4)"
# Commits on the data branch must not trigger the projection hook.
git checkout data
echo "data only" > data_file.txt
git add data_file.txt
git commit -m "chore: commit directly to data branch"
# No new commit should be created by the hook. The head is our manual commit.
assert_eq "chore: commit directly to data branch" "$(git log -1 --pretty=%s)"
git checkout main
echo "✅ PASSED"


echo -e "\n[TEST 5] Content Change Projection"
# A change in content should produce a new data commit.
DATA_COMMIT_BEFORE_CHANGE=$(get_data_head_commit)
echo "new content" > README.md
git commit -am "feat: update README"
MAIN_COMMIT_2=$(git rev-parse HEAD)

assert_false [ "$DATA_COMMIT_BEFORE_CHANGE" = "$(get_data_head_commit)" ]
assert_eq "$MAIN_COMMIT_2" "$(get_metadata_source_commit)"
echo "✅ PASSED"


echo -e "\n[TEST 6] Empty Merge Commit (Causality)"
# An empty merge commit has a new SHA but the same tree. It should still
# produce a new data commit because the causal link (source_commit) has changed.
DATA_COMMIT_BEFORE_MERGE=$(get_data_head_commit)
git checkout -b feature
git checkout main
git merge --no-ff --no-edit -m "feat: empty merge" feature
MAIN_COMMIT_3=$(git rev-parse HEAD)
DATA_COMMIT_AFTER_MERGE=$(get_data_head_commit)

assert_false [ "$DATA_COMMIT_BEFORE_MERGE" = "$DATA_COMMIT_AFTER_MERGE" ]
assert_eq "$MAIN_COMMIT_3" "$(get_metadata_source_commit)"
echo "✅ PASSED"


echo -e "\n[TEST 7] Branch Divergence / Force-Push (Branch-Local Reasoning, P5)"
# The data branch is a log of observations. If main is reset and diverges,
# the data branch should simply project the new state without being affected
# by its own history.
git reset --hard "$MAIN_COMMIT_1" # Go back to the first commit
echo "divergent content" > new_file.txt
git add new_file.txt
git commit -m "feat: diverge from history"
MAIN_COMMIT_4=$(git rev-parse HEAD)

assert_eq "$MAIN_COMMIT_4" "$(get_metadata_source_commit)"

RECONSTRUCTION_DIR=$(mktemp -d)
mkdir -p "$RECONSTRUCTION_DIR"
./tools/reconstruct.sh "$RECONSTRUCTION_DIR"
assert_true test -f "$RECONSTRUCTION_DIR/new_file.txt"
assert_false test -f "$RECONSTRUCTION_DIR/README.md" # The README was in the reset history
rm -rf "$RECONSTRUCTION_DIR"
echo "✅ PASSED"

echo -e "\n--- All Invariants Verified Successfully ---"
