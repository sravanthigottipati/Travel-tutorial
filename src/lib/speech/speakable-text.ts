// Turns the assistant's markdown into plain prose a speech engine can read
// without saying "asterisk asterisk" or reading table pipes aloud.
export function toSpeakableText(markdown: string): string {
  const lines = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\[map:[^\]]*\]/gi, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .split("\n")
    .map((raw) => {
      let line = raw.trim();
      if (/^\|?[\s:|-]+\|?$/.test(line) && line.includes("-")) return "";
      line = line
        .replace(/^#{1,6}\s+/, "")
        .replace(/^>\s?/, "")
        .replace(/^[-*+]\s+/, "")
        .replace(/^\d+[.)]\s+/, "")
        .replace(/^---+$/, "");
      if (line.includes("|")) {
        line = line
          .split("|")
          .map((cell) => cell.trim())
          .filter(Boolean)
          .join(", ");
      }
      line = line
        .replace(/(\*\*|__)(.*?)\1/g, "$2")
        .replace(/[*_`~]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      if (!line) return "";
      return /[.!?:;]$/.test(line) ? line : `${line}.`;
    })
    .filter(Boolean);
  return lines.join(" ");
}

// Chrome's engine silently cuts off long utterances, so speak in sentence-sized pieces.
export function splitIntoChunks(text: string, maxLength = 180): string[] {
  const sentences = text.split(/(?<=[.!?:;])\s+/).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  const push = (piece: string) => {
    if (current && current.length + piece.length + 1 > maxLength) {
      chunks.push(current);
      current = piece;
    } else {
      current = current ? `${current} ${piece}` : piece;
    }
  };

  for (const sentence of sentences) {
    if (sentence.length <= maxLength) {
      push(sentence);
      continue;
    }
    for (const word of sentence.split(" ")) push(word);
  }
  if (current) chunks.push(current);
  return chunks;
}
