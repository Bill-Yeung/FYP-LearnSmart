from typing import List, Dict, Optional, Any
import logging
import uuid

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
    SearchParams,
)

from app.core.config import settings
from app.core.database import qdrant_db

logger = logging.getLogger(__name__)

class QdrantRepository:

    def __init__(
        self,
        collection_name: Optional[str] = None,
        dimensions: Optional[int] = None):

        self.collection_name = collection_name or settings.qdrant_collection
        self.dimensions = dimensions or settings.qdrant_dimensions

    @property
    def client(self) -> QdrantClient:
        return qdrant_db.get_client()

    async def ensure_collection(self):

        import asyncio
        max_retries = 3
        retry_delay = 2

        for attempt in range(max_retries):
            try:

                collections = self.client.get_collections()
                exists = any(c.name == self.collection_name for c in collections.collections)

                if not exists:
                    self.client.create_collection(
                        collection_name = self.collection_name,
                        vectors_config = VectorParams(
                            size = self.dimensions,
                            distance = Distance.COSINE))
                    logger.info(f"Created Qdrant collection: {self.collection_name}")
                else:
                    logger.info(f"Qdrant collection exists: {self.collection_name}")

                return

            except Exception as e:
                if attempt < max_retries - 1:
                    logger.warning(f"Qdrant ensure_collection attempt {attempt + 1} failed: {e}, retrying in {retry_delay}s...")
                    await asyncio.sleep(retry_delay)
                    retry_delay *= 2
                else:
                    logger.error(f"Failed to ensure collection after {max_retries} attempts: {e}")
                    raise

    async def add_document_chunks(
        self,
        document_id: str,
        chunks: List[Dict[str, Any]],
        embeddings: List[List[float]],) -> int:
        
        if len(chunks) != len(embeddings):
            raise ValueError("chunks and embeddings must have same length")

        points = []

        for chunk, embedding in zip(chunks, embeddings):

            chunk_index = chunk["chunk_index"]
            chunk_seed = f"{document_id}_{chunk_index}"
            chunk_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, chunk_seed))

            payload = {
                "embedding_type": "chunk",
                "document_id": document_id,
                "chunk_index": chunk_index,
                "start_char": chunk.get("start_char", 0),
                "end_char": chunk.get("end_char", 0),
                "total_chunks": chunk.get("total_chunks", 1)}

            points.append(PointStruct(
                id = chunk_id,
                vector = embedding,
                payload = payload))

        if points:

            self.client.upsert(
                collection_name = self.collection_name,
                points = points)
            logger.info(f"Added {len(points)} chunk embeddings for document {document_id}")

        return len(points)

    async def add_concept_embedding(
        self,
        concept_id: str,
        concept_name: str,
        description: str,
        keywords: List[str],
        learning_objectives: List[str],
        difficulty: str,
        concept_type: str,
        embedding: List[float],
        subject: str | None = None,
        lcc_code: str | None = None) -> str:

        point_id = concept_id

        point = PointStruct(
            id = point_id,
            vector = embedding,
            payload = {
                "embedding_type": "concept",
                "concept_id": concept_id,
                "name": concept_name,
                "description": description,
                "keywords": keywords,
                "learning_objectives_count": len(learning_objectives),
                "difficulty": difficulty,
                "type": concept_type,
                "subject": subject,
                "lcc_code": lcc_code})

        self.client.upsert(
            collection_name = self.collection_name,
            points = [point])

        logger.info(f"Stored concept embedding: {concept_name}")
        return point_id

    async def update_concept_payload(
        self,
        concept_id: str,
        description: str | None = None,
        keywords: List[str] | None = None):

        point_id = concept_id
        payload_update = {}

        if description is not None:
            payload_update["description"] = description[:500]
        if keywords is not None:
            payload_update["keywords"] = keywords

        if not payload_update:
            return

        try:

            try:
                point = self.client.retrieve(
                    collection_name = self.collection_name,
                    ids = [point_id],
                    with_vectors = False)

                if not point:
                    logger.debug(f"Point {point_id} not found, skipping payload update")
                    return

            except Exception:
                logger.debug(f"Point {point_id} not found, skipping payload update")
                return

            self.client.set_payload(
                collection_name = self.collection_name,
                payload = payload_update,
                points = [point_id])
        except Exception as e:
            logger.warning(f"Failed to update concept payload for {concept_id}: {e}")

    async def update_concept_embedding(
        self,
        concept_id: str,
        new_name: str,
        new_embedding: List[float]):

        point_id = concept_id

        try:

            points = self.client.retrieve(
                collection_name = self.collection_name,
                ids = [point_id],
                with_payload = True,
                with_vectors = False)

            payload = points[0].payload if points else {
                "embedding_type": "concept",
                "concept_id": concept_id}

            payload["name"] = new_name

            self.client.upsert(
                collection_name = self.collection_name,
                points = [PointStruct(
                    id = point_id,
                    vector = new_embedding,
                    payload = payload)])
            logger.info(f"Updated concept embedding after rename: {new_name}")

        except Exception as e:
            logger.warning(f"Failed to update concept embedding for {concept_id}: {e}")

    async def search(
        self,
        query_embedding: List[float],
        limit: int = 10,
        score_threshold: float = 0.0,
        filter_document_id: Optional[str] = None,
        filter_type: Optional[str] = None,
        filter_subject: Optional[str] = None,
        filter_lcc_code: Optional[str] = None) -> List[Dict]:
        
        conditions = []

        if filter_document_id:
            conditions.append(FieldCondition(
                key = "document_id",
                match = MatchValue(value=filter_document_id)))

        if filter_type:
            conditions.append(FieldCondition(
                key = "type",
                match = MatchValue(value=filter_type)))

        if filter_subject:
            conditions.append(FieldCondition(
                key = "subject",
                match = MatchValue(value=filter_subject)))

        if filter_lcc_code:
            conditions.append(FieldCondition(
                key = "lcc_code",
                match = MatchValue(value=filter_lcc_code)))

        query_filter = Filter(must=conditions) if conditions else None

        results = self.client.search(
            collection_name = self.collection_name,
            query_vector = query_embedding,
            query_filter = query_filter,
            limit = limit,
            score_threshold = score_threshold,
            search_params = SearchParams(
                hnsw_ef = 128,
                exact = False))

        return [{
                "id": hit.id,
                "score": hit.score,
                **hit.payload} for hit in results]

    async def delete_chunks_by_document(self, document_id: str) -> bool:
        
        try:

            self.client.delete(
                collection_name = self.collection_name,
                points_selector = Filter(
                    must = [
                        FieldCondition(
                            key = "embedding_type",
                            match = MatchValue(value="chunk")),
                        FieldCondition(
                            key = "document_id",
                            match = MatchValue(value=document_id))]))
            logger.info(f"Deleted chunk embeddings for document: {document_id}")
            return True
        
        except Exception as e:
            logger.error(f"Failed to delete chunks for document {document_id}: {e}")
            return False

    async def find_similar_concepts(
        self,
        query_embedding: List[float],
        similarity_threshold: float = 0.85,
        limit: int = 5,
        exclude_concept_id: Optional[str] = None) -> List[Dict]:

        conditions = [
            FieldCondition(
                key = "embedding_type",
                match = MatchValue(value = "concept"))]

        query_filter = Filter(must=conditions)

        try:

            results = self.client.query_points(
                collection_name = self.collection_name,
                query = query_embedding,
                query_filter = query_filter,
                limit = limit + 1,
                score_threshold = similarity_threshold,
                search_params = SearchParams(
                    hnsw_ef = 128,
                    exact = False)).points

            similar = []
            for hit in results:

                concept_id = hit.payload.get("concept_id")
                if exclude_concept_id and concept_id == exclude_concept_id:
                    continue

                similar.append({
                    "concept_id": concept_id,
                    "name": hit.payload.get("name"),
                    "description": hit.payload.get("description"),
                    "type": hit.payload.get("type"),
                    "similarity_score": hit.score})

                if len(similar) >= limit:
                    break

            return similar

        except Exception as e:
           
            error_str = str(e)
            if "404" in error_str or "Not Found" in error_str:
                logger.debug(f"Collection empty or endpoint not ready (404): {e}")
                return []
            else:
                logger.warning(f"Similar concept search failed: {e}")
                return []

    async def seed_test_data(self) -> bool:

        from app.services.ai.embeddings import embedding_service

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
            chunks = []
            start = 0
            while start < len(text):
                end = min(start + chunk_size, len(text))
                chunks.append(text[start:end])
                if end >= len(text):
                    break
                start = end - overlap
            return chunks

        try:
            total_chunks = 0

            for doc in TEST_DOCUMENTS:
                doc_id = doc["id"]
                doc_name = doc["name"]
                text = doc["text"]

                chunks = chunk_text(text, chunk_size=200, overlap=30)
                logger.info(f"Seeding {doc_name}: {len(chunks)} chunks")

                for i, chunk in enumerate(chunks):
                    try:
                        embedding = await embedding_service.embed(chunk)

                        import uuid
                        point_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{doc_id}_chunk_{i}"))
                        metadata = {
                            "document_id": doc_id,
                            "document_name": doc_name,
                            "embedding_type": "chunk",
                            "chunk_index": i,
                            "total_chunks": len(chunks),
                            "chunk_text": chunk[:100]
                        }

                        self.client.upsert(
                            collection_name=self.collection_name,
                            points=[PointStruct(
                                id=point_id,
                                vector=embedding,
                                payload=metadata
                            )]
                        )
                        total_chunks += 1

                    except Exception as e:
                        logger.warning(f"Error seeding chunk {i} of {doc_name}: {e}")
                        continue

            logger.info(f"Successfully seeded {total_chunks} document chunks to Qdrant")
            return True

        except Exception as e:
            logger.error(f"Failed to seed Qdrant test data: {e}")
            return False

# Global instance
qdrant_repository = QdrantRepository()
