from pydantic import BaseModel
from typing import Optional, List

class TurnstileVerifyRequest(BaseModel):
    token: str

class TurnstileVerifyResponse(BaseModel):
    success: bool
    message: str
    challenge_ts: Optional[str] = None
    hostname: Optional[str] = None
    error_codes: Optional[List[str]] = None
    action: Optional[str] = None
    cdata: Optional[str] = None
