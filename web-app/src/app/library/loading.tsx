export default function Loading() {
  return <div className="stack" aria-busy="true" aria-label="Loading component library"><div className="page-heading"><h1>Circuit Library</h1><p role="status">Loading components…</p></div><div className="library-grid">{[0,1,2].map((item) => <div className="library-skeleton" key={item} />)}</div></div>;
}
