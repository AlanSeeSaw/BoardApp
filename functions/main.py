# Welcome to Cloud Functions for Firebase for Python!
# To get started, simply uncomment the below code or create your own.
# Deploy with `firebase deploy`

from firebase_functions import https_fn, options
from firebase_admin import initialize_app
from codebase_query import codebase_query
from card_time_estimate import estimate_card
from historical_cards import generate_embedding, update_historical_card_summary, update_historical_card_summary_on_delete
from firebase_functions import firestore_fn
import json

initialize_app()

@https_fn.on_call()
def card_time_estimate(req: https_fn.CallableRequest) -> dict:
    # data is the incoming payload from the client
    user_id = req.data.get("user_id")
    board_id = req.data.get("board_id")
    card = req.data.get("card")
    codebase_context = req.data.get("codebase_context")
    # Extract custom columns for time estimation
    columns = req.data.get("columns", [])
    # Delegate to estimate_card and return the result directly
    output = estimate_card(user_id, board_id, card, codebase_context, columns)
    return output

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

# TODO: Maybe recompute historical summary sometimes (or everytime) to make sure data is good.
# TODO: Create a delete function for historical cards.
# Only embeds on new historical cards, may need to switch to updates in the future. But keeping on created for no infinite loops.
@firestore_fn.on_document_created(
    document="users/{userId}/boards/{boardId}/historicalCards/{cardId}"
)
def new_historical_card(event: firestore_fn.Event[firestore_fn.DocumentSnapshot]):
    """Fire when a historicalCard is created: 
        - Compute and store its vector embedding
        - Update historical card summary
    """
    snapshot = event.data
    if not snapshot:
        return
    data = snapshot.to_dict()
    
    # Generate embedding for the historical card
    vector = generate_embedding(data)
    
    # Update historical card with embedding
    snapshot.reference.update({"embedding": vector})
    
    # Update historical cards summary
    update_historical_card_summary(snapshot.reference, data)

@firestore_fn.on_document_deleted(
    document="users/{userId}/boards/{boardId}/historicalCards/{cardId}"
)
def delete_historical_card(event: firestore_fn.Event[firestore_fn.DocumentSnapshot]):
    """Fire when a historicalCard is deleted:
        - Update historical card summary by removing its stats
    """
    print("inside delete_historical_card")
    snapshot = event.data
    if not snapshot:
        return
    data = snapshot.to_dict()

    update_historical_card_summary_on_delete(snapshot.reference, data)
