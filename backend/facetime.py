import subprocess
import time

import pyautogui



def osascript(script: str) -> str:
    r = subprocess.run(["osascript", "-e", script], capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(r.stderr.strip())
    return r.stdout.strip()


# --- placing the call -------------------------------------------------------

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
    # a facetime: link is dropped when FaceTime is not already running, so launch it first
    subprocess.run(["open", "-a", "FaceTime"], check=True)
    for _ in range(10):
        if subprocess.run(["pgrep", "-x", "FaceTime"], capture_output=True).returncode == 0:
            break
        time.sleep(0.5)
    time.sleep(1)
    subprocess.run(["open", f"facetime://{number}"], check=True)
    osascript(CONFIRM)


# "Take Live Photo" only exists once the video call is connected. The window must be on the current Space to be seen.
CONNECTED = """
tell application "FaceTime" to activate
tell application "System Events" to tell process "FaceTime"
  if (count of windows) is 0 then return false
  try
    set L to entire contents of window 1
  on error
    return false
  end try
  repeat with i from 1 to count of L
    try
      if class of (item i of L) is button and description of (item i of L) is "Take Live Photo" then return true
    end try
  end repeat
  return false
end tell
"""


def wait_connected() -> None:
    for _ in range(40):
        if osascript(CONNECTED) == "true":
            return
        time.sleep(2)
    raise TimeoutError("FaceTime call was not answered")


# Mute is only enabled during a call; the camera indicator covers the moment before FaceTime's menus update
IN_CALL = """
tell application "System Events"
  set muteOn to false
  try
    set muteOn to enabled of menu item "Mute" of menu "Video" of menu bar 1 of process "FaceTime"
  end try
  set camOn to false
  try
    set camOn to exists (first menu bar item of menu bar 1 of process "ControlCenter" whose description is "Audio and Video Controls")
  end try
  return muteOn or camOn
end tell
"""


def in_call() -> bool:
    return osascript(IN_CALL) == "true"


# --- audio routing ----------------------------------------------------------

# FaceTime's Video menu lists devices under "Microphone" then "Output"; pick the BlackHole 2ch entry after the Output header
OUTPUT_TO_BLACKHOLE = """
tell application "System Events" to tell process "FaceTime"
  set seen to false
  repeat with mi in (menu items of menu "Video" of menu bar 1)
    if (name of mi) is "Output" then set seen to true
    if seen and (name of mi) is "BlackHole 2ch" then
      click mi
      return
    end if
  end repeat
end tell
error "no BlackHole 2ch output in FaceTime Video menu"
"""


def route_audio_to_blackhole() -> None:
    osascript(OUTPUT_TO_BLACKHOLE)




# --- camera off ---------------------------------------------------------------
# The camera toggle lives in the menu bar video-controls popover (Control Center). Accessibility clicks don't register
# on its toggles, so real mouse clicks are used. In a fullscreen Space the menu bar is hidden; the mouse at the top edge reveals it.

VIDEO_ITEM = 'tell application "System Events" to tell process "ControlCenter" to tell (first menu bar item of menu bar 1 whose description is "Audio and Video Controls") to return (position) & (size)'
POPOVER_OPEN = 'tell application "System Events" to tell process "ControlCenter" to return (count of windows) > 0'
CAMERA_TOGGLE = """
tell application "System Events" to tell process "ControlCenter"
  set L to entire contents of window 1
  repeat with i from 1 to count of L
    try
      set e to item i of L
      if class of e is checkbox and (value of attribute "AXIdentifier" of e) is "facetime-video-device-toggle" then return (position of e) & (size of e) & (value of e)
    end try
  end repeat
  return "none"
end tell
"""


def nums(s: str) -> list[int]:
    return [int(v) for v in s.replace(" ", "").split(",")]


def camera_off() -> None:
    pyautogui.moveTo(pyautogui.size()[0] // 2, 0)
    item = None
    for _ in range(10):
        time.sleep(0.5)
        try:
            item = nums(osascript(VIDEO_ITEM))
        except RuntimeError:
            continue
        if item[1] >= 0:
            break
    if not item or item[1] < 0:
        raise RuntimeError("video controls not in the menu bar")
    if osascript(POPOVER_OPEN) != "true":
        pyautogui.click(item[0] + item[2] // 2, item[1] + item[3] // 2)
        for _ in range(8):
            time.sleep(0.5)
            if osascript(POPOVER_OPEN) == "true":
                break
    cam = osascript(CAMERA_TOGGLE)
    if cam == "none":
        osascript('tell application "System Events" to key code 53')
        raise RuntimeError("camera toggle not found in video controls")
    x, y, w, h, value = nums(cam)
    if value == 1:
        pyautogui.click(x + w // 2, y + h // 2)
        time.sleep(1)
    osascript('tell application "System Events" to key code 53')
