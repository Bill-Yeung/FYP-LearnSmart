# Please don't run too many times, it will request use a lot of server resources. 

import json
import os
import time
import requests
from datetime import datetime, timezone

BASE_URL = "https://api.polyhaven.com"

OUT_HDRIS = "polyhaven_scene_catalog.json"
OUT_TEXTURES = "polyhaven_textures_catalog.json"
OUT_MODELS = "polyhaven_models_catalog.json"

HEADERS = {
    "User-Agent": "MyVisionProARApp/0.1 (contact: you@example.com)"
}

SLEEP_SECONDS = 0.12  
MAX_RETRIES = 3
RETRY_BACKOFF = 1.5

TYPE_HDRI = 0
TYPE_TEXTURE = 1
TYPE_MODEL = 2


def http_get_json(session: requests.Session, url: str, params=None):
    last_err = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            r = session.get(url, params=params, timeout=30)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            last_err = e
            time.sleep(RETRY_BACKOFF ** attempt)
    raise RuntimeError(f"GET failed after {MAX_RETRIES} retries: {url}\n{last_err}")


def fetch_files(session, asset_id):
    return http_get_json(session, f"{BASE_URL}/files/{asset_id}")


def build_doc(kind_name: str, ids: list, assets_meta: dict, session: requests.Session):
    doc = {
        "source": "polyhaven",
        "kind": kind_name,
        "api_base": BASE_URL,
        "exported_at_utc": datetime.now(timezone.utc).isoformat(),
        "count": len(ids),
        "assets": {}
    }

    total = len(ids)
    for idx, asset_id in enumerate(ids, start=1):
        meta = assets_meta[asset_id]
        files_tree = fetch_files(session, asset_id)

        doc["assets"][asset_id] = {
            "meta": meta,      
            "files": files_tree
        }

        if idx % 100 == 0 or idx == total:
            print(f"[{kind_name}] {idx}/{total} fetched: {asset_id}")

        time.sleep(SLEEP_SECONDS)

    return doc


def write_json(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)


def main():
    session = requests.Session()
    session.headers.update(HEADERS)


    assets = http_get_json(session, f"{BASE_URL}/assets")
    if not isinstance(assets, dict):
        raise RuntimeError("Unexpected /assets response (expected dict).")

    hdri_ids = [aid for aid, meta in assets.items() if meta.get("type") == TYPE_HDRI]
    texture_ids = [aid for aid, meta in assets.items() if meta.get("type") == TYPE_TEXTURE]
    model_ids = [aid for aid, meta in assets.items() if meta.get("type") == TYPE_MODEL]

    print(f"Total assets: {len(assets)}")
    print(f"HDRIs: {len(hdri_ids)}  Textures: {len(texture_ids)}  Models: {len(model_ids)}")

    hdris_doc = build_doc("hdris", hdri_ids, assets, session)
    textures_doc = build_doc("textures", texture_ids, assets, session)
    models_doc = build_doc("models", model_ids, assets, session)

    write_json(OUT_HDRIS, hdris_doc)
    write_json(OUT_TEXTURES, textures_doc)
    write_json(OUT_MODELS, models_doc)

    print("Done:")
    print(os.path.abspath(OUT_HDRIS))
    print(os.path.abspath(OUT_TEXTURES))
    print(os.path.abspath(OUT_MODELS))


if __name__ == "__main__":
    main()
