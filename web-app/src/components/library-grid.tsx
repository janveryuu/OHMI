"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowUpRight, Search } from "lucide-react";
import entries from "@/lib/library.json";
import { Button } from "./ui/button";
import { LibraryArt } from "./library-art";

const categories = ["All components", ...new Set(entries.map((item) => item.category))];
export function LibraryGrid() {
  const params = useSearchParams();
  const query = params.get("q") || "";
  const requested = params.get("category") || categories[0];
  const category = categories.includes(requested) ? requested : categories[0];
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const items = entries.filter((item) => {
    const text = [item.name, item.category, ...item.keywords].join(" ").toLowerCase();
    return (category === categories[0] || item.category === category) && terms.every((term) => text.includes(term));
  });
  function update(key: "q" | "category", value: string) {
    const next = new URLSearchParams(window.location.search);
    if (!value || value === categories[0]) next.delete(key); else next.set(key, value);
    window.history.replaceState(null, "", "/app/library/" + (next.size ? "?" + next : ""));
  }
  return <div className="stack library-page">
    <div className="page-heading"><h1>Circuit Library</h1><p>Meet the parts. Understand their purpose. Build with a little more confidence.</p></div>
    <div className="library-tools">
      <label className="field" htmlFor="library-search">Find a component</label>
      <div className="library-search"><Search size={20} aria-hidden="true" /><input id="library-search" className="input" type="search" name="library-search" autoComplete="off" placeholder="Try LED, sensor or motor…" value={query} onChange={(event) => update("q", event.target.value)} /></div>
      <div className="library-categories" role="group" aria-label="Component categories">
        {categories.map((name) => <Button key={name} variant={category === name ? "default" : "outline"} aria-pressed={category === name} onClick={() => update("category", name)}>{name}</Button>)}
      </div>
    </div>
    <div className="library-results"><p role="status" aria-live="polite">{items.length} {items.length === 1 ? "component" : "components"}</p><span>Illustrations for recognition. Wiring references inside.</span></div>
    {items.length ? <div className="library-grid">{items.map((item, index) =>
      <Link className="library-card" href={"/library/" + item.id} key={item.id}>
        <LibraryArt id={item.id} name={item.name} priority={index === 0} />
        <div className="library-card-copy"><span className="muted">{item.category}</span><h2>{item.name}<ArrowUpRight size={18} aria-hidden="true" /></h2><p>{item.description}</p></div>
      </Link>)}</div> :
      <div className="library-empty"><h2>No matching components</h2><p>Try another name or clear the filters to see all 20 components.</p><Button onClick={() => window.history.replaceState(null, "", "/app/library/")}>Clear filters</Button></div>}
  </div>;
}
