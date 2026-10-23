export function CircuitDiagram({ step = 0 }: { step?: number }) {
  return (
    <figure className="circuit-diagram">
      <svg
        viewBox="0 0 600 260"
        role="img"
        aria-labelledby="circuit-title circuit-desc"
      >
        <title id="circuit-title">Example LED series circuit</title>
        <desc id="circuit-desc">
          A five volt DC source connects through a 330 ohm resistor and an LED
          to ground. Power must be disconnected while wiring.
        </desc>
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M90 190V80H220M300 80H390M433 80H510V190H90" />
          <path d="M220 65H300V95H220Z" />
          <path d="M390 58L426 80L390 102ZM433 58V102" />
          <path d="M442 46L460 28M450 58L468 40M452 28H460V36M460 40H468V48" />
          <circle cx="90" cy="135" r="23" fill="var(--card)" />
          <path d="M83 127H97M90 120V134M83 145H97M510 190V205M494 205H526M500 213H520M506 221H514" />
        </g>
        <g
          fill="currentColor"
          fontFamily="inherit"
          fontSize="16"
          textAnchor="middle"
        >
          <text x="90" y="242">
            5 V DC
          </text>
          <text x="260" y="126">
            330 Ω
          </text>
          <text x="410" y="140">
            Red LED
          </text>
          <text x="510" y="246">
            Ground
          </text>
        </g>
        {step > 0 && (
          <circle
            cx={[90, 410, 260, 510, 90][step]}
            cy="80"
            r="7"
            fill="var(--primary)"
          />
        )}
      </svg>
      <figcaption>
        Example schematic, not a wiring verification. Disconnect power before
        making changes.
      </figcaption>
    </figure>
  );
}
