from typing import Generic, TypeVar, Optional, Any, Dict, List
from pydantic import BaseModel, Field

DataT = TypeVar("DataT")


class PaginationMeta(BaseModel):
    page: int = 1
    limit: int = 20
    total: int = 0
    total_pages: int = 0
    has_next: bool = False
    has_prev: bool = False


def paginate_meta(page: int, limit: int, total: int) -> PaginationMeta:
    effective_limit = limit if limit > 0 else 20
    total_pages = (total + effective_limit - 1) // effective_limit if total > 0 else 1
    return PaginationMeta(
        page=page,
        limit=effective_limit,
        total=total,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1,
    )


class APIResponse(BaseModel, Generic[DataT]):
    success: bool = True
    message: str = "Operation completed successfully"
    data: Optional[DataT] = None
    meta: Optional[PaginationMeta] = None
    errors: Optional[Dict[str, Any]] = None


class MessageResponse(BaseModel):
    message: str
