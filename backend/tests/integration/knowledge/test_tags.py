import pytest
from uuid import uuid4
import json

async def _create_tag(client, name=None):
    name = name or f"tag-{uuid4().hex[:6]}"
    r = await client.post("/api/tags", json={"name": name})
    assert r.status_code == 201
    return r.json()

async def _create_diagram(db, user_id):
    slug = uuid4().hex[:12]
    row = await db.fetchrow(
        """INSERT INTO diagrams (user_id, title, diagram_type, diagram_data, url_slug)
           VALUES ($1, 'Tag Test Diagram', 'knowledge_map', '{"nodes":[],"links":[]}', $2)
           RETURNING id""",
        user_id, slug)
    return str(row["id"])

async def _create_source(db, user_id):
    row = await db.fetchrow(
        """INSERT INTO sources (document_name, document_path, document_type, uploaded_by,
             is_public, processing_status, language)
           VALUES ($1, '/tmp/test.txt', 'text', $2, FALSE, 'completed', 'en')
           RETURNING id""",
        f"Tag Source {uuid4().hex[:6]}", user_id)
    return str(row["id"])

class TestCreateTag:

    @pytest.mark.asyncio
    async def test_create_tag(self, client, authenticated_user):
        r = await client.post("/api/tags", json={
            "name": f"test-tag-{uuid4().hex[:6]}",
            "description": "A test tag",
            "color": "#FF0000"})
        assert r.status_code == 201
        data = r.json()
        assert "name" in data
        assert data["color"] == "#FF0000"

    @pytest.mark.asyncio
    async def test_create_duplicate_tag(self, client, authenticated_user):
        name = f"dup-tag-{uuid4().hex[:6]}"
        await _create_tag(client, name)
        r = await client.post("/api/tags", json={"name": name})
        assert r.status_code == 409

    @pytest.mark.asyncio
    async def test_create_tag_no_auth(self, client):
        r = await client.post("/api/tags", json={"name": "no-auth-tag"})
        assert r.status_code == 401

class TestListTags:

    @pytest.mark.asyncio
    async def test_list_tags(self, client, authenticated_user):
        await _create_tag(client)

        r = await client.get("/api/tags")
        assert r.status_code == 200
        data = r.json()
        assert "tags" in data
        assert "total" in data
        assert data["total"] >= 1

    @pytest.mark.asyncio
    async def test_list_tags_with_search(self, client, authenticated_user):
        unique = uuid4().hex[:6]
        await _create_tag(client, f"searchable-{unique}")

        r = await client.get("/api/tags", params={"search": f"searchable-{unique}"})
        assert r.status_code == 200
        data = r.json()
        assert data["total"] >= 1

    @pytest.mark.asyncio
    async def test_list_tags_pagination(self, client, authenticated_user):
        r = await client.get("/api/tags", params={"page": 1, "page_size": 5})
        assert r.status_code == 200
        data = r.json()
        assert data["page"] == 1
        assert data["page_size"] == 5

class TestGetTag:

    @pytest.mark.asyncio
    async def test_get_tag(self, client, authenticated_user):
        tag = await _create_tag(client)
        tag_id = tag["id"]

        r = await client.get(f"/api/tags/{tag_id}")
        assert r.status_code == 200
        assert r.json()["id"] == tag_id

    @pytest.mark.asyncio
    async def test_get_nonexistent_tag(self, client, authenticated_user):
        r = await client.get(f"/api/tags/{uuid4()}")
        assert r.status_code == 404

class TestUpdateTag:

    @pytest.mark.asyncio
    async def test_update_tag(self, client, authenticated_user):
        tag = await _create_tag(client)
        tag_id = tag["id"]

        r = await client.put(f"/api/tags/{tag_id}", json={
            "name": f"updated-{uuid4().hex[:6]}",
            "description": "Updated description"})
        assert r.status_code == 200
        assert r.json()["description"] == "Updated description"

    @pytest.mark.asyncio
    async def test_update_nonexistent_tag(self, client, authenticated_user):
        r = await client.put(f"/api/tags/{uuid4()}", json={"name": "nope"})
        assert r.status_code == 404

class TestDeleteTag:

    @pytest.mark.asyncio
    async def test_delete_tag(self, client, authenticated_user):
        tag = await _create_tag(client)
        tag_id = tag["id"]

        r = await client.delete(f"/api/tags/{tag_id}")
        assert r.status_code == 204

        r2 = await client.get(f"/api/tags/{tag_id}")
        assert r2.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_nonexistent_tag(self, client, authenticated_user):
        r = await client.delete(f"/api/tags/{uuid4()}")
        assert r.status_code == 404

