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
# Hidden setup: VHS spawns a bare bash (no .bashrc, no nvm), so put the
# linked flaglint (v0.5.4) and node/npx on PATH. Not shown in the recording.
# ─────────────────────────────────────────
Hide
Type `export PATH="/Users/krishankantsharma/.nvm/versions/node/v22.22.2/bin:/usr/local/bin:/usr/bin:/bin:$PATH"`
Enter
Type "clear"
Enter
Show

# ─────────────────────────────────────────
# SCENE 1: scan
# ─────────────────────────────────────────
Type "cd flaglint-demo"
Enter
Sleep 500ms

Type "npx flaglint scan ./src"
Enter
Sleep 4s

# pause so viewer can read the output
Sleep 3s

# ─────────────────────────────────────────
# SCENE 2: migrate dry-run
# ─────────────────────────────────────────
Type "flaglint migrate ./src --dry-run"
Enter
Sleep 5s

# pause on the diff output
Sleep 4s

# ─────────────────────────────────────────
# SCENE 3: CI gate
# ─────────────────────────────────────────
Type "flaglint validate ./src --no-direct-launchdarkly"
Enter
Sleep 4s

# pause on the exit 1 output
Sleep 3s

# final pause before loop
Sleep 2s
