"""
LEVITATE / Grocery Product Image Engine — V1
=============================================

Reads a product catalog (CSV/Excel), matches each SKU to a product image
using a source-priority waterfall (GTIN -> supplier -> Open Food Facts ->
generic produce library -> "image required"), scores confidence, runs an
OCR-based verification check, and exports a corrected catalog.

This is a runnable reference implementation. Two things are intentionally
pluggable because they depend on infrastructure this sandbox doesn't have
network access to:

  1. OPEN_FOOD_FACTS lookups  -> `OpenFoodFactsClient.lookup()`
     Real version should read Open Food Facts' AWS-hosted bulk data
     (their docs recommend the AWS dataset over hammering the live API
     for bulk retrieval), or call https://world.openfoodfacts.org/api/v2/
     product/<barcode>.json for one-off lookups.

  2. OCR verification -> `ocr_extract()`
     Real version should call Google Vision or Tesseract on the
     downloaded image. Here it's stubbed to simulate output so the
     confidence/matching logic can be exercised end-to-end.

Swap those two functions for real API/OCR calls and the rest of the
pipeline (normalization, matching, scoring, review routing, image
processing hooks, storage layout, CSV export) works unchanged.

Usage:
    python image_engine.py --input catalog.csv --output catalog_matched.csv
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
from dataclasses import dataclass, field, asdict
from enum import Enum
from pathlib import Path
from typing import Optional


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

class ImageSource(str, Enum):
    EXACT_GTIN = "EXACT_GTIN"
    SUPPLIER = "SUPPLIER_IMAGE"
    MANUFACTURER = "MANUFACTURER_IMAGE"
    OWN_CATALOG = "OWN_CATALOG"
    OPEN_FOOD_FACTS = "OPEN_FOOD_FACTS"
    OPENVERSE = "OPENVERSE"
    HUMAN_UPLOAD = "HUMAN_UPLOAD"
    NONE = "IMAGE_REQUIRED"


class ProductType(str, Enum):
    PACKAGED = "PACKAGED"
    LOOSE_PRODUCE = "LOOSE_PRODUCE"


class ReviewStatus(str, Enum):
    AUTO_APPROVE = "AUTO_APPROVE"
    SAMPLE_REVIEW = "AUTO_APPROVE_SAMPLE_REVIEW"
    HUMAN_REVIEW = "HUMAN_REVIEW"
    RE_MATCH = "RE_MATCH"
    REJECT = "REJECT"
    MISSING = "MISSING"


@dataclass
class Product:
    product_id: str
    sku: str
    barcode: str
    product_name: str
    brand: str
    category: str
    variant: str = ""
    pack_size: str = ""
    unit: str = ""

    # normalized fields filled in during processing
    norm_name: str = field(default="", repr=False)
    norm_brand: str = field(default="", repr=False)
    norm_variant: str = field(default="", repr=False)
    product_type: ProductType = ProductType.PACKAGED


@dataclass
class ImageCandidate:
    image_url: str
    source: ImageSource
    license: str
    license_url: str = ""
    source_url: str = ""
    ocr_text: str = ""
    width: int = 0
    height: int = 0


@dataclass
class MatchResult:
    product: Product
    image: Optional[ImageCandidate]
    match_method: str
    confidence_score: int
    quality_score: int
    status: ReviewStatus
    notes: str = ""

    def to_row(self) -> dict:
        return {
            "SKU": self.product.sku,
            "PRODUCT": self.product.product_name,
            "BARCODE": self.product.barcode,
            "IMAGE_URL": self.image.image_url if self.image else "",
            "IMAGE_SOURCE": self.image.source.value if self.image else ImageSource.NONE.value,
            "IMAGE_LICENSE": self.image.license if self.image else "",
            "IMAGE_CONFIDENCE": self.confidence_score,
            "IMAGE_STATUS": self.status.value,
            "MATCH_METHOD": self.match_method,
            "NOTES": self.notes,
        }


# ---------------------------------------------------------------------------
# Normalization
# ---------------------------------------------------------------------------

_UNIT_WORDS = {"g", "gm", "gms", "gram", "grams", "kg", "ml", "l", "ltr", "litre", "liter", "pcs", "pack"}
_PRODUCE_KEYWORDS = {
    "lemon", "nimbu", "potato", "aloo", "onion", "pyaz", "tomato", "tamatar",
    "carrot", "gajar", "cabbage", "patta gobi", "cauliflower", "gobi",
    "apple", "banana", "orange", "grapes", "mango", "papaya",
}


def normalize_text(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r"[^\w\s]", " ", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def classify_product_type(product: Product) -> ProductType:
    name = product.norm_name
    if not product.barcode or product.barcode.strip() in ("", "0", "NA", "N/A"):
        for kw in _PRODUCE_KEYWORDS:
            if kw in name:
                return ProductType.LOOSE_PRODUCE
    return ProductType.PACKAGED


def normalize_product(p: Product) -> Product:
    p.norm_name = normalize_text(p.product_name)
    p.norm_brand = normalize_text(p.brand)
    p.norm_variant = normalize_text(p.variant)
    p.product_type = classify_product_type(p)
    return p


# ---------------------------------------------------------------------------
# Pluggable external lookups
# ---------------------------------------------------------------------------

class OpenFoodFactsClient:
    """
    Stub client. Replace `lookup` with either:
      - a lookup against a locally synced Open Food Facts AWS bulk dataset
        (recommended for bulk jobs), or
      - a call to https://world.openfoodfacts.org/api/v2/product/<barcode>.json
        (fine for occasional/one-off lookups, not bulk).

    Open Food Facts image data is distributed under CC BY-SA — always
    carry `license` / `license_url` / `source_url` through so attribution
    isn't lost downstream.
    """

    def __init__(self, local_index: Optional[dict] = None):
        # local_index: {barcode: {"image_url":..., "product_name":..., ...}}
        self.local_index = local_index or {}

    def lookup(self, barcode: str) -> Optional[ImageCandidate]:
        if not barcode:
            return None
        record = self.local_index.get(barcode)
        if not record:
            return None
        return ImageCandidate(
            image_url=record["image_url"],
            source=ImageSource.OPEN_FOOD_FACTS,
            license="CC-BY-SA",
            license_url="https://creativecommons.org/licenses/by-sa/3.0/",
            source_url=f"https://world.openfoodfacts.org/product/{barcode}",
        )


class ProduceLibrary:
    """Own controlled library of generic produce images, keyed by
    (produce name, variant) e.g. ('lemon', 'yellow')."""

    def __init__(self, mapping: Optional[dict] = None):
        self.mapping = mapping or {}

    def lookup(self, product: Product) -> Optional[ImageCandidate]:
        for kw in _PRODUCE_KEYWORDS:
            if kw in product.norm_name:
                key = kw
                variant = None
                for token in product.norm_name.split():
                    if token in {"yellow", "green", "red", "white", "brown", "baby"}:
                        variant = token
                        break
                entry = self.mapping.get((key, variant)) or self.mapping.get((key, None))
                if entry:
                    return ImageCandidate(
                        image_url=entry["image_url"],
                        source=ImageSource.OWN_CATALOG,
                        license="OWNED",
                    )
        return None


def ocr_extract(image: ImageCandidate) -> str:
    """
    Stub OCR. Replace with a real call, e.g.:

        from google.cloud import vision
        client = vision.ImageAnnotatorClient()
        response = client.text_detection(image=vision.Image(content=image_bytes))
        return response.text_annotations[0].description if response.text_annotations else ""

    Here we just echo back any ocr_text already attached to the candidate
    (useful for tests / local datasets that pre-supply OCR text).
    """
    return image.ocr_text or ""


# ---------------------------------------------------------------------------
# Matching + scoring
# ---------------------------------------------------------------------------

def token_overlap_score(a: str, b: str) -> float:
    """Simple bag-of-words overlap ratio, 0..1."""
    ta, tb = set(a.split()), set(b.split())
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def score_match(product: Product, image: ImageCandidate) -> tuple[int, str]:
    """
    Confidence scoring per spec:
      exact barcode +50, brand match +15, product-name match +15,
      variant match +10, pack-size match +5, image quality +5 (max 100).
    """
    score = 0
    reasons = []

    if image.source in (ImageSource.EXACT_GTIN, ImageSource.OPEN_FOOD_FACTS) and product.barcode:
        score += 50
        reasons.append("barcode+50")

    ocr_text = normalize_text(ocr_extract(image))

    if product.norm_brand and product.norm_brand in ocr_text:
        score += 15
        reasons.append("brand+15")
    elif product.norm_brand and token_overlap_score(product.norm_brand, ocr_text) > 0.5:
        score += 10
        reasons.append("brand~+10")

    if product.norm_name and token_overlap_score(product.norm_name, ocr_text) > 0.6:
        score += 15
        reasons.append("name+15")

    if product.norm_variant:
        if product.norm_variant in ocr_text:
            score += 10
            reasons.append("variant+10")
        else:
            # explicit mismatch on a stated variant is a hard signal
            reasons.append("variant_mismatch")

    if product.pack_size and re.sub(r"\s", "", product.pack_size.lower()) in re.sub(r"\s", "", ocr_text):
        score += 5
        reasons.append("pack+5")

    # image quality placeholder — real version scores resolution/sharpness/bg
    quality = 90 if image.width >= 400 and image.height >= 400 else 60
    if quality >= 80:
        score += 5
        reasons.append("quality+5")

    # produce / own-catalog images are pre-verified by construction
    if image.source == ImageSource.OWN_CATALOG and product.product_type == ProductType.LOOSE_PRODUCE:
        score = 99
        reasons = ["own_catalog_produce"]

    return min(score, 100), ",".join(reasons)


def route_status(score: int, has_variant: bool, variant_mismatch: bool) -> ReviewStatus:
    if variant_mismatch and has_variant:
        return ReviewStatus.REJECT
    if score >= 95:
        return ReviewStatus.AUTO_APPROVE
    if score >= 85:
        return ReviewStatus.SAMPLE_REVIEW
    if score >= 70:
        return ReviewStatus.HUMAN_REVIEW
    if score >= 50:
        return ReviewStatus.RE_MATCH
    return ReviewStatus.REJECT


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

class ImageEngine:
    def __init__(self, off_client: OpenFoodFactsClient, produce_lib: ProduceLibrary,
                 supplier_index: Optional[dict] = None):
        self.off_client = off_client
        self.produce_lib = produce_lib
        self.supplier_index = supplier_index or {}  # {barcode_or_sku: ImageCandidate}

    def find_candidate(self, product: Product) -> tuple[Optional[ImageCandidate], str]:
        # 1. supplier / own catalog by exact barcode or SKU
        rec = self.supplier_index.get(product.barcode) or self.supplier_index.get(product.sku)
        if rec:
            return rec, "SUPPLIER_EXACT"

        # 2. produce library for loose produce
        if product.product_type == ProductType.LOOSE_PRODUCE:
            img = self.produce_lib.lookup(product)
            if img:
                return img, "CATEGORY_VARIANT"

        # 3. Open Food Facts by GTIN
        img = self.off_client.lookup(product.barcode)
        if img:
            return img, "EXACT_GTIN"

        return None, "NO_MATCH"

    def process(self, product: Product) -> MatchResult:
        normalize_product(product)
        image, method = self.find_candidate(product)

        if image is None:
            return MatchResult(
                product=product, image=None, match_method=method,
                confidence_score=0, quality_score=0,
                status=ReviewStatus.MISSING, notes="No candidate found in any source",
            )

        score, reasons = score_match(product, image)
        variant_mismatch = "variant_mismatch" in reasons
        status = route_status(score, bool(product.norm_variant), variant_mismatch)

        return MatchResult(
            product=product, image=image, match_method=method,
            confidence_score=score, quality_score=90 if image.width >= 400 else 60,
            status=status, notes=reasons,
        )

    def process_catalog(self, products: list[Product]) -> list[MatchResult]:
        return [self.process(p) for p in products]


# ---------------------------------------------------------------------------
# I/O
# ---------------------------------------------------------------------------

def load_catalog(path: str) -> list[Product]:
    p = Path(path)
    if p.suffix.lower() in (".xlsx", ".xls"):
        import openpyxl  # requires: pip install openpyxl --break-system-packages
        wb = openpyxl.load_workbook(p, read_only=True)
        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        header, data_rows = rows[0], rows[1:]
        header = [str(h).strip().lower() for h in header]
        products = []
        for r in data_rows:
            d = dict(zip(header, r))
            products.append(_row_to_product(d))
        return products
    else:
        with open(p, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            return [_row_to_product({k.lower(): v for k, v in row.items()}) for row in reader]


def _row_to_product(d: dict) -> Product:
    def g(*keys, default=""):
        for k in keys:
            if k in d and d[k] not in (None, ""):
                return str(d[k])
        return default

    return Product(
        product_id=g("product_id", "id", default=""),
        sku=g("sku", default=""),
        barcode=g("barcode", "gtin", "ean", default=""),
        product_name=g("product_name", "product", "name", default=""),
        brand=g("brand", default=""),
        category=g("category", default=""),
        variant=g("variant", default=""),
        pack_size=g("pack_size", "packsize", default=""),
        unit=g("unit", default=""),
    )


def write_results(results: list[MatchResult], path: str) -> None:
    fieldnames = ["SKU", "PRODUCT", "BARCODE", "IMAGE_URL", "IMAGE_SOURCE",
                  "IMAGE_LICENSE", "IMAGE_CONFIDENCE", "IMAGE_STATUS",
                  "MATCH_METHOD", "NOTES"]
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in results:
            writer.writerow(r.to_row())


def summarize(results: list[MatchResult]) -> dict:
    counts: dict[str, int] = {}
    for r in results:
        counts[r.status.value] = counts.get(r.status.value, 0) + 1
    total = len(results)
    have_image = sum(1 for r in results if r.image is not None)
    coverage = round(100 * have_image / total, 1) if total else 0.0
    return {"total_products": total, "coverage_pct": coverage, "by_status": counts}


# ---------------------------------------------------------------------------
# Demo data (used only if no --input is given)
# ---------------------------------------------------------------------------

def demo_catalog() -> list[Product]:
    return [
        Product("P000001", "SKU-0001", "8901234567890", "Maggi 2-Minute Masala Noodles", "Maggi",
                "Food", variant="Masala", pack_size="70g"),
        Product("P000002", "SKU-0002", "8901234567891", "Maggi 2-Minute Masala Noodles", "Maggi",
                "Food", variant="Chicken", pack_size="70g"),
        Product("P000015", "BC-000015", "", "Lemon Nimbu Yellow", "", "Produce", pack_size="250g"),
        Product("P000016", "BC-000016", "", "Lemon Nimbu Yellow", "", "Produce", pack_size="500g"),
        Product("P000030", "SKU-0030", "8909999999999", "Unknown Snack Bar", "GenericCo", "Food"),
    ]


def demo_off_index() -> dict:
    return {
        "8901234567890": {"image_url": "https://images.example/off/8901234567890.jpg"},
    }


def demo_supplier_index() -> dict:
    return {
        "8901234567890": ImageCandidate(
            image_url="https://cdn.example/supplier/maggi_masala_70g.jpg",
            source=ImageSource.SUPPLIER, license="SUPPLIER_LICENSED",
            ocr_text="MAGGI 2-MINUTE MASALA 70g", width=800, height=800,
        ),
        "8901234567891": ImageCandidate(
            # deliberately wrong image attached to this barcode, to show REJECT
            image_url="https://cdn.example/supplier/maggi_masala_70g.jpg",
            source=ImageSource.SUPPLIER, license="SUPPLIER_LICENSED",
            ocr_text="MAGGI 2-MINUTE MASALA 70g", width=800, height=800,
        ),
    }


def demo_produce_lib() -> dict:
    return {
        ("lemon", "yellow"): {"image_url": "https://cdn.example/produce/lemon_yellow.jpg"},
        ("lemon", None): {"image_url": "https://cdn.example/produce/lemon_default.jpg"},
    }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description="Grocery Product Image Engine")
    ap.add_argument("--input", help="Path to catalog CSV/XLSX", default=None)
    ap.add_argument("--output", help="Path to write matched catalog CSV",
                     default="catalog_matched.csv")
    args = ap.parse_args()

    off_client = OpenFoodFactsClient(local_index=demo_off_index())
    produce_lib = ProduceLibrary(mapping=demo_produce_lib())
    supplier_index = demo_supplier_index()
    engine = ImageEngine(off_client, produce_lib, supplier_index)

    if args.input:
        products = load_catalog(args.input)
    else:
        print("[no --input given, running on built-in demo catalog]\n", file=sys.stderr)
        products = demo_catalog()

    results = engine.process_catalog(products)
    write_results(results, args.output)

    summary = summarize(results)
    print(json.dumps(summary, indent=2))
    print(f"\nWrote {len(results)} rows to {args.output}")


if __name__ == "__main__":
    main()
