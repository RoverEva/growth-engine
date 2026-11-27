# 0001: The engine lives in its own private repository

- **Date:** 2026-11-27
- **Status:** Accepted (owner)

## Context
Phase 1 was built inside the HatchElite website repo. The engine now serves several websites (HatchElite,
EVA Video Studio), each with its own repo, hosting and deploy approvals.

## Decision
Move the engine to the private repo `RoverEva/growth-engine`, keeping its history. Website repos receive only pull
requests from publishing adapters.

## Consequences
- Website repos and their CI stay untouched by engine work. Access to engine code and strategy is separate.
- The HatchElite blog-loader contract test uses a pinned copy (`tests/contracts/hatchelite/`) that must be refreshed
  when HatchElite's loader changes.
