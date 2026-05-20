import pytest
from uuid import uuid4
import json

async def _create_diagram_in_db(db, user_id, title = None):

    title = title or f"Test Diagram {uuid4().hex[:6]}"
    slug = uuid4().hex[:12]
    row = await db.fetchrow(
        """INSERT INTO diagrams (user_id, title, diagram_type, diagram_data, url_slug)
           VALUES ($1, $2, 'knowledge_map', $3, $4)
           RETURNING *""",
        user_id, title, json.dumps({"nodes": [], "links": []}), slug)
    return dict(row)

class TestGenerateDiagram:

    @pytest.mark.asyncio
    async def test_generate_requires_concepts(self, client, authenticated_user):

        r = await client.post("/api/diagrams/generate", json = {
            "title": "Test Map",
            "diagram_type": "knowledge_map",
            "expand": False})

        assert r.status_code == 400
        assert "No concepts found" in r.json()["detail"]

    @pytest.mark.asyncio
    async def test_generate_diagram_no_auth(self, client):
        r = await client.post("/api/diagrams/generate", json = {
            "title": "Test",
            "diagram_type": "knowledge_map"})
        assert r.status_code == 401

class TestListDiagrams:

    @pytest.mark.asyncio
    async def test_list_diagrams(self, client, db, authenticated_user):
        user_id = authenticated_user["user"]["id"]
        await _create_diagram_in_db(db, user_id)

        r = await client.get("/api/diagrams")
        assert r.status_code == 200
        data = r.json()
        assert "diagrams" in data
        assert "total" in data
        assert data["total"] >= 1

    @pytest.mark.asyncio
    async def test_list_diagrams_filter_type(self, client, db, authenticated_user):
        user_id = authenticated_user["user"]["id"]
        await _create_diagram_in_db(db, user_id)

        r = await client.get("/api/diagrams",
                             params = {"diagram_type": "knowledge_map"})
        assert r.status_code == 200

    @pytest.mark.asyncio
    async def test_list_diagrams_no_auth(self, client):
        r = await client.get("/api/diagrams")
        assert r.status_code == 401

class TestRecentDiagrams:

    @pytest.mark.asyncio
    async def test_recent_diagrams(self, client, db, authenticated_user):
        user_id = authenticated_user["user"]["id"]
        await _create_diagram_in_db(db, user_id)

        r = await client.get("/api/diagrams/recent")
        assert r.status_code == 200
        data = r.json()
        assert "diagrams" in data

class TestGetDiagram:

    @pytest.mark.asyncio
    async def test_get_diagram_by_id(self, client, db, authenticated_user):
        user_id = authenticated_user["user"]["id"]
        diagram = await _create_diagram_in_db(db, user_id)

        r = await client.get(f"/api/diagrams/{diagram['id']}")
        assert r.status_code == 200

    @pytest.mark.asyncio
    async def test_get_diagram_by_slug(self, client, db, authenticated_user):
        user_id = authenticated_user["user"]["id"]
        diagram = await _create_diagram_in_db(db, user_id)

        r = await client.get(f"/api/diagrams/s/{diagram['url_slug']}")
        assert r.status_code == 200

    @pytest.mark.asyncio
    async def test_get_nonexistent_diagram(self, client, authenticated_user):
        r = await client.get(f"/api/diagrams/{uuid4()}")
        assert r.status_code == 404

class TestUpdateDiagram:

    @pytest.mark.asyncio
    async def test_update_diagram_title(self, client, db, authenticated_user):
        user_id = authenticated_user["user"]["id"]
        diagram = await _create_diagram_in_db(db, user_id)

        r = await client.put(f"/api/diagrams/{diagram['id']}",
                             json = {"title": "Updated Title"})
        assert r.status_code == 200
        assert r.json()["title"] == "Updated Title"

    @pytest.mark.asyncio
    async def test_update_nonexistent_diagram(self, client, authenticated_user):
        r = await client.put(f"/api/diagrams/{uuid4()}",
                             json = {"title": "Nope"})
        assert r.status_code == 404

class TestDeleteDiagram:

    @pytest.mark.asyncio
    async def test_delete_diagram(self, client, db, authenticated_user):
        user_id = authenticated_user["user"]["id"]
        diagram = await _create_diagram_in_db(db, user_id)

        r = await client.delete(f"/api/diagrams/{diagram['id']}")
        assert r.status_code == 204

        r2 = await client.get(f"/api/diagrams/{diagram['id']}")
        assert r2.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_nonexistent_diagram(self, client, authenticated_user):
        r = await client.delete(f"/api/diagrams/{uuid4()}")
        assert r.status_code == 404
