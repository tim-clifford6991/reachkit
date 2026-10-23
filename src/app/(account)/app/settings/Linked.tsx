// A registry sentence with one of its words as a link, so the sentence stays
// whole in the registry; a sentence the word has gone from renders plain.
import type React from "react";
import Link from "next/link";

export function Linked(p: { sentence: string; word: string; href: string }): React.JSX.Element {
  // The last match, so a word inside an interpolated value (an address) is never the link.
  const at = p.sentence.lastIndexOf(p.word);
  if (at === -1) return <>{p.sentence}</>;
  return (
    <>
      {p.sentence.slice(0, at)}
      <Link href={p.href} className="link">
        {p.word}
      </Link>
      {p.sentence.slice(at + p.word.length)}
    </>
  );
}
