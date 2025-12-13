#!/usr/bin/env bash
set -e

SOURCE_COMMIT_SHA=$1
if [ -z "$SOURCE_COMMIT_SHA" ]; then
  echo "Error: Source commit SHA required."
  exit 1
fi

# Idempotency Check
DATA_BRANCH_EXISTS=$(git rev-parse --verify --quiet refs/heads/data)
if [ -n "$DATA_BRANCH_EXISTS" ]; then
  if git log refs/heads/data --format=%B | grep -q "Projection of $SOURCE_COMMIT_SHA"; then
    echo "Projection for commit $SOURCE_COMMIT_SHA already exists. Skipping."
    exit 0
  fi
fi

# Kernel
STAGING_DIR=$(mktemp -d)
trap 'rm -rf "$STAGING_DIR"' EXIT

ARTIFACTS_DIR="$STAGING_DIR/artifacts"
METADATA_DIR="$STAGING_DIR/metadata"
mkdir -p "$ARTIFACTS_DIR" "$METADATA_DIR"

git archive "$SOURCE_COMMIT_SHA" | tar -x -C "$ARTIFACTS_DIR"
if [ ! -d "$ARTIFACTS_DIR" ] || [ -z "$(ls -A "$ARTIFACTS_DIR")" ]; then
  echo "Error: Failed to extract artifacts."
  exit 1
fi

SOURCE_TREE_SHA=$(git rev-parse "$SOURCE_COMMIT_SHA^{tree}")
echo "{\"source_commit\": \"$SOURCE_COMMIT_SHA\", \"source_tree\": \"$SOURCE_TREE_SHA\"}" > "$METADATA_DIR/commit.json"

# Materializer
export GIT_INDEX_FILE=$(mktemp)
trap 'rm -f "$GIT_INDEX_FILE"' EXIT
export GIT_WORK_TREE="$STAGING_DIR"

git add -A
TREE_SHA=$(git write-tree)
if [ -z "$TREE_SHA" ]; then
  echo "Error: Failed to write tree. Index may be empty."
  exit 1
fi

PARENT_SHA=$(git rev-parse --verify --quiet refs/heads/data || true)
if [ -n "$PARENT_SHA" ]; then
  COMMIT_SHA=$(echo "Projection of $SOURCE_COMMIT_SHA" | git commit-tree "$TREE_SHA" -p "$PARENT_SHA")
else
  COMMIT_SHA=$(echo "Projection of $SOURCE_COMMIT_SHA" | git commit-tree "$TREE_SHA")
fi

git update-ref refs/heads/data "$COMMIT_SHA"