class TestApplyTag:

    @pytest.mark.asyncio
    async def test_apply_tag_to_diagram(self, client, db, authenticated_user):

        user_id = authenticated_user["user"]["id"]
        tag = await _create_tag(client)
        diagram_id = await _create_diagram(db, user_id)

        r = await client.post(f"/api/tags/{tag['id']}/apply", json={
            "entity_type": "diagram",
            "entity_id": diagram_id})
        assert r.status_code == 201
        assert r.json()["applied"] is True

    @pytest.mark.asyncio
    async def test_apply_tag_duplicate(self, client, db, authenticated_user):
        user_id = authenticated_user["user"]["id"]
        tag = await _create_tag(client)
        diagram_id = await _create_diagram(db, user_id)

        await client.post(f"/api/tags/{tag['id']}/apply", json={
            "entity_type": "diagram",
            "entity_id": diagram_id})

        r = await client.post(f"/api/tags/{tag['id']}/apply", json={
            "entity_type": "diagram",
            "entity_id": diagram_id})
        assert r.status_code in (200, 201)
        assert r.json()["applied"] is False

    @pytest.mark.asyncio
    async def test_apply_tag_to_source(self, client, db, authenticated_user):
        user_id = authenticated_user["user"]["id"]
        tag = await _create_tag(client)
        source_id = await _create_source(db, user_id)

        r = await client.post(f"/api/tags/{tag['id']}/apply", json={
            "entity_type": "source",
            "entity_id": source_id})
        assert r.status_code == 201

class TestRemoveTag:

    @pytest.mark.asyncio
    async def test_remove_tag_from_entity(self, client, db, authenticated_user):
        user_id = authenticated_user["user"]["id"]
        tag = await _create_tag(client)
        diagram_id = await _create_diagram(db, user_id)

        await client.post(f"/api/tags/{tag['id']}/apply", json={
            "entity_type": "diagram",
            "entity_id": diagram_id})

        r = await client.delete(f"/api/tags/{tag['id']}/remove",
                                params={"entity_type": "diagram",
                                        "entity_id": diagram_id})
        assert r.status_code == 200

    @pytest.mark.asyncio
    async def test_remove_tag_not_applied(self, client, db, authenticated_user):
        user_id = authenticated_user["user"]["id"]
        tag = await _create_tag(client)
        diagram_id = await _create_diagram(db, user_id)

        r = await client.delete(f"/api/tags/{tag['id']}/remove",
                                params={"entity_type": "diagram",
                                        "entity_id": diagram_id})
        assert r.status_code == 404

class TestGetTaggedEntities:

    @pytest.mark.asyncio
    async def test_get_tagged_entities(self, client, db, authenticated_user):
        user_id = authenticated_user["user"]["id"]
        tag = await _create_tag(client)
        diagram_id = await _create_diagram(db, user_id)

        await client.post(f"/api/tags/{tag['id']}/apply", json={
            "entity_type": "diagram",
            "entity_id": diagram_id})

        r = await client.get(f"/api/tags/{tag['id']}/entities")
        assert r.status_code == 200
        data = r.json()
        assert "entities" in data
        assert data["total"] >= 1

class TestGetEntityTags:

    @pytest.mark.asyncio
    async def test_get_entity_tags(self, client, db, authenticated_user):
        user_id = authenticated_user["user"]["id"]
        tag = await _create_tag(client)
        diagram_id = await _create_diagram(db, user_id)

        await client.post(f"/api/tags/{tag['id']}/apply", json={
            "entity_type": "diagram",
            "entity_id": diagram_id})

        r = await client.get(f"/api/tags/entity/diagram/{diagram_id}")
        assert r.status_code == 200
        data = r.json()
        assert "tags" in data
        assert len(data["tags"]) >= 1

class TestBulkApplyTags:

    @pytest.mark.asyncio
    async def test_bulk_apply_tags(self, client, db, authenticated_user):
        user_id = authenticated_user["user"]["id"]
        tag1 = await _create_tag(client)
        tag2 = await _create_tag(client)
        diagram_id = await _create_diagram(db, user_id)

        r = await client.post("/api/tags/bulk-apply", json={
            "tag_ids": [tag1["id"], tag2["id"]],
            "entity_type": "diagram",
            "entity_id": diagram_id})
        assert r.status_code == 200
        data = r.json()
        assert data["applied_count"] == 2
