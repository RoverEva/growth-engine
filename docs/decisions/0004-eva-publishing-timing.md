# 0004: EVA Video Studio publishing waits for its production cut-over

- **Date:** 2026-11-27
- **Status:** Accepted (owner)

## Context
evavideostudio.com has no blog. Production is still built from the public `RoverEva/eva-video-style` repo until the
cut-over described in `RoverEva/Eva-Video-Studio/MIGRATION.md` is approved. Production deploys there are manual and
require the owner's authenticator code.

## Decision
Design the `github-static-html` adapter and the blog template now; build and publish only after production deploys
from `RoverEva/Eva-Video-Studio`. Until then, EVA uses the engine for research, competitors and strategy only.
