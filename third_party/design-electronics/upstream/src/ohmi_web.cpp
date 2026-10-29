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

Json observe(Document& document, double seconds) {
    if (!std::isfinite(seconds) || seconds < 0.05 || seconds > 5 || document.parts.size() > 100)
        throw std::runtime_error("Observation supports 0.05 to 5 seconds and up to 100 parts.");
    document.syncWireEnds();
    Connectivity connectivity; connectivity.build(document);
    Simulator simulator;
    Json samples = Json::array();
    for (double time = 0; time < seconds - 0.000001; time += 0.05) {
        const auto result = simulator.step(document, connectivity, {}, std::min(0.05, seconds - time));
        Json sample = Json::object(), leds = Json::object(), errors = Json::array(), warnings = Json::array(), damaged = Json::array();
        for (const auto& value : result.brightness) leds.set(std::to_string(value.first), value.second);
        for (const auto& value : result.code) if (!value.second.error.empty()) {
            Json error = Json::object(); error.set("part", value.first); error.set("line", value.second.errorLine); error.set("message", value.second.error); errors.push(error);
        }
        for (const auto& value : result.warnings) warnings.push(value);
        for (const auto& value : result.damaged) damaged.push(value);
        sample.set("time", result.time); sample.set("leds", leds); sample.set("errors", errors); sample.set("warnings", warnings); sample.set("damaged", damaged);
        samples.push(sample);
    }
    Json output = Json::object(); output.set("samples", samples); output.set("engine", "designElectronics interpreter; not hardware verification"); return output;
}

Json dispatch(const Json& request) {
    const std::string operation = request["operation"].str();
    if (operation == "status") {
        Json result = Json::object(); result.set("ready", app != nullptr); result.set("catalogCount", (int)partLibrary().size()); result.set("protocol", 1);
        if (app) result.set("documentId", documentIdentity());
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
