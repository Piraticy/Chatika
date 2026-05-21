from datetime import datetime

from pydantic import BaseModel


class BackupCreateInput(BaseModel):
    payload_json: str


class BackupOut(BaseModel):
    id: str
    created_at: datetime
    payload_json: str
