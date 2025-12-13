#!/bin/bash
set -e

# This script serves as the proof for Invariant P3 (Completeness).
# It reconstructs the source working tree from the artifacts stored in the
# latest commit on the data branch.

# --- Configuration ---
DATA_BRANCH="data"
ARTIFACTS_DIR="artifacts"

# --- Input Validation ---
TARGET_DIR="$1"
if [ -z "$TARGET_DIR" ]; then
  echo "Error: A target directory for the reconstruction must be provided." >&2
  echo "Usage: $0 <path/to/target/directory>" >&2
  exit 1
fi

if [ ! -d "$TARGET_DIR" ]; then
  echo "Error: Target directory '$TARGET_DIR' does not exist." >&2
  exit 1
fi

if [ -n "$(ls -A "$TARGET_DIR")" ]; then
  echo "Error: Target directory '$TARGET_DIR' must be empty." >&2
  exit 1
fi

# --- Reconstruction Logic ---
# Find the latest commit on the data branch.
DATA_BRANCH_HEAD_SHA=$(git rev-parse --verify "refs/heads/$DATA_BRANCH" 2>/dev/null)
if [ -z "$DATA_BRANCH_HEAD_SHA" ]; then
  echo "Error: Data branch '$DATA_BRANCH' not found." >&2
  exit 1
fi

echo "Reconstructing snapshot from data commit: $DATA_BRANCH_HEAD_SHA"

# Archive the contents of the 'artifacts' directory from the data commit
# and extract it into the target directory.
git archive --format=tar "$DATA_BRANCH_HEAD_SHA" "$ARTIFACTS_DIR" | tar -x -C "$TARGET_DIR" --strip-components=1

echo "Reconstruction complete. Files are in '$TARGET_DIR'."
