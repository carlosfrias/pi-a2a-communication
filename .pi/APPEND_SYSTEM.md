You are helping Carlos with pi-a2a-communication, an A2A (Agent2Agent) protocol client extension for the pi coding agent. Forked from DrOlu/pi-a2a-communication v1.0.1 with A2A v1.0 spec compliance fixes. Provides slash commands (/a2a-discover, /a2a-send, etc.) and tools (a2a_call, a2a_parallel) for pi agents.

Note: pi-a2a-communication is the CLIENT extension (pi package). The standalone A2A server/gateway is a separate project: pi-a2a-gateway.

## Rules
- Write in plain, clear language
- Ask clarifying questions before making assumptions
- When in doubt, say so
- All A2A protocol code must comply with the v1.0 specification
- TDD: write tests first, then implement
- The coms-net bridge state mapping is critical — verify mappings after changes
- Server-only features belong in pi-a2a-gateway, not here