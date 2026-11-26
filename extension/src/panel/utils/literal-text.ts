const MARKER = "\uE000";
export const LITERAL_TEXT_MARKUP = `${MARKER}__id__\uE001`;
const LITERAL_PATTERN = /\uE000(36|47|64|57344)\uE001/g;

export const literalCharacter = (id: string | number) => String.fromCharCode(Number(id));

export const encodeLiteralCharacter = (character: string) =>
  LITERAL_TEXT_MARKUP.replace("__id__", String(character.charCodeAt(0)));

// The composer stores controls as inline markup. Encode control characters as
// one-character spans so imported text stays editable and displays verbatim.
export const encodeLiteralText = (text: string) =>
  text.replace(/[$/@\uE000]/g, encodeLiteralCharacter);

export function decodeLiteralText(value: string) {
  const literalOffsets: number[] = [];
  let removed = 0;
  const text = value.replace(LITERAL_PATTERN, (match, id: string, offset: number) => {
    literalOffsets.push(offset - removed);
    removed += match.length - 1;
    return literalCharacter(id);
  });
  return { text, literalOffsets };
}

export function maskLiteralControls(text: string, offsets: readonly number[]) {
  if (!offsets.length) return text;
  const characters = text.split("");
  for (const offset of offsets) characters[offset] = "\uFFFC";
  return characters.join("");
}
