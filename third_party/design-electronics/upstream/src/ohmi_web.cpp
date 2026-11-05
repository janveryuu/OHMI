// OHMI's bounded browser adapter. Simulation, documents and MCP remain upstream.
#include "app.h"
#include "mcp.h"
#include <emscripten.h>
#include <algorithm>
#include <cmath>
#include <cstring>
#include <stdexcept>

namespace {
App* app = nullptr;
std::unique_ptr<McpSession> session;
unsigned long long documentGeneration = 0;
constexpr size_t maxBytes = 1024 * 1024;

std::string documentIdentity() {
    history::ensureUid(app->doc);
    return app->doc.uid + ":" + std::to_string(documentGeneration);
}

void replaced(bool newDocument = true) {
    if (newDocument) ++documentGeneration;
    app->simOn = false;
    app->simulator.reset();
    // Fresh documents may reuse a revision number; cached nets must never survive replacement.
    app->connRev = -1; app->simRev = -1; app->drcRev = -1;
    for (auto& camera : app->cam) camera.valid = false;
    app->selParts.clear(); app->selWires.clear(); app->selNotes.clear();
    app->codeOpen = false;
}

void bounded(const Json& value, int depth = 0) {
    if (depth > 24 || value.size() > 20000) throw std::runtime_error("Document structure is too large.");
    if (value.isString() && value.str().size() > 65536) throw std::runtime_error("Text is too large.");
    if (value.isNumber() && (!std::isfinite(value.num()) || std::abs(value.num()) > 10000000)) throw std::runtime_error("Number is outside the supported range.");
    for (const auto& item : value.items()) bounded(item, depth + 1);
    for (const auto& item : value.members()) bounded(item.second, depth + 1);
}

Json observe(Document& document, double seconds, const Json& events = Json(), double interval = 0.05) {
    if (!std::isfinite(seconds) || seconds < 0.05 || seconds > 20 || document.parts.size() > 100)
        throw std::runtime_error("Observation supports 0.05 to 5 seconds and up to 100 parts.");
    document.syncWireEnds();
    Connectivity connectivity; connectivity.build(document);
    Simulator simulator;
    Json samples = Json::array();
    size_t eventIndex = 0; std::set<int> pressed;
    for (double time = 0; time < seconds - 0.000001;) {
        while (eventIndex < events.size() && events[(int)eventIndex]["at"].num() <= time + 0.000001) {
            pressed.clear(); for (const auto& id : events[(int)eventIndex]["pressed"].items()) pressed.insert(id.i()); ++eventIndex;
        }
        double dt = std::min(interval, seconds - time);
        if (eventIndex < events.size()) dt = std::min(dt, events[(int)eventIndex]["at"].num() - time);
        const auto result = simulator.step(document, connectivity, pressed, dt);
        time += dt;
        Json sample = Json::object(), leds = Json::object(), activity = Json::object(), errors = Json::array(), warnings = Json::array(), damaged = Json::array();
        Json segments = Json::object(), serial = Json::object();
        for (const auto& value : result.segments) { Json values = Json::array(); for (const auto level : value.second) values.push(level); segments.set(std::to_string(value.first), values); }
        for (const auto& value : result.serial) serial.set(std::to_string(value.first), value.second);
        sample.set("segments", segments); sample.set("serial", serial);
        Json voltages = Json::object();
        for (const auto& part : document.parts) if (part.type == "arduino_uno") {
            Json pins = Json::object();
            for (int pin = 2; pin <= 12; ++pin) {
                const auto name = "D" + std::to_string(pin); const int net = connectivity.netOf(part.id, part.def->pinIndex(name));
                if (net >= 0 && net < (int)result.netVoltage.size()) pins.set(name, result.netVoltage[net]);
            }
            voltages.set(std::to_string(part.id), pins);
        }
        sample.set("voltages", voltages);
        for (const auto& value : result.brightness) leds.set(std::to_string(value.first), value.second);
        for (const auto& value : result.activity) activity.set(std::to_string(value.first), value.second);
        for (const auto& value : result.code) if (!value.second.error.empty()) {
            Json error = Json::object(); error.set("part", value.first); error.set("line", value.second.errorLine); error.set("message", value.second.error); errors.push(error);
        }
        for (const auto& value : result.warnings) warnings.push(value);
        if (!result.ran || result.message.find("could not be solved") != std::string::npos) errors.push(result.message);
        if (result.message.find("unstable") != std::string::npos) warnings.push(result.message);
        for (const auto& value : result.damaged) damaged.push(value);
        sample.set("time", result.time); sample.set("leds", leds); sample.set("activity", activity); sample.set("errors", errors); sample.set("warnings", warnings); sample.set("damaged", damaged);
        samples.push(sample);
    }
    Json output = Json::object(); output.set("samples", samples); output.set("engine", "designElectronics interpreter; not hardware verification"); return output;
}

// Stage on native pin geometry, refusing any placement that changes the circuit's nets.
Json prepare(Document& draft) {
    std::vector<int> originals;
    int boardId = -1, unoId = -1;
    for (auto& p : draft.parts) {
        if (p.type == "breadboard") boardId = p.id;
        else originals.push_back(p.id);
        if (p.type == "arduino_uno") unoId = p.id;
    }
    if (unoId < 0) {
        Json result = Json::object(); result.set("document", draft.toJson(true));
        result.set("observations", observe(draft, 4)); result.set("mounted", 0); return result;
    }
    if (boardId < 0) boardId = draft.addPart("breadboard", {{"size", "full+"}}, {0,0}).id;
    auto* board = draft.part(boardId);
    board->props["size"] = "full+"; board->refresh(); board->place[BB].pos = {0,0};
    // Ignore accidental geometric contacts in hand-authored input; explicit wiring is the specification.
    for (size_t i = 0; i < originals.size(); ++i) {
        auto* part = draft.part(originals[i]);
        part->place[BB].pos = {-20000.f - 5000.f * i, -10000};
        // Touching schematic/PCB pins also join global nets; separate those views before capturing intent.
        for (int view : {SCH, PCB}) part->place[view].pos = {2500.f * (i % 6), 3000.f * (i / 6)};
    }
    draft.syncWireEnds();
    auto wire = [&](int a, const std::string& pa, int b, const std::string& pb, uint32_t color) {
        Wire w; w.id = draft.newId(); w.view = BB; w.color = color;
        w.ends[0] = {a, draft.part(a)->def->pinIndex(pa)}; w.ends[1] = {b, draft.part(b)->def->pinIndex(pb)};
        w.pts = {draft.part(a)->pinPos(w.ends[0].pin, BB), draft.part(b)->pinPos(w.ends[1].pin, BB)};
        draft.wires.push_back(w);
    };
    wire(unoId, "5V", boardId, "tp1", rgba(217,67,67));
    wire(unoId, "GND", boardId, "tn1", rgba(34,34,34));
    wire(boardId, "tp1", boardId, "bp1", rgba(217,67,67));
    wire(boardId, "tn1", boardId, "bn1", rgba(34,34,34));
    Connectivity before; before.build(draft);
    std::vector<PinRef> pins;
    for (int id : originals) {
        const auto* p = draft.part(id);
        for (int i = 0; i < (int)p->def->pins.size(); ++i) pins.push_back({id, i});
    }
    auto group = [](const std::string& hole) { return std::string(hole[0] <= 'e' ? "top" : "bottom") + hole.substr(1); };
    std::map<std::string, int> occupiedGroups;
    std::set<std::string> occupiedHoles;
    std::vector<Rect> bodies;
    int mounted = 0;

    // Categorize parts for professional layout and grouping
    std::vector<int> displays, ics, buttons, pots, sensors, leds, resistors, buzzers, others;
    for (int id : originals) {
        const auto* p = draft.part(id);
        if (p->type == "arduino_uno" || p->type == "battery") continue;
        if (p->type == "seg7_cc" || p->type == "seg7_ca") displays.push_back(id);
        else if (p->type == "74hc595" || p->type == "cd4511" || (p->def && p->def->pins.size() >= 8)) ics.push_back(id);
        else if (p->type == "pushbutton" || p->type == "switch") buttons.push_back(id);
        else if (p->type == "potentiometer") pots.push_back(id);
        else if (p->type == "photocell") sensors.push_back(id);
        else if (p->type == "led" || p->type == "rgb_led") leds.push_back(id);
        else if (p->type == "resistor") resistors.push_back(id);
        else if (p->type == "buzzer" || p->type == "piezo") buzzers.push_back(id);
        else others.push_back(id);
    }

    struct PartHint {
        int targetCol = 32;
        char preferredRow = 'e';
        int preferredRot = 0;
    };
    std::map<int, PartHint> hints;

    if (!displays.empty()) {
        // Multi-digit display circuit (FMSS 2-digit counter, etc.)
        for (size_t d = 0; d < displays.size(); ++d) {
            hints[displays[d]] = { (int)(24 + d * 8), 'c', 0 };
        }
        for (size_t r = 0; r < resistors.size(); ++r) {
            hints[resistors[r]] = { (int)(7 + r * 2), 'a', 1 };
        }
        for (size_t b = 0; b < buttons.size(); ++b) {
            hints[buttons[b]] = { (int)(42 + b * 6), 'e', 0 };
        }
    } else if (!ics.empty()) {
        // Shift register / IC circuit (e.g. 74HC595 + 8 LEDs)
        hints[ics[0]] = { 8, 'e', 0 };
        size_t nOut = std::min(leds.size(), resistors.size());
        for (size_t i = 0; i < nOut; ++i) {
            hints[resistors[i]] = { (int)(18 + i * 5), 'f', 1 };
            hints[leds[i]] = { (int)(18 + i * 5 + 2), 'e', 0 };
        }
    } else if (!leds.empty()) {
        // Discrete LED circuit (Traffic light, LED chaser, etc.)
        int nL = (int)leds.size();
        int pitch = 5;
        int span = nL * pitch;
        int startCol = std::max(8, (60 - span) / 2);
        for (int i = 0; i < nL; ++i) {
            if (i < (int)resistors.size()) hints[resistors[i]] = { startCol + i * pitch, 'f', 1 };
            hints[leds[i]] = { startCol + i * pitch + 2, 'e', 0 };
        }
        for (size_t b = 0; b < buttons.size(); ++b) hints[buttons[b]] = { std::max(6, (int)(startCol - 8 - b * 5)), 'e', 0 };
        for (size_t bz = 0; bz < buzzers.size(); ++bz) hints[buzzers[bz]] = { std::min(58, (int)(startCol + span + 3 + bz * 6)), 'e', 0 };
        for (size_t s = 0; s < sensors.size(); ++s) hints[sensors[s]] = { std::max(6, startCol - 6), 'e', 0 };
        for (size_t p = 0; p < pots.size(); ++p) hints[pots[p]] = { std::max(6, startCol - 8), 'e', 0 };
    } else {
        // Sensor / other circuit without LEDs
        int startCol = 24;
        for (size_t p = 0; p < pots.size(); ++p) hints[pots[p]] = { (int)(startCol + p * 8), 'e', 0 };
        for (size_t s = 0; s < sensors.size(); ++s) hints[sensors[s]] = { (int)(startCol + 10 + s * 6), 'e', 0 };
        for (size_t b = 0; b < buttons.size(); ++b) hints[buttons[b]] = { (int)(startCol + 18 + b * 6), 'e', 0 };
        for (size_t r = 0; r < resistors.size(); ++r) hints[resistors[r]] = { (int)(startCol + 4 + r * 3), 'a', 1 };
    }

    // Assembly order: structured high-pin / central components first
    std::vector<int> order;
    for (int id : displays) order.push_back(id);
    for (int id : ics) order.push_back(id);
    for (int id : buttons) order.push_back(id);
    for (int id : buzzers) order.push_back(id);
    for (int id : pots) order.push_back(id);
    for (int id : sensors) order.push_back(id);
    for (int id : resistors) order.push_back(id);
    for (int id : leds) order.push_back(id);
    for (int id : others) order.push_back(id);
    for (int id : originals) {
        if (draft.part(id)->type == "arduino_uno" || draft.part(id)->type == "battery") order.push_back(id);
    }

    for (int id : order) {
        auto* p = draft.part(id);
        if (p->type == "arduino_uno") { p->place[BB].pos = {-3300, 0}; continue; }
        if (p->type == "battery") { p->place[BB].pos = {-3300, 2800}; continue; }
        bool placed = false;

        PartHint hint = hints.count(id) ? hints[id] : PartHint{32, 'e', 0};

        std::vector<int> rots = { hint.preferredRot, (hint.preferredRot + 2) % 4, (hint.preferredRot + 1) % 4, (hint.preferredRot + 3) % 4 };
        std::vector<char> rows = { hint.preferredRow };
        for (char r : std::string("efchajbdgi")) if (r != hint.preferredRow) rows.push_back(r);

        std::vector<int> cols;
        cols.push_back(hint.targetCol);
        for (int offset = 1; offset <= 63; ++offset) {
            int right = hint.targetCol + offset;
            int left = hint.targetCol - offset;
            if (right <= 63) cols.push_back(right);
            if (left >= 1) cols.push_back(left);
        }

        for (int rotation : rots) {
            if (placed) break;
            for (char row : rows) {
                if (placed) break;
                for (int col : cols) {
                    p->place[BB].rot = rotation; p->place[BB].pos = {0,0};
                    const auto target = board->pinPos(board->def->pinIndex(std::string(1,row) + std::to_string(col)), BB);
                    p->place[BB].pos = target - p->pinPos(0, BB);
                    const auto body = p->worldBounds(BB);
                    if (std::any_of(bodies.begin(), bodies.end(), [&](const Rect& other) { return body.overlaps(other); })) continue;
                    std::vector<std::string> holes;
                    std::map<std::string, int> candidate;
                    bool ok = true;
                    for (int pin = 0; pin < (int)p->def->pins.size() && ok; ++pin) {
                        const auto pos = p->pinPos(pin, BB);
                        std::string hole;
                        for (int h = 0; h < (int)board->def->pins.size(); ++h) {
                            const auto& name = board->def->pins[h].id;
                            if (name[0] >= 'a' && name[0] <= 'j' && name[1] >= '0' && name[1] <= '9' && dist(pos, board->pinPos(h, BB)) < 1) { hole = name; break; }
                        }
                        if (hole.empty() || occupiedHoles.count(hole)) { ok = false; break; }
                        const auto g = group(hole); const auto net = before.netOf(id, pin);
                        if ((occupiedGroups.count(g) && occupiedGroups.at(g) != net) || (candidate.count(g) && candidate.at(g) != net)) { ok = false; break; }
                        candidate[g] = net; holes.push_back(hole);
                    }
                    if (!ok) continue;
                    occupiedGroups.insert(candidate.begin(), candidate.end());
                    occupiedHoles.insert(holes.begin(), holes.end()); bodies.push_back(body); placed = true; ++mounted;
                    break;
                }
            }
        }
        if (!placed) throw std::runtime_error("No safe breadboard placement for " + p->label + ". Your active circuit is unchanged.");
    }
    draft.syncWireEnds();
    Connectivity after; after.build(draft);
    for (const auto& a : pins) for (const auto& b : pins)
        if ((before.netOf(a.part,a.pin) == before.netOf(b.part,b.pin)) != (after.netOf(a.part,a.pin) == after.netOf(b.part,b.pin)))
            throw std::runtime_error("Breadboard placement changed an electrical net. Your active circuit is unchanged.");

    const auto ground = after.netOf(unoId, draft.part(unoId)->def->pinIndex("GND"));
    const auto power = after.netOf(unoId, draft.part(unoId)->def->pinIndex("5V"));

    // Distribute power and ground returns to the nearest breadboard rail (top or bottom)
    for (auto& w : draft.wires) if (w.view == BB) {
        const auto net = after.netOf(w.ends[0].part, w.ends[0].pin);
        if (net == ground || net == power) {
            for (int side = 0; side < 2; ++side) {
                if (w.ends[side].part == unoId && w.ends[1 - side].part != boardId) {
                    const auto other = draft.part(w.ends[1 - side].part)->pinPos(w.ends[1 - side].pin, BB);
                    const std::string prefix = (other.y < 850.f)
                        ? (net == ground ? "tn" : "tp")
                        : (net == ground ? "bn" : "bp");
                    int closest = -1; float distance = 1e20f;
                    for (int pin = 0; pin < (int)board->def->pins.size(); ++pin) {
                        if (board->def->pins[pin].id.rfind(prefix, 0) != 0) continue;
                        const float d = std::abs(board->pinPos(pin, BB).x - other.x);
                        if (d < distance) { distance = d; closest = pin; }
                    }
                    if (closest >= 0) w.ends[side] = {boardId, closest};
                }
            }
        }
    }

    // High-contrast, distinguishable signal wire color palette
    const uint32_t signalPalette[] = {
        rgba(41, 121, 255),   // Vibrant Blue
        rgba(46, 175, 75),    // Forest Green
        rgba(255, 122, 0),    // Vivid Orange
        rgba(240, 180, 20),   // Warm Amber / Gold
        rgba(156, 39, 176),   // Rich Purple
        rgba(0, 188, 212),    // Bright Cyan
        rgba(233, 30, 99),    // Rose Pink
        rgba(0, 150, 136),    // Teal
        rgba(121, 85, 72),    // Saddle Brown
        rgba(63, 81, 181),    // Deep Indigo
        rgba(124, 179, 66),   // Lime
        rgba(96, 125, 139)    // Steel Slate
    };
    std::map<int, uint32_t> netColors;
    int colorCounter = 0;
    for (auto& w : draft.wires) if (w.view == BB) {
        const auto net = after.netOf(w.ends[0].part, w.ends[0].pin);
        if (net == ground) w.color = rgba(34, 34, 34);
        else if (net == power) w.color = rgba(217, 67, 67);
        else {
            if (netColors.find(net) == netColors.end()) {
                netColors[net] = signalPalette[(colorCounter++) % 12];
            }
            w.color = netColors[net];
        }
    }

    // Intelligent orthogonal wire routing in dedicated channels with monotonic non-crossing tracks
    std::vector<int> unoWireIndices;
    std::vector<int> otherWireIndices;
    for (size_t i = 0; i < draft.wires.size(); ++i) {
        auto& w = draft.wires[i];
        if (w.view != BB) continue;
        const auto net = after.netOf(w.ends[0].part, w.ends[0].pin);
        bool isUno = (w.ends[0].part == unoId || w.ends[1].part == unoId);
        bool isRailJumper = (w.ends[0].part == boardId || w.ends[1].part == boardId) && (net == ground || net == power);

        if (isRailJumper) {
            int compSide = (w.ends[0].part == boardId) ? 1 : 0;
            int railSide = 1 - compSide;
            if (w.ends[compSide].part == unoId && w.ends[railSide].part == boardId) {
                // Main power feeds from Uno to tp1 / tn1
                const auto a = draft.part(w.ends[compSide].part)->pinPos(w.ends[compSide].pin, BB);
                const auto b = draft.part(w.ends[railSide].part)->pinPos(w.ends[railSide].pin, BB);
                float trackY = (net == ground ? -120.f : -170.f);
                w.pts = { a, {a.x, trackY}, {b.x, trackY}, b };
            } else if (w.ends[0].part == boardId && w.ends[1].part == boardId) {
                // Rail links (tp1 to bp1, tn1 to bn1) down the left margin
                const auto a = draft.part(w.ends[0].part)->pinPos(w.ends[0].pin, BB);
                const auto b = draft.part(w.ends[1].part)->pinPos(w.ends[1].pin, BB);
                float marginX = (net == ground ? -70.f : -120.f);
                w.pts = { a, {marginX, a.y}, {marginX, b.y}, b };
            } else {
                // Component to adjacent rail hole
                const auto pComp = draft.part(w.ends[compSide].part)->pinPos(w.ends[compSide].pin, BB);
                const auto pRail = board->pinPos(w.ends[railSide].pin, BB);
                if (std::abs(pComp.x - pRail.x) < 2.f) {
                    w.pts = { pComp, pRail };
                } else {
                    w.pts = { pComp, {pComp.x, pRail.y}, pRail };
                }
            }
        } else if (isUno) {
            unoWireIndices.push_back((int)i);
        } else {
            otherWireIndices.push_back((int)i);
        }
    }

    // Sort Uno-to-board wires by destination X coordinate to prevent crossing in the top channel
    std::sort(unoWireIndices.begin(), unoWireIndices.end(), [&](int a, int b) {
        auto getDstX = [&](int idx) {
            const auto& w = draft.wires[idx];
            int dstSide = (w.ends[0].part == unoId) ? 1 : 0;
            return draft.part(w.ends[dstSide].part)->pinPos(w.ends[dstSide].pin, BB).x;
        };
        return getDstX(a) < getDstX(b);
    });

    int topLane = 0;
    for (int idx : unoWireIndices) {
        auto& w = draft.wires[idx];
        int unoSide = (w.ends[0].part == unoId) ? 0 : 1;
        int dstSide = 1 - unoSide;
        const auto a = draft.part(w.ends[unoSide].part)->pinPos(w.ends[unoSide].pin, BB);
        const auto b = draft.part(w.ends[dstSide].part)->pinPos(w.ends[dstSide].pin, BB);
        float trackY = -230.f - (topLane++) * 45.f;
        w.pts = { a, {a.x, trackY}, {b.x, trackY}, b };
    }

    // Board-to-board jumpers (segment lines, IC outputs, sensor links)
    std::sort(otherWireIndices.begin(), otherWireIndices.end(), [&](int a, int b) {
        auto getMidX = [&](int idx) {
            const auto& w = draft.wires[idx];
            const auto p0 = draft.part(w.ends[0].part)->pinPos(w.ends[0].pin, BB);
            const auto p1 = draft.part(w.ends[1].part)->pinPos(w.ends[1].pin, BB);
            return (p0.x + p1.x) * 0.5f;
        };
        return getMidX(a) < getMidX(b);
    });

    int troughLane = 0;
    for (int idx : otherWireIndices) {
        auto& w = draft.wires[idx];
        auto a = draft.part(w.ends[0].part)->pinPos(w.ends[0].pin, BB);
        auto b = draft.part(w.ends[1].part)->pinPos(w.ends[1].pin, BB);
        if (a.x > b.x) std::swap(a, b);

        if (dist(a, b) < 350.f) {
            if (std::abs(a.x - b.x) < 2.f || std::abs(a.y - b.y) < 2.f) {
                w.pts = { a, b };
            } else {
                w.pts = { a, {b.x, a.y}, b };
            }
        } else {
            if (a.y >= 850.f && b.y >= 850.f) {
                float laneY = 820.f + (troughLane++ % 3) * 30.f;
                w.pts = { a, {a.x, laneY}, {b.x, laneY}, b };
            } else {
                float laneY = -230.f - (topLane++) * 45.f;
                w.pts = { a, {a.x, laneY}, {b.x, laneY}, b };
            }
        }
    }

    draft.syncWireEnds();
    Connectivity routed; routed.build(draft);
    for (const auto& a : pins) for (const auto& b : pins)
        if ((before.netOf(a.part,a.pin) == before.netOf(b.part,b.pin)) != (routed.netOf(a.part,a.pin) == routed.netOf(b.part,b.pin)))
            throw std::runtime_error("Jumper routing changed an electrical net. Your active circuit is unchanged.");
    history::ensureUid(draft);
    Json result = Json::object(); result.set("document", draft.toJson(true));
    result.set("observations", observe(draft, 4)); result.set("mounted", mounted); return result;
}

Json dispatch(const Json& request) {
    const std::string operation = request["operation"].str();
    if (operation == "status") {
        Json result = Json::object(); result.set("ready", app != nullptr); result.set("catalogCount", (int)partLibrary().size()); result.set("protocol", 1);
        if (app) result.set("documentId", documentIdentity());
        if (app) { result.set("running", app->simOn); result.set("view", app->view); }
        return result;
    }
    if (!app || !session) throw std::runtime_error("Engine is not ready.");
    if (operation == "capture") {
        Json snapshot = Json::object(); snapshot.set("operation", "snapshot");
        Json result = Json::object(); result.set("document", dispatch(snapshot)); result.set("documentId", documentIdentity()); return result;
    }
    if (operation == "catalog") {
        Json entries = Json::array();
        for (const auto& entry : partLibrary()) {
            const auto definition = getPartDef(entry.type, entry.props);
            if (!definition) throw std::runtime_error("Catalog definition is missing.");
            Json item = Json::object(), pins = Json::array();
            item.set("type", entry.type); item.set("title", entry.title);
            for (const auto& pin : definition->pins) pins.push(pin.id);
            item.set("pins", pins);
            if (request["presets"].boolean()) {
                Json props = Json::object();
                for (const auto& property : entry.props) props.set(property.first, property.second);
                item.set("properties", props); item.set("category", entry.category);
            }
            entries.push(item);
        }
        return entries;
    }
    if (operation == "snapshot") {
        history::ensureUid(app->doc);
        app->doc.syncWireEnds();
        const auto result = app->doc.toJson(true);
        if (result.dump().size() > maxBytes) throw std::runtime_error("This document exceeds the 1 MiB bridge limit. Use the native export menu.");
        return result;
    }
    if (operation == "probe") {
        const auto& value = request["document"]; const auto& events = request["events"];
        const double seconds = request["seconds"].num(), interval = request["sampleMs"].num() / 1000;
        if (!events.isArray() || events.size() > 500 || seconds < 0.05 || seconds > 20 || interval < 0.001 || interval > 0.05 || seconds / interval + events.size() > 2000 || value["parts"].size() > 32 || value["wires"].size() > 256) throw std::runtime_error("Probe exceeds bounded time, sample or document limits.");
        Document draft; std::string error;
        if (!draft.fromJson(value, &error) || draft.parts.size() != value["parts"].size() || draft.wires.size() != value["wires"].size()) throw std::runtime_error("Invalid probe document.");
        double previous = -1;
        for (const auto& event : events.items()) {
            const double at = event["at"].num(-1);
            if (at < 0 || at <= previous || at > seconds || !event["pressed"].isArray() || event["pressed"].size() > 4) throw std::runtime_error("Invalid input timeline.");
            for (const auto& id : event["pressed"].items()) { const auto* part = draft.part(id.i()); if (!part || part->type != "pushbutton") throw std::runtime_error("Probe input is not a button."); }
            previous = at;
        }
        return observe(draft, seconds, events, interval);
    }
    if (operation == "prepare") {
        const auto& value = request["document"];
        if (value["format"].str() != "designElectronics" || value["version"].i() != 1 || value["parts"].size() > 32 || value["wires"].size() > 256)
            throw std::runtime_error("Unsupported or oversized generated circuit.");
        Document draft; std::string error;
        if (!draft.fromJson(value, &error) || draft.parts.size() != value["parts"].size() || draft.wires.size() != value["wires"].size())
            throw std::runtime_error("Could not stage the complete generated circuit.");
        if (request.has("layout") && !request["layout"].boolean()) {
            Json result = Json::object(); result.set("document", draft.toJson(true));
            result.set("observations", observe(draft, 4)); result.set("mounted", 0); return result;
        }
        return prepare(draft);
    }
    if (operation == "open") {
        const auto& value = request["document"];
        if (value["format"].str() != "designElectronics" || value["version"].i() != 1 || !value["parts"].isArray() || !value["wires"].isArray() || value["parts"].size() > 200 || value["wires"].size() > 800)
            throw std::runtime_error("Unsupported or oversized designElectronics document.");
        Document staged; std::string error;
        if (!staged.fromJson(value, &error)) throw std::runtime_error(error.empty() ? "Could not read this document." : error);
        if (staged.parts.size() != value["parts"].size() || staged.wires.size() != value["wires"].size()) throw std::runtime_error("Document contains unknown parts or invalid wires.");
        for (const auto& wire : value["wires"].items()) for (const auto* key : {"from", "to"}) {
            const auto& terminal = wire[key];
            if (!terminal.isObject()) continue;
            const auto* part = staged.part(terminal["part"].i());
            if (!part || part->def->pinIndex(terminal["pin"].str()) < 0) throw std::runtime_error("Wire references an invalid terminal.");
        }
        std::set<int> ids;
        for (const auto& part : staged.parts) {
            if (!part.def || part.id <= 0 || !ids.insert(part.id).second) throw std::runtime_error("Invalid or duplicate part identifier.");
        }
        for (const auto& wire : staged.wires) {
            if (wire.id <= 0 || !ids.insert(wire.id).second || wire.pts.size() < 2) throw std::runtime_error("Invalid or duplicate wire identifier.");
            for (const auto& ref : wire.ends) if (ref.part >= 0) {
                const auto* part = staged.part(ref.part);
                if (!part || ref.pin < 0 || ref.pin >= (int)part->def->pins.size()) throw std::runtime_error("Wire references an invalid terminal.");
            }
        }
        app->checkpoint(); app->doc = std::move(staged); app->changed(); replaced();
        Json result = Json::object(); result.set("opened", true); return result;
    }
    if (operation == "compile") {
        const auto& spec = request["spec"];
        if (spec["version"].i() != 1 || spec["status"].str() != "draft" || !spec["parts"].isArray() || spec["parts"].size() > 24 || !spec["connections"].isArray() || spec["connections"].size() > 64)
            throw std::runtime_error("Invalid circuit specification.");
        Document draft; draft.title = spec["title"].str();
        McpSession builder(&draft);
        const auto call = [&](const std::string& name, const Json& args) {
            bool failed = false; const auto text = builder.callTool(name, args, failed);
            if (failed) throw std::runtime_error(text);
            return Json::parse(text);
        };
        static const std::map<std::string, std::set<std::string>> types = {
            {"arduino_uno", {}}, {"battery", {"voltage"}}, {"resistor", {"resistance"}},
            {"led", {"color"}}, {"switch", {"position"}}, {"breadboard", {"size"}}
        };
        std::set<std::string> ids;
        for (const auto& part : spec["parts"].items()) {
            const auto type = part["type"].str(), id = part["id"].str(), code = part["sketch"].str();
            if (!types.count(type) || id.empty() || id.size() > 32 || !ids.insert(id).second || code.size() > 8000 || (type != "arduino_uno" && !code.empty()) || !part["properties"].isArray() || part["properties"].size() > 4)
                throw std::runtime_error("Unsupported circuit component.");
            Json args = Json::object(), props = Json::object();
            for (const auto& property : part["properties"].items()) {
                const auto key = property["key"].str();
                if (!types.at(type).count(key) || props.has(key.c_str()) || !property["value"].isString() || property["value"].str().size() > 80)
                    throw std::runtime_error("Unsupported circuit property.");
                props.set(key, property["value"]);
            }
            args.set("type", type); args.set("label", id); args.set("properties", props);
            const auto added = call("add_part", args);
            draft.part(added["id"].i())->code = code;
        }
        for (const auto& wire : spec["connections"].items()) {
            Json args = Json::object(), views = Json::array();
            for (const auto* view : {"breadboard", "schematic", "pcb"}) views.push(view);
            for (const auto* side : {"from", "to"}) {
                const auto id = wire[side]["part"].str();
                if (!ids.count(id)) throw std::runtime_error("Unknown circuit endpoint.");
                args.set(std::string(side) + "_part", id); args.set(std::string(side) + "_pin", wire[side]["pin"].str());
            }
            args.set("views", views); call("connect", args);
        }
        history::ensureUid(draft); draft.syncWireEnds();
        Json result = Json::object(); result.set("document", draft.toJson(true));
        result.set("observations", observe(draft, 4)); return result;
    }
    if (operation == "observe") return observe(app->doc, request["seconds"].num());
    if (operation == "view") {
        int view = request["view"].i(-1);
        if (view < 0 || view >= NUM_VIEWS) throw std::runtime_error("Unknown view.");
        app->view = view;
        Json result = Json::object(); result.set("view", view); return result;
    }
    if (operation == "zoom") {
        const auto direction = request["direction"].str();
        if (direction == "fit") app->fitView(app->view, app->rCanvas);
        else if (direction == "in" || direction == "out")
            app->zoomAt(direction == "in" ? 1.25f : 0.8f, {app->rCanvas.x + app->rCanvas.w/2, app->rCanvas.y + app->rCanvas.h/2});
        else throw std::runtime_error("Unknown zoom direction.");
        Json result = Json::object(); result.set("zoom", app->cam[app->view].zoom); return result;
    }
    if (operation == "running") {
        app->simOn = request["running"].boolean(); app->simulator.reset();
        Json result = Json::object(); result.set("running", app->simOn); return result;
    }
    if (operation == "undo" || operation == "redo") {
        if (operation == "undo") app->undo(); else app->redo();
        Json result = Json::object(); result.set("changed", true); return result;
    }
    if (operation == "theme") {
        bool dark = request["theme"].str() == "dark";
        Theme theme;
        theme.bg = dark ? rgba(11,12,15) : rgba(246,250,248);
        theme.panel = dark ? rgba(21,23,27) : rgba(252,254,253);
        theme.panel2 = dark ? rgba(32,35,41) : rgba(235,244,240);
        theme.border = dark ? rgba(60,65,74) : rgba(194,213,205);
        theme.text = dark ? rgba(240,244,247) : rgba(28,48,40);
        theme.textDim = dark ? rgba(166,180,190) : rgba(83,109,98);
        theme.accent = dark ? rgba(139,223,197) : rgba(23,104,86);
        theme.accentText = dark ? rgba(12,35,28) : rgba(250,255,252);
        theme.button = theme.panel; theme.buttonHover = theme.panel2; theme.buttonDown = theme.border; theme.field = theme.panel;
        theme.ok = dark ? rgba(139,223,197) : rgba(23,104,86);
        theme.danger = dark ? rgba(255,180,171) : rgba(178,54,54);
        app->ui.th = theme;
        Json result = Json::object(); result.set("theme", dark ? "dark" : "light"); return result;
    }
    if (operation == "export") {
        const auto format = request["format"].str();
        Json args = Json::object(); args.set("format", format); args.set("view", request["view"].str("breadboard"));
        if (format == "gerber") args.set("path", "/tmp/ohmi-export.zip");
        else if (format != "svg" && format != "bom" && format != "netlist" && format != "spice") throw std::runtime_error("Unsupported export format.");
        bool failed = false; const auto text = session->callTool("export", args, failed);
        if (failed) throw std::runtime_error(text);
        return Json::parse(text);
    }
    if (operation == "tool") {
        const auto name = request["name"].str();
        static const std::set<std::string> allowed = {"list_parts", "get_part_info", "get_design", "new_design", "load_example", "add_part", "set_part_properties", "move_part", "place_on_breadboard", "remove_part", "remove_wire", "connect", "autoroute", "run_drc"};
        if (!allowed.count(name) || !request["arguments"].isObject()) throw std::runtime_error("This tool is not allowed in the browser bridge.");
        if (app->doc.parts.size() >= 200 && name == "add_part") throw std::runtime_error("The bridge limit is 200 parts.");
        if (app->doc.wires.size() >= 798 && name == "connect") throw std::runtime_error("The bridge limit is 800 wires.");
        bool failed = false; const auto text = session->callTool(name, request["arguments"], failed);
        if (failed) throw std::runtime_error(text);
        return Json::parse(text);
    }
    throw std::runtime_error("Unknown bridge operation.");
}
}

