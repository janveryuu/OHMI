import Link from "next/link";
export default function NotFound() {
  return (
    <div className="panel empty">
      <h1>A little off the path.</h1>
      <p>This page does not exist. Let’s get you back to your workspace.</p>
      <Link className="text-link" href="/">
        Back to dashboard
      </Link>
    </div>
  );
}
