import datetime
from fastapi import HTTPException
from typing import cast
from common import RequestHandler, ConversationDB
from type import StartClient

class StartRequest(RequestHandler):
    def __init__(self, state, key, client, user_id, response_id):
        super().__init__(state, key, user_id, response_id)
        self.client = cast(StartClient, client)
        self.conv_db = ConversationDB(
            state=self.state,
            user_id=self.user_id,
            conv_id=self.client.id,
            metadata=self.client.metadata
        )
    
    async def start(self):
        result = await self.conv_db.start_conversation()
        if (not result):
            raise HTTPException(status_code=500, detail="Failed to start conversation.")
        return {
            "status": "success",
            "type": "conversation.initiated",
            "id": self.response_id,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).timestamp(),
            "metadata": self.client.metadata.model_dump()
        }