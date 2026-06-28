const CODE_128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
] as const;

const CODE_128_START_B = 104;
const CODE_128_STOP = 106;
const QUIET_ZONE_MODULES = 10;

const toCode128BValues = (value: string) => {
  const values = [CODE_128_START_B];

  for (const character of value) {
    const codePoint = character.charCodeAt(0);
    if (codePoint < 32 || codePoint > 127) {
      return [];
    }

    values.push(codePoint - 32);
  }

  let checksum = CODE_128_START_B;
  for (let index = 1; index < values.length; index += 1) {
    checksum += values[index] * index;
  }

  values.push(checksum % 103, CODE_128_STOP);
  return values;
};

export const createCode128SvgMarkup = (value: string, options?: { height?: number; moduleWidth?: number }) => {
  const normalizedValue = value.trim();
  const values = toCode128BValues(normalizedValue);
  if (!normalizedValue || values.length === 0) {
    return "";
  }

  const height = options?.height ?? 64;
  const moduleWidth = options?.moduleWidth ?? 2;
  let cursor = QUIET_ZONE_MODULES;
  const bars: string[] = [];

  for (const codeValue of values) {
    const pattern = CODE_128_PATTERNS[codeValue];
    let drawBar = true;

    for (const widthCharacter of pattern) {
      const moduleCount = Number(widthCharacter);

      if (drawBar) {
        bars.push(`<rect x="${cursor * moduleWidth}" y="0" width="${moduleCount * moduleWidth}" height="${height}" />`);
      }

      cursor += moduleCount;
      drawBar = !drawBar;
    }
  }

  const totalWidth = (cursor + QUIET_ZONE_MODULES) * moduleWidth;

  return `<svg class="ims-code128-svg" viewBox="0 0 ${totalWidth} ${height}" role="img" aria-label="Code 128 barcode" xmlns="http://www.w3.org/2000/svg"><rect width="${totalWidth}" height="${height}" fill="#fff"/><g fill="#20242a">${bars.join("")}</g></svg>`;
};
