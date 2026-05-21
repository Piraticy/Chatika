from pydantic import BaseModel, Field


class PushTokenRegisterInput(BaseModel):
    platform: str = Field(pattern='^(ios|android|web)$')
    token: str = Field(min_length=12, max_length=255)
    device_name: str = Field(default='Unknown Device', max_length=120)


class PushTokenUnregisterInput(BaseModel):
    platform: str = Field(pattern='^(ios|android|web)$')
    token: str = Field(min_length=12, max_length=255)
