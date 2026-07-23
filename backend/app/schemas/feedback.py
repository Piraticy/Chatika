from typing import Literal, Optional

from pydantic import BaseModel, Field


class BetaFeedbackInput(BaseModel):
    rating: int = Field(ge=1, le=5)
    favorite_feature: Literal['messaging', 'calls', 'media', 'design', 'speed']
    improvement_area: Literal['reliability', 'calls', 'mobile_ui', 'notifications', 'other']
    comment: Optional[str] = Field(default=None, max_length=500)
    app_version: Optional[str] = Field(default=None, max_length=20)
    platform: Optional[str] = Field(default=None, max_length=30)
