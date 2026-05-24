from pydantic import BaseModel
from typing import List, Optional, Dict, Any


class Node(BaseModel):
    id: str
    name: str
    type: str
    lon: float
    lat: float
    status: str
    metadata: Optional[Dict[str, Any]] = {}
    last_update: Optional[int] = 0


class Link(BaseModel):
    id: str
    a: str
    b: str
    type: str
    capacity: float
    active: bool
    latency_ms: float
    metadata: Optional[Dict[str, Any]] = {}


class Dependency(BaseModel):
    parent: str
    child: str


class Alert(BaseModel):
    id: str
    level: str
    title: str
    message: str
    location: Optional[List[float]] = None
    ts: Optional[int] = None
