import os

_DEFAULT_TEST_ENV: dict[str, str] = {
    # PostgreSQL
    "POSTGRES_HOST": "localhost",
    "POSTGRES_PORT": "5432",
    "POSTGRES_USER": "admin",
    "POSTGRES_PASSWORD": "password",
    "POSTGRES_DB": "learning_platform",
    # Neo4j
    "NEO4J_HOST": "localhost",
    "NEO4J_PORT": "7687",
    "NEO4J_USER": "neo4j",
    "NEO4J_PASSWORD": "neo4j",
    # Qdrant
    "QDRANT_HOST": "localhost",
    "QDRANT_PORT": "6333",
    "QDRANT_COLLECTION": "test",
    "QDRANT_DIMENSIONS": "768",
    # Ollama
    "OLLAMA_HOST": "localhost",
    "OLLAMA_PORT": "11434",
    "OLLAMA_MAX_REQUESTS": "1",
    "OLLAMA_DEFAULT_EMBED_MODEL": "",
    "OLLAMA_EMBED_MODELS": "[]",
    "OLLAMA_DEFAULT_MODEL": "",
    "OLLAMA_MODELS": "[]",
    # Cloud providers
    "DEEPSEEK_BASE_URL": "",
    "DEEPSEEK_MAX_REQUESTS": "1",
    "DEEPSEEK_DEFAULT_MODEL": "",
    "DEEPSEEK_MODELS": "[]",
    "QWEN_BASE_URL": "",
    "QWEN_MAX_REQUESTS": "1",
    "QWEN_DEFAULT_MODEL": "",
    "QWEN_MODELS": "[]",
    "OPENROUTER_BASE_URL": "",
    "OPENROUTER_MAX_REQUESTS": "1",
    "OPENROUTER_DEFAULT_MODEL": "",
    "OPENROUTER_MODELS": "[]",
    # Misc
    "MAX_CONTEXT_USAGE": "0.9",
    "CHUNK_OVERLAP_TOKENS": "128",
    "UPLOAD_DIR": "uploads",
    "SECRET_KEY": "test-secret",
    "ALGORITHM": "HS256",
    "ACCESS_TOKEN_EXPIRE_MINUTES": "60",
    "REFRESH_TOKEN_EXPIRE_DAYS": "30",
    "CORS_ORIGINS": "[\"*\"]",
}

for _k, _v in _DEFAULT_TEST_ENV.items():
    os.environ.setdefault(_k, _v)

_TEST_ENV_OVERRIDES = {
    "POSTGRES_HOST": os.getenv("TEST_POSTGRES_HOST"),
    "POSTGRES_PORT": os.getenv("TEST_POSTGRES_PORT"),
    "POSTGRES_USER": os.getenv("TEST_POSTGRES_USER"),
    "POSTGRES_PASSWORD": os.getenv("TEST_POSTGRES_PASSWORD"),
    "POSTGRES_DB": os.getenv("TEST_POSTGRES_DB"),
}
for _k, _v in _TEST_ENV_OVERRIDES.items():
    if _v:
        os.environ[_k] = _v

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from uuid import uuid4

from main import app
from app.core.database import postgres_db, get_postgres
from app.services import AuthService

@pytest_asyncio.fixture(scope = "session", loop_scope = "session")
async def db_pool():

    await postgres_db.connect()
    yield postgres_db.pool
    await postgres_db.disconnect()

@pytest_asyncio.fixture(loop_scope = "session")
async def db(db_pool):
    
    async with db_pool.acquire() as connection:
        yield connection

@pytest.fixture
def override_get_postgres(db_pool):

    async def _override():
        async with db_pool.acquire() as conn:
            yield conn

    return _override

@pytest_asyncio.fixture(loop_scope = "session")
async def client(override_get_postgres):

    app.dependency_overrides[get_postgres] = override_get_postgres
    transport = ASGITransport(app = app)

    async with AsyncClient(transport = transport, base_url = "http://test") as ac:
        yield ac

    app.dependency_overrides.clear()

@pytest.fixture
def test_user_data():

    unique_id = uuid4().hex[:8]

    return {
        "username": f"testuser_{unique_id}",
        "email": f"test_{unique_id}@example.com",
        "password": "TestPassword123!"}

@pytest_asyncio.fixture(loop_scope = "session")
async def registered_user(client, test_user_data):

    response = await client.post("/api/auth/register", json = test_user_data)
    assert response.status_code == 201

    return {
        **test_user_data,
        "user": response.json()}

@pytest_asyncio.fixture(loop_scope = "session")
async def authenticated_user(client, registered_user):

    response = await client.post("/api/auth/login", json = {
        "email": registered_user["email"],
        "password": registered_user["password"]})

    assert response.status_code == 200
    tokens = response.json()

    return {
        **registered_user,
        "access_token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"]}

@pytest.fixture
def auth_headers(authenticated_user):
    return {"Authorization": f"Bearer {authenticated_user['access_token']}"}

@pytest_asyncio.fixture(loop_scope = "session")
async def admin_user(client, db):

    unique_id = uuid4().hex[:8]
    email = f"admin_{unique_id}@example.com"
    password = "AdminPassword123!"
    password_hash = AuthService.hash_password(password)

    await db.execute(
        """
        INSERT INTO users (username, email, password_hash, role, display_name)
        VALUES ($1, $2, $3, 'admin', 'Test Admin')
        """,
        f"admin_{unique_id}", email, password_hash)

    response = await client.post("/api/auth/login", json = {
        "email": email,
        "password": password})

    assert response.status_code == 200
    tokens = response.json()

    return {
        "email": email,
        "password": password,
        "access_token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"]}

@pytest.fixture
def admin_headers(admin_user):
    return {"Authorization": f"Bearer {admin_user['access_token']}"}
