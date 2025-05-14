# Welcome to Cloud Functions for Firebase for Python!
# To get started, simply uncomment the below code or create your own.
# Deploy with `firebase deploy`

from firebase_functions import https_fn
from firebase_admin import initialize_app
from codebase_query import codebase_query
from card_time_estimate import estimate_card
from historical_cards import generate_embedding
from firebase_functions import firestore_fn
import json

initialize_app()

@https_fn.on_request()
def card_time_estimate(req: https_fn.Request) -> https_fn.Response:
    try:
        body = req.get_json()
        card = body["card"]
        codebase_estimate = body["codebase_estimate"]
    except Exception:
        return https_fn.Response("❌ invalid JSON", status=400)

    result = estimate_card(card, codebase_estimate)

    return https_fn.Response(
        json.dumps(result),
        headers={"Content-Type": "application/json"},
        status=200
    )

# @https_fn.on_request()
# def codebase_context(req: https_fn.Request) -> https_fn.Response:
#     try:
#         body = req.get_json()
#         card = body["card"]
#         repo_name = body["repo_name"]
#         repo_owner = body["repo_owner"]
#     except Exception:
#         return https_fn.Response("❌ invalid JSON", status=400)

#     result = codebase_query(repo_name, repo_owner, card)

#     return https_fn.Response(
#         json.dumps(result),
#         headers={"Content-Type": "application/json"},
#         status=200
#     )

# Only embeds on new historical cards, may need to switch to updates in the future. But keeping on created for no infinite loops.
@firestore_fn.on_document_created(
    document="users/{userId}/boards/{boardId}/historicalCards/{cardId}"
)
def generate_historical_card_embedding(event: firestore_fn.Event[firestore_fn.DocumentSnapshot]):
    """Fire when a historicalCard is created: compute and store its vector embedding."""
    snapshot = event.data
    if not snapshot:
        return
    data = snapshot.to_dict()
    
    vector = generate_embedding(data)
    
    snapshot.reference.update({"embedding": vector})
    
