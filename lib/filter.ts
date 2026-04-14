import { Format } from "./data-loader";

type AxisFilter = {
  hook?: string;
  tone?: string;
  structure?: string;
};

/**
 * 3 軸フィルタ：指定された軸で formats を絞り込む。
 * 未指定の軸は無視。完全一致 → 部分一致（1〜2 軸マッチ）の順で候補を返す。
 */
export function filterFormats(formats: Format[], f: AxisFilter): {
  exact: Format[];
  partial: Format[];
} {
  const provided = Object.entries(f).filter(([, v]) => v);
  if (provided.length === 0) {
    return { exact: [], partial: formats };
  }

  const exact: Format[] = [];
  const partial: Format[] = [];

  for (const fmt of formats) {
    let matches = 0;
    for (const [axis, val] of provided) {
      if ((fmt.axes as any)[axis] === val) matches++;
    }
    if (matches === provided.length) {
      exact.push(fmt);
    } else if (matches > 0) {
      partial.push(fmt);
    }
  }

  return { exact, partial };
}
