Output flaglint-demo.gif

Set Shell "bash"
Set FontSize 15
# VHS Width/Height are PIXELS (not cols/rows). 1200x800 px @ FontSize 15
# yields roughly a 110-col x 36-row terminal, which is the intended size.
Set Width 1200
Set Height 800
Set Theme "Dracula"
Set Padding 20
Set TypingSpeed 40ms
Set PlaybackSpeed 1

# ─────────────────────────────────────────
# Hidden setup: VHS spawns a bare bash (no .bashrc, no nvm), so put
# node/npm on PATH and link the local build so "flaglint" resolves to
# dist/bin/flaglint.js. Run "npm run build:cli && npm link" before recording.
# ─────────────────────────────────────────
Hide
Type `export PATH="/Users/krishankantsharma/.nvm/versions/node/v22.22.2/bin:/usr/local/bin:/usr/bin:/bin:$PATH"`
Enter
Type "npm link"
Enter
Type "cd examples/enterprise-checkout-service"
Enter
Type "clear"
Enter
Show

# ─────────────────────────────────────────
# SCENE 1: audit with readiness
# ─────────────────────────────────────────
Type "flaglint audit ./src --config .flaglintrc"
Enter
Sleep 4s
Sleep 1500ms

# ─────────────────────────────────────────
# SCENE 2: audit with effort estimate
# ─────────────────────────────────────────
Type "flaglint audit ./src --config .flaglintrc --cost-estimate"
Enter
Sleep 4s
Sleep 1500ms

# ─────────────────────────────────────────
# SCENE 3: validate against clean migrated directory
# ─────────────────────────────────────────
Type "flaglint validate ./after-complete --no-direct-launchdarkly"
Enter
Sleep 4s
Sleep 1500ms
