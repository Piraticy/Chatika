from pydantic import BaseModel, Field


class ApproveUserInput(BaseModel):
    user_id: str


class RemoveUserInput(BaseModel):
    user_id: str


class AddUserInput(BaseModel):
    username: str
    password: str
    phone_number: str | None = None


class ResetPasswordInput(BaseModel):
    user_id: str
    new_password: str = Field(min_length=8, max_length=120)
