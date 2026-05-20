import json
import os
import sys
from collections import Counter

DEFAULT_INPUTS = [
    "polyhaven_hdris.json",
    "polyhaven_textures.json",
    "polyhaven_models.json",
]

OUT_FILE = "format_counts.json"


def iter_exts_from_files_tree(files_tree):
    """
    Poly Haven /files/{id} 回來的 files tree 常見結構：
    { MapName: { Resolution: { Ext: {size,url,md5} } } }
    但不同資產可能深度稍有不同，所以用「遇到 dict 且包含 url」當葉節點。
    """
    if not isinstance(files_tree, dict):
        return

    for _k1, v1 in files_tree.items():
        if not isinstance(v1, dict):
            continue

        for _k2, v2 in v1.items():
            if not isinstance(v2, dict):
                continue

            for ext, meta in v2.items():
                if isinstance(meta, dict) and "url" in meta:
                    yield str(ext).lower()


def count_formats_in_doc(doc):
    """
    doc 格式（你之前 dump 的 3-json）：
    {
      "kind": "...",
      "assets": {
         "AssetId": {"meta": {...}, "files": {...}},
         ...
      }
    }
    """
    assets = doc.get("assets", {})
    if not isinstance(assets, dict):
        return Counter()

    c = Counter()
    for _asset_id, entry in assets.items():
        if not isinstance(entry, dict):
            continue
        files_tree = entry.get("files", {})
        for ext in iter_exts_from_files_tree(files_tree):
            c[ext] += 1
    return c


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def main():
    # 用法：
    # python count_polyhaven_formats.py                 -> 用預設 3 個檔
    # python count_polyhaven_formats.py polyhaven_models.json  -> 只計 1 個檔
    inputs = sys.argv[1:] if len(sys.argv) > 1 else DEFAULT_INPUTS

    total_counter = Counter()
    per_file = {}

    for path in inputs:
        if not os.path.exists(path):
            print(f"Skip (not found): {path}")
            continue

        doc = load_json(path)
        c = count_formats_in_doc(doc)
        per_file[path] = {
            "unique_format_count": len(c),
            "counts": dict(c)
        }
        total_counter.update(c)

    result = {
        "inputs": inputs,
        "total_unique_format_count": len(total_counter),
        "total_counts": dict(total_counter),
        "per_file": per_file
    }

    # 輸出 JSON
    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    # Console 顯示（由多到少）
    print("Total unique formats =", result["total_unique_format_count"])
    for ext, n in total_counter.most_common():
        print(f"{ext}: {n}")

    print("Wrote:", os.path.abspath(OUT_FILE))


if __name__ == "__main__":
    main()