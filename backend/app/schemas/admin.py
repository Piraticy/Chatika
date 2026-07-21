from pydantic import BaseModel


class ApproveUserInput(BaseModel):
    user_id: str


class RemoveUserInput(BaseModel):
    user_id: str


class AddUserInput(BaseModel):
    username: str
    password: str
    phone_number: str | None = None
