from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INDEX_PATH = PROJECT_ROOT / "data" / "outputs" / "rag_compliance_index_v1.json"
DEFAULT_PERSIST_DIR = PROJECT_ROOT / "rag" / "chroma_db"
DEFAULT_COLLECTION_NAME = "aria_regulatory_corpus_v1"
EMBEDDING_DIMENSIONS = 384

TOKEN_PATTERN = re.compile(r"[a-z0-9_]+")
TOKEN_SYNONYMS = {
    "licence": "license",
    "licences": "license",
    "licensing": "license",
    "licenses": "license",
    "registered": "registration",
    "register": "registration",
    "regularise": "regularize",
    "regularised": "regularized",
    "regularisable": "regularizable",
    "regularisation": "regularization",
    "regularising": "regularizing",
    "athina": "athens",
    "str": "short term rental",
}


@dataclass(frozen=True)
class CorpusDocument:
    id: str
    text: str
    metadata: dict[str, str]


def _normalise_token(token: str) -> str:
    return TOKEN_SYNONYMS.get(token, token)


def _terms(text: str) -> list[str]:
    tokens = [_normalise_token(token) for token in TOKEN_PATTERN.findall(text.lower())]
    terms = list(tokens)
    terms.extend(f"{tokens[i]} {tokens[i + 1]}" for i in range(len(tokens) - 1))
    terms.extend(
        f"{tokens[i]} {tokens[i + 1]} {tokens[i + 2]}"
        for i in range(len(tokens) - 2)
    )
    return terms


def embed_text(text: str, dimensions: int = EMBEDDING_DIMENSIONS) -> list[float]:
    """Deterministic local embedding for reproducible ChromaDB demo retrieval."""
    vector = [0.0] * dimensions

    for term in _terms(text):
        digest = hashlib.sha256(term.encode("utf-8")).digest()
        index = int.from_bytes(digest[:4], "little") % dimensions
        sign = 1.0 if digest[4] & 1 else -1.0
        weight = 1.0

        if any(keyword in term for keyword in ("registration", "license", "freeze", "enforcement", "loi")):
            weight += 1.5
        if " " in term:
            weight += 0.3

        vector[index] += sign * weight

    norm = math.sqrt(sum(value * value for value in vector)) or 1.0
    return [value / norm for value in vector]


def _document_embedding_text(document: CorpusDocument) -> str:
    metadata = document.metadata
    return " ".join(
        [
            metadata["category"],
            metadata["category"],
            metadata["title"],
            metadata["title"],
            metadata["citation"],
            document.text,
        ]
    )


def load_corpus(index_path: Path = DEFAULT_INDEX_PATH) -> list[CorpusDocument]:
    if not index_path.exists():
        raise FileNotFoundError(f"Compliance corpus not found: {index_path}")

    raw = json.loads(index_path.read_text(encoding="utf-8"))
    documents = raw.get("documents")
    if not isinstance(documents, list) or not documents:
        raise ValueError(f"No documents found in compliance corpus: {index_path}")

    required_fields = {"id", "category", "title", "text", "citation"}
    parsed: list[CorpusDocument] = []

    for position, item in enumerate(documents, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"Document {position} is not an object")

        missing = sorted(required_fields - item.keys())
        if missing:
            raise ValueError(f"Document {position} is missing fields: {', '.join(missing)}")

        parsed.append(
            CorpusDocument(
                id=str(item["id"]),
                text=str(item["text"]),
                metadata={
                    "category": str(item["category"]),
                    "title": str(item["title"]),
                    "citation": str(item["citation"]),
                    "source_index": index_path.name,
                },
            )
        )

    ids = [document.id for document in parsed]
    if len(ids) != len(set(ids)):
        raise ValueError("Compliance corpus contains duplicate document ids")

    return parsed


def require_chromadb() -> Any:
    try:
        import chromadb
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "ChromaDB is not installed. Install it with: python -m pip install chromadb"
        ) from exc

    return chromadb


def _open_collection(persist_dir: Path, collection_name: str):
    chromadb = require_chromadb()
    persist_dir.mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(path=str(persist_dir))
    return client.get_or_create_collection(
        name=collection_name,
        metadata={
            "description": "ARIA Phase 5 regulatory corpus for Athens AMA and Paris Loi Le Meur retrieval",
            "embedding_backend": "local_hash_v1",
            "hnsw:space": "cosine",
        },
    )


def _safe_reset_persist_dir(persist_dir: Path) -> None:
    target = persist_dir.resolve()
    rag_root = (PROJECT_ROOT / "rag").resolve()

    if not target.exists():
        return
    if target == rag_root or rag_root not in target.parents:
        raise ValueError(f"Refusing to reset path outside rag/: {target}")

    shutil.rmtree(target)


def build_collection(
    index_path: Path = DEFAULT_INDEX_PATH,
    persist_dir: Path = DEFAULT_PERSIST_DIR,
    collection_name: str = DEFAULT_COLLECTION_NAME,
    reset: bool = False,
) -> int:
    if reset:
        _safe_reset_persist_dir(persist_dir)

    documents = load_corpus(index_path)
    collection = _open_collection(persist_dir, collection_name)

    collection.upsert(
        ids=[document.id for document in documents],
        documents=[document.text for document in documents],
        metadatas=[document.metadata for document in documents],
        embeddings=[embed_text(_document_embedding_text(document)) for document in documents],
    )

    return collection.count()


