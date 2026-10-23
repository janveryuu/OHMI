"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="panel empty" role="alert">
      <h1>A little hiccup.</h1>
      <p>
        We couldn’t open this view. Your session may still be available. Try
        again.
      </p>
      <button className="input" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
