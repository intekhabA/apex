import asyncio
import os
import shutil
import tempfile
import logging
from typing import Optional, Union, Generator
from fastapi import HTTPException, status
from fastapi.responses import FileResponse, Response, StreamingResponse

from app.core.config import settings

logger = logging.getLogger(__name__)


class StorageService:
    """
    Unified Storage Service supporting:
    1. Local Filesystem storage (for local development & testing)
    2. AWS S3 Bucket storage (for AWS production environments)
    """

    def __init__(self):
        self._s3_client = None

    @property
    def is_s3(self) -> bool:
        """Check if S3 storage is enabled."""
        return settings.use_s3_storage

    @property
    def provider(self) -> str:
        """Return 's3' or 'local'."""
        return "s3" if self.is_s3 else "local"

    @property
    def bucket_name(self) -> str:
        """Return configured AWS S3 bucket name."""
        return settings.AWS_S3_BUCKET or "diagnolab-reports"

    def get_s3_client(self):
        """Lazy-initialize boto3 S3 client with configured AWS credentials and region."""
        if self._s3_client is None:
            try:
                import boto3
            except ImportError as err:
                raise RuntimeError(
                    "boto3 is required for AWS S3 storage provider. "
                    "Install it via `pip install boto3`."
                ) from err

            client_kwargs = {
                "service_name": "s3",
                "region_name": settings.AWS_REGION or "us-east-1",
            }
            if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
                client_kwargs["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
                client_kwargs["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY

            self._s3_client = boto3.client(**client_kwargs)
        return self._s3_client

    def normalize_key(self, path: str) -> str:
        """
        Normalize relative path or S3 key by removing redundant prefixes
        such as './', '/', 'storage/uploads/', 'storage/'.
        Example: './storage/uploads/reports/123/file.pdf' -> 'reports/123/file.pdf'
        """
        if not path:
            return ""
        clean = path.replace("\\", "/").strip()
        while clean.startswith("./") or clean.startswith("/"):
            clean = clean[2:] if clean.startswith("./") else clean[1:]
        if clean.startswith("storage/uploads/"):
            clean = clean[len("storage/uploads/") :]
        elif clean.startswith("storage/"):
            clean = clean[len("storage/") :]
        return clean

    def get_local_path(self, path: str) -> str:
        """Get absolute path on local filesystem within STORAGE_LOCAL_ROOT."""
        clean = self.normalize_key(path)
        root = os.path.abspath(settings.STORAGE_LOCAL_ROOT)
        return os.path.join(root, clean)

    def get_local_staging_path(self, rel_path: str) -> str:
        """
        Get local path to write a generated document (e.g. PDF before persistence).
        - If local: returns the final destination path in STORAGE_LOCAL_ROOT.
        - If S3: returns a temporary file path that will be uploaded and cleaned up.
        """
        clean = self.normalize_key(rel_path)
        if not self.is_s3:
            local_path = self.get_local_path(clean)
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            return local_path
        else:
            staging_dir = os.path.join(tempfile.gettempdir(), "diagnolab_staging")
            target_path = os.path.join(staging_dir, clean)
            os.makedirs(os.path.dirname(target_path), exist_ok=True)
            return target_path

    async def save_file_bytes(
        self,
        file_bytes: bytes,
        rel_path: str,
        content_type: str = "application/octet-stream",
    ) -> str:
        """
        Save binary data to storage (Local or AWS S3).
        Returns the normalized storage path / key.
        """
        key = self.normalize_key(rel_path)

        if self.is_s3:
            s3 = self.get_s3_client()
            await asyncio.to_thread(
                s3.put_object,
                Bucket=self.bucket_name,
                Key=key,
                Body=file_bytes,
                ContentType=content_type,
            )
            logger.info("Uploaded %d bytes to S3: s3://%s/%s", len(file_bytes), self.bucket_name, key)
            return key
        else:
            local_path = self.get_local_path(key)
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            await asyncio.to_thread(self._write_bytes_sync, local_path, file_bytes)
            logger.info("Saved %d bytes to local storage: %s", len(file_bytes), local_path)
            # Retain relative storage path for backwards compatibility
            rel_storage_path = os.path.relpath(local_path, start=".")
            return rel_storage_path

    @staticmethod
    def _write_bytes_sync(path: str, data: bytes):
        with open(path, "wb") as f:
            f.write(data)

    async def persist_file(
        self,
        local_path: str,
        rel_path: str,
        content_type: str = "application/octet-stream",
    ) -> str:
        """
        Persist a locally generated file (e.g. PDF from ReportLab) to storage.
        If S3: uploads to S3 bucket and cleans up local staging copy.
        If Local: ensures file resides at local destination.
        """
        key = self.normalize_key(rel_path)

        if self.is_s3:
            s3 = self.get_s3_client()
            await asyncio.to_thread(
                s3.upload_file,
                Filename=local_path,
                Bucket=self.bucket_name,
                Key=key,
                ExtraArgs={"ContentType": content_type},
            )
            logger.info("Persisted staged file to S3: s3://%s/%s", self.bucket_name, key)
            # Remove staging file after successful upload to prevent disk bloat
            if os.path.exists(local_path):
                try:
                    os.remove(local_path)
                except OSError:
                    pass
            return key
        else:
            final_local_path = self.get_local_path(key)
            if os.path.abspath(local_path) != os.path.abspath(final_local_path):
                os.makedirs(os.path.dirname(final_local_path), exist_ok=True)
                await asyncio.to_thread(shutil.move, local_path, final_local_path)
            logger.info("Persisted file locally: %s", final_local_path)
            return os.path.relpath(final_local_path, start=".")

    async def file_exists(self, rel_path: str) -> bool:
        """Check whether a file exists in the active storage provider."""
        key = self.normalize_key(rel_path)

        if self.is_s3:
            s3 = self.get_s3_client()
            from botocore.exceptions import ClientError

            try:
                await asyncio.to_thread(s3.head_object, Bucket=self.bucket_name, Key=key)
                return True
            except ClientError as e:
                status_code = e.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
                code = e.response.get("Error", {}).get("Code")
                if status_code in (404, 403) or code in ("404", "NoSuchKey", "AccessDenied"):
                    return False
                logger.error("S3 head_object error for key %s: %s", key, e)
                return False
        else:
            local_path = self.get_local_path(key)
            if os.path.exists(local_path):
                return True
            # Also check if raw rel_path exists
            if os.path.exists(rel_path):
                return True
            return False

    async def get_file_bytes(self, rel_path: str) -> bytes:
        """Retrieve binary bytes of stored file."""
        key = self.normalize_key(rel_path)

        if self.is_s3:
            s3 = self.get_s3_client()
            from botocore.exceptions import ClientError

            try:
                res = await asyncio.to_thread(s3.get_object, Bucket=self.bucket_name, Key=key)
                body = res["Body"]
                return await asyncio.to_thread(body.read)
            except ClientError as e:
                status_code = e.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
                code = e.response.get("Error", {}).get("Code")
                if status_code in (404, 403) or code in ("404", "NoSuchKey", "AccessDenied"):
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="File not found in storage.",
                    ) from e
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Storage retrieval error: {str(e)}",
                ) from e
        else:
            local_path = self.get_local_path(key)
            if not os.path.exists(local_path) and os.path.exists(rel_path):
                local_path = rel_path
            if not os.path.exists(local_path):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="File not found in local storage.",
                )
            with open(local_path, "rb") as f:
                return f.read()

    async def get_file_response(
        self,
        rel_path: str,
        filename: str,
        media_type: str = "application/pdf",
        inline: bool = False,
    ) -> Response:
        """
        Generate HTTP Response for file download or inline viewing:
        - If Local: returns FastAPI FileResponse.
        - If S3: streams object body from AWS S3 with proper headers.
        """
        key = self.normalize_key(rel_path)
        disposition = "inline" if inline else f'attachment; filename="{filename}"'

        if self.is_s3:
            s3 = self.get_s3_client()
            from botocore.exceptions import ClientError

            try:
                s3_res = await asyncio.to_thread(s3.get_object, Bucket=self.bucket_name, Key=key)
            except ClientError as e:
                status_code = e.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
                code = e.response.get("Error", {}).get("Code")
                if status_code in (404, 403) or code in ("404", "NoSuchKey", "AccessDenied"):
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Document not found in S3 storage.",
                    ) from e
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to retrieve document from S3: {str(e)}",
                ) from e

            body = s3_res["Body"]
            content_length = s3_res.get("ContentLength")

            def stream_chunks() -> Generator[bytes, None, None]:
                try:
                    while True:
                        chunk = body.read(65536)
                        if not chunk:
                            break
                        yield chunk
                finally:
                    body.close()

            headers = {"Content-Disposition": disposition}
            if content_length is not None:
                headers["Content-Length"] = str(content_length)

            return StreamingResponse(
                stream_chunks(),
                media_type=media_type,
                headers=headers,
            )
        else:
            local_path = self.get_local_path(key)
            if not os.path.exists(local_path) and os.path.exists(rel_path):
                local_path = rel_path
            if not os.path.exists(local_path):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Document not found in local storage.",
                )

            return FileResponse(
                path=local_path,
                media_type=media_type,
                filename=filename,
                headers={"Content-Disposition": disposition} if inline else None,
            )

    async def delete_file(self, rel_path: str) -> bool:
        """Delete file from storage (Local or S3)."""
        key = self.normalize_key(rel_path)

        if self.is_s3:
            s3 = self.get_s3_client()
            try:
                await asyncio.to_thread(s3.delete_object, Bucket=self.bucket_name, Key=key)
                logger.info("Deleted S3 object: s3://%s/%s", self.bucket_name, key)
                return True
            except Exception as e:
                logger.warning("Error deleting S3 object s3://%s/%s: %s", self.bucket_name, key, e)
                return False
        else:
            local_path = self.get_local_path(key)
            deleted = False
            if os.path.exists(local_path):
                try:
                    os.remove(local_path)
                    deleted = True
                except OSError as e:
                    logger.warning("Could not delete local file %s: %s", local_path, e)
            if os.path.exists(rel_path):
                try:
                    os.remove(rel_path)
                    deleted = True
                except OSError:
                    pass
            return deleted

    async def get_presigned_url(self, rel_path: str, expires_in: int = 3600) -> str:
        """Generate presigned GET URL for S3 or return relative path for local."""
        key = self.normalize_key(rel_path)
        if self.is_s3:
            s3 = self.get_s3_client()
            url = await asyncio.to_thread(
                s3.generate_presigned_url,
                ClientMethod="get_object",
                Params={"Bucket": self.bucket_name, "Key": key},
                ExpiresIn=expires_in,
            )
            return url
        return f"/storage/uploads/{key}"


storage_service = StorageService()