void ohmiWebRegister(App* value) {
    app = value;
    // No persistent browser autosave is restored across OHMI accounts.
    app->scratchSession = true;
    app->onDocumentReplaced = [] { ++documentGeneration; };
    session = std::make_unique<McpSession>(&app->doc);
    session->beforeEdit = [] { app->checkpoint(); };
    session->afterEdit = [] { app->doc.syncWireEnds(); app->changed(); app->pruneSelection(); app->drcIssues.clear(); };
    session->onReplaced = [] { replaced(app->doc.uid.empty()); };
}

extern "C" EMSCRIPTEN_KEEPALIVE const char* de_ohmi_dispatch(const char* input) {
    static std::string output;
    Json result = Json::object();
    try {
        if (!input || std::strlen(input) > maxBytes) throw std::runtime_error("Bridge request exceeds 1 MiB.");
        std::string error; const Json request = Json::parse(input, &error);
        if (!error.empty() || !request.isObject()) throw std::runtime_error("Invalid JSON request.");
        bounded(request);
        result.set("result", dispatch(request)); result.set("ok", true);
    } catch (const std::exception& error) {
        result.set("ok", false); result.set("error", error.what());
    }
    output = result.dump();
    if (output.size() > 2 * maxBytes) output = "{\"ok\":false,\"error\":\"Bridge response is too large.\"}";
    return output.c_str();
}
