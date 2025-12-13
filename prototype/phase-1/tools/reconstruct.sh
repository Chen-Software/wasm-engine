#!/bin/bash
set -e

OUTPUT_DIR=${1:-reconstructed_tree}

# Ensure the output directory is clean and exists.
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# Get the latest commit on the data branch.
DATA_COMMIT_SHA=$(git rev-parse refs/heads/data)

if [ -z "$DATA_COMMIT_SHA" ]; then
  echo "Error: The 'data' branch does not exist."
  exit 1
fi

# Get the tree SHA for the 'artifacts' directory.
ARTIFACTS_TREE_SHA=$(git ls-tree "$DATA_COMMIT_SHA" -- "artifacts" | awk '{print $3}')

if [ -z "$ARTIFACTS_TREE_SHA" ]; then
  echo "Error: Could not find 'artifacts' directory in the latest data branch commit."
  exit 1
fi

# Use git archive to extract the artifacts tree to the output directory.
git archive "$ARTIFACTS_TREE_SHA" | tar -x -C "$OUTPUT_DIR"

echo "Successfully reconstructed artifacts to '$OUTPUT_DIR'"
