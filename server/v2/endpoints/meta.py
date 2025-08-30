import datetime
from fastapi import HTTPException
from typing import cast
from common import RequestHandler, ConversationDB
from type import MetaClient

import litellm
from ai.instructions.meta import TITLE_PROMPT


class MetaRequest(RequestHandler):
    def __init__(self, state, key, client, user_id, response_id):
        super().__init__(state, key, user_id, response_id)
        self.client = cast(MetaClient, client)
        self.conv_db = ConversationDB(
            state=self.state,
            user_id=self.user_id,
            conv_id=self.client.id,
            metadata=self.client.metadata
        )
    
    async def process(self):
        request_params = await self.request_handler()
        response = await litellm.aresponses(**request_params)
        if not isinstance(response, dict):
            try:
                response = response.model_dump()
            except AttributeError:
                print("response is not a dict:", response)
        
        response_params = await self.response_handler(response, request_params)
        if (response_params):
            post_params = await self.post_handler(response_params, request_params)
            if (post_params):
                result = await self.conv_db.update_metadata(post_params["title"])
                if (not result):
                    raise HTTPException(status_code=500, detail="Failed to update metadata.")
                return post_params

    async def request_handler(self):
        model_params = {
            # "model": "gpt-4.1-nano",
            "model": "groq/llama-3.3-70b-versatile",
            "stream": False,
            "input": [{'role': 'system', 'content': TITLE_PROMPT}, { "role": "user", "content": self.client.prompt }],
        }

        return model_params
    
    async def response_handler(self, chunk, request_params):
        # TODO: Update usage
        return chunk
    
    async def post_handler(self, response, request_params):
        post_params = {
            "status": "success",
            "type": "conversation.created",
            "id": self.response_id,
            "title": response["output"][0]["content"][0]["text"],
            "timestamp": datetime.datetime.now(datetime.timezone.utc).timestamp(),
            "metadata": self.client.metadata.model_dump()
        }
        return post_params