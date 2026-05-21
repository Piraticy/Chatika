from typing import List, Optional

from pydantic import BaseModel, Field


class UserKeyBundleUpsertInput(BaseModel):
    identity_key: str = Field(min_length=16, max_length=12000)
    signed_prekey: str = Field(min_length=16, max_length=12000)
    signed_prekey_signature: str = Field(min_length=16, max_length=12000)
    one_time_prekeys: List[str] = Field(default_factory=list)


class UserKeyBundleOut(BaseModel):
    user_id: str
    identity_key: str
    signed_prekey: str
    signed_prekey_signature: str
    one_time_prekey: Optional[str]
