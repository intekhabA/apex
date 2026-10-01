import os
import tempfile
import pytest
from unittest.mock import MagicMock, patch
from botocore.exceptions import ClientError
from fastapi.responses import FileResponse, StreamingResponse

from app.core.config import settings
from app.services.storage_service import StorageService, storage_service


def test_normalize_key():
    svc = StorageService()
    assert svc.normalize_key("./storage/uploads/reports/123/r.pdf") == "reports/123/r.pdf"
    assert svc.normalize_key("storage/uploads/reports/123/r.pdf") == "reports/123/r.pdf"
    assert svc.normalize_key("storage/reports/123/r.pdf") == "reports/123/r.pdf"
    assert svc.normalize_key("/reports/123/r.pdf") == "reports/123/r.pdf"
    assert svc.normalize_key("reports/123/r.pdf") == "reports/123/r.pdf"
    assert svc.normalize_key("receipts\\inv1\\r.pdf") == "receipts/inv1/r.pdf"


def test_storage_provider_detection():
    # Local explicitly
    with patch.object(settings, "STORAGE_PROVIDER", "local"), \
         patch.object(settings, "ENVIRONMENT", "development"):
        svc = StorageService()
        assert svc.is_s3 is False
        assert svc.provider == "local"

    # S3 explicitly
    with patch.object(settings, "STORAGE_PROVIDER", "s3"), \
         patch.object(settings, "ENVIRONMENT", "development"):
        svc = StorageService()
        assert svc.is_s3 is True
        assert svc.provider == "s3"

    # Auto in production with S3 bucket
    with patch.object(settings, "STORAGE_PROVIDER", "auto"), \
         patch.object(settings, "ENVIRONMENT", "production"), \
         patch.object(settings, "AWS_S3_BUCKET", "my-bucket"):
        svc = StorageService()
        assert svc.is_s3 is True
        assert svc.provider == "s3"

    # Production with live env file (STORAGE_PROVIDER=s3, ENVIRONMENT=production)
    with patch.object(settings, "STORAGE_PROVIDER", "s3"), \
         patch.object(settings, "ENVIRONMENT", "production"), \
         patch.object(settings, "AWS_S3_BUCKET", "diagnolab-reports-production"):
        svc = StorageService()
        assert svc.is_s3 is True
        assert svc.provider == "s3"


@pytest.mark.asyncio
async def test_local_storage_lifecycle(tmp_path):
    with patch.object(settings, "STORAGE_PROVIDER", "local"), \
         patch.object(settings, "STORAGE_LOCAL_ROOT", str(tmp_path)):
        svc = StorageService()
        rel_path = "reports/test_local_lifecycle/test.pdf"
        data = b"%PDF-1.4 test local pdf binary data"

        # 1. Save
        saved_path = await svc.save_file_bytes(data, rel_path, content_type="application/pdf")
        assert "reports/test_local_lifecycle/test.pdf" in saved_path

        # 2. Exists
        assert await svc.file_exists(rel_path) is True
        assert await svc.file_exists("reports/nonexistent.pdf") is False

        # 3. Read
        read_data = await svc.get_file_bytes(rel_path)
        assert read_data == data

        # 4. Response
        response = await svc.get_file_response(rel_path, "download_test.pdf")
        assert isinstance(response, FileResponse)
        assert response.media_type == "application/pdf"

        # 5. Delete
        assert await svc.delete_file(rel_path) is True
        assert await svc.file_exists(rel_path) is False


@pytest.mark.asyncio
async def test_s3_storage_mocked():
    mock_s3 = MagicMock()
    mock_s3.put_object.return_value = {"ResponseMetadata": {"HTTPStatusCode": 200}}
    mock_s3.head_object.return_value = {"ResponseMetadata": {"HTTPStatusCode": 200}}

    class MockStreamingBody:
        def __init__(self, data: bytes):
            self.data = data
            self.read_called = False

        def read(self, chunk_size=None):
            if not self.read_called:
                self.read_called = True
                return self.data
            return b""

        def close(self):
            pass

    mock_s3.get_object.return_value = {
        "Body": MockStreamingBody(b"s3 binary stream"),
        "ContentLength": 16,
    }
    mock_s3.delete_object.return_value = {"ResponseMetadata": {"HTTPStatusCode": 204}}

    with patch.object(settings, "STORAGE_PROVIDER", "s3"), \
         patch.object(settings, "AWS_S3_BUCKET", "test-bucket"):
        svc = StorageService()
        svc._s3_client = mock_s3
        assert svc.is_s3 is True

        # 1. Save
        res = await svc.save_file_bytes(b"hello s3", "reports/s3_test/file.pdf")
        assert res == "reports/s3_test/file.pdf"
        mock_s3.put_object.assert_called_once()

        # 2. Exists
        assert await svc.file_exists("reports/s3_test/file.pdf") is True

        # 3. Read
        data = await svc.get_file_bytes("reports/s3_test/file.pdf")
        assert data == b"s3 binary stream"

        # 4. Response
        resp = await svc.get_file_response("reports/s3_test/file.pdf", "s3_file.pdf")
        assert isinstance(resp, StreamingResponse)

        # 5. Delete
        assert await svc.delete_file("reports/s3_test/file.pdf") is True
        mock_s3.delete_object.assert_called_once()


@pytest.mark.asyncio
async def test_persist_file_local_and_s3(tmp_path):
    # Test local persist
    with patch.object(settings, "STORAGE_PROVIDER", "local"), \
         patch.object(settings, "STORAGE_LOCAL_ROOT", str(tmp_path)):
        svc = StorageService()
        rel_path = "reports/persist_test/doc.pdf"
        staging = svc.get_local_staging_path(rel_path)
        with open(staging, "wb") as f:
            f.write(b"persisted pdf")

        persisted_path = await svc.persist_file(staging, rel_path)
        assert await svc.file_exists(rel_path) is True
        assert os.path.exists(os.path.join(str(tmp_path), rel_path))

    # Test S3 persist
    mock_s3 = MagicMock()
    with patch.object(settings, "STORAGE_PROVIDER", "s3"), \
         patch.object(settings, "AWS_S3_BUCKET", "test-bucket"):
        svc = StorageService()
        svc._s3_client = mock_s3
        rel_path = "reports/s3_persist/doc.pdf"
        staging = svc.get_local_staging_path(rel_path)
        with open(staging, "wb") as f:
            f.write(b"s3 staged pdf")

        await svc.persist_file(staging, rel_path)
        mock_s3.upload_file.assert_called_once()
        # Staging file should be cleaned up after upload to S3
        assert not os.path.exists(staging)
