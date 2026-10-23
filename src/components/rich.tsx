import { Fragment } from "react";

// Renders a translation with <b>…</b> marks as bold, without raw HTML.
export function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/(<b>.*?<\/b>)/).map((part, i) => {
        const m = /^<b>(.*)<\/b>$/.exec(part);
        return m ? <b key={i}>{m[1]}</b> : <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}
