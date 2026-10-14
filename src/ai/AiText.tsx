export function AiText({ text }: { text: string }) {
  return <>{text.split(/(```[\s\S]*?```)/g).map((part,index)=>part.startsWith('```') ? <pre key={index} className="ohmi-code"><code>{part.replace(/^```[^\n]*\n?/, '').replace(/```$/, '')}</code></pre> : <p key={index} style={{whiteSpace:'pre-wrap'}}>{part}</p>)}</>;
}