def query_collection(
    query: str,
    top_k: int = 5,
    index_path: Path = DEFAULT_INDEX_PATH,
    persist_dir: Path = DEFAULT_PERSIST_DIR,
    collection_name: str = DEFAULT_COLLECTION_NAME,
) -> list[dict[str, Any]]:
    if top_k < 1:
        raise ValueError("top_k must be at least 1")

    collection = _open_collection(persist_dir, collection_name)
    if collection.count() == 0:
        build_collection(index_path=index_path, persist_dir=persist_dir, collection_name=collection_name)

    results = collection.query(
        query_embeddings=[embed_text(query)],
        n_results=top_k,
        include=["documents", "metadatas", "distances"],
    )

    rows: list[dict[str, Any]] = []
    result_ids = results.get("ids", [[]])[0]
    result_documents = results.get("documents", [[]])[0]
    result_metadatas = results.get("metadatas", [[]])[0]
    result_distances = results.get("distances", [[]])[0]

    for doc_id, document, metadata, distance in zip(
        result_ids,
        result_documents,
        result_metadatas,
        result_distances,
    ):
        rows.append(
            {
                "id": doc_id,
                "category": metadata.get("category", ""),
                "title": metadata.get("title", ""),
                "citation": metadata.get("citation", ""),
                "distance": round(float(distance), 6),
                "text": document,
            }
        )

    return rows


def validate_collection(
    index_path: Path = DEFAULT_INDEX_PATH,
    persist_dir: Path = DEFAULT_PERSIST_DIR,
    collection_name: str = DEFAULT_COLLECTION_NAME,
) -> list[dict[str, Any]]:
    build_collection(index_path=index_path, persist_dir=persist_dir, collection_name=collection_name)

    checks = [
        {
            "name": "Athens AMA registration",
            "query": "Is AMA registration mandatory for Athens short-term rentals?",
            "expected_category": "AMA_REGISTRATION",
        },
        {
            "name": "Central Athens freeze",
            "query": "Can an unlicensed central Athens listing regularize after the Dec 2024 freeze?",
            "expected_category": "AMA_FREEZE",
        },
        {
            "name": "Athens enforcement",
            "query": "What happens when enforcement removes unlicensed Athens listings?",
            "expected_category": "AMA_ENFORCEMENT",
        },
        {
            "name": "Paris Loi Le Meur",
            "query": "What does Loi Le Meur change for Paris primary residences?",
            "expected_category": "LOI_LE_MEUR",
        },
    ]

    validation_rows: list[dict[str, Any]] = []
    failures: list[str] = []

    for check in checks:
        hits = query_collection(
            check["query"],
            top_k=5,
            index_path=index_path,
            persist_dir=persist_dir,
            collection_name=collection_name,
        )
        categories = [hit["category"] for hit in hits]
        passed = check["expected_category"] in categories[:3]
        top_hit = hits[0] if hits else {}

        validation_rows.append(
            {
                "name": check["name"],
                "query": check["query"],
                "expected_category": check["expected_category"],
                "passed": passed,
                "top_hit": {
                    "id": top_hit.get("id", ""),
                    "category": top_hit.get("category", ""),
                    "title": top_hit.get("title", ""),
                    "citation": top_hit.get("citation", ""),
                    "distance": top_hit.get("distance", ""),
                },
            }
        )

        if not passed:
            failures.append(f"{check['name']} expected {check['expected_category']} in top 3")

    if failures:
        raise AssertionError("; ".join(failures))

    return validation_rows


def print_query_results(rows: list[dict[str, Any]], as_json: bool) -> None:
    if as_json:
        print(json.dumps(rows, indent=2, ensure_ascii=False))
        return

    for index, row in enumerate(rows, start=1):
        preview = row["text"].replace("\n", " ")
        if len(preview) > 260:
            preview = f"{preview[:257]}..."

        print(f"{index}. {row['id']} | {row['category']} | distance={row['distance']}")
        print(f"   {row['title']}")
        print(f"   Citation: {row['citation']}")
        print(f"   {preview}")


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build and query ARIA's local ChromaDB compliance collection."
    )
    parser.add_argument("--index-path", type=Path, default=DEFAULT_INDEX_PATH)
    parser.add_argument("--persist-dir", type=Path, default=DEFAULT_PERSIST_DIR)
    parser.add_argument("--collection", default=DEFAULT_COLLECTION_NAME)

    subparsers = parser.add_subparsers(dest="command", required=True)

    build_parser = subparsers.add_parser("build", help="Build or refresh the ChromaDB collection")
    build_parser.add_argument("--reset", action="store_true", help="Delete rag/chroma_db before rebuilding")

    query_parser = subparsers.add_parser("query", help="Query the ChromaDB collection")
    query_parser.add_argument("query")
    query_parser.add_argument("--top-k", type=int, default=5)
    query_parser.add_argument("--json", action="store_true", help="Print machine-readable JSON")

    subparsers.add_parser("validate", help="Run retrieval smoke tests against expected legal categories")

    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])

    try:
        if args.command == "build":
            count = build_collection(
                index_path=args.index_path,
                persist_dir=args.persist_dir,
                collection_name=args.collection,
                reset=args.reset,
            )
            print(f"Built ChromaDB collection '{args.collection}' with {count} documents.")
            print(f"Persisted at: {args.persist_dir}")
            return 0

        if args.command == "query":
            rows = query_collection(
                args.query,
                top_k=args.top_k,
                index_path=args.index_path,
                persist_dir=args.persist_dir,
                collection_name=args.collection,
            )
            print_query_results(rows, as_json=args.json)
            return 0

        if args.command == "validate":
            rows = validate_collection(
                index_path=args.index_path,
                persist_dir=args.persist_dir,
                collection_name=args.collection,
            )
            print(json.dumps(rows, indent=2, ensure_ascii=False))
            print("Validation passed.")
            return 0

    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    print(f"Unknown command: {args.command}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
