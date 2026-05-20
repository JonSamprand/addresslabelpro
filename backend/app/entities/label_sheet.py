from typing import List

from pydantic import BaseModel

from app.entities.label import LabelEntity


class LabelSheetEntity(BaseModel):
    """A full sheet of labels (one page)."""

    page_number: int
    labels: List[LabelEntity] = []
    template_name: str = "avery_5160"
