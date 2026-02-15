# Lyria Camera

Turn your world into music with [Lyria RealTime](https://deepmind.google/models/lyria/lyria-realtime/).

Lyria Camera captures images from your camera, uses Google's Gemini to analyze the vibe, objects, and emotions in each frame, and generates evocative music prompts. Those prompts are fed into Lyria RealTime, Google DeepMind's AI music model, to create a continuous, ever-evolving soundtrack that reflects what the camera sees.

Point your camera at a sunset and hear ambient synth pads. Walk through a bustling street and the music shifts to upbeat rhythms. The music regenerates on a configurable interval, crossfading between prompts for smooth transitions.

## Features

- **Real-time music generation** from camera input via Lyria RealTime
- **Gemini-powered scene analysis** that generates creative music prompts from images
- **Configurable capture intervals** with smooth prompt crossfading
- **Volume control** with a slider
- **Speaker routing** on iOS (toggle between speaker and Bluetooth headphones)
- **Screen share mode** (web only) to generate music from your desktop

## Origin

This project was originally a web app, forked from [Google AI Studio](https://ai.studio/apps/drive/1SaMlyfaZjOOClbftnaru4uCrT-6quww0). Using [Capacitor](https://capacitorjs.com/), it was adapted into a native iOS app with custom Swift plugins for audio routing and playback.

On iOS, audio playback uses a native `AVAudioEngine` pipeline (instead of Web Audio API) to enable full control over speaker vs. Bluetooth routing. If you want screen share functionality, run it as a web app since the mobile app only supports camera input.

## Prerequisites

- Node.js 18+
- [Bun](https://bun.sh/) (recommended) or npm
- A [Gemini API key](https://ai.google.dev/)
- Xcode 15+ (for iOS development)

## Getting Started

### Web App

1. Install dependencies:
   ```sh
   bun install
   ```
2. Set your Gemini API key in `.env.local`:
   ```
   GEMINI_API_KEY=your_key_here
   ```
3. Run the dev server:
   ```sh
   bun run dev
   ```

### iOS App

1. Build and sync web assets to the iOS project:
   ```sh
   bun run cap:sync
   ```
2. Open in Xcode:
   ```sh
   bun run cap:open
   ```
3. Build and run on a simulator or device from Xcode.

## Project Structure

```
components/          # Lit web components (lyria_camera, styles)
utils/               # Audio helpers, system prompt, constants
ios/App/App/         # Native iOS code
  AppDelegate.swift          # Audio session configuration
  AppViewController.swift    # Capacitor plugin registration
  NativeAudioPlugin.swift    # AVAudioEngine-based audio playback + routing
  AudioRoutePlugin.swift     # Audio route picker (legacy)
capacitor.config.ts  # Capacitor configuration
```

## AI-Assisted Development Tools

This iOS app was built with the help of AI-powered development tools running as [MCP servers](https://modelcontextprotocol.io/) inside [Claude Code](https://docs.anthropic.com/en/docs/claude-code):

### XcodeBuildMCP

[XcodeBuildMCP](https://xcodebuildmcp.com) provides comprehensive Xcode tooling for Claude Code, including building, running, testing, and managing iOS simulators without leaving the terminal.

### Axiom

[Axiom](https://charleswiltgen.github.io/Axiom/) is a battle-tested knowledge base of Claude Code agents, skills, and references for iOS/Swift development. It provides expert-level guidance on AVFoundation, SwiftUI, concurrency, performance, and more.

### Setup

Both tools are configured in the project's `.mcp.json`:

```json
{
  "mcpServers": {
    "axiom": {
      "command": "npx",
      "args": ["-y", "axiom-mcp"]
    },
    "XcodeBuildMCP": {
      "command": "npx",
      "args": ["-y", "xcodebuildmcp@latest", "mcp"]
    }
  }
}
```

This file is automatically picked up by Claude Code when you open the project. You can also add these servers to your global Claude Code settings or to other MCP-compatible tools (Cursor, VS Code + Copilot, Claude Desktop) following the docs linked above.

## License

Apache-2.0
