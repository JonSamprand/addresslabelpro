from typing import Generic, Optional, TypeVar

from pydantic import BaseModel

from app.shared.errors import AppError

T = TypeVar("T")


class Result(BaseModel, Generic[T]):
    success: bool
    data: Optional[T] = None
    error: Optional[AppError] = None

    @classmethod
    def ok(cls, data: T) -> "Result[T]":
        return cls(success=True, data=data)

    @classmethod
    def fail(cls, error: AppError) -> "Result[T]":
        return cls(success=False, error=error)

    def fold(self, *, on_success, on_error):
        if self.success and self.data is not None:
            return on_success(self.data)
        if self.error is not None:
            return on_error(self.error)
        return on_error(AppError(code="unknown", message="Unknown error"))
