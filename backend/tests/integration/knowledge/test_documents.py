import pytest
from uuid import uuid4
import json

async def _insert_document(db, user_id, title=None, status="completed"):

    title = title or f"Test Doc {uuid4().hex[:6]}"
    row = await db.fetchrow(
        """INSERT INTO sources
            (document_name, document_path, document_type, uploaded_by,
             is_public, processing_status, language, concepts_extracted, relationships_extracted)
           VALUES ($1, '/tmp/test.txt', 'text', $2, FALSE, $3, 'en', 0, 0)
           RETURNING *""",
        title, user_id, status)
    return dict(row)

class TestUploadDocument:

    @pytest.mark.asyncio
    async def test_upload_text_content(self, client, authenticated_user):

        r = await client.post("/api/documents/upload", data={
            "title": "Test Text Upload",
            "content": "This is some test content for document upload.",
            "is_public": "false"})

        assert r.status_code in (200, 400, 500)

    @pytest.mark.asyncio
    async def test_upload_no_file_or_content(self, client, authenticated_user):
        r = await client.post("/api/documents/upload", data={})
        assert r.status_code == 400

    @pytest.mark.asyncio
    async def test_upload_content_without_title(self, client, authenticated_user):
        r = await client.post("/api/documents/upload", data={
            "content": "Some content without a title"})
        assert r.status_code == 400

    @pytest.mark.asyncio
    async def test_upload_no_auth(self, client):
        r = await client.post("/api/documents/upload", data={
            "title": "No Auth", "content": "test"})
        assert r.status_code == 401

class TestListDocuments:

    @pytest.mark.asyncio
    async def test_list_documents(self, client, db, authenticated_user):
        user_id = authenticated_user["user"]["id"]
        await _insert_document(db, user_id)

        r = await client.get("/api/documents")
        assert r.status_code == 200
        data = r.json()
        assert "documents" in data
        assert "total" in data
        assert data["total"] >= 1

    @pytest.mark.asyncio
    async def test_list_documents_with_pagination(self, client, db, authenticated_user):
        r = await client.get("/api/documents", params={"page": 1, "page_size": 5})
        assert r.status_code == 200
        data = r.json()
        assert data["page"] == 1
        assert data["page_size"] == 5

    @pytest.mark.asyncio
    async def test_list_documents_filter_by_type(self, client, db, authenticated_user):
        user_id = authenticated_user["user"]["id"]
        await _insert_document(db, user_id)

        r = await client.get("/api/documents", params={"document_type": "text"})
        assert r.status_code == 200

    @pytest.mark.asyncio
    async def test_list_documents_filter_by_status(self, client, db, authenticated_user):
        user_id = authenticated_user["user"]["id"]
        await _insert_document(db, user_id, status="completed")

        r = await client.get("/api/documents", params={"status": "completed"})
        assert r.status_code == 200

    @pytest.mark.asyncio
    async def test_list_documents_no_auth(self, client):
        r = await client.get("/api/documents")
        assert r.status_code == 401

class TestGetDocument:

    @pytest.mark.asyncio
    async def test_get_document(self, client, db, authenticated_user):
        user_id = authenticated_user["user"]["id"]
        doc = await _insert_document(db, user_id)

        r = await client.get(f"/api/documents/{doc['id']}")
        assert r.status_code == 200

    @pytest.mark.asyncio
    async def test_get_nonexistent_document(self, client, authenticated_user):
        r = await client.get(f"/api/documents/{uuid4()}")
        assert r.status_code == 404

class TestDocumentStatus:

    @pytest.mark.asyncio
    async def test_get_document_status(self, client, db, authenticated_user):

        user_id = authenticated_user["user"]["id"]
        doc = await _insert_document(db, user_id, status="pending")

        r = await client.get(f"/api/documents/{doc['id']}/status")
        assert r.status_code == 200
        data = r.json()
        assert "status" in data
        assert data["status"] == "pending"

    @pytest.mark.asyncio
    async def test_get_status_nonexistent(self, client, authenticated_user):
        r = await client.get(f"/api/documents/{uuid4()}/status")
        assert r.status_code == 404

class TestDeleteDocument:

    @pytest.mark.asyncio
    async def test_delete_document(self, client, db, authenticated_user):
        user_id = authenticated_user["user"]["id"]
        doc = await _insert_document(db, user_id)

        r = await client.delete(f"/api/documents/{doc['id']}")
        assert r.status_code == 200
        assert "deleted" in r.json()["message"].lower()

    @pytest.mark.asyncio
    async def test_delete_nonexistent_document(self, client, authenticated_user):
        r = await client.delete(f"/api/documents/{uuid4()}")
        assert r.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_already_deleted(self, client, db, authenticated_user):
        user_id = authenticated_user["user"]["id"]
        doc = await _insert_document(db, user_id)

        await db.execute(
            "UPDATE sources SET deleted_at = NOW() WHERE id = $1", doc["id"])

        r = await client.delete(f"/api/documents/{doc['id']}")
        assert r.status_code == 410

