"""Read-only integration feasibility checks against the official native release.

Usage: python audit_upstream.py path/to/designElectronics.exe output-directory
These are upstream baseline checks, not proof of an OHMI browser integration.
"""
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile

exe = Path(sys.argv[1]).resolve()
out = Path(sys.argv[2]).resolve()
out.mkdir(parents=True, exist_ok=True)
history = tempfile.TemporaryDirectory(prefix="ohmi-native-audit-")
env = dict(os.environ, DE_HISTORY_DIR=history.name)
baseline = subprocess.run([str(exe), "--selftest"], capture_output=True, text=True, encoding="utf-8", env=env, timeout=60)
(out / "native-selftest.log").write_text(baseline.stdout + baseline.stderr, encoding="utf-8")
assert baseline.returncode == 0, baseline.stdout[-2000:]
report = {"scope": "Official v0.2.1 native Windows release only; no AI, OHMI integration or hardware verification", "nativeSelftest": {"exit": baseline.returncode, "passedAssertions": len(re.findall(r"\[\s*ok\s*\]", baseline.stdout))}, "cases": []}
process = subprocess.Popen([str(exe), "--mcp"], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, encoding="utf-8", env=env)
sequence = 0

def tool(name, **args):
    global sequence
    sequence += 1
    request = {"jsonrpc": "2.0", "id": sequence, "method": "tools/call", "params": {"name": name, "arguments": args}}
    process.stdin.write(json.dumps(request) + "\n")
    process.stdin.flush()
    response = json.loads(process.stdout.readline())["result"]
    assert not response["isError"], response
    return json.loads(response["content"][0]["text"])

try:
    report["catalogCount"] = int(re.search(r"Part library: (\d+) entries", baseline.stdout).group(1))
    report["catalogSearchReturned"] = len(tool("list_parts")["parts"])
    for name, colors, pins, resistance, samples in [
        ("uno-blink", ["Red"], [13], "220Ω", [0.25, 0.75, 1.25, 1.75]),
        ("uno-traffic-light", ["Red", "Green", "Yellow"], [8, 9, 10], "330Ω", [0.25, 1.25, 2.25, 3.25]),
    ]:
        tool("new_design", title=name)
        board = tool("add_part", type="arduino_uno", x=0, y=0)
        leds = []
        for i, (color, pin) in enumerate(zip(colors, pins)):
            resistor = tool("add_part", type="resistor", x=3200, y=i * 900, properties={"resistance": resistance})
            led = tool("add_part", type="led", x=4200, y=i * 900, properties={"color": color})
            leds.append(led["label"])
            tool("connect", from_part=board["label"], from_pin=f"D{pin}", to_part=resistor["label"], to_pin="pin0")
            tool("connect", from_part=resistor["label"], from_pin="pin1", to_part=led["label"], to_pin="anode")
            tool("connect", from_part=led["label"], from_pin="cathode", to_part=board["label"], to_pin="GND")
        setup = "\n".join(f"  pinMode({pin}, OUTPUT);" for pin in pins)
        if len(pins) == 1:
            loop = "  digitalWrite(13, HIGH);\n  delay(500);\n  digitalWrite(13, LOW);\n  delay(500);"
        else:
            phases = []
            for active in pins:
                phases += [f"  digitalWrite({pin}, {'HIGH' if pin == active else 'LOW'});" for pin in pins]
                phases += ["  delay(1000);"]
            loop = "\n".join(phases)
        code = f"void setup() {{\n{setup}\n}}\n\nvoid loop() {{\n{loop}\n}}\n"
        (out / f"{name}.ino").write_text(code, encoding="utf-8")
        tool("set_part_properties", part=board["label"], properties={"code": code})
        observations = []
        for i, seconds in enumerate(samples):
            result = tool("simulate", seconds=seconds)
            assert not result.get("damaged"), result
            assert not result.get("programErrors"), result
            states = [result["ledBrightness"].get(label, 0) > 0.05 for label in leds]
            expected = [i % 2 == 0] if len(pins) == 1 else [j == i % 3 for j in range(3)]
            assert states == expected, (name, seconds, states, expected, result)
            observations.append({"seconds": seconds, "lit": states, "brightness": result["ledBrightness"], "warnings": result.get("warnings", [])})
        path = out / f"{name}.dez"
        tool("save_design", path=str(path))
        saved = json.loads(path.read_text(encoding="utf-8"))
        tool("new_design", title="roundtrip")
        tool("open_design", path=str(path))
        reopened = tool("get_design")
        assert len(reopened["parts"]) == len(saved["parts"])
        assert len(reopened["wires"]) == len(saved["wires"])
        assert any(part.get("code") == code for part in saved["parts"])
        report["cases"].append({"name": name, "parts": len(saved["parts"]), "wires": len(saved["wires"]), "dezBytes": path.stat().st_size, "roundTrip": "pass", "ino": f"{name}.ino", "observations": observations})
    (out / "native-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
finally:
    process.stdin.close()
    process.wait(timeout=5)
