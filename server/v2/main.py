
from typing import Annotated, cast
from fastapi import Depends, FastAPI, HTTPException, Request, APIRouter
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from contextlib import asynccontextmanager
import uvicorn

import os
from supabase import acreate_client
from redis.asyncio import Redis

from common import generate_unique_id, Authentication
from endpoints import StartRequest, MetaRequest, SearchRequest, ResearchRequest, AutomateRequest
from type import State, StartClient, MetaClient, SearchClient, ResearchClient, AutomateClient

from dotenv import load_dotenv

load_dotenv()

supabase_url = os.environ.get("SUPABASE_URL")
supabase_key: str = os.environ.get("SUPABASE_KEY")

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.supabase = await acreate_client(supabase_url, supabase_key)
    app.state.redis = Redis(host="localhost", port=6379)
    print("Lifespan set", app.state.redis, app.state.supabase)
    yield
    # app.state.redis.close()

app = FastAPI(lifespan=lifespan)
model = APIRouter(lifespan=lifespan)
bearer_scheme = HTTPBearer()

async def validate_token(auth: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)], request: Request):
    app_state = cast(State, request.app.state)
    token = auth.credentials
    # key = "client:" + token
    key = "session:" + token
    if (not await app_state.redis.exists(key)):
        raise HTTPException(status_code=401, detail="Invalid token.")
    return key

@model.post("/start")
async def start_endpoint(key: Annotated[str, Depends(validate_token)], request: Request, client: StartClient):
    # try:
        app_state = cast(State, request.app.state)
        user_id = await Authentication(app_state, key, client).authenticate()
        response_id = generate_unique_id()
        start_request = StartRequest(app_state, key, client, user_id, response_id)
        response = await start_request.start()
        return JSONResponse(content=response, status_code=200)
    # except:
    #     raise HTTPException(status_code=500, detail="Internal server error.")

@model.post("/meta")
async def meta_endpoint(key: Annotated[str, Depends(validate_token)], request: Request, client: MetaClient):
    # try:
        app_state = cast(State, request.app.state)
        user_id = await Authentication(app_state, key, client).authenticate()
        response_id = generate_unique_id()
        meta_request = MetaRequest(app_state, key, client, user_id, response_id)
        response = await meta_request.process()
        return JSONResponse(content=response, status_code=200)
    # except:
    #     raise HTTPException(status_code=500, detail="Internal server error.")

@model.post("/search")
async def search_endpoint(key: Annotated[str, Depends(validate_token)], request: Request, client: SearchClient):
    # try:
        app_state = cast(State, request.app.state)
        user_id = await Authentication(app_state, key, client).authenticate()
        response_id = generate_unique_id()
        automate_request = SearchRequest(app_state, key, client, user_id, response_id)
        response = automate_request.process()
        return StreamingResponse(response, media_type="text/event-stream")
    # except:
    #     raise HTTPException(status_code=500, detail="Internal server error.")

@model.post("/research")
async def research_endpoint(key: Annotated[str, Depends(validate_token)], request: Request, client: ResearchClient):
    # try:
        app_state = cast(State, request.app.state)
        user_id = await Authentication(app_state, key, client).authenticate()
        response_id = generate_unique_id()
        research_request = ResearchRequest(app_state, key, client, user_id, response_id)
        response = research_request.process()
        return StreamingResponse(response, media_type="text/event-stream")
    # except:
    #     raise HTTPException(status_code=500, detail="Internal server error.")

@model.post("/automate")
async def automate_endpoint(key: Annotated[str, Depends(validate_token)], request: Request, client: AutomateClient):
    # try:
        app_state = cast(State, request.app.state)
        user_id = await Authentication(app_state, key, client).authenticate()
        response_id = generate_unique_id()
        automate_request = AutomateRequest(app_state, key, client, user_id, response_id)
        response = automate_request.process()
        return StreamingResponse(response, media_type="text/event-stream")
    # except:
    #     raise HTTPException(status_code=500, detail="Internal server error.")

# @model.post("/cloud")
# async def cloud_endpoint(request: CloudClient):
#     pass

app.include_router(model, prefix="/inference")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=4000, reload=False)