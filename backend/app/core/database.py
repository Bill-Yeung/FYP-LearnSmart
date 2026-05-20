import asyncpg
import logging
import os
from fastapi import HTTPException
from neo4j import GraphDatabase, Driver
from qdrant_client import QdrantClient
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.core.config import settings

logger = logging.getLogger(__name__)

DATABASE_URL = f"postgresql+asyncpg://{settings.postgres_user}:{settings.postgres_password}@{settings.postgres_host}:{settings.postgres_port}/{settings.postgres_db}"
engine = create_async_engine(DATABASE_URL, echo=True)
session_factory = async_sessionmaker(bind=engine, expire_on_commit=False)

class PostgresDatabase:

    def __init__(self):
        self.pool: asyncpg.Pool | None = None

    async def connect(self):
        if self.pool is None:
            self.pool = await asyncpg.create_pool(
                host = settings.postgres_host,
                port = settings.postgres_port,
                user = settings.postgres_user,
                password = settings.postgres_password,
                database = settings.postgres_db,
                min_size = 5,
                max_size = 20)
            print(f"PostgreSQL connected: {settings.postgres_host}:{settings.postgres_port}")

    async def disconnect(self):
        if self.pool:
            await self.pool.close()
            self.pool = None
            print("PostgreSQL disconnected")

    async def get_connection(self):
        if self.pool is None:
            raise RuntimeError("Database not connected. Call connect() first.")
        async with self.pool.acquire() as connection:
            yield connection

    def get_session_factory(self):
        return session_factory

class Neo4jDatabase:

    def __init__(self):
        self.driver: Driver | None = None

    def connect(self):
        if self.driver is None:
            try:
                self.driver = GraphDatabase.driver(
                    settings.neo4j_url,
                    auth = (settings.neo4j_user, settings.neo4j_password))
                self.driver.verify_connectivity()
                print(f"Neo4j connected: {settings.neo4j_url}")
            except Exception as e:
                logger.error(f"Failed to connect to Neo4j: {e}")
                raise

    def disconnect(self):
        if self.driver:
            self.driver.close()
            self.driver = None
            print("Neo4j disconnected")

    def get_session(self):
        if self.driver is None:
            raise RuntimeError("Neo4j not connected. Call connect() first.")
        session = self.driver.session()
        try:
            yield session
        finally:
            session.close()

class QdrantDatabase:

    def __init__(self):
        self.client: QdrantClient | None = None

    def connect(self):
        if self.client is None:
            self.client = QdrantClient(
                host = settings.qdrant_host,
                port = settings.qdrant_port,
                prefer_grpc = False,
                timeout = 30)
            self.client.get_collections()
            print(f"Qdrant connected: {settings.qdrant_url}")

    def disconnect(self):
        if self.client:
            self.client.close()
            self.client = None
            print("Qdrant disconnected")

    def get_client(self) -> QdrantClient:
        if self.client is None:
            raise RuntimeError("Qdrant not connected. Call connect() first.")
        return self.client

async def get_postgres():

    if postgres_db.pool is None:
        try:
            await postgres_db.connect()
        except Exception as e:
            logger.exception("Failed to connect to Postgres in dependency")
            raise HTTPException(status_code=503, detail="Database unavailable")

    async for conn in postgres_db.get_connection():
        yield conn

def get_neo4j():
    for session in neo4j_db.get_session():
        yield session

def get_qdrant() -> QdrantClient:
    return qdrant_db.get_client()

async def _init_neo4j_schema():
    
    base = os.path.join(os.path.dirname(__file__), "..", "..", "database")
    ddl_path = os.path.join(base, "init_neo4j_ddl.cypher")
    await neo4j_repository.execute_cypher_file(ddl_path)

    async def check_taxonomy():
        def work(tx):
            result = tx.run("MATCH (t:TaxonomyNode) RETURN count(t) > 0 as exists")
            record = result.single()
            return record["exists"] if record else False
        return await neo4j_repository._read(work)

    taxonomy_exists = await check_taxonomy()

    if not taxonomy_exists:
        taxonomy_path = os.path.join(base, "init_neo4j_taxonomy.cypher")
        await neo4j_repository.execute_cypher_file(taxonomy_path)

    data_path = os.path.join(base, "init_neo4j_data.cypher")
    await neo4j_repository.execute_cypher_file(data_path)

async def _init_qdrant_collection():
    await qdrant_repository.ensure_collection()

