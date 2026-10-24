import { CircuitDiagram } from "./circuit-diagram";

export function LibraryDiagram({ kind }: { kind: string }) {
  if (kind === "led") return <><CircuitDiagram /><p className="muted">This example uses 330 ohms. The recognition artwork shows a separate 220-ohm resistor. Choose a value for your supply and LED.</p></>;
  if (!["breadboard", "diode", "switch", "potentiometer"].includes(kind)) return null;
  const description = {
    breadboard: "Two separate groups of five internally connected breadboard sockets, separated by the center gap. Neighboring rows and power rails are not shown.",
    diode: "Anode on the left, cathode bar on the right. The band on the illustrated rectifier body marks the cathode.",
    switch: "SPDT contact topology. A common contact connects to one of two throws. This is not a physical pin-position diagram.",
    potentiometer: "A resistive track between two end terminals, with a separate moving wiper contact. This is a functional symbol, not a physical pinout."
  }[kind];
  return <figure className="library-diagram">
    <svg viewBox="0 0 600 220" role="img" aria-label={description}>
      <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        {kind === "breadboard" && <>{[0, 1].map((side) => <g key={side}>
          <path d={side ? "M360 100H520" : "M80 100H240"} />
          {[0, 1, 2, 3, 4].map((hole) => <circle key={hole} cx={80 + side * 280 + hole * 40} cy="100" r="9" fill="var(--card)" />)}
        </g>)}<path d="M300 45V145" strokeDasharray="6 8" /></>}
        {kind === "diode" && <><path d="M90 100H240M320 100H510M240 65L320 100L240 135ZM320 65V135" /></>}
        {kind === "switch" && <><path d="M100 120H230L365 60M370 60H500M370 145H500" /><circle cx="230" cy="120" r="6" fill="var(--card)" /><circle cx="365" cy="60" r="6" /><circle cx="365" cy="145" r="6" /></>}
        {kind === "potentiometer" && <><path d="M80 90H200V70H400V110H200V90M400 90H520M300 180V110M289 123L300 110L311 123" /></>}
      </g>
      <g fill="currentColor" fontSize="17" fontFamily="inherit" textAnchor="middle">
        {kind === "breadboard" && <><text x="160" y="175">Connected group</text><text x="440" y="175">Separate group</text><text x="300" y="30">Center gap</text></>}
        {kind === "diode" && <><text x="150" y="175">Anode</text><text x="450" y="175">Cathode (band)</text></>}
        {kind === "switch" && <><text x="130" y="175">Common</text><text x="470" y="35">Throw 1</text><text x="470" y="190">Throw 2</text></>}
        {kind === "potentiometer" && <><text x="100" y="50">End A</text><text x="500" y="50">End B</text><text x="300" y="210">Wiper</text></>}
      </g>
    </svg><figcaption>{description}</figcaption>
  </figure>;
}
