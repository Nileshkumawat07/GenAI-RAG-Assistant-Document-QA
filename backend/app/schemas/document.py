from pydantic import BaseModel


class QueryRequest(BaseModel):
    question: str


class RenameDocumentRequest(BaseModel):
    filename: str
