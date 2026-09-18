from pydantic import BaseModel

class ReglasResponse(BaseModel):
    reglas: str

class ReglasUpdate(BaseModel):
    reglas: str
