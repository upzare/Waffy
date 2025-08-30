from typing import Optional
from pydantic import BaseModel
from supabase import AsyncClient
from redis.asyncio import Redis

class State:
    supabase: Optional[AsyncClient]
    redis: Optional[Redis]

class BaseClientMetadata(BaseModel):
    client_id: str
    account_id: str

class BaseClient(BaseModel):
    metadata: BaseClientMetadata

class StartClientMetadata(BaseModel):
    client_id: str
    account_id: str

class StartClient(BaseModel):
    id: str
    metadata: StartClientMetadata

class MetaClientMetadata(BaseModel):
    client_id: str
    account_id: str

class MetaClient(BaseModel):
    id: str
    prompt: str
    metadata: MetaClientMetadata

class AutomateClientMetadata(BaseModel):
    client_id: str
    account_id: str
    mode: str
    message_id: Optional[str] = None

class AutomateClient(BaseModel):
    id: str
    data: list
    metadata: AutomateClientMetadata

class SearchClientMetadata(BaseModel):
    client_id: str
    account_id: str

class SearchClient(BaseModel):
    id: str
    data: list
    metadata: SearchClientMetadata

class ResearchClientMetadata(BaseModel):
    client_id: str
    account_id: str

class ResearchClient(BaseModel):
    id: str
    data: list
    metadata: ResearchClientMetadata