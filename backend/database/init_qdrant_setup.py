from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from app.core.config import settings

def init_qdrant(
    host: str = "localhost",
    port: int = 6333,
    collection_name: str = "learning_platform",
    embedding_dimensions: int = 1024):
    
    try:

        print(f"Connecting to Qdrant at {host}:{port}...")
        client = QdrantClient(
            host = host,
            port = port,
            prefer_grpc = False,
            timeout = 30
        )

        collections = client.get_collections().collections
        collection_names = [c.name for c in collections]

        if collection_name in collection_names:
            print(f"Collection '{collection_name}' already exists. Skipping creation.")
            return True

        print(f"Creating collection '{collection_name}' with {embedding_dimensions} dimensions...")
        client.create_collection(
            collection_name = collection_name,
            vectors_config = VectorParams(size = embedding_dimensions, distance = Distance.COSINE)
        )

        collections = client.get_collections().collections
        collection_names = [c.name for c in collections]

        if collection_name in collection_names:
            print(f"Collection '{collection_name}' created successfully!")
            print(f" - Vector dimensions: {embedding_dimensions}")
            print(f" - Distance metric: COSINE")
            return True
        else:
            print(f"Failed to create collection '{collection_name}'")
            return False

    except Exception as e:
        print(f"Error initializing Qdrant: {str(e)}")
        return False

def main():

    success = init_qdrant(
        host = settings.qdrant_host,
        port = settings.qdrant_port,
        collection_name = settings.qdrant_collection,
        embedding_dimensions = settings.qdrant_dimensions
    )

    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
