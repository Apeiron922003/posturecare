from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from deps import device_token_header, get_store
from rules_schema import RulesError, validate_rules
from schemas import RulesBody
from store import Store

router = APIRouter(prefix="/api/rules", tags=["rules"])


@router.get("")
def get_rules(store: Store = Depends(get_store), token: str = Depends(device_token_header)):
    return store.get_rules(token)


@router.put("", status_code=204)
def put_rules(
    body: RulesBody,
    store: Store = Depends(get_store),
    token: str = Depends(device_token_header),
):
    try:
        cleaned = validate_rules(body.rules)
    except RulesError as err:
        raise HTTPException(status_code=422, detail=str(err)) from err
    store.put_rules(token, cleaned)
    return None
