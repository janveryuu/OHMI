import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import entries from "@/lib/library.json";
import { LibraryArt } from "@/components/library-art";
import { LibraryDiagram } from "@/components/library-diagram";

export function generateStaticParams() { return entries.map(({ id }) => ({ id })); }
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const item = entries.find((entry) => entry.id === id);
  return { title: item ? item.name + " | Circuit Library" : "Component not found" };
}
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = entries.find((entry) => entry.id === id);
  if (!item) notFound();
  const related = entries.filter((entry) => item.related.includes(entry.id));
  return <article className="stack library-detail">
    <Link href="/library" className="library-back"><ArrowLeft size={18} aria-hidden="true" />Circuit Library</Link>
    <div className="library-overview">
      <figure className="library-portrait"><LibraryArt id={item.id} name={item.name} priority /><figcaption>Recognition illustration. Use the separate technical reference for wiring.</figcaption></figure>
      <div className="library-intro"><p className="muted">{item.category}</p><h1>{item.name}</h1><p>{item.description}</p><h2>What does it do?</h2><p>{item.purpose}</p><h2>When should I use it?</h2><p>{item.useCase}</p></div>
    </div>
    <div className="library-learning">
      <section><h2>Use it with care</h2><p>{item.usage}</p><h3>Common mistake</h3><p>{item.mistake}</p></section>
      <section><h2>Try it yourself</h2><p>{item.activity}</p><p className="muted">Disconnect power before changing connections. Follow your instructor’s guidance for real hardware.</p></section>
    </div>
    <section className="library-reference"><h2>Wiring & technical reference</h2><LibraryDiagram kind={item.diagram} /><p>{item.referenceLabel}. Match the exact component model and orientation before wiring.</p>
      <a href={item.wiringSource} target="_blank" rel="noopener noreferrer">Open technical reference <ArrowUpRight size={16} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>
      <p className="muted">Component details checked against <a href={item.source} target="_blank" rel="noopener noreferrer">{new URL(item.source).hostname}<span className="sr-only"> (opens in a new tab)</span></a> on <time dateTime={item.verifiedOn}>24 October 2026</time>. This does not electrically verify a circuit.</p>
    </section>
    <section><h2>Explore related components</h2><div className="library-related">{related.map((entry) => <Link key={entry.id} href={"/library/" + entry.id}><LibraryArt id={entry.id} name={entry.name} /><span>{entry.name}</span><ArrowUpRight size={16} aria-hidden="true" /></Link>)}</div></section>
  </article>;
}
