import subprocess

# FaceTime shows a "Click to call" prompt inside its main window; the Call button has no name, only a description.
# The element walk can hit stale references while the prompt animates in, so any error just retries.
CONFIRM = """
tell application "System Events" to tell process "FaceTime"
  repeat 40 times
    try
      set L to entire contents of window 1
      repeat with i from 1 to count of L
        set e to item i of L
        if class of e is button and description of e is "Call" then
          click e
          return
        end if
      end repeat
    end try
    delay 0.25
  end repeat
end tell
error "FaceTime call button never appeared"
"""


def call(number: str) -> None:
    subprocess.run(["open", f"facetime://{number}"], check=True)
    subprocess.run(["osascript", "-e", CONFIRM], check=True)
