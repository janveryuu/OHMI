// PostgREST boundary double; actual ownership/constraints run separately in PostgreSQL.
export async function handleElectronicsRest({
  request,
  url,
  user,
  body,
  state,
  send,
}) {
  const native = url.pathname === "/rest/v1/ohmi_electronics_projects",
    legacy = url.pathname === "/rest/v1/ohmi_playground_projects";
  if (!native && !(legacy && state.electronics)) return false;
  if (!state.electronics) {
    send(404, { code: "PGRST205", message: "Table not found" });
    return true;
  }
  if (!user) {
    send(401, { message: "Sign in" });
    return true;
  }
  const store = state.electronics;
  if (store.delayMs)
    await new Promise((resolve) => setTimeout(resolve, store.delayMs));
  const rows = legacy ? store.legacy : store.projects;
  const matches = (row) =>
    row.user_id === user.id &&
    ["id", "user_id", "revision"].every(
      (key) =>
        !url.searchParams.has(key) ||
        String(row[key]) === url.searchParams.get(key).slice(3),
    );
  const single = String(request.headers.accept || "").includes(
    "vnd.pgrst.object",
  );
  const reply = (values) => send(200, single ? (values[0] ?? null) : values);
  if (request.method === "GET") {
    let found = [...rows.values()]
      .filter(matches)
      .sort(
        (a, b) =>
          b.updated_at.localeCompare(a.updated_at) || b.id.localeCompare(a.id),
      );
    const cursor = url.searchParams
      .get("or")
      ?.match(
        /updated_at\.lt\.([^,]+),and\(updated_at\.eq\.[^,]+,id\.lt\.([^)]*)/,
      );
    if (cursor)
      found = found.filter(
        (row) =>
          row.updated_at < cursor[1] ||
          (row.updated_at === cursor[1] && row.id < cursor[2]),
      );
    const columns = url.searchParams.get("select")?.split(",");
    found = found
      .slice(0, Number(url.searchParams.get("limit") || 1000))
      .map((row) =>
        columns
          ? Object.fromEntries(columns.map((key) => [key, row[key]]))
          : row,
      );
    reply(found);
    return true;
  }
  if (request.method === "POST") {
    if (body.user_id !== user.id) {
      send(403, { code: "42501" });
      return true;
    }
    if (rows.has(body.id)) {
      send(409, { code: "23505" });
      return true;
    }
    const row = {
      ...structuredClone(body),
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    rows.set(row.id, row);
    reply([row]);
    return true;
  }
  if (request.method === "PATCH" || request.method === "DELETE") {
    const found = [...rows.values()].filter(matches);
    for (const row of found) {
      if (request.method === "DELETE") rows.delete(row.id);
      else
        Object.assign(row, structuredClone(body), {
          updated_at: new Date().toISOString(),
        });
    }
    reply(found);
    return true;
  }
  send(405, { message: "Unsupported fixture method" });
  return true;
}

export const legacyFixture = () => ({
  version: 1,
  name: "Legacy switch",
  parts: [
    { id: "b", kind: "battery", x: 0, y: 0, value: 5, closed: false },
    { id: "s", kind: "switch", x: 240, y: 0, value: 2, closed: true },
    { id: "r", kind: "resistor", x: 480, y: 0, value: 330, closed: false },
    { id: "l", kind: "led", x: 720, y: 240, value: 2, closed: false },
  ],
  wires: [
    { id: "w1", from: { part: "b", pin: "p" }, to: { part: "s", pin: "a" } },
    { id: "w2", from: { part: "s", pin: "b" }, to: { part: "r", pin: "a" } },
    { id: "w3", from: { part: "r", pin: "b" }, to: { part: "l", pin: "a" } },
    { id: "w4", from: { part: "l", pin: "k" }, to: { part: "b", pin: "n" } },
  ],
  mission: "switch",
  hints: 2,
  completed: ["led"],
  switchSeen: ["open", "lit"],
});
