import asyncio
import sys
import os
import httpx

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from app.core.config import settings

QDRANT_HOST = settings.qdrant_host
QDRANT_PORT = settings.qdrant_port
OLLAMA_HOST = settings.ollama_host
OLLAMA_PORT = settings.ollama_port
OLLAMA_DEFAULT_EMBED_MODEL = settings.ollama_default_embed_model
COLLECTION_NAME = settings.qdrant_collection

TEST_DOCUMENTS = [
    {
        "id": "a0000000-0000-0000-0000-000000000101",
        "name": "Introduction to Machine Learning",
        "text": """Machine Learning is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed. Neural Networks are computational models inspired by biological neural networks. Supervised Learning uses labeled data to train models. Unsupervised Learning finds patterns in unlabeled data. Backpropagation is the algorithm used to train neural networks. Linear Regression predicts continuous values. Decision Trees make decisions through tree-like models. Random Forest combines multiple decision trees. Gradient Descent optimizes model parameters. Loss Function measures prediction error."""
    },
    {
        "id": "a0000000-0000-0000-0000-000000000102",
        "name": "Introduction to Python Programming",
        "text": """Python Programming is a high-level, interpreted programming language known for its simplicity and readability. Variables store data values in memory. Functions are reusable blocks of code that perform specific tasks. Lambda Functions are anonymous functions defined with lambda keyword. Lists are ordered, mutable collections of items. List Comprehension provides concise syntax for creating lists. Dictionaries store key-value pairs for fast lookups. Generators yield values lazily for memory-efficient iteration."""
    },
    {
        "id": "a0000000-0000-0000-0000-000000000103",
        "name": "Data Structures and Algorithms",
        "text": """Data Structures organize and store data efficiently for various operations. Arrays are contiguous memory blocks storing elements of same type. Array Traversal visits each element sequentially. Linked Lists use nodes with pointers to next elements. Pointer Manipulation changes node connections. Stacks follow Last-In-First-Out (LIFO) principle. Stack Push/Pop operations add or remove from top. Binary Trees have hierarchical structure with nodes. Tree Traversal visits nodes in specific order. Hash Tables provide O(1) average lookup time. Sorting Algorithms arrange elements in order. Big O Notation describes algorithm complexity."""
    },
    {
        "id": "a0000000-0000-0000-0000-000000000104",
        "name": "Introduction to Databases",
        "text": """Database is an organized collection of structured data. Relational Database uses tables with rows and columns. SQL Queries retrieve and manipulate data using Structured Query Language. Tables store data in rows and columns. Joins combine data from multiple tables. Normalization eliminates data redundancy. Third Normal Form (3NF) ensures no transitive dependencies. Transactions are atomic units of database operations. ACID Properties ensure database reliability: Atomicity, Consistency, Isolation, Durability. Indexes speed up data retrieval operations."""
    },
    {
        "id": "a0000000-0000-0000-0000-000000000105",
        "name": "Introduction to Classical Mechanics",
        "text": """Classical Mechanics studies motion of macroscopic objects under forces. Newton's Laws of Motion describe relationship between force, mass and acceleration. Force Equation F=ma relates force to mass and acceleration. Kinematics describes motion without considering forces. Equations of Motion calculate displacement, velocity and acceleration. Energy is capacity to do work. Work-Energy Theorem relates work done to change in kinetic energy. Momentum is product of mass and velocity. Conservation of Momentum states total momentum remains constant in isolated systems. Friction opposes relative motion between surfaces."""
    }
]

def chunk_text(text: str, chunk_size: int = 200, overlap: int = 30) -> list[str]:
    """Split text into overlapping chunks."""
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunks.append(text[start:end])
        start = end - overlap
        if start >= len(text):
            break
    return chunks

async def embed_text(client: httpx.AsyncClient, text: str) -> list[float]:

    response = await client.post(
        f"http://{OLLAMA_HOST}:{OLLAMA_PORT}/api/embeddings",
        json={"model": OLLAMA_DEFAULT_EMBED_MODEL, "prompt": text},
        timeout=60.0
    )
    response.raise_for_status()
    return response.json()["embedding"]

async def check_qdrant_ready(client: httpx.AsyncClient) -> bool:

    try:
        response = await client.get(
            f"http://{QDRANT_HOST}:{QDRANT_PORT}/collections/{COLLECTION_NAME}",
            timeout=10.0
        )
        return response.status_code == 200
    except Exception:
        return False

async def upsert_point(client: httpx.AsyncClient, point_id: str, embedding: list[float], metadata: dict):

    response = await client.put(
        f"http://{QDRANT_HOST}:{QDRANT_PORT}/collections/{COLLECTION_NAME}/points",
        json={
            "points": [{
                "id": point_id,
                "vector": embedding,
                "payload": metadata
            }]
        },
        timeout=30.0
    )
    response.raise_for_status()

async def seed_qdrant():

    print("=" * 80)
    print("Qdrant Test Data Initialization")
    print("=" * 80)

    async with httpx.AsyncClient() as client:

        print(f"\nWaiting for Qdrant at {QDRANT_HOST}:{QDRANT_PORT}...")
        for attempt in range(30):
            if await check_qdrant_ready(client):
                print(f"✓ Qdrant is ready (collection '{COLLECTION_NAME}' exists)")
                break
            await asyncio.sleep(2)
        else:
            print(f"✗ Qdrant collection '{COLLECTION_NAME}' not found after 60s")
            print("  Make sure init_qdrant_setup.py has been run first")
            return False

        total_chunks = 0

        for doc in TEST_DOCUMENTS:
            doc_id = doc["id"]
            doc_name = doc["name"]
            text = doc["text"]

            chunks = chunk_text(text, chunk_size=200, overlap=30)
            print(f"\n{doc_name}")
            print(f"  Document ID: {doc_id}")
            print(f"  Chunks: {len(chunks)}")

            for i, chunk in enumerate(chunks):
                try:

                    embedding = await embed_text(client, chunk)
                    point_id = f"{doc_id}_chunk_{i}"
                    metadata = {
                        "document_id": doc_id,
                        "document_name": doc_name,
                        "embedding_type": "chunk",
                        "chunk_index": i,
                        "total_chunks": len(chunks),
                        "chunk_text": chunk[:100]
                    }

                    await upsert_point(client, point_id, embedding, metadata)
                    total_chunks += 1

                except Exception as e:
                    print(f"  ✗ Error processing chunk {i}: {e}")
                    continue

            print(f"  ✓ Stored {len(chunks)} chunks")

        print("\n" + "=" * 80)
        print(f"✓ Successfully seeded {total_chunks} document chunks to Qdrant")
        print("=" * 80)
        return True

async def main():
    try:
        success = await seed_qdrant()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nInterrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
