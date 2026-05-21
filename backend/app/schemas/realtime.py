from typing import Any, Dict, List

from pydantic import BaseModel


class IceConfigOut(BaseModel):
    force_turn: bool
    ice_servers: List[Dict[str, Any]]