async def _seed_qdrant_data():

    try:
        test_doc_id = "a0000000-0000-0000-0000-000000000101"
        results = await qdrant_repository.search_by_metadata(
            {"document_id": test_doc_id, "embedding_type": "chunk"},
            limit = 1)
        if results:
            logger.info("Qdrant: test data already seeded")
            return
    except Exception:
        pass

    logger.info("Seeding Qdrant with test data...")
    success = await qdrant_repository.seed_test_data()
    if success:
        logger.info("Qdrant: test data seeded successfully")
    else:
        logger.warning("Qdrant: test data seeding failed")

async def _init_asset_library():

    base = os.path.join(os.path.dirname(__file__), "..", "..", "database")
    sql_files = [
        ("init_pg_polyhaven.sql",  "hdri",  100),
        ("init_pg_polyhaven.sql",  "model", 100),
        ("init_pg_polyhaven2.sql", None,    None),
    ]

    conn = await postgres_db.pool.acquire()
    try:
        already_seeded = True
        for sql_file, asset_type, threshold in sql_files:
            if asset_type and threshold:
                count = await conn.fetchval(
                    "SELECT COUNT(*) FROM asset_library WHERE asset_type = $1",
                    asset_type,
                )
                if count < threshold:
                    already_seeded = False
                    break

        if already_seeded:
            print("Asset library already seeded, skipping.")
            return

        print("Asset library missing data — seeding from SQL files...")
        seen_files: set[str] = set()
        for sql_file, asset_type, threshold in sql_files:
            if sql_file in seen_files:
                continue

            if asset_type and threshold:
                count = await conn.fetchval(
                    "SELECT COUNT(*) FROM asset_library WHERE asset_type = $1",
                    asset_type,
                )
                if count >= threshold:
                    seen_files.add(sql_file)
                    continue

            path = os.path.join(base, sql_file)
            if not os.path.exists(path):
                logger.warning(f"Seed file not found: {path}")
                seen_files.add(sql_file)
                continue

            try:
                with open(path, "r") as f:
                    sql = f.read()
                await conn.execute(sql)
                print(f"  Seeded {sql_file}")
            except Exception as e:
                logger.error(f"Failed to seed {sql_file}: {e}")

            seen_files.add(sql_file)
    finally:
        await postgres_db.pool.release(conn)

    print("Asset library seeding complete.")


async def lifespan(app):

    # Startup

    print("Connecting to databases...")
    await postgres_db.connect()
    neo4j_db.connect()
    qdrant_db.connect()
    print("All databases connected!")

    await _init_neo4j_schema()
    print("Neo4j schema initialized!")

    await _init_qdrant_collection()
    print("Qdrant collection ready!")

    await _init_asset_library()
    print("Asset library ready!")

    await _seed_qdrant_data()
    print("Qdrant test data ready!")

    from app.services.pipelines.document_pipeline import document_pipeline
    from app.services.infrastructure.task_queue_manager import task_queue_manager
    from app.services.ai.embeddings import embedding_service

    await document_pipeline.initialize(
        postgres_pool = postgres_db.pool,
        embed_model = embedding_service)
    print("Document pipeline initialized!")

    await task_queue_manager.initialize()
    print("Task queue manager initialized!")


    from app.services.infrastructure.cleanup_service import cleanup_service
    await cleanup_service.start_periodic_cleanup(interval_hours=24)
    print("Cleanup service started!")

    from app.services.infrastructure.flashcard_reminder_service import flashcard_reminder_service
    await flashcard_reminder_service.start(check_interval_minutes=60)
    print("Flashcard reminder service started!")

    yield

    # Shutdown

    print("Stopping cleanup service...")
    cleanup_service.stop()
    print("Cleanup service stopped!")

    print("Stopping flashcard reminder service...")
    flashcard_reminder_service.stop()
    print("Flashcard reminder service stopped!")

    print("Shutting down task queue manager...")
    await task_queue_manager.shutdown()
    print("Task queue manager stopped!")

    print("Disconnecting from databases...")
    await postgres_db.disconnect()
    neo4j_db.disconnect()
    qdrant_db.disconnect()
    print("All databases disconnected!")


postgres_db = PostgresDatabase()
neo4j_db = Neo4jDatabase()
qdrant_db = QdrantDatabase()

from app.repositories.qdrant_repository import qdrant_repository
from app.repositories.neo4j_repository import neo4j_repository
