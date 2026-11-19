# Changelog

## 0.3.0

- Expand to 42 standalone experiments, mapping supplied courseware experiments and assignments to their source pages, with clearly marked supplemental experiments.
- Generate a Chinese guide alongside each sketch: wiring, dependencies, parameters, expected behavior, troubleshooting and source adaptations.
- Search templates by lesson, device, library or outcome; reject known incompatible board selections before creating ESP32-S3 course sketches.
- Add board-aware Chinese help for interrupts, ADC calibration, LEDC, timers and ultrasonic measurement.
- Add bounded network parsers/timeouts, safe callback handoff, source-generated repository examples and a real compiler validation matrix.
- Keep original PPTX materials out of Git and VSIX packages.

## 0.2.2

- Locate missing semicolons using compiler fix-it insertion positions, with the marker on the statement rather than the next token.
- Mark unambiguous for-keyword misspellings at the keyword and include unknown identifiers in Chinese explanations.
- Keep original compiler locations in related information and discard in-flight results after newer edits.

## 0.2.1

- Diagnose original editor buffers with direct clangd and one-to-one virtual C++ URIs, avoiding failed preprocessor mapping and lost documents.
- Expand board response flags and adapt GCC-only flags without altering upload builds.
- Reject diagnostics for older document versions; refresh compile parameters from unsaved includes.
- Create real, independently editable experiment sketches instead of relying on IDE-specific untitled editors.
- Add Chinese core-function hover help and restore status when board selection is cancelled.

## 0.2.0

- Replace the bottom tree with a Visual Studio style error table, filtering, source context and precise click navigation.
- Fix document identity across Windows URI encodings/case, and serialize initial unsaved-buffer synchronization before subsequent edits.
- Add five standalone, annotated hardware experiment templates and Chinese Arduino core API completions.
- Browse actual included-library headers, public declarations and bundled examples from the installed library catalog.

## 0.1.10

- Explain misleading indentation, expected expressions and specific missing brackets in Chinese.
- Label uncovered diagnostics honestly in Chinese and keep their original reason in details.
- Underline a bare if itself when its missing condition is diagnosed at the following brace; retain the compiler's original location.

## 0.1.9

- Mark edits as pending immediately, and label previous results while waiting for fresh diagnostics.
- Explain missing if conditions explicitly in Chinese.
- Exercise missing-if-condition detection and repair through the real ESP32S3 server without saving.

## 0.1.8

- Stop advertising semantic-token and other editor features that trigger unsupported refresh requests in Arduino Language Server.
- Keep the companion focused on incremental text synchronization and push diagnostics alongside IDE language features.
- Show stopped-server state and clear stale diagnostics when the connection closes.

## 0.1.7

- Fix Windows Arduino IDE document matching so open and unsaved sketches reach the diagnostic server.
- Scope text synchronization to its own sketch, including multiple open projects.
- Report first-diagnostic timeouts and document synchronization in the output log.

## 0.1.6

- Avoid duplicate clangd.applyFix/applyTweak command registration alongside Arduino IDE's built-in client.
- Keep board selection available while awaiting workspace trust.

## 0.1.5

- Allow board selection before workspace trust is granted.
- Await the public trust request result instead of silently returning on Theia's stale synchronous flag.
- Show board-list loading and trust-wait states in the diagnostics panel.

## 0.1.4

- Add a docked real-time diagnostics panel at the bottom or in the left sidebar.
- Show board, state, severity counts and Chinese explanations; click to locate code.
- Persist panel position without restarting diagnostics.

## 0.1.3

- Keep menu/help activation responsive while Arduino IDE initializes its API.

## 0.1.2

- Restore the built-in C++ language and syntax highlighting for .ino files.
- Follow Arduino IDE's selected board through its built-in API by default.
- Add a permanent real-time check menu, editor toolbar button and usage guide.
- Distinguish initial parsing from diagnostics that are ready to use.

## 0.1.1

- Select installed boards and restart diagnostics for the selected FQBN.
- Use pinned, SHA-256 verified Espressif clangd for ESP32 targets.
- Isolate GCC-only flag adaptation in temporary diagnostic directories.
- Verify live, unsaved error detection and repair on ESP32S3 core 3.3.12.

## 0.1.0

- Incremental LSP synchronization for live, unsaved Arduino edits.
- Chinese explanations for common diagnostics.
- Arduino IDE tool discovery, board selection, logs and restart commands.
- Unit tests and a real language server test for unsaved errors and repairs.
