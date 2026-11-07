"""Offline factual street gazetteer. Never imports addresses from Google.

Python dependencies: osmium, shapely, pymupdf, pypdf, pyproj, numpy.
Inputs are downloaded separately and checksummed; see infra/streets/README.md.
"""
import argparse, gzip, hashlib, json, pathlib, re

import numpy as np
import osmium
import pymupdf
from pypdf import PdfReader
from pyproj import Transformer
from shapely.geometry import Point, shape
from shapely.strtree import STRtree

parser = argparse.ArgumentParser()
parser.add_argument("--cache", type=pathlib.Path, required=True)
parser.add_argument("--output", type=pathlib.Path, required=True)
args = parser.parse_args()
cache = args.cache
records = []
sources = []

def load(name):
    return json.loads((cache / name).read_text(encoding="utf8"))

districts = load("districts.geojson")["features"]
provinces = {f["properties"]["ccdd"] + f["properties"]["ccpp"]: f["properties"]["nombprov"].title() for f in load("provinces.geojson")["features"]}
departments = {f["properties"]["ccdd"]: f["properties"]["nombdep"].title() for f in load("departments.geojson")["features"]}
geometries = [shape(f["geometry"]) for f in districts]
tree = STRtree(geometries)

def admin(lon, lat):
    hits = tree.query(Point(lon, lat), predicate="intersects")
    if len(hits) == 0:
        return None
    p = districts[min(hits, key=lambda n: districts[n]["properties"]["ubigeo"])]["properties"]
    return {"city": p["nombdist"].title(), "district": p["nombdist"].title(), "province": provinces[p["ccdd"] + p["ccpp"]], "state": departments[p["ccdd"]]}

pbf = cache / "peru-261105.osm.pbf"
expected = (cache / "peru-261105.osm.pbf.md5").read_text().split()[0]
with pbf.open("rb") as f:
    assert hashlib.file_digest(f, "md5").hexdigest() == expected
sources.append({"url": "https://download.geofabrik.de/south-america/peru-261105.osm.pbf", "md5": expected, "date": "2026-11-05", "license": "ODbL-1.0"})