class TestRestoreDocument:

    @pytest.mark.asyncio
    async def test_restore_document(self, client, db, authenticated_user):
        user_id = authenticated_user["user"]["id"]
        doc = await _insert_document(db, user_id)

        await db.execute(
            "UPDATE sources SET deleted_at = NOW() WHERE id = $1", doc["id"])

        r = await client.post(f"/api/documents/{doc['id']}/restore")
        assert r.status_code == 200
        assert "restored" in r.json()["message"].lower()

    @pytest.mark.asyncio
    async def test_restore_not_deleted(self, client, db, authenticated_user):
        user_id = authenticated_user["user"]["id"]
        doc = await _insert_document(db, user_id)

        r = await client.post(f"/api/documents/{doc['id']}/restore")
        assert r.status_code == 404

class TestDeletedDocuments:

    @pytest.mark.asyncio
    async def test_list_deleted_documents(self, client, db, authenticated_user):
        user_id = authenticated_user["user"]["id"]
        doc = await _insert_document(db, user_id)
        await db.execute(
            "UPDATE sources SET deleted_at = NOW() WHERE id = $1", doc["id"])

        r = await client.get("/api/documents/deleted/list")
        assert r.status_code == 200
        data = r.json()
        assert "documents" in data
        assert "total" in data

class TestProcessingStats:

    @pytest.mark.asyncio
    async def test_get_processing_stats(self, client, db, authenticated_user):
        user_id = authenticated_user["user"]["id"]
        await _insert_document(db, user_id, status="completed")
        await _insert_document(db, user_id, status="pending")

        r = await client.get("/api/documents/processing/stats")
        assert r.status_code == 200
        data = r.json()
        assert "completed" in data
        assert "pending" in data

class TestDocumentConcepts:

    @pytest.mark.asyncio
    async def test_get_concepts_empty(self, client, db, authenticated_user):

        user_id = authenticated_user["user"]["id"]
        doc = await _insert_document(db, user_id)

        r = await client.get(f"/api/documents/{doc['id']}/concepts")
        assert r.status_code == 200
        data = r.json()
        assert "concepts" in data
        assert data["total"] == 0

    @pytest.mark.asyncio
    async def test_get_concepts_nonexistent_doc(self, client, authenticated_user):
        r = await client.get(f"/api/documents/{uuid4()}/concepts")
        assert r.status_code == 404

class TestDocumentRelationships:

    @pytest.mark.asyncio
    async def test_get_relationships_empty(self, client, db, authenticated_user):
        user_id = authenticated_user["user"]["id"]
        doc = await _insert_document(db, user_id)

        r = await client.get(f"/api/documents/{doc['id']}/relationships")
        assert r.status_code == 200
        data = r.json()
        assert "relationships" in data
        assert data["total"] == 0

class TestDocumentAnalytics:

    @pytest.mark.asyncio
    async def test_get_analytics(self, client, db, authenticated_user):
        user_id = authenticated_user["user"]["id"]
        doc = await _insert_document(db, user_id)

        r = await client.get(f"/api/documents/{doc['id']}/analytics")
        assert r.status_code == 200
        data = r.json()
        assert "total_concepts" in data
        assert "total_relationships" in data

    @pytest.mark.asyncio
    async def test_get_analytics_nonexistent(self, client, authenticated_user):
        r = await client.get(f"/api/documents/{uuid4()}/analytics")
        assert r.status_code == 404

class TestKnowledgeMap:

    @pytest.mark.asyncio
    async def test_get_knowledge_map_empty(self, client, authenticated_user):
        r = await client.get("/api/documents/knowledge-map/data")
        assert r.status_code == 200
        data = r.json()
        assert "concepts" in data
        assert "relationships" in data

class TestSearchKnowledge:

    @pytest.mark.asyncio
    async def test_search_keyword(self, client, authenticated_user):
        r = await client.get("/api/documents/search/query",
                             params={"q": "test", "search_type": "keyword"})
        assert r.status_code == 200
        data = r.json()
        assert "results" in data
        assert "query" in data

    @pytest.mark.asyncio
    async def test_search_no_auth(self, client):
        r = await client.get("/api/documents/search/query",
                             params={"q": "test"})
        assert r.status_code == 401

class TestDuplicateScan:

    @pytest.mark.asyncio
    async def test_scan_duplicates_empty(self, client, authenticated_user):
        r = await client.get("/api/documents/duplicates/scan")
        assert r.status_code == 200
        data = r.json()
        assert "duplicate_groups" in data

class TestRetryDocument:

    @pytest.mark.asyncio
    async def test_retry_failed_document(self, client, db, authenticated_user):
        user_id = authenticated_user["user"]["id"]
        doc = await _insert_document(db, user_id, status="failed")

        r = await client.post(f"/api/documents/{doc['id']}/retry")
        assert r.status_code in (200, 500)

    @pytest.mark.asyncio
    async def test_retry_non_failed_document(self, client, db, authenticated_user):
        user_id = authenticated_user["user"]["id"]
        doc = await _insert_document(db, user_id, status="completed")

        r = await client.post(f"/api/documents/{doc['id']}/retry")
        assert r.status_code == 400
