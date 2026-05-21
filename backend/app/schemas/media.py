from pydantic import BaseModel, Field


class MediaPreferenceInput(BaseModel):
    storage_mode: str = Field(pattern='^(device|app)$')


class MediaPreferenceOut(BaseModel):
    user_id: str
    storage_mode: str
