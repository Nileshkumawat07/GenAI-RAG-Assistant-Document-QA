from __future__ import annotations

from collections.abc import Iterable

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import AWS_REGION, AWS_S3_BUCKET, AWS_S3_URL_EXPIRATION


class StorageServiceError(RuntimeError):
    """Raised when object storage actions fail."""


class StorageService:
    def __init__(self) -> None:
        self.bucket = AWS_S3_BUCKET
        self.region = AWS_REGION
        self.default_expiration = AWS_S3_URL_EXPIRATION
        self._client = (
            boto3.client("s3", region_name=self.region or None)
            if self.bucket
            else None
        )

    @property
    def enabled(self) -> bool:
        return bool(self.bucket and self._client)

    def upload_bytes(self, *, key: str, content: bytes, content_type: str | None = None) -> str:
        if not self.enabled:
            raise StorageServiceError("S3 storage is not configured.")
        extra_args: dict[str, str] = {}
        if content_type:
            extra_args["ContentType"] = content_type
        try:
            self._client.put_object(Bucket=self.bucket, Key=key, Body=content, **extra_args)
        except (BotoCoreError, ClientError) as exc:
            raise StorageServiceError(f"Failed to upload '{key}' to S3.") from exc
        return key

    def delete_object(self, key: str | None) -> None:
        if not self.enabled or not key:
            return
        try:
            self._client.delete_object(Bucket=self.bucket, Key=key)
        except (BotoCoreError, ClientError) as exc:
            raise StorageServiceError(f"Failed to delete '{key}' from S3.") from exc

    def delete_prefix(self, prefix: str | None) -> None:
        if not self.enabled or not prefix:
            return
        continuation_token: str | None = None
        try:
            while True:
                params = {"Bucket": self.bucket, "Prefix": prefix}
                if continuation_token:
                    params["ContinuationToken"] = continuation_token
                response = self._client.list_objects_v2(**params)
                keys = [item["Key"] for item in response.get("Contents", []) if item.get("Key")]
                self._delete_keys(keys)
                if not response.get("IsTruncated"):
                    break
                continuation_token = response.get("NextContinuationToken")
        except (BotoCoreError, ClientError) as exc:
            raise StorageServiceError(f"Failed to delete S3 prefix '{prefix}'.") from exc

    def generate_download_url(
        self,
        *,
        key: str,
        download_name: str | None = None,
        content_type: str | None = None,
        expires_in: int | None = None,
    ) -> str:
        if not self.enabled:
            raise StorageServiceError("S3 storage is not configured.")
        params: dict[str, str] = {"Bucket": self.bucket, "Key": key}
        if download_name:
            safe_name = download_name.replace('"', "")
            params["ResponseContentDisposition"] = f'inline; filename="{safe_name}"'
        if content_type:
            params["ResponseContentType"] = content_type
        try:
            return self._client.generate_presigned_url(
                "get_object",
                Params=params,
                ExpiresIn=expires_in or self.default_expiration,
            )
        except (BotoCoreError, ClientError) as exc:
            raise StorageServiceError(f"Failed to generate a download URL for '{key}'.") from exc

    def _delete_keys(self, keys: Iterable[str]) -> None:
        batch = [{"Key": key} for key in keys if key]
        if not batch:
            return
        self._client.delete_objects(Bucket=self.bucket, Delete={"Objects": batch})


storage_service = StorageService()