class Streets(osmium.SimpleHandler):
    def way(self, way):
        if not way.tags.get("highway"):
            return
        name = way.tags.get("name:es") or way.tags.get("name")
        if not name or len(way.nodes) < 2:
            return
        point = way.nodes[len(way.nodes) // 2]
        if not point.location.valid():
            return
        lon, lat = point.lon, point.lat
        context = admin(lon, lat)
        if context is None:
            return
        aliases = set()
        for key in ["name", "alt_name", "old_name", "official_name", "short_name"]:
            aliases.update(v.strip() for v in way.tags.get(key, "").split(";") if v.strip() and v.strip() != name)
        records.append({"id": f"osm:W:{way.id}", "name": name, "aliases": sorted(aliases), **context,
                        "latitude": round(lat, 7), "longitude": round(lon, 7),
                        "attribution": "© OpenStreetMap contributors / INEI (límites referenciales)",
                        "sourceURL": f"https://www.openstreetmap.org/way/{way.id}", "sourceDate": "2026-11-05"})

osm_cache = cache / "osm-streets-derived.json.gz"
cache_fingerprint = hashlib.sha256((expected + "".join(hashlib.sha256((cache / (n + ".geojson")).read_bytes()).hexdigest() for n in ["districts", "provinces", "departments"])).encode()).hexdigest()
if osm_cache.exists():
    cached = json.loads(gzip.decompress(osm_cache.read_bytes()))
    if cached.get("fingerprint") == cache_fingerprint:
        records = cached["records"]
if not records:
    Streets().apply_file(str(pbf), locations=True, idx="flex_mem")
    osm_cache.write_bytes(gzip.compress(json.dumps({"fingerprint": cache_fingerprint, "records": records}, ensure_ascii=False).encode(), mtime=0))
osm_count = len(records)
assert osm_count > 10000, f"Unexpectedly small national index: {osm_count}"
print(f"OSM_STREETS {osm_count}", flush=True)

pdf_urls = {
    "22": "https://munitrujillo.gob.pe/Archivosvirtual/plandet/AREA%20URBANA%20SECTOR%2022.pdf",
    "20": "https://munitrujillo.gob.pe/Archivosvirtual/plandet/AREA_URBANA_SECTOR_20.pdf",
    "08": "https://munitrujillo.gob.pe/Archivosvirtual/plandet/AREA%20URBANA%20SECTOR%2008.pdf",
    "06": "https://munitrujillo.gob.pe/Archivosvirtual/plandet/AREA%20URBANA%20SECTOR%2006.pdf",
}
prefix = re.compile(r"^(AVENIDA|AV\.?|JIRON|JR\.?|CALLE|CA\.?|PASAJE|PSJE\.?|PS\.?|PROLONGACION|PROL\.?|CARRETERA)\s+(.+)$", re.I)
types = {"AV": "Avenida", "AVENIDA": "Avenida", "JIRON": "Jirón", "JR": "Jirón", "CALLE": "Calle", "CA": "Calle", "PASAJE": "Pasaje", "PSJE": "Pasaje", "PS": "Pasaje", "PROL": "Prolongación", "PROLONGACION": "Prolongación", "CARRETERA": "Carretera"}
transform = Transformer.from_crs(32717, 4326, always_xy=True)
for sector, url in pdf_urls.items():
    file = cache / f"trujillo-sector{sector}.pdf"
    reader = PdfReader(file)
    page = pymupdf.open(file)[0]
    # ArcMap GeoPDF control points are explicit, not coordinates inferred from
    # the user's example. These sheets state WGS84 / UTM zone 17 South.
    text = page.get_text()
    assert "WGS" in text and ("17S" in text or "17 S" in text)
    viewports = reader.pages[0]["/VP"]
    view = max(viewports, key=lambda v: abs(float(v["/BBox"][2] - v["/BBox"][0]) * float(v["/BBox"][3] - v["/BBox"][1])))
    measure = view["/Measure"].get_object()
    assert measure["/Subtype"] == "/GEO"
    local = np.array(list(map(float, measure["/LPTS"]))).reshape(-1, 2)
    ground = np.array(list(map(float, measure["/GPTS"]))).reshape(-1, 2)
    geographic = np.max(np.abs(ground)) < 180
    design = np.column_stack([local, np.ones(len(local))])
    coefficients, _, _, _ = np.linalg.lstsq(design, ground, rcond=None)
    assert np.max(np.abs(design @ coefficients - ground)) < 0.1
    x0, y0, x1, y1 = map(float, view["/BBox"])
    inset = [list(map(float, v["/BBox"])) for v in viewports if v is not view]
    date = str(reader.metadata.creation_date.date()) if reader.metadata.creation_date else "unknown"
    sources.append({"url": url, "sha256": hashlib.sha256(file.read_bytes()).hexdigest(), "date": date, "reference": "WGS84 / UTM 17S; municipal working map; approximate street-label reference"})
    count = 0
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            for span in line["spans"]:
                raw = re.sub(r"\\[^;{}]+;", "", span["text"]).replace("{", "").replace("}", "")
                raw = " ".join(raw.split()).strip()
                match = prefix.match(raw)
                if not match or "�" in raw:
                    continue
                name = types[match[1].upper().rstrip(".")] + " " + match[2].title()
                if len(name) > 160:
                    continue
                bx0, by0, bx1, by1 = span["bbox"]
                x, y = (bx0 + bx1) / 2, page.rect.height - (by0 + by1) / 2
                if not min(x0, x1) <= x <= max(x0, x1) or not min(y0, y1) <= y <= max(y0, y1):
                    continue
                if any(min(b[0], b[2]) <= x <= max(b[0], b[2]) and min(b[1], b[3]) <= y <= max(b[1], b[3]) for b in inset):
                    continue
                northing, easting = np.array([(x - x0) / (x1 - x0), (y - y0) / (y1 - y0), 1]) @ coefficients
                lon, lat = (easting, northing) if geographic else transform.transform(easting, northing)
                assert -8.2 < lat < -8 and -79.15 < lon < -78.9
                context = admin(lon, lat)
                if context is None:
                    continue
                key = hashlib.sha256(f"{sector}|{name}|{x:.3f}|{y:.3f}".encode()).hexdigest()[:16]
                records.append({"id": "mpt:" + key, "name": name, **context,
                                "latitude": round(lat, 7), "longitude": round(lon, 7),
                                "attribution": "Municipalidad Provincial de Trujillo – PLANDET / INEI (límites referenciales)",
                                "sourceURL": url, "sourceDate": date})
                count += 1
    print(f"MUNICIPAL_SECTOR_{sector} {count}", flush=True)

records = list({r["id"]: r for r in records}.values())
records.sort(key=lambda r: r["id"])
assert len({r["id"] for r in records}) == len(records)
payload = json.dumps({"version": 1, "records": records}, ensure_ascii=False, separators=(",", ":")).encode()
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_bytes(gzip.compress(payload, compresslevel=9, mtime=0))
administrative_sources = [{"url": "https://geoespacial.inei.gob.pe/geoserver/Interoperabilidad/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=Interoperabilidad:" + layer + "&outputFormat=application/json&srsName=EPSG:4326", "sha256": hashlib.sha256((cache / (name + ".geojson")).read_bytes()).hexdigest(), "referenceDate": "2022"} for name, layer in [("districts", "ig_distrito"), ("provinces", "ig_provincia"), ("departments", "ig_departamento")]]
manifest = {"records": len(records), "osmRecords": osm_count, "municipalRecords": len(records) - osm_count, "districtNames": len({r["district"] for r in records}), "departments": len({r["state"] for r in records}), "sources": sources, "administrativeSources": administrative_sources, "outputSHA256": hashlib.sha256(args.output.read_bytes()).hexdigest()}
args.output.with_suffix(".manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf8")
print(json.dumps({k: v for k, v in manifest.items() if k != "sources"}), flush=True)
