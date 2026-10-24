import subprocess


def send(number: str, text: str) -> None:
    script = 'on run argv\ntell application "Messages" to send (item 1 of argv) to participant (item 2 of argv) of (1st account whose service type = iMessage)\nend run'
    subprocess.run(["osascript", "-e", script, text, number], check=True)
