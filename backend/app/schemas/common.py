from typing import Generic, TypeVar, Optional, Any, Dict, List
from pydantic import BaseModel, Field

DataT = TypeVar("DataT")


class PaginationMeta(BaseModel):
    page: int = 1
    limit: int = 20
    total: int = 0
    total_pages: int = 0


class APIResponse(BaseModel, Generic[DataT]):
    success: bool = True
    message: str = "Operation completed successfully"
    data: Optional[DataT] = None
    meta: Optional[PaginationMeta] = None
    errors: Optional[Dict[str, Any]] = None


class MessageResponse(BaseModel):
    message: str
